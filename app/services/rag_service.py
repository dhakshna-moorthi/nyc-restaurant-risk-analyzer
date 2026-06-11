from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from sqlalchemy import text

model = SentenceTransformer('all-MiniLM-L6-v2')

def get_similar_restaurants(camis: int, violation_text: str, db: Session, limit: int = 10):
    embedding = model.encode(violation_text).tolist()
    embedding_str = str(embedding)
    
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
        "embedding": embedding_str,
        "camis": camis,
        "limit": limit
    }).fetchall()
    
    return [dict(r._mapping) for r in results]