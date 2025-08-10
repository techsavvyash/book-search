"""
Unit tests for core models.
"""

import pytest
from library.models import Story, SearchResult


class TestStory:
    """Test cases for the Story model."""

    def test_story_creation(self, sample_story_data):
        """Test creating a story instance."""
        story = Story(
            id="test-story",
            **sample_story_data
        )
        
        assert story.id == "test-story"
        assert story.filename == "test-story.txt"
        assert "Hero" in story.character_primary
        assert "Castle" in story.setting_primary
        assert "Good vs Evil" in story.theme_primary

    def test_story_empty_lists(self):
        """Test story with empty lists."""
        story = Story(
            id="empty-story",
            filename="empty.txt",
            character_primary=[],
            character_secondary=[],
            setting_primary=[],
            setting_secondary=[],
            theme_primary=[],
            theme_secondary=[],
            events_primary=[],
            events_secondary=[],
            emotions_primary=[],
            emotions_secondary=[],
            keywords=[]
        )
        
        assert story.id == "empty-story"
        assert all(len(getattr(story, field)) == 0 for field in [
            'character_primary', 'character_secondary', 'setting_primary',
            'setting_secondary', 'theme_primary', 'theme_secondary',
            'events_primary', 'events_secondary', 'emotions_primary',
            'emotions_secondary', 'keywords'
        ])


class TestSearchResult:
    """Test cases for the SearchResult model."""

    def test_search_result_creation(self, sample_story_data):
        """Test creating a search result instance."""
        story = Story(id="test-story", **sample_story_data)
        
        result = SearchResult(
            story=story,
            score=0.85,
            matched_fields={"theme_primary": 0.9, "character_primary": 0.8}
        )
        
        assert result.story == story
        assert result.score == 0.85
        assert result.matched_fields["theme_primary"] == 0.9
        assert result.matched_fields["character_primary"] == 0.8

    def test_search_result_empty_matches(self, sample_story_data):
        """Test search result with no matched fields."""
        story = Story(id="test-story", **sample_story_data)
        
        result = SearchResult(
            story=story,
            score=0.0,
            matched_fields={}
        )
        
        assert result.story == story
        assert result.score == 0.0
        assert len(result.matched_fields) == 0
