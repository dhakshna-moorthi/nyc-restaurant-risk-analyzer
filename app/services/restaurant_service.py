from app.services.llm_service import generate_daily_briefing
from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date, datetime, timedelta


def serialize_row(row: dict) -> dict:
    result = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        elif isinstance(value, (date, datetime)):
            result[key] = str(value)
        elif isinstance(value, timedelta):
            result[key] = value.days
        else:
            result[key] = value
    return result


def get_home_data(db: Session):
    
    # Overall stats
    stats = db.execute(text("""
        SELECT
            COUNT(*) as total_restaurants,
            COUNT(CASE WHEN rs.criticality = 'High' THEN 1 END) as high_risk_count,
            COUNT(CASE WHEN CURRENT_DATE - latest.last_inspection > 180 THEN 1 END) as overdue_count,
            ROUND(AVG(rs.risk_score)::numeric, 1) as avg_risk_score
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        JOIN (
            SELECT camis, MAX(inspection_date) as last_inspection
            FROM inspections GROUP BY camis
        ) latest ON r.camis = latest.camis
    """)).fetchone()

    # Top 10 urgent restaurants
    urgent = db.execute(text("""
        SELECT 
            r.camis, r.dba, r.boro, r.cuisine_description,
            rs.risk_score, rs.criticality, rs.trend,
            CURRENT_DATE - MAX(i.inspection_date) as days_since_inspection
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        JOIN inspections i ON r.camis = i.camis
        WHERE rs.criticality = 'High'
        GROUP BY r.camis, r.dba, r.boro, r.cuisine_description,
                 rs.risk_score, rs.criticality, rs.trend
        HAVING CURRENT_DATE - MAX(i.inspection_date) > 180
        ORDER BY rs.risk_score DESC
        LIMIT 10
    """)).fetchall()

    # NYC score trend over time
    score_trend = db.execute(text("""
        SELECT 
            DATE_TRUNC('month', inspection_date) as month,
            ROUND(AVG(score)::numeric, 2) as avg_score
        FROM inspections
        WHERE inspection_date IS NOT NULL
        AND score IS NOT NULL
        GROUP BY DATE_TRUNC('month', inspection_date)
        ORDER BY month ASC
    """)).fetchall()

    # Compute trend comparison
    # Convert to dicts with serialization
    score_trend_dicts = [serialize_row(dict(r._mapping)) for r in score_trend]

    # Compute trend averages
    score_list = [r['avg_score'] for r in score_trend_dicts]
    if len(score_list) >= 6:
        recent_avg = round(sum(score_list[-3:]) / 3, 2)
        previous_avg = round(sum(score_list[-6:-3]) / 3, 2)
    else:
        recent_avg = score_list[-1] if score_list else 0
        previous_avg = score_list[0] if score_list else 0
    

    # Compute trend averages
    score_list = [r['avg_score'] for r in score_trend_dicts]
    if len(score_list) >= 6:
        recent_avg = round(sum(score_list[-3:]) / 3, 2)
        previous_avg = round(sum(score_list[-6:-3]) / 3, 2)
    else:
        recent_avg = score_list[-1] if score_list else 0
        previous_avg = score_list[0] if score_list else 0
    
    # Inspection gap distribution
    inspection_gap = db.execute(text("""
        SELECT 
        CASE 
            WHEN CURRENT_DATE - last_inspection <= 30 THEN '0-30 days'
            WHEN CURRENT_DATE - last_inspection <= 90 THEN '31-90 days'
            WHEN CURRENT_DATE - last_inspection <= 180 THEN '91-180 days'
            WHEN CURRENT_DATE - last_inspection <= 365 THEN '181-365 days'
            ELSE '365+ days'
        END as gap_bucket,
        COUNT(*) as restaurant_count
    FROM (
        SELECT camis, MAX(inspection_date) as last_inspection
        FROM inspections
        GROUP BY camis
    ) latest
    GROUP BY gap_bucket
    ORDER BY MIN(CURRENT_DATE - last_inspection)
    """)).fetchall()

    # Heatmap data for high-risk restaurants
    heatmap = db.execute(text("""
        SELECT 
            r.boro,
            r.cuisine_description,
            COUNT(CASE WHEN rs.criticality = 'High' THEN 1 END) as high_risk_count,
            COUNT(*) as total_count,
            ROUND(
                COUNT(CASE WHEN rs.criticality = 'High' THEN 1 END) * 100.0 / COUNT(*),
                1
            ) as high_risk_percentage
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        WHERE r.cuisine_description IN (
            SELECT cuisine_description 
            FROM restaurants 
            GROUP BY cuisine_description 
            ORDER BY COUNT(*) DESC 
            LIMIT 10
        )
        AND r.boro IN ('Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island')
        GROUP BY r.boro, r.cuisine_description
        ORDER BY r.boro, high_risk_count DESC
    """)).fetchall()

    # Compute heatmap totals
    heatmap_data = [serialize_row(dict(r._mapping)) for r in heatmap]

    # Get unique boroughs and cuisines
    boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
    cuisines = list(dict.fromkeys([r['cuisine_description'] for r in heatmap_data]))

    # Build borough totals
    borough_totals = {}
    for boro in boroughs:
        boro_rows = [r for r in heatmap_data if r['boro'] == boro]
        total_high = sum(r['high_risk_count'] for r in boro_rows)
        total_all = sum(r['total_count'] for r in boro_rows)
        borough_totals[boro] = {
            'high_risk_count': total_high,
            'total_count': total_all,
            'high_risk_percentage': round(total_high * 100 / total_all, 1) if total_all > 0 else 0
        }

    # Build cuisine totals
    cuisine_totals = {}
    for cuisine in cuisines:
        cuisine_rows = [r for r in heatmap_data if r['cuisine_description'] == cuisine]
        total_high = sum(r['high_risk_count'] for r in cuisine_rows)
        total_all = sum(r['total_count'] for r in cuisine_rows)
        cuisine_totals[cuisine] = {
            'high_risk_count': total_high,
            'total_count': total_all,
            'high_risk_percentage': round(total_high * 100 / total_all, 1) if total_all > 0 else 0
        }

    # Grand total
    total_high_all = sum(r['high_risk_count'] for r in heatmap_data)
    total_all_all = sum(r['total_count'] for r in heatmap_data)
    grand_total = {
        'high_risk_count': total_high_all,
        'total_count': total_all_all,
        'high_risk_percentage': round(total_high_all * 100 / total_all_all, 1) if total_all_all > 0 else 0
    }

    # Area summary for briefing
    area_summary = db.execute(text("""
        SELECT 
            r.boro,
            ROUND(AVG(rs.risk_score)::numeric, 2) as avg_risk_score,
            COUNT(*) as restaurant_count,
            COUNT(CASE WHEN rs.criticality = 'High' THEN 1 END) as high_count
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        WHERE r.boro IN ('Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island')
        GROUP BY r.boro
        ORDER BY avg_risk_score DESC
    """)).fetchall()

    # Cuisine summary for briefing
    cuisine_summary = db.execute(text("""
        SELECT 
            r.cuisine_description,
            ROUND(AVG(rs.risk_score)::numeric, 2) as avg_risk_score,
            COUNT(*) as restaurant_count
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        WHERE r.cuisine_description IN (
            SELECT cuisine_description 
            FROM restaurants 
            GROUP BY cuisine_description 
            ORDER BY COUNT(*) DESC 
            LIMIT 10
        )
        GROUP BY r.cuisine_description
        ORDER BY avg_risk_score DESC
    """)).fetchall()
    

    result = {
        "stats": serialize_row(dict(stats._mapping)),
        "urgent_restaurants": [serialize_row(dict(r._mapping)) for r in urgent],
        "area_summary": [dict(r._mapping) for r in area_summary],
        "cuisine_summary": [dict(r._mapping) for r in cuisine_summary],
        "score_trend": score_trend_dicts,
        "recent_avg": recent_avg,
        "previous_avg": previous_avg,
        "inspection_gap": [serialize_row(dict(r._mapping)) for r in inspection_gap],
        "heatmap": heatmap_data,
        "heatmap_totals": {
            "borough_totals": borough_totals,
            "cuisine_totals": cuisine_totals,
            "grand_total": grand_total
        }
    }

    result["daily_briefing"] = generate_daily_briefing(result)
    # result["daily_briefing"] = []

    return result


