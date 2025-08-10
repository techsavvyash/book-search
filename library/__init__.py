"""
Book Search Core Library

A comprehensive library for hybrid book/story search combining semantic and lexical ranking.
Supports multiple embedding providers, vector databases, and graceful degradation.
"""

__version__ = "1.0.0"

from .models import Story, SearchResult
from .engine import StorySearchEngine
from .providers import APIEmbeddingModel
from .services import FeedbackDB, VoiceHandler
from .utils import translate_to_english, translate_and_refine, get_font, NumpyEncoder

__all__ = [
    "Story",
    "SearchResult", 
    "StorySearchEngine",
    "APIEmbeddingModel",
    "FeedbackDB",
    "VoiceHandler",
    "translate_to_english",
    "translate_and_refine", 
    "get_font",
    "NumpyEncoder",
]
