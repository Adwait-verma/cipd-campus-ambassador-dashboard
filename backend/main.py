"""
CiPD Ambassador Rating System — Backend

Run:
    uvicorn main:app --reload

Then open:
    http://127.0.0.1:8000/health
    http://127.0.0.1:8000/db-check
    http://127.0.0.1:8000/test-users
    http://127.0.0.1:8000/docs
"""

import os

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, EmailStr

from pwdlib import PasswordHash

from sqlalchemy import create_engine, text


# ---------------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# ---------------------------------------------------------

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not set — copy .env.example to .env and fill in your password"
    )


# ---------------------------------------------------------
# DATABASE CONNECTION
# ---------------------------------------------------------

engine = create_engine(DATABASE_URL)


# ---------------------------------------------------------
# PASSWORD HASHING
# ---------------------------------------------------------

password_hash = PasswordHash.recommended()


# ---------------------------------------------------------
# FASTAPI APPLICATION
# ---------------------------------------------------------

app = FastAPI(
    title="CiPD Ambassador Rating System"
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    college_name: str
    graduation_year: int
    password: str


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok"
    }


# ---------------------------------------------------------
# DATABASE CHECK
# ---------------------------------------------------------

@app.get("/db-check")
def db_check():
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT 1")
            )

            result.fetchone()

        return {
            "database": "connected"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {e}",
        )


# ---------------------------------------------------------
# TEST USERS
# ---------------------------------------------------------

@app.get("/test-users")
def test_users():
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT
                        user_id,
                        full_name,
                        email,
                        role
                    FROM users
                    ORDER BY user_id
                    """
                )
            )

            rows = [
                dict(row._mapping)
                for row in result
            ]

        return {
            "users": rows
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Query failed: {e}",
        )


# ---------------------------------------------------------
# REGISTER AMBASSADOR
# ---------------------------------------------------------

@app.post("/register")
def register_ambassador(data: RegisterRequest):
    try:

        # ---------------------------------------------
        # BASIC VALIDATION
        # ---------------------------------------------

        if len(data.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long.",
            )

        if not data.full_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Full name is required.",
            )

        if not data.college_name.strip():
            raise HTTPException(
                status_code=400,
                detail="College name is required.",
            )


        # ---------------------------------------------
        # HASH PASSWORD
        # ---------------------------------------------

        hashed_password = password_hash.hash(
            data.password
        )


        # ---------------------------------------------
        # DATABASE TRANSACTION
        # ---------------------------------------------

        with engine.begin() as conn:

            # CHECK DUPLICATE EMAIL

            existing_user = conn.execute(
                text(
                    """
                    SELECT user_id
                    FROM users
                    WHERE LOWER(email) = LOWER(:email)
                    """
                ),
                {
                    "email": str(data.email)
                },
            ).fetchone()

            if existing_user:
                raise HTTPException(
                    status_code=409,
                    detail="A user with this email already exists.",
                )


            # CREATE USER

            user_result = conn.execute(
                text(
                    """
                    INSERT INTO users (
                        full_name,
                        email,
                        role,
                        password_hash
                    )
                    VALUES (
                        :full_name,
                        :email,
                        'AMBASSADOR',
                        :password_hash
                    )
                    RETURNING user_id
                    """
                ),
                {
                    "full_name": data.full_name.strip(),
                    "email": str(data.email).lower(),
                    "password_hash": hashed_password,
                },
            )

            user_id = user_result.scalar_one()


            # CREATE AMBASSADOR PROFILE

            ambassador_result = conn.execute(
                text(
                    """
                    INSERT INTO ambassadors (
                        user_id,
                        college_name,
                        graduation_year,
                        status
                    )
                    VALUES (
                        :user_id,
                        :college_name,
                        :graduation_year,
                        'PENDING'
                    )
                    RETURNING ambassador_id
                    """
                ),
                {
                    "user_id": user_id,
                    "college_name": data.college_name.strip(),
                    "graduation_year": data.graduation_year,
                },
            )

            ambassador_id = ambassador_result.scalar_one()


        # ---------------------------------------------
        # RESPONSE TO FRONTEND
        # ---------------------------------------------

        return {
            "message": "Ambassador registered successfully.",
            "user_id": user_id,
            "ambassador_id": ambassador_id,
            "status": "PENDING",
        }


    except HTTPException:
        raise


    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {e}",
        )