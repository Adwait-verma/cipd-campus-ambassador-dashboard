import os
import getpass

from dotenv import load_dotenv
from pwdlib import PasswordHash
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing.")

engine = create_engine(DATABASE_URL)
password_hash = PasswordHash.recommended()

email = input("Admin email: ").strip()
password = getpass.getpass("New admin password: ")

if len(password) < 6:
    raise ValueError("Password must be at least 6 characters.")

hashed = password_hash.hash(password)

with engine.begin() as conn:
    admin = conn.execute(
        text("""
            SELECT user_id, full_name, role
            FROM users
            WHERE email = :email
        """),
        {"email": email},
    ).fetchone()

    if not admin:
        raise ValueError("No user found with that email.")

    if admin._mapping["role"] != "ADMIN":
        raise ValueError("That user is not an ADMIN.")

    conn.execute(
        text("""
            UPDATE users
            SET password_hash = :password_hash
            WHERE email = :email
        """),
        {
            "password_hash": hashed,
            "email": email,
        },
    )

print("Admin password set successfully.")