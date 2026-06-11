# SafePlate — NYC Restaurant Health Risk Inspection Portal

A decision-support tool for NYC health inspectors to prioritize restaurant inspections using risk scoring, RAG-powered AI insights, and a conversational chatbot.

\---

## Overview

SafePlate analyzes \~290,000 NYC DOHMH restaurant inspection records across 27,000+ restaurants to help inspectors answer one operational question: **which restaurants should be inspected next?**

The system computes a research-backed risk score for every restaurant, surfaces AI-generated insights grounded in historical violation patterns, and provides a natural language chatbot for ad-hoc queries.

\---

## Features

### Dashboard

* Restaurant list with risk scores, criticality badges, and trend indicators
* Filters by area, cuisine type, criticality, and trend
* Bubble chart view — visualize risk score vs days since inspection
* KPI cards with citywide statistics

### Restaurant Detail

* Full inspection history with violation descriptions
* Risk analysis — repeat violations, critical ratio, score trend, violation trend
* Comparison to similar restaurants by neighborhood and cuisine
* AI Insights panel — LLM-generated risk narrative and recommendations powered by RAG

### Home Page

* Daily briefing — AI-generated actionable insights cached weekly
* Inspection backlog chart
* NYC inspection score trend over time
* High Risk heatmap by borough × cuisine type

### Chatbot

* Conversational interface for natural language queries
* Hybrid routing — SQL generation for structured queries, vector similarity search for semantic queries
* Maintains conversation context across messages

\---

## Tech Stack

### Backend

* **FastAPI** — REST API
* **PostgreSQL + pgvector** — primary database with vector similarity search
* **SQLAlchemy** — database ORM and raw SQL execution
* **Pandas** — data cleaning, transformation, and business logic
* **sentence-transformers** (`all-MiniLM-L6-v2`) — local embeddings for RAG
* **Redis** — LLM response caching
* **OpenAI API** — LLM for AI insights, chatbot, and daily briefing

### Frontend

* **React + Vite** — single page application
* **Tailwind CSS** — styling
* **Recharts** — data visualizations
* **React Router** — client-side routing

\---

## RAG Pipeline

1. Each restaurant's violation descriptions are concatenated and embedded using `all-MiniLM-L6-v2`
2. Embeddings stored in PostgreSQL using `pgvector`
3. On AI Insights request: current restaurant's violations are embedded and used to retrieve the 10 most similar restaurants from history
4. Retrieved cases + structured metrics sent to LLM for grounded insight generation
5. Responses cached in Redis for 30 days

\---

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

│       ├── restaurant\_service.py

│       ├── llm\_service.py

│       ├── rag\_service.py

│       ├── chatbot\_service.py

│       └── redis\_service.py

├── scripts/

│   └── data\_refresh\_pipeline.py

├── frontend/

│   ├── public/

│   ├── src/

│   │   ├── assets/

│   │   ├── components/

│   │   ├── pages/

│   │   ├── styles/

│   │   ├── App.jsx

│   │   └── main.jsx

│   ├── index.html

│   ├── package.json

│   └── vite.config.js

├── requirements.txt

├── .env.example

└── README.md
```

\---

## Local Setup

### Prerequisites

* Python 3.10+
* PostgreSQL 18 with pgvector extension
* Redis
* Node.js 18+

### Backend

```bash
# Clone the repo
git clone https://github.com/dhakshna-moorthi/nyc-restaurant-risk-analyzer.git
cd nyc-restaurant-risk-analyzer

# Create virtual environment
python -m venv venv
venv\\Scripts\\activate  # Windows
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
python scripts/data\_refresh\_pipeline.py
```

This will:

1. Fetch NYC DOHMH inspection data from the open data API
2. Load restaurants and inspections into PostgreSQL
3. Load violation codes reference table
4. Generate violation embeddings for RAG
5. Compute risk scores for all restaurants

\---

## Environment Variables

Create a `.env` file based on `.env.example`:

```
DB\_USER=postgres
DB\_PASSWORD=your\_password
DB\_HOST=localhost
DB\_PORT=5432
DB\_NAME=nyc\_restaurant\_risk

REDIS\_HOST=localhost
REDIS\_PORT=6379

OPENAI\_API\_KEY=your\_openai\_key

LOGIN\_USERNAME=inspector
LOGIN\_PASSWORD=your\_password
JWT\_SECRET=your\_jwt\_secret
```

\---

## Data Source

* **NYC DOHMH Restaurant Inspection Results** — [NYC Open Data](https://data.cityofnewyork.us/resource/43nn-pn8j.json)
* Updated daily by NYC Department of Health and Mental Hygiene
* \~290,000 inspection records, 27,000+ restaurants

\---

## Deployment

> 🚧 Deployment in progress. This section will be updated once live.

**Planned stack:**

* **FastAPI** → Render
* **PostgreSQL + pgvector** → Supabase
* **Redis** → Upstash
* **React** → Vercel

\---

## API Documentation

Once the server is running, visit:

* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`