def get_restaurants_service(
    db: Session,
    search: str = None,
    boro: str = None,
    cuisine: str = None,
    criticality: str = None,
    violation_code: str = None,
    trend: str = None,
    sort_by: str = "risk_score",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20
):
    base_query = """
        SELECT 
            r.camis,
            r.dba as restaurant_name,
            r.boro as area,
            r.cuisine_description,
            COUNT(i.inspection_id) as total_inspections,
            SUM(CASE WHEN i.critical_flag = 'Critical' THEN 1 ELSE 0 END) as critical_violation_count,
            CURRENT_DATE - MAX(i.inspection_date) as days_since_last_inspection,
            (SELECT i2.violation_code 
            FROM inspections i2 
            WHERE i2.camis = r.camis 
            ORDER BY i2.inspection_date DESC 
            LIMIT 1) as last_violation_code,
            rs.risk_score,
            rs.risk_percentile,
            rs.criticality,
            rs.trend
        FROM restaurants r
        LEFT JOIN inspections i ON r.camis = i.camis
        LEFT JOIN risk_scores rs ON r.camis = rs.camis
    """

    filters = []
    params = {}

    if search:
        filters.append("(r.dba ILIKE :search OR CAST(r.camis AS TEXT) LIKE :search)")
        params["search"] = f"%{search}%"
    if boro:
        filters.append("r.boro = :boro")
        params["boro"] = boro
    if cuisine:
        filters.append("r.cuisine_description ILIKE :cuisine")
        params["cuisine"] = f"%{cuisine}%"
    if criticality:
        filters.append("rs.criticality = :criticality")
        params["criticality"] = criticality
    if trend:
        filters.append("rs.trend = :trend")
        params["trend"] = trend
    

    if filters:
        base_query += " WHERE " + " AND ".join(filters)

    base_query += " GROUP BY r.camis, r.dba, r.boro, r.cuisine_description, rs.risk_score, rs.risk_percentile, rs.criticality, rs.trend"

    allowed_sort_columns = { "restaurant_name", "area", "cuisine_description",
        "total_inspections", "critical_violation_count",
        "days_since_last_inspection", "risk_score", "risk_percentile", "criticality", "trend"
    }

    if sort_by in allowed_sort_columns:
        sort_order = "DESC" if sort_order.lower() == "desc" else "ASC"
        base_query += f" ORDER BY {sort_by} {sort_order}"

    offset = (page - 1) * page_size
    base_query += " LIMIT :page_size OFFSET :offset"
    params["page_size"] = page_size
    params["offset"] = offset

    result = db.execute(text(base_query), params)
    rows = result.fetchall()

    count_query = """
        SELECT COUNT(DISTINCT r.camis)
        FROM restaurants r
        LEFT JOIN inspections i ON r.camis = i.camis
        LEFT JOIN risk_scores rs ON r.camis = rs.camis
    """

    if filters:
        count_query += " WHERE " + " AND ".join(filters)

    total_count = db.execute(text(count_query), params).scalar()

    kpi_query = """
        SELECT 
            COUNT(CASE WHEN rs.criticality = 'High' THEN 1 END) as high_risk_count,
            COUNT(CASE WHEN CURRENT_DATE - latest.last_inspection > 180 THEN 1 END) as overdue_count,
            COUNT(CASE WHEN rs.trend = 'Declining' THEN 1 END) as declining_count,
            ROUND(AVG(rs.risk_score)::numeric, 1) as avg_risk_score
        FROM restaurants r
        LEFT JOIN (
            SELECT camis, MAX(inspection_date) as last_inspection
            FROM inspections
            GROUP BY camis
        ) latest ON r.camis = latest.camis
        LEFT JOIN risk_scores rs ON r.camis = rs.camis
    """

    if filters:
        kpi_query += " WHERE " + " AND ".join(filters)

    kpi_result = db.execute(text(kpi_query), params).fetchone()

    return {
        "data": [dict(row._mapping) for row in rows],
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "kpis": {
            "high_risk_count": kpi_result.high_risk_count or 0,
            "overdue_count": kpi_result.overdue_count or 0,
            "declining_count": kpi_result.declining_count or 0,
            "avg_risk_score": float(kpi_result.avg_risk_score or 0)
        }
    }


