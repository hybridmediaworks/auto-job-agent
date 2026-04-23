"""
backend/migrate.py

Run database migrations manually.

Usage (from project root):
    python backend/migrate.py

Safe to run multiple times — all migrations are idempotent.
"""

import sys
from pathlib import Path

# Add backend/ to path so app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import init_db

if __name__ == "__main__":
    print("Running database migrations...")
    init_db()
    print("Done.")
