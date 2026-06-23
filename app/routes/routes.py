from app.schemas import AIInsights, ChatRequest, ChatResponse, HomeResponse, RestaurantDetailResponse, RestaurantListResponse, BubbleRestaurant
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services.restaurant_service import get_restaurant_detail, get_restaurants_service, get_home_data, get_bubble_data
from app.services.chatbot_service import chat
import json

router = APIRouter()

@router.get("/health")
def read_root():
    return {"status": "ok"}


@router.get("/home", response_model=HomeResponse)
def get_home(db: Session = Depends(get_db)):
    return get_home_data(db)


@router.get("/restaurants", response_model=RestaurantListResponse)
def get_restaurants(
    search: Optional[str] = None,
    boro: Optional[str] = None,
    cuisine: Optional[str] = None,
    criticality: Optional[str] = None,
    trend: Optional[str] = None,
    violation_code: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    return get_restaurants_service(
        db=db,
        search=search,
        boro=boro,
        cuisine=cuisine,
        criticality=criticality,
        trend=trend,
        violation_code=violation_code,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )


@router.get("/restaurants/bubble", response_model=list[BubbleRestaurant])
def get_bubble_chart_data(
    search: Optional[str] = None,
    boro: Optional[str] = None,
    cuisine: Optional[str] = None,
    criticality: Optional[str] = None,
    trend: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return get_bubble_data(db, search, boro, cuisine, criticality, trend)


@router.get("/restaurants/{camis}", response_model=RestaurantDetailResponse)
def get_restaurant_detail_route(
    camis: int,
    page: int = 1,
    db: Session = Depends(get_db),
):
    result = get_restaurant_detail(camis=camis, page=page, db=db)
    if not result:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return result


@router.get("/restaurants/{camis}/insights", response_model=AIInsights)
def get_restaurant_insights(camis: int, db: Session = Depends(get_db)):
    
    # Check Redis cache first
    from app.services.redis_service import get_cached
    cache_key = f"llm_insights:{camis}"
    cached = get_cached(cache_key)
    
    if cached:
        # Return cached response as a stream
        def cached_stream():
            yield cached
        return StreamingResponse(cached_stream(), media_type="application/json")
    
    # Fetch restaurant data needed for LLM
    from app.services.restaurant_service import get_restaurant_detail
    restaurant_data = get_restaurant_detail(camis=camis, page=1, db=db)
    
    if not restaurant_data:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Stream LLM response
    def generate():
        from app.services.llm_service import generate_risk_insights
        result = generate_risk_insights(restaurant_data, db)
        yield json.dumps(result)
    
    return StreamingResponse(generate(), media_type="application/json")


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    
    result = chat(
        question=question,
        db=db,
        conversation_history=payload.conversation_history
    )
    return result