def get_restaurant_detail(camis: int, page: int = 1, db: Session = None):
    
    # Query 1 - Basic info
    restaurant = db.execute(text("""
        SELECT 
            r.camis, r.dba, r.boro, r.cuisine_description,
            rs.risk_score, rs.risk_percentile, rs.criticality, rs.trend
        FROM restaurants r
        LEFT JOIN risk_scores rs ON r.camis = rs.camis
        WHERE r.camis = :camis
    """), {"camis": camis}).fetchone()

    if not restaurant:
        return None

    # Query 2 - Inspection history
    offset = (page - 1) * 20
    inspections = db.execute(text("""
        SELECT * FROM inspections 
        WHERE camis = :camis 
        ORDER BY inspection_date DESC 
        LIMIT 20 OFFSET :offset
    """), {"camis": camis, "offset": offset}).fetchall()

    # Total violation rows for pagination
    inspection_count = db.execute(text("""
        SELECT COUNT(*) 
        FROM inspections 
        WHERE camis = :camis
    """), {"camis": camis}).scalar()

    # Unique inspection dates for header text
    unique_inspection_count = db.execute(text("""
        SELECT COUNT(DISTINCT inspection_date) 
        FROM inspections 
        WHERE camis = :camis
    """), {"camis": camis}).scalar()

    # Query 3 - repeat violations with rate
    repeat_violations = db.execute(text("""
        SELECT 
            violation_code,
            COUNT(*) as occurrence_count
        FROM inspections
        WHERE camis = :camis
        AND violation_code IS NOT NULL
        GROUP BY violation_code
        HAVING COUNT(*) > 1
        ORDER BY occurrence_count DESC
    """), {"camis": camis}).fetchall()

    # Query 4 - Critical ratio
    critical_ratio = db.execute(text("""
        SELECT 
            critical_flag,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM inspections
        WHERE camis = :camis AND critical_flag IS NOT NULL
        GROUP BY critical_flag
    """), {"camis": camis}).fetchall()

    # Query 5 - Score trend
    score_trend = db.execute(text("""
        SELECT inspection_date, MAX(score) as score
        FROM inspections
        WHERE camis = :camis AND score IS NOT NULL
        GROUP BY inspection_date
        ORDER BY inspection_date ASC
    """), {"camis": camis}).fetchall()

    # Query 6 - Violation trend
    violation_trend = db.execute(text("""
        SELECT inspection_date, COUNT(*) as violation_count
        FROM inspections
        WHERE camis = :camis AND violation_code IS NOT NULL
        GROUP BY inspection_date
        ORDER BY inspection_date ASC
    """), {"camis": camis}).fetchall()

    # Query 7 - Similar restaurants
    similar = db.execute(text("""
        SELECT 
            AVG(rs.risk_score) as avg_risk_score,
            COUNT(*) as restaurant_count,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rs.risk_score) as median_risk_score
        FROM restaurants r
        JOIN risk_scores rs ON r.camis = rs.camis
        WHERE r.boro = :boro
        AND r.cuisine_description = :cuisine
        AND r.camis != :camis
    """), {"boro": restaurant.boro, "cuisine": restaurant.cuisine_description, "camis": camis}).fetchone()

    # Query 8 - Current grade, last outcome, days since inspection
    last_inspection = db.execute(text("""
        SELECT 
            grade,
            action as last_outcome,
            CURRENT_DATE - inspection_date as days_since_inspection
        FROM inspections
        WHERE camis = :camis
        AND inspection_date IS NOT NULL
        ORDER BY inspection_date DESC
        LIMIT 1
    """), {"camis": camis}).fetchone()

    # Query 9 - Neighborhood percentile
    neighborhood_percentile = db.execute(text("""
        WITH ranked AS (
            SELECT 
                r.camis,
                r.boro,
                rs.risk_score,
                ROUND(
                    (PERCENT_RANK() OVER (
                        PARTITION BY r.boro 
                        ORDER BY rs.risk_score
                    ) * 100)::numeric, 2
                ) as neighborhood_percentile
            FROM restaurants r
            JOIN risk_scores rs ON r.camis = rs.camis
        )
        SELECT neighborhood_percentile
        FROM ranked
        WHERE camis = :camis
    """), {"camis": camis}).scalar()

    # Query 10 - Cuisine percentile
    cuisine_percentile = db.execute(text("""
        WITH ranked AS (
            SELECT 
                r.camis,
                r.cuisine_description,
                rs.risk_score,
                ROUND(
                    (PERCENT_RANK() OVER (
                        PARTITION BY r.cuisine_description 
                        ORDER BY rs.risk_score
                    ) * 100)::numeric, 2
                ) as cuisine_percentile
            FROM restaurants r
            JOIN risk_scores rs ON r.camis = rs.camis
        )
        SELECT cuisine_percentile
        FROM ranked
        WHERE camis = :camis
    """), {"camis": camis}).scalar()

    result = {
        "restaurant": {
            **dict(restaurant._mapping),
            "grade": last_inspection.grade if last_inspection else None,
            "last_outcome": last_inspection.last_outcome if last_inspection else None,
            "days_since_inspection": last_inspection.days_since_inspection if last_inspection else None,
        },
        "inspections": {
            "data": [dict(i._mapping) for i in inspections],
            "total": inspection_count,
            "unique_inspections": unique_inspection_count,
            "page": page,
            "page_size": 20
        },
        "risk_metrics": {
            "repeat_violations": [dict(r._mapping) for r in repeat_violations],
            "critical_ratio": [dict(r._mapping) for r in critical_ratio],
            "score_trend": [dict(r._mapping) for r in score_trend],
            "violation_trend": [dict(r._mapping) for r in violation_trend],
            "similar_restaurants": dict(similar._mapping) if similar else None,
            "neighborhood_percentile": neighborhood_percentile,
            "cuisine_percentile": cuisine_percentile
        }
    }
    
    return result


