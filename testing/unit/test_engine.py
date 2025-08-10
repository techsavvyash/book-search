"""
Unit tests for the search engine.
"""

import pytest
from library import StorySearchEngine


class TestStorySearchEngine:
    """Test cases for the StorySearchEngine."""

    def test_engine_initialization(self):
        """Test search engine initializes correctly."""
        engine = StorySearchEngine()
        
        assert engine.model is not None
        assert isinstance(engine.stories, dict)
        assert len(engine.stories) == 0
        assert engine.weights is not None
        assert "theme_primary" in engine.weights

    def test_load_data_from_csv_string(self, sample_csv_data):
        """Test loading data from CSV string."""
        engine = StorySearchEngine()
        
        engine.load_data(csv_data=sample_csv_data)
        
        assert len(engine.stories) == 2
        assert "test-story" in engine.stories
        assert "another-story" in engine.stories
        
        story = engine.stories["test-story"]
        assert story.filename == "test-story.txt"
        assert "Hero" in story.character_primary
        assert "Castle" in story.setting_primary

    def test_safe_eval_list(self):
        """Test the _safe_eval_list static method."""
        # Test list string
        result = StorySearchEngine._safe_eval_list("['a', 'b', 'c']")
        assert result == ['a', 'b', 'c']
        
        # Test semicolon separated
        result = StorySearchEngine._safe_eval_list("a; b; c")
        assert result == ['a', 'b', 'c']
        
        # Test empty string
        result = StorySearchEngine._safe_eval_list("")
        assert result == []
        
        # Test None/NaN
        result = StorySearchEngine._safe_eval_list(None)
        assert result == []

    def test_keyword_search(self):
        """Test keyword search functionality."""
        field_values = ["Hero", "Princess", "Knight"]
        
        # Exact match
        score = StorySearchEngine._keyword_search("Hero", field_values)
        assert score > 0
        
        # Partial match
        score = StorySearchEngine._keyword_search("hero", field_values)
        assert score > 0
        
        # No match
        score = StorySearchEngine._keyword_search("Dragon", field_values)
        assert score == 0
        
        # Empty query
        score = StorySearchEngine._keyword_search("", field_values)
        assert score == 0

    def test_search_empty_query(self, sample_csv_data):
        """Test search with empty query."""
        engine = StorySearchEngine()
        engine.load_data(csv_data=sample_csv_data)
        
        results = engine.search("")
        assert len(results) == 0
        
        results = engine.search("   ")
        assert len(results) == 0

    def test_search_with_results(self, sample_csv_data):
        """Test search returns results."""
        engine = StorySearchEngine()
        engine.load_data(csv_data=sample_csv_data)
        
        results = engine.search("Hero")
        assert len(results) > 0
        
        # Results should be sorted by score
        if len(results) > 1:
            assert results[0].score >= results[1].score

    def test_get_stats(self, sample_csv_data):
        """Test getting engine statistics."""
        engine = StorySearchEngine()
        engine.load_data(csv_data=sample_csv_data)
        
        stats = engine.get_stats()
        
        assert "total_stories" in stats
        assert "pinecone_connected" in stats
        assert "embedding_provider" in stats
        assert "embedding_dimension" in stats
        
        assert stats["total_stories"] == 2
        assert isinstance(stats["pinecone_connected"], bool)
        assert isinstance(stats["embedding_provider"], str)
        assert isinstance(stats["embedding_dimension"], int)
