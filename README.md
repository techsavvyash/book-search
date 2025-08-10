# Book Search - Hybrid Story Search System

A clean, modular monorepo containing a hybrid story search system that combines semantic and lexical ranking. The project follows a library-first architecture with clear separation of concerns.

## 🏗️ Architecture

```
book-search/
├── library/                 # Core search library
│   ├── models/             # Data models (Story, SearchResult)
│   ├── engine/             # Search engine and algorithms
│   ├── providers/          # Multi-provider embedding support
│   ├── services/           # External services (feedback, voice)
│   └── utils/              # Utilities and helpers
├── webapp/                 # Flask web application
│   ├── routes/             # API and web routes
│   └── templates/          # HTML templates
├── scripts/                # Utility scripts and automation
├── examples/               # Example usage and demos
├── config/                 # Configuration files
├── data/                   # Sample and test data
├── testing/                # Test suites
│   ├── unit/               # Unit tests for core library
│   └── integration/        # Integration tests for web app
├── tools/                  # Analysis and data processing tools
└── docs/                   # Documentation
```

## ✨ Features

### Core Library (`library/`)
- **Hybrid Search**: Combines semantic embeddings with lexical/fuzzy matching
- **Multi-Provider Embeddings**: OpenAI, Google, Cohere, HuggingFace, with local fallback
- **Vector Database**: Optional Pinecone integration for semantic search
- **Graceful Degradation**: Works offline with local embeddings
- **Modular Design**: Clean separation of concerns for easy testing and reuse

### Web Application (`webapp/`)
- **RESTful API**: JSON endpoints for search, upload, feedback
- **Voice Search**: Speech-to-text integration via SarvamAI
- **Feedback System**: User feedback collection via Supabase
- **File Upload**: CSV data ingestion for story metadata
- **Web UI**: Simple HTML interface for interactive search

### Tools & Analysis
- **Story Analysis**: Automated meta-tag generation using DSPy and Gemini
- **Data Scraping**: Tools for collecting story data from various sources
- **Batch Processing**: Efficient processing of large story collections

## 🚀 Quick Start

### 1. Install the Core Library

```bash
# Clone the repository
git clone <repository-url>
cd book-search

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install the core library in development mode
pip install -e .

# Install additional dependencies
pip install -r requirements.txt
```

### 2. Run the Web Application

```bash
# Set environment variables (optional)
export EMBEDDING_PROVIDER=local  # Use local embeddings
export PORT=5050                 # Avoid macOS AirPlay conflict

# Start the web server
python server.py
```

### 3. Access the Application

- **Web UI**: http://localhost:5050
- **Health Check**: http://localhost:5050/health
- **API Documentation**: See `docs/endpoints.md`

## 🔧 Configuration

### Environment Variables

#### Core Search Engine
- `EMBEDDING_PROVIDER`: `openai|google|cohere|huggingface|local` (default: auto-detect)
- `PINECONE_API_KEY`: Enable vector database (optional)

#### Embedding Providers
- `OPENAI_API_KEY` + `OPENAI_EMBEDDING_MODEL` (default: text-embedding-3-small)
- `GOOGLE_API_KEY` + `GEMINI_MODEL` (for query translation)
- `COHERE_API_KEY` + `COHERE_EMBEDDING_MODEL`
- `HUGGINGFACE_API_KEY` + `HUGGINGFACE_MODEL`

#### External Services
- `SUPABASE_URL` + `SUPABASE_ANON_KEY`: Enable feedback storage
- `SARVAM_API_KEY`: Enable voice search

### Graceful Degradation

The system works without any external services:
- **No API keys**: Falls back to local embeddings
- **No Pinecone**: Uses in-memory search only
- **No Supabase**: Disables feedback features
- **No SarvamAI**: Disables voice search

## 📚 Using the Core Library

### Basic Search Engine

