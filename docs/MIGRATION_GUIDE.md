# Migration Guide: From Flask App to Library-First Architecture

This guide helps you migrate from the old `app/` structure to the new library-first architecture.

## 🏗️ Structural Changes

### Old Structure
```
app/
├── __init__.py          # Flask app factory
├── routes.py            # All routes
├── models.py            # Data models
├── encoders.py          # JSON encoders
├── utils.py             # Utilities
├── services/
│   ├── engine.py        # Search engine
│   ├── embeddings.py    # Embedding providers
│   ├── feedback.py      # Feedback storage
│   └── voice.py         # Voice processing
└── templates/
    └── index.html
```

### New Structure
```
book_search_core/        # Core library
├── models/              # Data models
├── search/              # Search engine
├── embeddings/          # Embedding providers  
├── storage/             # External services
└── utils/               # Utilities

web_app/                 # Flask web application
├── app.py               # App factory
├── routes/              # Route blueprints
└── templates/           # HTML templates
```

## 🔄 Import Changes

### Models
```python
# Old
from app.models import Story, SearchResult

# New  
from book_search_core.models import Story, SearchResult
# Or
from book_search_core import Story, SearchResult
```

### Search Engine
```python
# Old
from app.services.engine import StorySearchEngine

# New
from book_search_core.search import StorySearchEngine
# Or
from book_search_core import StorySearchEngine
```

### Embeddings
```python
# Old
from app.services.embeddings import APIEmbeddingModel

# New
from book_search_core.embeddings import APIEmbeddingModel
# Or  
from book_search_core import APIEmbeddingModel
```

### Storage Services
```python
# Old
from app.services.feedback import FeedbackDB
from app.services.voice import VoiceHandler

# New
from book_search_core.storage import FeedbackDB, VoiceHandler
# Or
from book_search_core import FeedbackDB, VoiceHandler
```

### Utilities
```python
# Old
from app.utils import translate_to_english, translate_and_refine
from app.encoders import NumpyEncoder

# New
from book_search_core.utils import translate_to_english, translate_and_refine, NumpyEncoder
# Or
from book_search_core import translate_to_english, translate_and_refine, NumpyEncoder
```

## 🚀 Running the Application

### Old Way
```bash
python server.py
```

### New Way
```bash
# Install the core library first
pip install -e .

# Run the new server
python server_new.py
```

## 🧪 Testing Changes

### Old Test Structure
```
tests/
├── conftest.py
├── test_engine_unit.py
├── test_routes_unit.py
└── test_end_to_end.py
```

### New Test Structure
```
tests_new/
├── conftest.py
├── unit/
│   ├── test_core_models.py
│   └── test_search_engine.py
└── integration/
    └── test_web_app.py
```

### Test Import Changes
```python
# Old
from app.services.engine import StorySearchEngine

# New
from book_search_core import StorySearchEngine
```

### Running Tests
```bash
# Old
pytest tests/

# New  
pytest tests_new/
```

## 📦 Installing as a Library

The core functionality is now available as an installable library:

```bash
# Development installation
pip install -e .

# Or install from source
pip install git+https://github.com/your-repo/book-search.git
```

### Using in Other Projects
```python
# Install the library
pip install book-search-core

# Use in your code
from book_search_core import StorySearchEngine, Story

engine = StorySearchEngine()
# ... use the engine
```

## 🛠️ Development Workflow

### Old Workflow
1. Edit files in `app/`
2. Run `python server.py`
3. Run tests with `pytest tests/`

### New Workflow  
1. Edit core library in `book_search_core/`
2. Edit web app in `web_app/`
3. Install in development mode: `pip install -e .`
4. Run server: `python server_new.py`
5. Run tests: `pytest tests_new/`

## 🔧 Configuration Changes

### Environment Variables
All environment variables remain the same - no changes needed.

### Flask App Factory
```python
# Old
from app import create_app

# New
from web_app.app import create_app
```

## 📁 File-by-File Migration

### Core Library Files
- `app/models.py` → `book_search_core/models/story.py` + `book_search_core/models/search_result.py`
- `app/services/engine.py` → `book_search_core/search/engine.py`
- `app/services/embeddings.py` → `book_search_core/embeddings/providers.py`
- `app/services/feedback.py` → `book_search_core/storage/feedback.py`
- `app/services/voice.py` → `book_search_core/storage/voice.py`
- `app/utils.py` → `book_search_core/utils/text_processing.py`
- `app/encoders.py` → `book_search_core/utils/encoders.py`

### Web Application Files
- `app/__init__.py` → `web_app/app.py`
- `app/routes.py` → `web_app/routes/api.py` + `web_app/routes/web.py`
- `app/templates/` → `web_app/templates/`

### Server Files
- `server.py` → `server_new.py` (updated imports)

## ⚠️ Breaking Changes

### Import Paths
All import paths have changed - update your code to use the new structure.

### Flask App Creation
```python
# Old
from app import create_app

# New
from web_app.app import create_app
```

### Direct Module Access
Some internal modules may have moved or been renamed. Use the public API from `book_search_core.__init__.py`.

## 🚨 Common Issues

### Import Errors
**Problem**: `ImportError: No module named 'app'`
**Solution**: Update imports to use `book_search_core` or `web_app`

### Module Not Found
**Problem**: `ModuleNotFoundError: No module named 'book_search_core'`
**Solution**: Install the library with `pip install -e .`

### Test Failures
**Problem**: Tests fail due to import changes
**Solution**: Update test imports and use the new test structure in `tests_new/`

### Missing Dependencies
**Problem**: Some dependencies not found
**Solution**: The core library has its own dependencies in `setup.py`. Install with `pip install -e .`

## 🎯 Migration Checklist

- [ ] Update all import statements
- [ ] Install the core library (`pip install -e .`)
- [ ] Update test files and imports
- [ ] Update deployment scripts to use `server_new.py`
- [ ] Update CI/CD to run `pytest tests_new/`
- [ ] Update documentation references
- [ ] Test all functionality works as expected

## 🤝 Getting Help

If you encounter issues during migration:

1. Check this guide for common patterns
2. Look at the new test files for usage examples
3. Examine `book_search_core/__init__.py` for available imports
4. Create an issue if you find problems not covered here

The new structure provides better modularity, testability, and reusability while maintaining all existing functionality.
