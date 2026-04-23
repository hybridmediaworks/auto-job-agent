"""
backend/app/models/base.py

SQLAlchemy declarative base for all models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass
