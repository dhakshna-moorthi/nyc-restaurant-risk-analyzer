from pydantic import BaseModel
from typing import Optional
from datetime import date

class RestaurantSchema(BaseModel):
    camis: int
    dba: str
    boro: str
    cuisine_description: Optional[str]

    class Config:
        from_attributes = True


class InspectionSchema(BaseModel):
    inspection_id: int
    camis: int
    inspection_date: date
    action: Optional[str]
    violation_code: str
    violation_description: str
    critical_flag: Optional[str]
    score: Optional[float]
    grade: Optional[str]
    grade_date: Optional[date]
    record_date: Optional[date]
    inspection_type: Optional[str]

    class Config:
        from_attributes = True


class RestaurantListItem(BaseModel):
    camis: int
    restaurant_name: str
    area: str
    cuisine_description: Optional[str] = None
    total_inspections: int
    critical_violation_count: int
    last_violation_code: Optional[str] = None
    days_since_last_inspection: Optional[int] = None
    trend: Optional[str] = None
    risk_score: Optional[float] = None
    risk_percentile: Optional[float] = None
    criticality: Optional[str] = None

    class Config:
        from_attributes = True


class KPIStats(BaseModel):
    high_risk_count: int
    overdue_count: int
    declining_count: int
    avg_risk_score: float

    class Config:
        from_attributes = True


class RestaurantListResponse(BaseModel):
    data: list[RestaurantListItem]
    total: int
    page: int
    page_size: int
    kpis: KPIStats

    class Config:
        from_attributes = True


class InspectionRecord(BaseModel):
    inspection_id: int
    camis: int
    inspection_date: Optional[date] = None
    action: Optional[str] = None
    violation_code: Optional[str] = None
    violation_description: Optional[str] = None
    critical_flag: Optional[str] = None
    score: Optional[float] = None
    grade: Optional[str] = None
    grade_date: Optional[date] = None
    record_date: Optional[date] = None
    inspection_type: Optional[str] = None

    class Config:
        from_attributes = True


class InspectionHistory(BaseModel):
    data: list[InspectionRecord]
    total: int
    unique_inspections: int
    page: int
    page_size: int


class RepeatViolation(BaseModel):
    violation_code: str
    occurrence_count: int


class CriticalRatio(BaseModel):
    critical_flag: str
    count: int
    percentage: float


class ScoreTrend(BaseModel):
    inspection_date: date
    score: float


class ViolationTrend(BaseModel):
    inspection_date: date
    violation_count: int


class SimilarRestaurants(BaseModel):
    avg_risk_score: float
    restaurant_count: int
    median_risk_score: float


class RiskMetrics(BaseModel):
    repeat_violations: list[RepeatViolation]
    critical_ratio: list[CriticalRatio]
    score_trend: list[ScoreTrend]
    violation_trend: list[ViolationTrend]
    similar_restaurants: Optional[SimilarRestaurants] = None
    neighborhood_percentile: Optional[float] = None
    cuisine_percentile: Optional[float] = None


class RestaurantInfo(BaseModel):
    camis: int
    dba: str
    boro: str
    cuisine_description: Optional[str] = None
    risk_score: Optional[float] = None
    risk_percentile: Optional[float] = None
    criticality: Optional[str] = None
    trend: Optional[str] = None
    grade: Optional[str] = None
    days_since_inspection: Optional[int] = None


class AIInsights(BaseModel):
    narrative: str
    recommendations: list[str]
    pattern_insight: str


class RestaurantDetailResponse(BaseModel):
    restaurant: RestaurantInfo
    inspections: InspectionHistory
    risk_metrics: RiskMetrics


class AIInsights(BaseModel):
    narrative: str
    recommendations: list[str]
    pattern_insight: str


class ChatRequest(BaseModel):
    question: str
    conversation_history: list = []


class ChatResponse(BaseModel):
    answer: str
    type: str
    data: list
    suggested_questions: list[str] = []


class InspectionGap(BaseModel):
    gap_bucket: str
    restaurant_count: int


class HeatmapCell(BaseModel):
    boro: str
    cuisine_description: str
    high_risk_count: int
    total_count: int
    high_risk_percentage: float

class RiskTotal(BaseModel):
    high_risk_count: int
    total_count: int
    high_risk_percentage: float

class HeatmapTotals(BaseModel):
    borough_totals: dict[str, RiskTotal]
    cuisine_totals: dict[str, RiskTotal]
    grand_total: RiskTotal


class HomeStats(BaseModel):
    total_restaurants: int
    high_risk_count: int
    overdue_count: int
    avg_risk_score: Optional[float] = None


class UrgentRestaurant(BaseModel):
    camis: int
    dba: str
    boro: str
    cuisine_description: Optional[str] = None
    risk_score: Optional[float] = None
    criticality: Optional[str] = None
    trend: Optional[str] = None
    days_since_inspection: Optional[int] = None


class ScoreTrend(BaseModel):
    month: str
    avg_score: float


class HomeResponse(BaseModel):
    stats: HomeStats
    urgent_restaurants: list[UrgentRestaurant]
    area_summary: list[dict]
    cuisine_summary: list[dict]
    heatmap: list[HeatmapCell]
    heatmap_totals: HeatmapTotals
    score_trend: list[ScoreTrend]
    inspection_gap: list[InspectionGap]
    daily_briefing: list[str]


class BubbleRestaurant(BaseModel):
    camis: int
    dba: Optional[str] = None
    boro: Optional[str] = None
    cuisine_description: Optional[str] = None
    risk_score: Optional[float] = None
    risk_percentile: Optional[float] = None
    criticality: Optional[str] = None
    trend: Optional[str] = None
    days_since_last_inspection: Optional[int] = None
    critical_violation_count: Optional[int] = None