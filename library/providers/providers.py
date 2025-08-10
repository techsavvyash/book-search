"""
Multi-provider embedding model with fallback support.
"""

import logging
import os
import time
from typing import List

import numpy as np
import requests

logger = logging.getLogger(__name__)


class APIEmbeddingModel:
    """Embedding model with multi-provider support and local fallback."""

    def __init__(self):
        self.provider = os.getenv("EMBEDDING_PROVIDER", "openai").lower()
        self.api_key = None
        self.base_url = None
        self.model_name = None
        self.dimension = None
        self.local_model = None

        self._initialize_provider()

    def _initialize_provider(self) -> None:
        if self.provider == "openai":
            self.api_key = os.getenv("OPENAI_API_KEY")
            self.base_url = "https://api.openai.com/v1/embeddings"
            self.model_name = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
            self.dimension = 1536
        elif self.provider == "google":
            self.api_key = os.getenv("GOOGLE_API_KEY")
            self.base_url = "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent"
            self.model_name = "embedding-001"
            self.dimension = 768
        elif self.provider == "cohere":
            self.api_key = os.getenv("COHERE_API_KEY")
            self.base_url = "https://api.cohere.ai/v1/embed"
            self.model_name = os.getenv("COHERE_EMBEDDING_MODEL", "embed-english-light-v3.0")
            self.dimension = 384
        elif self.provider == "huggingface":
            self.api_key = os.getenv("HUGGINGFACE_API_KEY")
            self.model_name = os.getenv("HUGGINGFACE_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            self.base_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.model_name}"
            self.dimension = 384
        else:
            self._fallback_to_local()
            return

        if self.provider != "local" and not self.api_key:
            logger.warning("No API key configured for %s, falling back to local model", self.provider)
            self._fallback_to_local()

    def _fallback_to_local(self) -> None:
        """Use a local embedding model. If sentence-transformers is not available,
        fall back to a lightweight deterministic embedder suitable for tests.
        """
        try:
            from sentence_transformers import SentenceTransformer

            self.local_model = SentenceTransformer("all-MiniLM-L6-v2")
            self.provider = "local"
            self.dimension = 384
            logger.info("Using local SentenceTransformer model")
        except Exception:
            # Lightweight deterministic embedder to avoid heavyweight deps in CI/tests
            class _DummyEmbedder:
                def __init__(self, dimension: int = 128) -> None:
                    self.dimension = dimension

                def encode(self, texts: List[str]) -> np.ndarray:  # type: ignore[override]
                    vectors = []
                    for text in texts:
                        seed = abs(hash(text)) % (2**32)
                        rng = np.random.default_rng(seed)
                        vec = rng.normal(size=self.dimension).astype(np.float32)
                        norm = np.linalg.norm(vec) + 1e-8
                        vectors.append(vec / norm)
                    return np.vstack(vectors)

            self.local_model = _DummyEmbedder()
            self.provider = "local"
            self.dimension = self.local_model.dimension
            logger.info("Using lightweight dummy embedder (sentence-transformers unavailable)")

    def encode(self, texts: List[str], max_retries: int = 3) -> np.ndarray:
        if self.provider == "local":
            return self.local_model.encode(texts)

        for attempt in range(max_retries):
            try:
                if self.provider == "openai":
                    return self._encode_openai(texts)
                if self.provider == "google":
                    return self._encode_google(texts)
                if self.provider == "cohere":
                    return self._encode_cohere(texts)
                if self.provider == "huggingface":
                    return self._encode_huggingface(texts)
            except Exception as error:  # noqa: BLE001 broad for resiliency
                logger.warning("Embedding attempt %s failed for %s: %s", attempt + 1, self.provider, error)
                if attempt == max_retries - 1:
                    logger.error("All embedding attempts failed, falling back to local model")
                    self._fallback_to_local()
                    return self.local_model.encode(texts)
                time.sleep(2**attempt)

        # Safety fallback
        return self.local_model.encode(texts)

    def _encode_openai(self, texts: List[str]) -> np.ndarray:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {"input": texts, "model": self.model_name}
        response = requests.post(self.base_url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()
        vectors = [item["embedding"] for item in result["data"]]
        return np.array(vectors)

    def _encode_google(self, texts: List[str]) -> np.ndarray:
        from google import genai

        client = genai.Client()
        result = client.models.embed_content(
            model=self.model_name,
            contents=texts,
            config=genai.types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        return np.array(result.embeddings)

    def _encode_cohere(self, texts: List[str]) -> np.ndarray:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {"texts": texts, "model": self.model_name, "input_type": "search_document"}
        response = requests.post(self.base_url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()
        return np.array(result["embeddings"])

    def _encode_huggingface(self, texts: List[str]) -> np.ndarray:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {"inputs": texts, "options": {"wait_for_model": True}}
        response = requests.post(self.base_url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        return np.array(result)

    def get_sentence_embedding_dimension(self) -> int:
        return int(self.dimension)
