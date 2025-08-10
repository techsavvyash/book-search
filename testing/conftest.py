"""
Test configuration for the restructured book search project.
"""

import os
import sys
from pathlib import Path
import pytest

# Ensure repository root is importable during test collection
REPO_ROOT = str(Path(__file__).resolve().parents[1])
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


@pytest.fixture(autouse=True)
def _isolate_test_env(monkeypatch, tmp_path):
    """Isolate test environment from external services and local files."""
    # Ensure backup file does not pollute project directory
    monkeypatch.chdir(tmp_path)
    # Disable Pinecone and external services
    monkeypatch.setenv("PINECONE_API_KEY", "")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "")
    monkeypatch.setenv("SARVAM_API_KEY", "")
    monkeypatch.setenv("GOOGLE_API_KEY", "")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "local")
    monkeypatch.setenv("TEST_DB", "0")


@pytest.fixture
def sample_story_data():
    """Sample story data for testing."""
    return {
        "filename": "test-story.txt",
        "character_primary": ["Hero", "Princess"],
        "character_secondary": ["Wizard", "Dragon"],
        "setting_primary": ["Castle", "Forest"],
        "setting_secondary": ["Cave", "Village"],
        "theme_primary": ["Good vs Evil", "Courage"],
        "theme_secondary": ["Friendship", "Adventure"],
        "events_primary": ["Battle", "Rescue"],
        "events_secondary": ["Journey", "Discovery"],
        "emotions_primary": ["Hope", "Fear"],
        "emotions_secondary": ["Joy", "Sadness"],
        "keywords": ["magic", "quest", "kingdom"]
    }


@pytest.fixture
def sample_csv_data():
    """Sample CSV data for testing data loading."""
    return """filename,character_primary,character_secondary,setting_primary,setting_secondary,theme_primary,theme_secondary,events_primary,events_secondary,emotions_primary,emotions_secondary,keywords
test-story.txt,"['Hero', 'Princess']","['Wizard', 'Dragon']","['Castle', 'Forest']","['Cave', 'Village']","['Good vs Evil', 'Courage']","['Friendship', 'Adventure']","['Battle', 'Rescue']","['Journey', 'Discovery']","['Hope', 'Fear']","['Joy', 'Sadness']","['magic', 'quest', 'kingdom']"
another-story.txt,"['Knight']","['Squire']","['Mountain']","['River']","['Honor']","['Loyalty']","['Quest']","['Training']","['Determination']","['Doubt']","['sword', 'honor']"
"""
