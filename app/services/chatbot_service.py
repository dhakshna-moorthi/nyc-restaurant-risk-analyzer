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

SYSTEM_PROMPT = """You are SafeBot, an NYC health inspection analyst assistant.
You help health inspectors analyze restaurant inspection data.

{schema}

Use the provided tools to query the database whenever needed:
- Use execute_sql_query for counting, ranking, filtering, scheduling, aggregations, or specific data lookups
- Use execute_semantic_search for finding restaurants with similar violation patterns or descriptions
- Use report_unanswerable when the question is out of scope or cannot be answered with available data

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
- Only add this disclaimer when the question involves counts across different sized groups

Formatting rules — follow these strictly:
- NEVER use markdown tables. Tables are forbidden.
- Present lists of restaurants as numbered lists
- For each restaurant entry use this pattern:
  **Restaurant Name** *(Cuisine, Borough)* — Risk Score: **XX.X** | Criticality: High/Medium/Low | Trend: Improving/Stable/Declining
- Use **bold** for restaurant names, risk scores, and key figures
- Use *italics* for cuisine type, borough, and secondary descriptors
- Use ## headings to group results when breaking out by borough or category
- End with a short 1–2 sentence plain-English summary of what the data shows
- For scheduling answers, use ## Day 1, ## Day 2, etc. as section headers

Call report_unanswerable when the question:
- Is not related to NYC restaurant health inspections
- Requires data not available in the tables above
- Is too vague to generate a meaningful query
- Is a general knowledge question unrelated to inspections
- Asks for personal recommendations, opinions, or subjective judgments

Rules for SQL queries:
- Only write SELECT statements
- Always LIMIT to 20 rows maximum
- Use proper JOINs across tables
- For scheduling questions, order by risk_score DESC
- ONLY use PostgreSQL syntax — no QUALIFY, no TOP, no LIMIT BY
- For top-N per group queries, use subqueries with ROW_NUMBER() window function
- ALWAYS join risk_scores to include risk_score, criticality, and trend columns
"""

execute_sql_query_schema = {
    "type": "function",
    "function": {
        "name": "execute_sql_query",
        "description": "Executes a SQL SELECT query against the database and returns the results. Use for counting, ranking, filtering, scheduling, aggregations, or specific data lookups. Only SELECT statements are allowed. Always LIMIT to 20 rows maximum. Use PostgreSQL syntax only.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A valid PostgreSQL SELECT query string."
                }
            },
            "required": ["query"]
        }
    }
}

execute_semantic_search_schema = {
    "type": "function",
    "function": {
        "name": "execute_semantic_search",
        "description": "Searches restaurants using semantic similarity against health violation records. Given a natural language description (e.g. 'dirty kitchen', 'rodent issues', 'improper food storage'), returns the top 10 most semantically similar restaurants ranked by violation similarity. Each result includes restaurant identity, borough, cuisine type, risk score, criticality level, trend, and similarity score.",
        "parameters": {
            "type": "object",
            "properties": {
                "search_text": {
                    "type": "string",
                    "description": "Natural language description of a violation type, health concern, or restaurant characteristic to search for."
                }
            },
            "required": ["search_text"]
        }
    }
}

report_unanswerable_schema = {
    "type": "function",
    "function": {
        "name": "report_unanswerable",
        "description": "Call this when the user's question is out of scope or cannot be answered using the available database. Provide a brief reason and exactly 3 alternative questions the user could ask instead.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Brief explanation of why the question cannot be answered."
                },
                "suggested_questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Exactly 3 alternative questions the user could ask about NYC restaurant health inspections.",
                    "minItems": 3,
                    "maxItems": 3
                }
            },
            "required": ["reason", "suggested_questions"]
        }
    }
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


def execute_sql_query(query: str, db: Session) -> str:
    try:
        results = execute_sql_safely(query, db)
        return json.dumps(results, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def execute_semantic_search(search_text: str, db: Session) -> str:
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
    return json.dumps(data, default=str)


def chat(question: str, db: Session, conversation_history: list = None) -> dict:
    if conversation_history is None:
        conversation_history = []

    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(schema=SCHEMA_DESCRIPTION)}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": question})

    all_data = []
    query_type = None

    while True:
        response = client.chat.completions.create(
            model="gpt-5.4-nano",
            messages=messages,
            tools=[execute_sql_query_schema, execute_semantic_search_schema, report_unanswerable_schema]
        )

        assistant_message = response.choices[0].message
        messages.append(assistant_message)

        if response.choices[0].finish_reason != "tool_calls":
            answer = assistant_message.content or ""
            break

        for tool_call in assistant_message.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            if name == "execute_sql_query":
                query_type = "SQL"
                result = execute_sql_query(args["query"], db)
            elif name == "execute_semantic_search":
                query_type = "Semantic"
                result = execute_semantic_search(args["search_text"], db)
            elif name == "report_unanswerable":
                print(messages)
                return {
                    "answer": args.get("reason", "I cannot answer that question."),
                    "type": "unanswerable",
                    "data": [],
                    "suggested_questions": args.get("suggested_questions", [])
                }
            else:
                result = json.dumps({"error": f"Unknown tool: {name}"})

            parsed = json.loads(result)
            if isinstance(parsed, list):
                all_data.extend(parsed)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })

    print(messages)

    return {
        "answer": answer,
        "type": query_type,
        "data": all_data[:10],
        "suggested_questions": []
    }
