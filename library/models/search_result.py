"""
Search result model containing a story and its relevance scores.
"""

from dataclasses import dataclass
from typing import Dict

from .story import Story


@dataclass
class SearchResult:
    """
    Represents a search result containing a story and its relevance information.
    
    Attributes:
        story: The Story object that matched the search
        score: Overall relevance score for this result
        matched_fields: Dictionary mapping field names to their individual scores
    """
    story: Story
    score: float
    matched_fields: Dict[str, float]
