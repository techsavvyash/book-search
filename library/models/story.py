"""
Story model representing a book/story with its metadata.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class Story:
    """
    Represents a story/book with all its searchable attributes.
    
    Attributes:
        id: Unique identifier for the story
        filename: Original filename of the story
        character_primary: Primary characters in the story
        character_secondary: Secondary characters in the story
        setting_primary: Primary settings/locations
        setting_secondary: Secondary settings/locations
        theme_primary: Primary themes explored
        theme_secondary: Secondary themes explored
        events_primary: Main events in the story
        events_secondary: Supporting events
        emotions_primary: Primary emotions conveyed
        emotions_secondary: Secondary emotions
        keywords: Additional searchable keywords
    """
    id: str
    filename: str
    character_primary: List[str]
    character_secondary: List[str]
    setting_primary: List[str]
    setting_secondary: List[str]
    theme_primary: List[str]
    theme_secondary: List[str]
    events_primary: List[str]
    events_secondary: List[str]
    emotions_primary: List[str]
    emotions_secondary: List[str]
    keywords: List[str]
