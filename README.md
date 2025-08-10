## Book Search

Hybrid story search service combining semantic and lexical ranking. Upload a CSV of stories, then search across characters, settings, themes, events, emotions, and keywords. The system degrades gracefully when external services are not configured, making local development straightforward.

### Features
- Semantic search via embeddings (OpenAI/Google/Cohere/HF), with a robust local fallback
- Keyword and fuzzy matching to complement semantics
- Optional Pinecone vector index integration
- Optional Supabase feedback persistence
- Optional SarvamAI voice search (speech-to-text)
- Lightweight Flask UI and JSON APIs

### Repository layout
- `app/` core application
  - `__init__.py` app factory, service wiring, CORS, JSON encoder
  - `routes.py` HTTP routes (JSON APIs and UI)
  - `services/` embeddings, engine, feedback, voice
  - `models.py` dataclasses (`Story`, `SearchResult`)
  - `encoders.py` `NumpyEncoder` for NumPy types
- `server.py` WSGI entrypoint (used locally and in deployments)
- `docs/` architecture, endpoints, OpenAPI spec, quickstart
- `tests/` unit and end-to-end tests

### Requirements
- Python 3.9+
- macOS/Linux/Windows
- Optional for voice search: `ffmpeg` (required by `pydub` when converting audio)

### Quickstart
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip setuptools wheel
pip install -r requirements.txt

# Optional but recommended locally for better embeddings quality
pip install sentence-transformers

# Run the server (use non-5000 port on macOS to avoid AirPlay conflicts)
PORT=5050 python server.py
```

Open: `http://127.0.0.1:${PORT:-5050}`

Health check:
```bash
curl http://127.0.0.1:${PORT:-5050}/health | jq .
```

### Configuration (environment variables)
- `EMBEDDING_PROVIDER`: one of `openai|google|cohere|huggingface|local` (defaults to provider if API key present, else falls back to local)
- `OPENAI_API_KEY` and `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `GOOGLE_API_KEY` (for Gemini query translation/refinement)
- `COHERE_API_KEY`, `COHERE_EMBEDDING_MODEL` (default `embed-english-light-v3.0`)
- `HUGGINGFACE_API_KEY`, `HUGGINGFACE_MODEL` (default `sentence-transformers/all-MiniLM-L6-v2`)
- `PINECONE_API_KEY` (enables Pinecone index)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (enables feedback persistence)
- `SARVAM_API_KEY` (enables voice search)

When these are not set, the app degrades gracefully:
- Embeddings revert to a local model (or a deterministic lightweight embedder in CI)
- Pinecone is disabled; only in-process search runs
- Feedback endpoints return empty data or 503 where appropriate
- Voice search returns 503

Tip: to force local embeddings during development or tests:
```bash
export EMBEDDING_PROVIDER=local
```

### CSV data format
The `/upload` endpoint expects a CSV with these headers:
- `filename`, `character_primary`, `character_secondary`, `setting_primary`, `setting_secondary`,
  `theme_primary`, `theme_secondary`, `events_primary`, `events_secondary`, `emotions_primary`,
  `emotions_secondary`, `keywords`

Values can be either:
- A Python-like list string, e.g. `["Hero", "Sidekick"]`, or
- A semicolon-separated string, e.g. `Hero; Sidekick`

Minimal example:
```csv
filename,character_primary,character_secondary,setting_primary,setting_secondary,theme_primary,theme_secondary,events_primary,events_secondary,emotions_primary,emotions_secondary,keywords
alpha.txt,Hero;,Sidekick;,City;,Alley;,Courage;,Friendship;,Battle;,Chase;,Hope;,Fear;,adventure; quest
```

Upload via cURL:
```bash
curl -F "file=@stories.csv" http://127.0.0.1:${PORT:-5050}/upload | jq .
```

### Searching
POST `/search` with a JSON body:
```bash
curl -X POST http://127.0.0.1:${PORT:-5050}/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "hero adventure in city", "top_k": 5}' | jq .
```

### Testing
Tests run entirely in a virtual environment and avoid external dependencies by default.
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```
Coverage configuration is defined in `pytest.ini`. End-to-end tests start a local Flask server on an ephemeral port and validate upload + search flows.

### Production notes
Use a WSGI server instead of the Flask dev server. Example:
```bash
gunicorn -w 2 -b 0.0.0.0:${PORT:-5050} server:app
```

### Documentation
- Quickstart and notes: `docs/README.md`
- Endpoints: `docs/endpoints.md`
- OpenAPI: `docs/openapi.yaml`
- Architecture: `docs/architecture.md`

## DSPYRepo

A repository for DSPY experimentation.

### Getting Started

Clone the repository:

```bash
cd tools

pip install -r requirements.txt

# Without Chain of Thought, Process default (min of 50 or total stories)
python modifiedHierarcy.py

# With Chain of Thought reasoning
python modifiedHierarcy.py --cot

# Custom stpries folder
python modifiedHierarcy.py --folder /path/to/stories --cot

# Process only 10 stories
python modifiedHierarcy.py --num_rows 10  

```