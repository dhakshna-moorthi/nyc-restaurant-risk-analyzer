from urllib import response
import json
import os
from openai import OpenAI
from sqlalchemy import text as sql_text
from dotenv import load_dotenv
from app.services.redis_service import get_cached, set_cached
from app.services.rag_service import get_similar_restaurants
from app.schemas import AIInsights
from sqlalchemy import text
from datetime import date, timedelta

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_risk_insights(restaurant_data: dict, db) -> dict:
    camis = restaurant_data['restaurant']['camis']
    cache_key = f"llm_insights:{restaurant_data['restaurant']['camis']}"
    
    # Check cache first
    cached = get_cached(cache_key)
    if cached:
        return json.loads(cached)
    
    restaurant = restaurant_data['restaurant']
    metrics = restaurant_data['risk_metrics']

    # Fetch this restaurant's violation text from embeddings table
    violation_row = db.execute(sql_text("""
        SELECT violation_text 
        FROM violation_embeddings 
        WHERE camis = :camis
    """), {"camis": camis}).fetchone()

    violation_text = violation_row.violation_text if violation_row else "no violations"
    
    # RAG - get similar restaurants by violation pattern
    similar_by_violation = get_similar_restaurants(
        camis=camis,
        violation_text=violation_text,
        db=db,
        limit=10
    )
    
    # SQL - get similar restaurants by cuisine + area
    similar_by_cuisine_area = db.execute(text("""
        SELECT 
            r.dba,
            rs.risk_score,
            rs.trend,
            rs.criticality,
            CURRENT_DATE - MAX(i.inspection_date) as days_since_inspection
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        JOIN inspections i ON r.camis = i.camis
        WHERE r.cuisine_description = :cuisine
        AND r.boro = :boro
        AND r.camis != :camis
        GROUP BY r.dba, rs.risk_score, rs.trend, rs.criticality
        ORDER BY rs.risk_score DESC
        LIMIT 10
    """), {
        "cuisine": restaurant['cuisine_description'],
        "boro": restaurant['boro'],
        "camis": camis
    }).fetchall()
    
    similar_cuisine_area = [dict(r._mapping) for r in similar_by_cuisine_area]
    
    # Build prompt
    prompt = f"""You are a NYC health inspection analyst. Analyze this restaurant and generate insights for a health inspector.

    RESTAURANT PROFILE:
    - Name: {restaurant['dba']}
    - Area: {restaurant['boro']}
    - Cuisine: {restaurant['cuisine_description']}
    - Risk Score: {restaurant['risk_score']} (citywide percentile: {restaurant['risk_percentile']}%)
    - Criticality: {restaurant['criticality']}
    - Trend: {restaurant['trend']}
    - Days Since Last Inspection: {restaurant['days_since_inspection']}
    - Current Grade: {restaurant['grade']}
    - Critical Violation Ratio: {next((r['percentage'] for r in metrics['critical_ratio'] if r['critical_flag'] == 'Critical'), 0)}%
    - Repeat Violations: {[r['violation_code'] for r in metrics['repeat_violations']]}
    - Neighborhood Percentile: {metrics['neighborhood_percentile']}%
    - Cuisine Percentile: {metrics['cuisine_percentile']}%

    SIMILAR RESTAURANTS BY VIOLATION PATTERN (RAG):
    {json.dumps([{
        'name': r['dba'],
        'risk_score': r['risk_score'],
        'trend': r['trend'],
        'criticality': r['criticality']
    } for r in similar_by_violation[:10]], indent=2)}

    SIMILAR RESTAURANTS BY CUISINE AND AREA:
    {json.dumps([{
        'name': r['dba'],
        'risk_score': r['risk_score'],
        'trend': r['trend'],
        'days_since_inspection': r['days_since_inspection']
    } for r in similar_cuisine_area], indent=2)}

    Based on all this data, generate:
    1. A risk narrative (3-4 sentences) explaining the key risk factors and patterns
    2. Three specific actionable recommendations for the inspector
    3. One key pattern insight based on similar restaurants

    Respond ONLY in this exact JSON format with no other text:
    {{
        "narrative": "3-4 sentence risk explanation",
        "recommendations": [
            "Specific recommendation 1",
            "Specific recommendation 2",
            "Specific recommendation 3"
        ],
        "pattern_insight": "One key insight from similar restaurant data"
    }}
    
    IMPORTANT: Return ONLY the raw JSON object. No markdown. No ```json. No backticks. No explanation. Start your response with {{ and end with }}.
    """

    response = client.chat.completions.create(
        model="gpt-5.4-nano",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    response_text = response.choices[0].message.content.strip()
    print("Raw LLM response (risk insights):", response_text)

    # Remove markdown code blocks
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()


    try:
        result = json.loads(response_text)
        # Validate against schema
        validated = AIInsights(**result)
        result = validated.dict()
    except json.JSONDecodeError:
        result = {
            "narrative": response_text[:500],
            "recommendations": ["Please retry for detailed recommendations"],
            "pattern_insight": "Unable to parse insights"
        }
    
    # Cache for 30 days
    set_cached(cache_key, json.dumps(result), ttl_days=30)
    
    return result


def generate_daily_briefing(home_data: dict) -> list:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    cache_key = f"weekly_briefing:{monday}"
    
    # Check cache first
    cached = get_cached(cache_key)
    if cached:
        return json.loads(cached)
    
    stats = home_data['stats']
    area_summary = home_data['area_summary']
    cuisine_summary = home_data['cuisine_summary']
    heatmap = home_data['heatmap']
    recent_avg = home_data['recent_avg']
    previous_avg = home_data['previous_avg']
    
    trend_direction = "worsening" if recent_avg > previous_avg else "improving"

    # Borough summary
    area_json = json.dumps([
        {
            "borough": row["boro"],
            "avg_risk_score": float(row["avg_risk_score"]),
            "restaurant_count": row["restaurant_count"],
            "high_risk_count": row["high_count"]
        }
        for row in area_summary
    ])

    # Top cuisines
    cuisine_json = json.dumps([
        {
            "cuisine": row["cuisine_description"],
            "avg_risk_score": float(row["avg_risk_score"]),
            "restaurant_count": row["restaurant_count"]
        }
        for row in cuisine_summary[:10]
    ])

    # Highest-risk borough/cuisine combinations
    heatmap_json = json.dumps(
        sorted(
            heatmap,
            key=lambda x: x["high_risk_percentage"],
            reverse=True
        )[:15]
    )
    
    prompt = f"""You are a NYC health inspection analyst. Generate exactly 5 actionable insights for health inspectors based on today's data.

    DATA:
    - Total restaurants: {stats['total_restaurants']}
    - High risk: {stats['high_risk_count']} ({round(stats['high_risk_count']/stats['total_restaurants']*100, 1)}%)
    - Overdue for inspection (180+ days): {stats['overdue_count']}
    - Avg risk score: {stats['avg_risk_score']}
    - Score trend: {trend_direction} (recent avg: {recent_avg}, previous avg: {previous_avg})

    Borough breakdown:
    {area_json}

    Top riskiest cuisines:
    {cuisine_json}

    Highest risk combinations (borough x cuisine):
    {heatmap_json}

    Generate exactly 5 insights. Each must:
    - Be one sentence
    - Include specific numbers from the data
    - Be directly actionable for an inspector

    Return ONLY a JSON array, no markdown, no backticks:
    ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]"""

    response = client.chat.completions.create(
        model="gpt-5.4-nano",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    response_text = response.choices[0].message.content.strip()
    print("Raw LLM response (daily briefing):", response_text)
    
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()
    
    try:
        insights = json.loads(response_text)
    except json.JSONDecodeError:
        insights = ["Unable to generate insights at this time. Please try again."]
    
    set_cached(cache_key, json.dumps(insights), ttl_days=7)
    
    return insights
