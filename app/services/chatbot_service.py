import json
import os
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv
from app.services.rag_service import get_embedding

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCHEMA_DESCRIPTION = """
You have access to these PostgreSQL tables:

restaurants: camis (PK), dba (name), boro (area), cuisine_description
inspections: inspection_id (PK), camis (FK), inspection_date, violation_code, violation_description, critical_flag, score, grade, inspection_type
risk_scores: camis (FK), risk_score (0-100), risk_percentile, criticality (High/Medium/Low), trend (Improving/Stable/Declining)
violation_codes: violation_code (PK), category, risk_tier (public_health_hazard/critical/general), base_points

IMPORTANT: Always use descriptive column aliases that read naturally:
  r.dba AS "Restaurant Name"
  r.boro AS "Area"  
  r.cuisine_description AS "Cuisine"
  rs.risk_score AS "Risk Score"
  rs.criticality AS "Criticality"
  rs.trend AS "Trend"
  COUNT(*) AS "Total Count"
  AVG(rs.risk_score) AS "Avg Risk Score"

"""

ROUTER_SYSTEM_PROMPT = """You are a query router for a NYC restaurant health inspection system.

{schema}

Given a user question (considering conversation history), determine if it needs:
1. "sql" - for counting, ranking, filtering, scheduling, aggregations, or specific data lookups
2. "semantic" - for finding restaurants with similar violation patterns or descriptions

Set "answerable" to false if the question:
- Is not related to NYC restaurant health inspections
- Requires data not available in the tables above
- Is too vague to generate a meaningful query
- Is a general knowledge question unrelated to inspections
- Asks for personal recommendations, opinions, or subjective judgments
- Uses words like "best", "worst", "recommend", "suggest" in a consumer context

When not answerable, suggest 3 specific questions the system CAN answer.

Respond ONLY in this JSON format:
{{
    "type": "sql" or "semantic",
    "query": "SQL SELECT query here (if sql) or empty string (if semantic)",
    "search_text": "text to search for (if semantic) or empty string (if sql)",
    "answerable": true or false,
    "reason": "brief reason if not answerable, empty string if answerable",
    "suggested_similar_questions": [
        "Question 1",
        "Question 2", 
        "Question 3"
    ]
}}

Rules for SQL:
- Only write SELECT statements
- Always LIMIT to 20 rows maximum
- Use proper JOINs across tables
- For scheduling questions, order by risk_score DESC
- ONLY use PostgreSQL syntax — no QUALIFY, no TOP, no LIMIT BY
- For top-N per group queries, use subqueries with ROW_NUMBER() window function
- ALWAYS join risk_scores to include risk_score, criticality, and trend columns
- Example for top 5 per borough:
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY boro ORDER BY risk_score DESC) as rn
    FROM ...
  ) ranked WHERE rn <= 5
  """

ANSWER_SYSTEM_PROMPT = """You are SafeBot, an NYC health inspection analyst assistant. 
You help health inspectors analyze restaurant inspection data.

Guidelines:
- Answer directly and specifically using the retrieved data
- For scheduling questions, present a clear day-by-day plan
- Keep answers concise but complete
- Never make up data not present in the retrieved results
- If data is insufficient, say so and suggest what the user could ask instead
- Maintain conversation context — reference previous questions when relevant
- When answering questions that compare raw counts across boroughs or cuisine types, 
  add a brief disclaimer: "Note: raw counts may be influenced by the number of 
  restaurants in each area — percentage-based comparisons are more meaningful."
- Only add this disclaimer when the question involves counts across different sized groups"""


def route_query(question: str, conversation_history: list) -> dict:
    messages = [
        {
            "role": "system",
            "content": ROUTER_SYSTEM_PROMPT.format(schema=SCHEMA_DESCRIPTION)
        }
    ]
    
    # Add conversation history for context
    for msg in conversation_history:
        messages.append(msg)
    
    # Add current question
    messages.append({"role": "user", "content": question})
    
    response = client.chat.completions.create(
        model="gpt-5.4-nano",
        messages=messages
    )

    response_text = response.choices[0].message.content.strip()
    print("Raw LLM response (query routing):", response_text)

    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "type": "semantic",
            "query": "",
            "search_text": question,
            "answerable": True,
            "reason": "",
            "suggested_similar_questions": []
        }


def execute_sql_safely(query: str, db: Session) -> list:
    cleaned = query.strip().upper()
    if not cleaned.startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")
    
    dangerous = ["DROP", "DELETE", "INSERT", "UPDATE", "TRUNCATE", "ALTER"]
    for keyword in dangerous:
        if keyword in cleaned:
            raise ValueError(f"Query contains forbidden keyword: {keyword}")
    
    result = db.execute(text(query))
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


def answer_question(question: str, data: list, conversation_history: list) -> str:
    messages = [
        {
            "role": "system",
            "content": ANSWER_SYSTEM_PROMPT
        }
    ]
    
    # Add conversation history for context
    for msg in conversation_history:  
        messages.append(msg)
    
    # Add current question with retrieved data
    messages.append({
        "role": "user",
        "content": f"""Question: {question}

Retrieved data:
{json.dumps(data, indent=2, default=str)}

Answer based on this data."""
    })
    
    response = client.chat.completions.create(
        model="gpt-5.4-nano",
        messages=messages
    )

    print("Raw LLM response (question answer):", response.choices[0].message.content.strip())

    return response.choices[0].message.content.strip()


def chat(question: str, db: Session, conversation_history: list = None) -> dict:
    if conversation_history is None:
        conversation_history = []
    
    # Step 1 - Route the query with conversation context
    routing = route_query(question, conversation_history)
    
    if not routing.get("answerable", True):
        return {
            "answer": f"I don't have enough information to answer that. {routing.get('reason', '')}",
            "type": "unanswerable",
            "data": [],
            "suggested_questions": routing.get("suggested_similar_questions", [])
        }
    
    # Step 2 - Execute based on type
    data = []
    query_type = routing.get("type", "semantic")
    
    if query_type == "sql":
        try:
            data = execute_sql_safely(routing["query"], db)
        except Exception as e:
            query_type = "semantic"
            routing["search_text"] = question
    
    if query_type == "semantic":
        search_text = routing.get("search_text") or question
        embedding = get_embedding(search_text)

        db.rollback()
        
        results = db.execute(text("""
            SELECT 
                r.camis, r.dba, r.boro, r.cuisine_description,
                rs.risk_score, rs.criticality, rs.trend,
                1 - (ve.embedding <=> CAST(:embedding AS vector)) as similarity
            FROM violation_embeddings ve
            JOIN restaurants r ON ve.camis = r.camis
            JOIN risk_scores rs ON ve.camis = rs.camis
            ORDER BY ve.embedding <=> CAST(:embedding AS vector)
            LIMIT 10
        """), {"embedding": str(embedding)}).fetchall()
        
        data = [dict(r._mapping) for r in results]
    
    # Step 3 - Generate answer with conversation context
    answer = answer_question(question, data, conversation_history)
    
    return {
        "answer": answer,
        "type": query_type,
        "data": data[:10],
        "suggested_questions": []
    }