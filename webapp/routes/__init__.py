"""
Route blueprints for the web application.
"""

from .api import bp as api_bp
from .web import bp as web_bp

__all__ = ["api_bp", "web_bp"]
