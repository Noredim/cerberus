"""
Accent-insensitive search utilities for SQLAlchemy queries.

Uses PostgreSQL's native unaccent() extension, which is already enabled
in this database (created by the CNAE ETL script).

Usage:
    from src.core.search import unaccent_ilike, build_search_term

    query = query.filter(unaccent_ilike(Model.column, search_term))
"""
from sqlalchemy import func


def unaccent(column):
    """Wraps a column or expression with PostgreSQL unaccent()."""
    return func.unaccent(column)


def unaccent_ilike(column, term: str):
    """
    Returns a filter clause equivalent to:
        unaccent(column) ILIKE unaccent('%term%')

    This makes the search accent-insensitive so that searching 'cam'
    also matches 'câm', 'cám', 'cãm', etc.
    """
    return func.unaccent(column).ilike(func.unaccent(f"%{term}%"))
