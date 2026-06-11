from sqlalchemy import create_engine, text
from sentence_transformers import SentenceTransformer
from datetime import date, datetime
from upstash_redis import Redis
from dotenv import load_dotenv
import pandas as pd
import logging
import requests
import redis
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)

# r = redis.Redis(
#     host=os.getenv("REDIS_HOST"),
#     port=int(os.getenv("REDIS_PORT", 6379)),
#     decode_responses=True
# )

redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN")
)


def fetch_and_process_data():
    logger.info("Fetching latest inspection date from database...")
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT MAX(inspection_date) FROM inspections"))
        latest_date = result.scalar()
    
    # Build API params
    url = "https://data.cityofnewyork.us/resource/43nn-pn8j.json"
    params = {
        "$limit": 10000,
        "$order": "inspection_date ASC"
    }
    
    if latest_date:
        logger.info(f"Fetching records after {latest_date}...")
        params["$where"] = f"inspection_date > '{latest_date}'"
    else:
        logger.info("No existing data found. Fetching full dataset...")
    
    # Fetch with pagination
    all_records = []
    offset = 0

    while True:
        params["$offset"] = offset
        response = requests.get(url, params=params, timeout=60)
        
        if response.status_code != 200:
            raise Exception(f"API request failed: {response.status_code}")
        
        records = response.json()
        if not records:
            break
            
        all_records.extend(records)
        offset += 10000
        logger.info(f"Fetched {len(all_records)} records so far...")
        
        if len(records) < 10000:
            break

    if not all_records:
        logger.info("No new records found. Database is up to date.")
        return None

    logger.info(f"Total new records fetched: {len(all_records)}")
    
    # Convert to DataFrame and return
    df = pd.DataFrame(all_records)
    logger.info(f"Returning raw DataFrame with {len(df)} rows")
    
    return df


def create_tables():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS restaurants (
                camis BIGINT PRIMARY KEY,
                dba VARCHAR(255),
                boro VARCHAR(50),
                cuisine_description VARCHAR(255)
            )
        """))
    
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS inspections (
                inspection_id SERIAL PRIMARY KEY,
                camis BIGINT REFERENCES restaurants(camis),
                inspection_date DATE,
                action VARCHAR(255),
                violation_code VARCHAR(50),
                violation_description TEXT,
                critical_flag VARCHAR(50),
                score FLOAT,
                grade VARCHAR(10),
                grade_date DATE,
                record_date DATE,
                inspection_type VARCHAR(255)
            )
        """))

        conn.commit()
        print("Tables created successfully")


def load_inspections_restaurants_data(df):
    df.drop(columns = ["building", "street", "zipcode", "phone", "latitude", "longitude", "community_board", "council_district", "census_tract", "bin", "bbl", "nta", "location"], inplace=True)
    df.dropna(subset=["violation_description"], inplace=True)

    date_cols = ['inspection_date', 'grade_date', 'record_date']
    df[date_cols] = df[date_cols].apply(pd.to_datetime)
    df['critical_flag'] = df['critical_flag'].astype('category')
    df['cuisine_description'] = df['cuisine_description'].fillna('Unknown')

    restaurant_df = df[["camis", "dba", "boro", "cuisine_description"]].drop_duplicates(subset=["camis"]).copy()
    inspections_df = df[["camis", "inspection_date", "action", "violation_code", "violation_description", "critical_flag", "score", "grade", "grade_date", "record_date", "inspection_type"]].copy()

    # Insert data into the database
    with engine.connect() as conn:
        existing_camis = pd.read_sql(
            "SELECT camis FROM restaurants",
            conn
        )["camis"]

        restaurant_df["camis"] = restaurant_df["camis"].astype(int)

        restaurant_df = restaurant_df[
            ~restaurant_df["camis"].isin(existing_camis)
        ]

        restaurant_df.to_sql("restaurants", conn, if_exists="append", index=False)
        inspections_df.to_sql("inspections", conn, if_exists="append", index=False)

        conn.commit()
        print("Data inserted successfully")

def load_violation_codes_data():
    # Load official violation codes
    url = "https://raw.githubusercontent.com/nychealth/Food-Safety-Health-Code-Reference/main/Violation-Health-Code-Mapping.csv"
    df = pd.read_csv(url)

    # Tier mapping based on official NYC DOH terminology
    tier_mapping = {
        # Public Health Hazard - 7 points
        'COOKING': ('public_health_hazard', 7),
        'HOT HOLDING': ('public_health_hazard', 7),
        'COLD HOLDING': ('public_health_hazard', 7),
        'REHEATING & HOT HOLDING': ('public_health_hazard', 7),
        'COOLING & REFRIGERATION': ('public_health_hazard', 7),
        'CONTAMINATION': ('public_health_hazard', 7),
        'ADULTERATED': ('public_health_hazard', 7),
        'REDUCE OXYGEN PACKAGE': ('public_health_hazard', 7),
        'TEMPERATURE REGULATING': ('public_health_hazard', 7),

        # Critical - 5 points
        'PEST CONTROL': ('critical', 5),
        'FOOD PROTECTION': ('critical', 5),
        'FOOD WORKERS': ('critical', 5),
        'HANDWASH/TOILET': ('critical', 5),
        'UNAPPROVED SOURCE': ('critical', 5),
        'HACCP PLAN': ('critical', 5),

        # General - 2 points
        'PLUMBING': ('general', 2),
        'WAREWASHING': ('general', 2),
        'UTENSILS': ('general', 2),
        'EQUIPMENT': ('general', 2),
        'FACILITY': ('general', 2),
        'MAINTENANCE, CONSTRUCTION & PLACEMENT': ('general', 2),
        'LIGHT, HEAT & VENTILATION': ('general', 2),
    }

    def get_tier(category):
        result = tier_mapping.get(category)
        if result:
            return result
        return ('general', 2)

    # Build violation_codes dataframe
    violation_df = df[['Violation_Code', 'Category_Description']].drop_duplicates(subset=['Violation_Code'])
    violation_df.columns = ['violation_code', 'category']
    violation_df['risk_tier'] = violation_df['category'].apply(lambda x: get_tier(x)[0])
    violation_df['base_points'] = violation_df['category'].apply(lambda x: get_tier(x)[1])

    # Load to PostgreSQL
    violation_df.to_sql('violation_codes', engine, if_exists='replace', index=False)
    print(f"Loaded {len(violation_df)} violation codes")
    print(violation_df['risk_tier'].value_counts())


