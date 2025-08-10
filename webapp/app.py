"""
Flask application factory for the book search web app.
"""

import logging
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from library import (
    StorySearchEngine,
    FeedbackDB,
    VoiceHandler,
    NumpyEncoder,
)
from .routes import api_bp, web_bp


def create_app() -> Flask:
    """
    Application factory that wires up services, blueprints, and config.
    
    Returns:
        Configured Flask application instance
    """
    load_dotenv()

    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    app = Flask(__name__)
    CORS(app)
    app.json_encoder = NumpyEncoder

    # Initialize core services (singletons)
    search_engine = StorySearchEngine()
    
    # Feedback/Voice are optional in local dev; avoid crashing when env vars are missing
    try:
        feedback_db = FeedbackDB()
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("FeedbackDB not initialized: %s", exc)
        feedback_db = None
        
    try:
        voice_handler = VoiceHandler()
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("VoiceHandler not initialized: %s", exc)
        voice_handler = None

    # Expose services via app config so routes can access them
    app.config["SEARCH_ENGINE"] = search_engine
    app.config["FEEDBACK_DB"] = feedback_db
    app.config["VOICE_HANDLER"] = voice_handler

    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(web_bp)

    return app