```python
from library import StorySearchEngine

# Initialize engine
engine = StorySearchEngine()

# Load data from CSV
engine.load_data(csv_path="stories.csv")

# Search stories
results = engine.search("brave hero adventure", top_k=10)

for result in results:
    print(f"Story: {result.story.filename}")
    print(f"Score: {result.score}")
    print(f"Matches: {result.matched_fields}")
```

### Working with Models

```python
from library.models import Story, SearchResult

# Create a story
story = Story(
    id="hero-story",
    filename="hero.txt",
    character_primary=["Hero", "Princess"],
    theme_primary=["Courage", "Adventure"],
    # ... other fields
)

# Create search result
result = SearchResult(
    story=story,
    score=0.85,
    matched_fields={"theme_primary": 0.9}
)
```

### Custom Embedding Providers

```python
from library.providers import APIEmbeddingModel

# Initialize with specific provider
model = APIEmbeddingModel()
embeddings = model.encode(["story about courage"])
```

## 🧪 Testing

### Run All Tests

```bash
# Install test dependencies (if not already installed)
pip install pytest pytest-cov

# Run tests with coverage
pytest testing/ --cov=library --cov=webapp
```

### Test Categories

- **Unit Tests** (`testing/unit/`): Test core library components in isolation
- **Integration Tests** (`testing/integration/`): Test web application end-to-end

### Test Configuration

Tests automatically:
- Disable external services (Pinecone, Supabase, etc.)
- Use local embeddings for speed
- Isolate file system operations
- Provide sample data fixtures

## 🛠️ Development

### Project Structure Guidelines

1. **Core Library First**: All business logic goes in `library/`
2. **Web App as Client**: `webapp/` only contains Flask-specific code
3. **Tools are Standalone**: `tools/` can use the core library but remain independent
4. **Tests Mirror Structure**: Test organization follows code organization

### Adding New Features

1. **Models**: Add to `library/models/`
2. **Search Logic**: Extend `library/engine/`
3. **External Services**: Add to `library/services/`
4. **Web Endpoints**: Add to `webapp/routes/`
5. **Tests**: Add corresponding tests in `testing/`

## 📖 API Reference

### Search API

```bash
# Search stories
curl -X POST http://localhost:5050/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "brave hero adventure", "top_k": 5}'
```

### Upload API

```bash
# Upload CSV data
curl -F "file=@stories.csv" http://localhost:5050/upload
```

### Voice Search API

```bash
# Upload audio for voice search
curl -F "audio=@query.wav" http://localhost:5050/voice-search
```

## 📊 Data Format

### CSV Structure

The system expects CSV files with these columns:

```csv
filename,character_primary,character_secondary,setting_primary,setting_secondary,theme_primary,theme_secondary,events_primary,events_secondary,emotions_primary,emotions_secondary,keywords
story1.txt,"['Hero', 'Princess']","['Wizard']","['Castle']","['Forest']","['Courage']","['Friendship']","['Battle']","['Journey']","['Hope']","['Fear']","['magic', 'quest']"
```

Values can be:
- Python list strings: `"['Hero', 'Princess']"`
- Semicolon-separated: `"Hero; Princess"`

## 🚀 Production Deployment

### Using Gunicorn

```bash
# Install gunicorn (already in requirements.txt)
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -b 0.0.0.0:$PORT server:app
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install -e .
RUN pip install -r requirements.txt

EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "server:app"]
```

### Environment Configuration

For production, set these environment variables:
- `EMBEDDING_PROVIDER=openai` (or your preferred provider)
- `OPENAI_API_KEY=your_key`
- `PINECONE_API_KEY=your_key` (for better search performance)
- `SUPABASE_URL=your_url` + `SUPABASE_ANON_KEY=your_key` (for feedback)

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes following the project structure**
4. **Add tests for new functionality**
5. **Run the test suite**: `pytest testing/`
6. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **DSPy** for structured AI generation
- **Pinecone** for vector database capabilities
- **OpenAI, Google, Cohere, HuggingFace** for embedding APIs
- **Flask** for the web framework
- **SarvamAI** for voice processing capabilities