def compute_violation_embeddings():
    # Load sentence transformer model
    print("Loading embedding model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # Fetch all inspections with violation descriptions
    print("Fetching violation data...")
    query = """
        SELECT 
            camis,
            STRING_AGG(violation_description, ' | ') as violation_text
        FROM inspections
        WHERE violation_description IS NOT NULL
        GROUP BY camis
    """
    df = pd.read_sql(query, engine)
    print(f"Found {len(df)} restaurants with violations")

    # Generate embeddings
    print("Generating embeddings...")
    embeddings = model.encode(df['violation_text'].tolist(), show_progress_bar=True)

    # Store in database
    print("Storing embeddings...")
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM violation_embeddings"))
        for idx, row in df.iterrows():
            conn.execute(text("""
                INSERT INTO violation_embeddings (camis, violation_text, embedding)
                VALUES (:camis, :violation_text, :embedding)
            """), {
                "camis": int(row['camis']),
                "violation_text": row['violation_text'],
                "embedding": embeddings[idx].tolist()
            })
        conn.commit()

    print(f"Done. Stored embeddings for {len(df)} restaurants")


def normalize(series, invert=False):
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val:
        return pd.Series([0] * len(series), index=series.index)
    normalized = (series - min_val) / (max_val - min_val) * 100
    if invert:
        normalized = 100 - normalized
    return normalized


def calculate_risk_scores():
    # 1. Fetch all inspections joined with violation codes
    query = """
        SELECT 
            i.camis,
            i.inspection_date,
            i.violation_code,
            i.critical_flag,
            i.score,
            v.risk_tier,
            v.base_points
        FROM inspections i
        LEFT JOIN violation_codes v ON i.violation_code = v.violation_code
        WHERE i.inspection_date IS NOT NULL
    """
    df = pd.read_sql(query, engine)
    df['inspection_date'] = pd.to_datetime(df['inspection_date'])
    today = pd.Timestamp(date.today())

    results = []

    for camis, group in df.groupby('camis'):

        # Metric 1 - Weighted violation score (weight: 30)
        valid = group[group['base_points'].notna()]
        weighted_score = valid['base_points'].mean() if len(valid) > 0 else 0

        # Metric 2 - Repeat violations (weight: 20)
        violation_counts = group['violation_code'].value_counts()
        total_inspections = group['inspection_date'].nunique()

        # Sum of excess occurrences (occurrences beyond first) normalized by inspections
        repeat_score = sum(
            count - 1 for count in violation_counts if count > 1
        ) / total_inspections if total_inspections > 0 else 0

        # Metric 3 - Violation category mix (weight: 20)
        total = len(group[group['violation_code'].notna()])
        phh_count = len(group[group['risk_tier'] == 'public_health_hazard'])
        category_mix = (phh_count / total * 100) if total > 0 else 0

        # Metric 4 - Recency of violations (weight: 15)
        critical_dates = group[
            group['risk_tier'].isin(['public_health_hazard', 'critical'])
        ]['inspection_date']
        if len(critical_dates) > 0:
            days_since_critical = (today - critical_dates.max()).days
        else:
            days_since_critical = 9999

        # Metric 5 - Violation trend (weight: 10)
        inspection_scores = group.groupby('inspection_date')['score'].first().dropna().sort_index()
        if len(inspection_scores) >= 6:
            recent_avg = inspection_scores.iloc[-3:].mean()
            previous_avg = inspection_scores.iloc[-6:-3].mean()
            trend_delta = recent_avg - previous_avg
        elif len(inspection_scores) >= 2:
            recent_avg = inspection_scores.iloc[-1]
            previous_avg = inspection_scores.iloc[0]
            trend_delta = recent_avg - previous_avg
        else:
            trend_delta = 0
        
        def assign_trend(delta):
            if delta > 5:
                return 'Declining'
            elif delta < -5:
                return 'Improving'
            else:
                return 'Stable'

        # Metric 6 - Days since last inspection (weight: 5)
        days_since_inspection = (today - group['inspection_date'].max()).days

        results.append({
            'camis': camis,
            'weighted_violation_score': weighted_score,
            'repeat_violations': repeat_score,
            'category_mix': category_mix,
            'days_since_critical': days_since_critical,
            'trend_delta': trend_delta,
            'trend': assign_trend(trend_delta),
            'days_since_inspection': days_since_inspection
        })

    # 2. Build results dataframe
    scores_df = pd.DataFrame(results)

    # 3. Normalize each metric
    scores_df['n_weighted'] = normalize(scores_df['weighted_violation_score'])
    scores_df['n_repeat'] = normalize(scores_df['repeat_violations'])
    scores_df['n_category'] = normalize(scores_df['category_mix'])
    scores_df['n_recency'] = normalize(scores_df['days_since_critical'], invert=True)
    scores_df['n_trend'] = normalize(scores_df['trend_delta'])
    scores_df['n_days'] = normalize(scores_df['days_since_inspection'])

    # 4. Apply weights
    scores_df['risk_score'] = (
        scores_df['n_weighted'] * 0.30 +
        scores_df['n_repeat'] * 0.20 +
        scores_df['n_category'] * 0.20 +
        scores_df['n_recency'] * 0.15 +
        scores_df['n_trend'] * 0.10 +
        scores_df['n_days'] * 0.05
    ).round(2)

    # 5. Compute citywide percentile
    scores_df['risk_percentile'] = (
        scores_df['risk_score'].rank(pct=True) * 100
    ).round(2)

    # 6. Assign criticality
    def assign_criticality(percentile):
        if percentile >= 90:
            return 'High'
        elif percentile >= 70:
            return 'Medium'
        else:
            return 'Low'

    scores_df['criticality'] = scores_df['risk_percentile'].apply(assign_criticality)

    # 7. Store in risk_scores table
    output = scores_df[['camis', 'risk_score', 'risk_percentile', 'criticality', 'trend']].copy()
    output['computed_at'] = today

    output.to_sql('risk_scores', engine, if_exists='replace', index=False)
    print(f"Risk scores computed for {len(output)} restaurants")
    print(output['criticality'].value_counts())

    return output


def main():
    start_time = datetime.now()
    logger.info("Starting SafePlate data refresh pipeline...")
    
    try:
        # Step 0 - Fetch new data from NYC Open Data
        logger.info("Step 0/5: Fetching new data from NYC Open Data...")
        df = fetch_and_process_data()
        print(f"✓ Fetched {len(df) if df is not None else 0} new records from API")
        
        if df is not None:
            # Step 1 - Create tables
            logger.info("Step 1/5: Creating tables...")
            # create_tables()
            logger.info("✓ Tables ready")
            
            # Step 2 - Load restaurant and inspection data
            logger.info("Step 2/5: Loading restaurant and inspection data...")
            load_inspections_restaurants_data(df)
            logger.info("✓ Restaurant and inspection data loaded")
        
            # Step 3 - Load violation codes
            logger.info("Step 3/5: Loading violation codes...")
            # load_violation_codes_data()
            logger.info("✓ Violation codes loaded")
            
            # Step 4 - Compute violation embeddings
            logger.info("Step 4/5: Computing violation embeddings...")
            compute_violation_embeddings()
            logger.info("✓ Embeddings computed")
            
            # Step 5 - Calculate risk scores
            logger.info("Step 5/5: Calculating risk scores...")
            calculate_risk_scores()
            logger.info("✓ Risk scores calculated")
            
            #step 6 - Clear Redis cache
            if df is not None and not df.empty:
                redis_client.flushdb()
                logger.info("✓ Redis database cleared.")

        elapsed = datetime.now() - start_time
        logger.info(f"Pipeline completed successfully in {elapsed}")
        
    except Exception as e:
        logger.error(f"Pipeline failed at step: {str(e)}")
        raise

if __name__ == "__main__":
    main()