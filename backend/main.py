"""
CiPD Ambassador Rating System — Backend Skeleton
Run: uvicorn main:app --reload
Then open http://127.0.0.1:8000/health and http://127.0.0.1:8000/test-users
"""
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

load_dotenv()  # reads .env

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set — copy .env.example to .env and fill in your password")

engine = create_engine(DATABASE_URL)

app = FastAPI(title="CiPD Ambassador Rating System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    """Basic liveness check — does NOT touch the database."""
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    """Confirms the app can actually talk to Postgres."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        return {"database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")


@app.get("/test-users")
def test_users():
    """Pulls the seed rows from schema.sql — proves reads work end to end."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT user_id, full_name, email, role FROM users"))
            rows = [dict(row._mapping) for row in result]
        return {"users": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