def get_bubble_data(db: Session, search=None, boro=None, cuisine=None, criticality=None, trend=None):
    base_query = """
        SELECT 
            r.camis,
            r.dba,
            r.boro,
            r.cuisine_description,
            COUNT(i.inspection_id) as total_inspections,
            SUM(CASE WHEN i.critical_flag = 'Critical' THEN 1 ELSE 0 END) as critical_violation_count,
            CURRENT_DATE - MAX(i.inspection_date) as days_since_last_inspection,
            rs.risk_score,
            rs.risk_percentile,
            rs.criticality,
            rs.trend
        FROM restaurants r
        LEFT JOIN inspections i ON r.camis = i.camis
        LEFT JOIN risk_scores rs ON r.camis = rs.camis
    """

    filters = []
    params = {}

    if search:
        filters.append("(r.dba ILIKE :search OR CAST(r.camis AS TEXT) LIKE :search)")
        params["search"] = f"%{search}%"
    if boro:
        filters.append("r.boro = :boro")
        params["boro"] = boro
    if cuisine:
        filters.append("r.cuisine_description ILIKE :cuisine")
        params["cuisine"] = f"%{cuisine}%"
    if criticality:
        filters.append("rs.criticality = :criticality")
        params["criticality"] = criticality
    if trend:
        filters.append("rs.trend = :trend")
        params["trend"] = trend
    

    if filters:
        base_query += " WHERE " + " AND ".join(filters)

    base_query += " GROUP BY r.camis, r.dba, r.boro, r.cuisine_description, rs.risk_score, rs.risk_percentile, rs.criticality, rs.trend"

    print(base_query)
    
    result = db.execute(text(base_query), params)
    rows = result.fetchall()
    records = [dict(row._mapping) for row in rows]
    
    return records