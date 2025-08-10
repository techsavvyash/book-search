"""
Feedback storage using Supabase.
"""

import os
from datetime import datetime
from typing import Dict, List, Optional

from supabase import Client, create_client


class FeedbackDB:
    """
    Feedback database interface using Supabase.
    
    Handles user feedback collection and retrieval for search results.
    Gracefully handles missing configuration for development environments.
    """

    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None) -> None:
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_ANON_KEY")
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and key must be provided via params or environment variables")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self._init_db()

    def _init_db(self) -> None:
        try:
            _ = self.supabase.table("feedback").select("id").limit(1).execute()
        except Exception:
            # Non-fatal: table might not exist in local env. Instruction is documented in original file.
            pass

    def save_feedback(self, query: str, story_id: str, feedback_text: str, user_ip: Optional[str] = None) -> bool:
        """
        Save user feedback for a search result.
        
        Args:
            query: Original search query
            story_id: ID of the story being rated
            feedback_text: User's feedback text
            user_ip: User's IP address (optional)
            
        Returns:
            True if feedback was saved successfully
        """
        try:
            data = {
                "query": query,
                "story_id": story_id,
                "feedback_text": feedback_text,
                "user_ip": user_ip,
                "timestamp": datetime.utcnow().isoformat(),
            }
            result = self.supabase.table("feedback").insert(data).execute()
            return bool(getattr(result, "data", []))
        except Exception:
            return False

    def get_all_feedback(self) -> List[Dict]:
        """Get all feedback records ordered by timestamp (newest first)."""
        try:
            result = self.supabase.table("feedback").select("*").order("timestamp", desc=True).execute()
            return getattr(result, "data", [])
        except Exception:
            return []

    def get_feedback_by_story_id(self, story_id: str) -> List[Dict]:
        """Get feedback for a specific story."""
        try:
            result = self.supabase.table("feedback").select("*").eq("story_id", story_id).order("timestamp", desc=True).execute()
            return getattr(result, "data", [])
        except Exception:
            return []

    def get_recent_feedback(self, limit: int = 50) -> List[Dict]:
        """Get recent feedback with optional limit."""
        try:
            result = self.supabase.table("feedback").select("*").order("timestamp", desc=True).limit(limit).execute()
            return getattr(result, "data", [])
        except Exception:
            return []

    def delete_feedback(self, feedback_id: int) -> bool:
        """Delete a feedback record by ID."""
        try:
            result = self.supabase.table("feedback").delete().eq("id", feedback_id).execute()
            return bool(getattr(result, "data", []))
        except Exception:
            return False
