"""
Web UI routes for the book search application.
"""

from flask import Blueprint, render_template

bp = Blueprint("web", __name__)


@bp.route("/")
def home() -> str:
    """Main web interface for book search."""
    return render_template("index.html")
