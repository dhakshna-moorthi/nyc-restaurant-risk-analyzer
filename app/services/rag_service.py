from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text: str) -> list:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def get_similar_restaurants(camis: int, violation_text: str, db: Session, limit: int = 10):
    embedding = get_embedding(violation_text)
    
    results = db.execute(text("""
        SELECT 
            ve.camis,
            r.dba,
            r.boro,
            r.cuisine_description,
            rs.risk_score,
            rs.trend,
            rs.criticality,
            1 - (ve.embedding <=> CAST(:embedding AS vector)) as similarity_score
        FROM violation_embeddings ve
        JOIN restaurants r ON ve.camis = r.camis
        JOIN risk_scores rs ON ve.camis = rs.camis
        WHERE ve.camis != :camis
        ORDER BY ve.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """), {
        "embedding": str(embedding),
        "camis": camis,
        "limit": limit
    }).fetchall()
    
    return [dict(r._mapping) for r in results]