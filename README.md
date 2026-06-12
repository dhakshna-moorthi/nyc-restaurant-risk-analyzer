# SafePlate — NYC Restaurant Health Risk Inspection Portal

A decision-support tool for NYC health inspectors to prioritize restaurant inspections using risk scoring, RAG-powered AI insights, and a conversational chatbot.

**Live Demo:** [safeplatenyc.vercel.app](https://safeplatenyc.vercel.app)

---

## Overview

SafePlate analyzes ~290,000 NYC DOHMH restaurant inspection records across 27,000+ restaurants to help inspectors answer one operational question: **which restaurants should be inspected next?**

The system computes a research-backed risk score for every restaurant, surfaces AI-generated insights grounded in historical violation patterns, and provides a natural language chatbot for ad-hoc queries.

---

## Features

### Home Page
- Weekly briefing — AI-generated actionable insights, refreshes every Monday
- Inspection backlog chart — restaurants by days since last inspection
- NYC inspection score trend over time
- High Risk heatmap by borough × cuisine type (normalized by restaurant count)

### Dashboard
- Restaurant list with risk scores, criticality badges, and trend indicators
- Filters by area, cuisine type, criticality, and trend
- Bubble chart view — visualize risk score vs days since inspection
- KPI cards with citywide statistics including percentages

### Restaurant Detail
- Full inspection history with violation descriptions
- Risk analysis — repeat violations, critical ratio, score trend, violation trend
- Comparison to similar restaurants by neighborhood and cuisine percentile
- AI Insights panel — LLM-generated risk narrative and recommendations powered by RAG

### Chatbot (SafeBot)
- Conversational interface for natural language queries
- Hybrid routing — SQL generation for structured queries, vector similarity search for semantic queries
- Maintains conversation context across messages
- Suggests alternatives for unanswerable questions

---

## Tech Stack

### Backend
- **FastAPI** — REST API
- **PostgreSQL + pgvector** — primary database with vector similarity search
- **SQLAlchemy** — database ORM and raw SQL execution
- **Pandas** — data cleaning, transformation, and business logic
- **sentence-transformers** (`all-MiniLM-L6-v2`) — local embeddings for RAG
- **Redis** — LLM response caching
- **OpenAI API** — LLM for AI insights, chatbot, and weekly briefing

### Frontend
- **React + Vite** — single page application
- **Tailwind CSS** — styling
- **Recharts** — data visualizations
- **React Router** — client-side routing

---

## RAG Pipeline

1. Each restaurant's violation descriptions are concatenated and embedded using `all-MiniLM-L6-v2`
2. Embeddings stored in PostgreSQL using `pgvector`
3. On AI Insights request: current restaurant's violations are embedded and used to retrieve the 10 most similar restaurants from history
4. Retrieved cases + structured metrics sent to LLM for grounded insight generation
5. Responses cached in Redis for 30 days

---

## Project Structure

```
nyc-restaurant-risk-analyzer/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routes/
│   │   └── routes.py
│   └── services/
│       ├── restaurant_service.py
│       ├── llm_service.py
│       ├── rag_service.py
│       ├── chatbot_service.py
│       └── redis_service.py
├── scripts/
│   └── data_refresh_pipeline.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Shared.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RestaurantDetail.jsx
│   │   │   ├── Chatbot.jsx
│   │   │   └── Login.jsx
│   │   ├── styles/
│   │   │   ├── home.css
│   │   │   ├── dashboard.css
│   │   │   ├── restaurant-detail.css
│   │   │   ├── chatbot.css
│   │   │   └── shared.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .github/
│   └── workflows/
│       └── data_refresh.yml
├── requirements.txt
├── .env.example
└── README.md
```

---

## Local Setup

### Prerequisites
- Python 3.10+
- PostgreSQL 18 with pgvector extension
- Redis
- Node.js 18+

### Backend

```bash
# Clone the repo
git clone https://github.com/dhakshna-moorthi/nyc-restaurant-risk-analyzer.git
cd nyc-restaurant-risk-analyzer

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run the server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Data Setup

```bash
# Run the full data pipeline (first time setup)
python scripts/data_refresh_pipeline.py
```

This will:
1. Fetch NYC DOHMH inspection data from the open data API
2. Load restaurants and inspections into PostgreSQL
3. Load violation codes reference table
4. Generate violation embeddings for RAG
5. Compute risk scores for all restaurants

---

## Environment Variables

Create a `.env` file based on `.env.example`:

```
ENVIRONMENT=development

DATABASE_URL=your_db_connection_url

UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

OPENAI_API_KEY=your_openai_key

LOGIN_USERNAME=inspector
LOGIN_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

---

## Data Source

- **NYC DOHMH Restaurant Inspection Results** — [NYC Open Data](https://data.cityofnewyork.us/resource/43nn-pn8j.json)
- Updated daily by NYC Department of Health and Mental Hygiene
- ~290,000 inspection records, 27,000+ restaurants
- **NYC Health Violation Code Reference** — [GitHub: nychealth/Food-Safety-Health-Code-Reference](https://github.com/nychealth/Food-Safety-Health-Code-Reference)

---

## Deployment

| Component | Platform | URL |
|---|---|---|
| React Frontend | Vercel | [safeplatenyc.vercel.app](https://safeplatenyc.vercel.app) |
| FastAPI Backend | Render | — |
| PostgreSQL + pgvector | Supabase | — |
| Redis Cache | Upstash | — |

**Data refresh** runs automatically on the first day of every month via GitHub Actions, fetching the latest NYC inspection data from the open data API.

---

## API Documentation

Local: `http://localhost:8000/docs`

