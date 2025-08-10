"""
Hybrid story search engine combining semantic and lexical search.
"""

import ast
import io
import logging
import os
import pickle
import re
import time
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from fuzzywuzzy import fuzz
from pinecone import Pinecone, ServerlessSpec
from supabase import create_client, Client

from ..models import SearchResult, Story
from ..providers import APIEmbeddingModel

logger = logging.getLogger(__name__)


COLUMNS_MAP = {
    "story_id": "filename",
    "story_title": None,
    "level": None,
    "success": None,
    "error": None,
    "validation_errors": None,
    "analysis_type": None,
    "characters_primary": "character_primary",
    "characters_secondary": "character_secondary",
    "settings_primary": "setting_primary",
    "settings_secondary": "setting_secondary",
    "themes_primary": "theme_primary",
    "themes_secondary": "theme_secondary",
    "themes_amazon": None,
    "events_primary": "events_primary",
    "events_secondary": "events_secondary",
    "emotions_primary": "emotions_primary",
    "emotions_secondary": "emotions_secondary",
    "keywords": "keywords",
    "processed_at": None,
}


def format_column(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns=COLUMNS_MAP)
    df = df[[val for val in COLUMNS_MAP.values() if val is not None]]
    return df


class StorySearchEngine:
    """
    Hybrid search engine for stories combining semantic and lexical search.
    
    Features:
    - Multi-provider embedding support with graceful fallback
    - Pinecone vector database integration (optional)
    - Fuzzy matching for character names and keywords
    - Weighted scoring across different story attributes
    - Backup/restore functionality for offline operation
    """

    def __init__(self) -> None:
        self.model = APIEmbeddingModel()
        self.pc: Optional[Pinecone] = None
        self.index = None
        self.stories: Dict[str, Story] = {}
        self.stories_backup_file = "stories_test_backup.pkl"

        self._init_pinecone()
        self._load_stories_backup()

        self.weights = {
            "theme_primary": 0.25,
            "theme_secondary": 0.15,
            "events_primary": 0.20,
            "events_secondary": 0.10,
            "emotions_primary": 0.15,
            "emotions_secondary": 0.08,
            "setting_primary": 0.12,
            "setting_secondary": 0.08,
            "character_primary": 0.15,
            "character_secondary": 0.10,
            "keywords": 0.12,
        }

        self.semantic_fields = [
            "theme_primary",
            "theme_secondary",
            "events_primary",
            "events_secondary",
            "emotions_primary",
            "emotions_secondary",
            "setting_primary",
            "setting_secondary",
        ]

        self.keyword_fields = ["character_primary", "character_secondary", "keywords"]

    def _init_pinecone(self) -> None:
        try:
            api_key = os.getenv("PINECONE_API_KEY")
            if not api_key:
                logger.warning("PINECONE_API_KEY not found - running without Pinecone")
                return

            self.pc = Pinecone(api_key=api_key)
            embedding_dim = self.model.get_sentence_embedding_dimension()
            index_name = f"story-search-{self.model.provider}-{embedding_dim}"
            test_db = os.getenv("TEST_DB")
            if test_db != "0":
                index_name = f"story-search-{self.model.provider}-{embedding_dim}-test-{test_db}"

            if index_name not in self.pc.list_indexes().names():
                self.pc.create_index(
                    name=index_name,
                    dimension=embedding_dim,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                logger.info("Created Pinecone index %s with dim %s", index_name, embedding_dim)
            else:
                index_info = self.pc.describe_index(index_name)
                existing_dim = index_info.dimension
                if int(existing_dim) != int(embedding_dim):
                    logger.warning("Index %s dim %s != expected %s; recreating", index_name, existing_dim, embedding_dim)
                    self.pc.delete_index(index_name)
                    time.sleep(5)
                    self.pc.create_index(
                        name=index_name,
                        dimension=embedding_dim,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                    )

            self.index = self.pc.Index(index_name)
        except Exception as exc:  # noqa: BLE001 broad
            logger.error("Failed to initialize Pinecone: %s", exc)
            self.pc = None
            self.index = None

    def _sync_from_pinecone(self) -> None:
        """Placeholder for syncing stories from Pinecone.
        The original implementation attempted to reconstruct stories from vector metadata,
        which is brittle. Keep this as a no-op to preserve route compatibility.
        """
        logger.info("Sync from Pinecone is currently a no-op in the refactored service.")

    def _save_stories_supabase(self):
        """Save stories to Supabase storage"""
        
        FILE_PATH = self.stories_backup_file # local path
        bucket = os.getenv("SUPABASE_BUCKET")
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        supabase = create_client(url, key)

        with open(FILE_PATH, "rb") as f:
            supabase.storage.from_(bucket).upload(FILE_PATH, f)
        # print(f"Upload status: {res.status_code} - {res.text}")
        logger.info(f"Uploaded stories to Supabase bucket {bucket} file {FILE_PATH}")   

    def _load_stories_supabase(self):
        url = os.getenv("SUPABASE_URL")
        anon_key = os.getenv("SUPABASE_ANON_KEY")
        bucket = os.getenv("SUPABASE_BUCKET")
        FILE_PATH = self.stories_backup_file # local path        
        # Initialize Supabase client
        supabase = create_client(url, anon_key)

        # Download file as bytes
        response = supabase.storage.from_(bucket).download(FILE_PATH)
        
        # Save the downloaded content locally
        with open(self.stories_backup_file, "wb") as f:
            f.write(response)
        logger.info(f"Loaded stories from Supabase bucket {bucket} file {FILE_PATH}")

    def _save_stories_backup(self) -> None:
        try:
            self._save_stories_supabase()
            with open(self.stories_backup_file, "wb") as f:
                pickle.dump(dict(self.stories), f)
            logger.info("Saved %s stories to backup", len(self.stories))
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to save stories backup: %s", exc)

    def _load_stories_backup(self) -> None:
        try:
            self._load_stories_supabase()
            if os.path.exists(self.stories_backup_file):
                # Override pickle's default behavior to look for Story class in __main__
                from ..models import Story  # importing here to make sure it's available
                import sys
                sys.modules['__main__'].Story = Story
                
                with open(self.stories_backup_file, "rb") as f:
                    self.stories = pickle.load(f)
                logger.info("Loaded %s stories from backup", len(self.stories))
            else:
                logger.info("No backup file found")
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to load stories backup: %s", exc)
            self.stories = {}

    @staticmethod
    def _safe_eval_list(list_str: str) -> List[str]:
        if pd.isna(list_str) or not str(list_str).strip():
            return []
        try:
            if isinstance(list_str, list):
                return list_str
            s = str(list_str)
            if s.startswith("[") and s.endswith("]"):
                return ast.literal_eval(s)
            return [item.strip().strip("\"'") for item in s.split(";")]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to parse list string %r: %s", list_str, exc)
            return []

    def load_data(self, csv_path: Optional[str] = None, csv_data: Optional[str] = None) -> None:
        """
        Load story data from CSV file or string.
        
        Args:
            csv_path: Path to CSV file
            csv_data: CSV data as string
            
        Raises:
            ValueError: If neither csv_path nor csv_data is provided
        """
        if csv_data:
            df = pd.read_csv(io.StringIO(csv_data))
            if "story_id" in df.columns:
                df = format_column(df)
        elif csv_path:
            df = pd.read_csv(csv_path)
            df = df[~df.isin(["Error parsing", "Error"]).any(axis=1)]
            if "story_id" in df.columns:
                df = format_column(df)
        else:
            raise ValueError("Either csv_path or csv_data must be provided")

        logger.info("Loaded %s rows from CSV", len(df))

        new_stories: Dict[str, Story] = {}
        for _, row in df.iterrows():
            story_id = row["filename"].replace(".txt", "")
            story = Story(
                id=story_id,
                filename=row["filename"],
                character_primary=self._safe_eval_list(row["character_primary"]),
                character_secondary=self._safe_eval_list(row["character_secondary"]),
                setting_primary=self._safe_eval_list(row["setting_primary"]),
                setting_secondary=self._safe_eval_list(row["setting_secondary"]),
                theme_primary=self._safe_eval_list(row["theme_primary"]),
                theme_secondary=self._safe_eval_list(row["theme_secondary"]),
                events_primary=self._safe_eval_list(row["events_primary"]),
                events_secondary=self._safe_eval_list(row["events_secondary"]),
                emotions_primary=self._safe_eval_list(row["emotions_primary"]),
                emotions_secondary=self._safe_eval_list(row["emotions_secondary"]),
                keywords=self._safe_eval_list(row["keywords"]),
            )
            new_stories[story_id] = story

        self.stories.update(new_stories)
        logger.info("Total stories now: %s", len(self.stories))
        self._save_stories_backup()

        if self.index:
            self._create_embeddings(new_stories)

    def _create_embeddings(self, stories_to_process: Optional[Dict[str, Story]] = None) -> None:
        try:
            stories = stories_to_process or self.stories
            vectors_to_upsert = []

            for story_id, story in stories.items():
                all_field_values: List[List[str]] = []
                for field in self.semantic_fields:
                    field_values = getattr(story, field)
                    for value in field_values or []:
                        all_field_values.append([value, field])

                if not all_field_values:
                    continue

                embeddings = self.model.encode([v for v, _ in all_field_values]).tolist()
                counter = 0
                for embedding_obj, (value, field) in zip(embeddings, all_field_values):
                    embedding = getattr(embedding_obj, "values", embedding_obj)
                    vectors_to_upsert.append(
                        {
                            "id": f"{story_id}_{field}__{counter}",
                            "values": embedding,
                            "metadata": {
                                "story_id": story_id,
                                "field": field,
                                "text": value,
                                "filename": story.filename,
                            },
                        }
                    )
                    counter += 1

            for i in range(0, len(vectors_to_upsert), 100):
                batch = vectors_to_upsert[i : i + 100]
                self.index.upsert(vectors=batch)

            logger.info("Upserted %s vectors to Pinecone", len(vectors_to_upsert))
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to create embeddings: %s", exc)

    @staticmethod
    def _keyword_search(query: str, field_values: List[str]) -> float:
        """
        Perform keyword-based search with fuzzy matching.
        
        Args:
            query: Search query
            field_values: List of field values to search in
            
        Returns:
            Average relevance score (0-1)
        """
        if not field_values or not query.strip():
            return 0.0
        
        stop_words = {
            "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "up",
            "about", "into", "through", "during", "before", "after", "above", "below", "between", "among", "is",
            "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
            "should", "could", "can", "may", "might", "must", "story", "stories", "tale", "book", "novel",
        }

        query_words = [
            w.strip().lower()
            for w in re.split(r"[\s,]+", query)
            if w.strip() and len(w.strip()) >= 3 and w.strip().lower() not in stop_words
        ]
        if not query_words:
            return 0.0

        total_score = 0.0
        field_text = " ".join(field_values).lower()
        for q in query_words:
            best = 0.0
            if q in field_text.split():
                best = 1.0
            else:
                for val in field_values:
                    fuzzy_score = fuzz.ratio(q, val.lower()) / 100.0
                    if fuzzy_score >= 0.8:
                        best = max(best, fuzzy_score * 0.8)
            total_score += best
        return float(total_score) / float(len(query_words))

    def search(self, query: str, top_k: int = 20) -> List[SearchResult]:
        """
        Perform hybrid search combining semantic and lexical matching.
        
        Args:
            query: Search query string
            top_k: Maximum number of results to return
            
        Returns:
            List of SearchResult objects sorted by relevance
        """
        if not query.strip() or not self.stories:
            return []

        results: Dict[str, Dict] = {}

        # Semantic search via Pinecone
        if self.index:
            try:
                query_embedding = self.model.encode([query])[0]
                query_embedding = getattr(query_embedding, "values", query_embedding)
                search_results = self.index.query(
                    vector=query_embedding,
                    top_k=min(1000, top_k * len(self.semantic_fields)),
                    include_metadata=True,
                )

                field_argmax: Dict[str, Dict[str, float]] = {}
                for match in search_results["matches"]:
                    field = match["metadata"]["field"]
                    story_id = match["metadata"]["story_id"]
                    field_argmax.setdefault(story_id, {})[field] = 0.0

                for match in search_results["matches"]:
                    story_id = match["metadata"]["story_id"]
                    field = match["metadata"]["field"]
                    score = float(match["score"])  # cosine similarity
                    if story_id in self.stories and score >= 0.6:
                        results.setdefault(
                            story_id,
                            {"story": self.stories[story_id], "scores": {}, "total_score": 0.0},
                        )
                        results[story_id]["scores"][field] = max(
                            field_argmax[story_id][field], score
                        )
                        field_argmax[story_id][field] = results[story_id]["scores"][field]
                        results[story_id]["total_score"] = max(
                            results[story_id]["total_score"], results[story_id]["scores"][field]
                        )
            except Exception as exc:  # noqa: BLE001
                logger.error("Pinecone search failed: %s", exc)

        # Keyword augmentation
        for story_id, story in self.stories.items():
            results.setdefault(story_id, {"story": story, "scores": {}, "total_score": 0.0})
            for field in self.keyword_fields:
                score = self._keyword_search(query, getattr(story, field))
                results[story_id]["scores"][field] = score
                results[story_id]["total_score"] += self.weights.get(field, 0.0) * score

        search_results: List[SearchResult] = []
        for story_id, data in results.items():
            if data["total_score"] > 0:
                search_results.append(
                    SearchResult(
                        story=data["story"],
                        score=float(data["total_score"]),
                        matched_fields={k: float(v) for k, v in data["scores"].items()},
                    )
                )
        search_results.sort(key=lambda x: x.score, reverse=True)
        return search_results[:top_k]

    def get_stats(self) -> Dict[str, object]:
        """Get search engine statistics."""
        return {
            "total_stories": len(self.stories),
            "pinecone_connected": self.index is not None,
            "embedding_provider": self.model.provider,
            "embedding_dimension": self.model.dimension,
        }
