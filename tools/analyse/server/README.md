# Children's Literature Analysis Server

A TypeScript server built with Bun that analyzes children's stories using Google's Gemini API via the new `@google/genai` SDK.

## Features

- 📚 Analyzes children's literature from text and PDF files
- 🤖 Uses Gemini 2.0 Flash via the latest `@google/genai` SDK
- ✅ JSON schema validation for consistent results
- 🚀 Fast and efficient with Bun runtime
- 📊 Structured output with primary/secondary categorization

## Setup

### Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

1. Clone or navigate to the server directory:

```bash
cd tools/analyse/server
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

```bash
# Create .env file
echo "GOOGLE_API_KEY=your_actual_api_key_here" > .env
echo "PORT=3000" >> .env
```

4. Start the development server:

```bash
bun run dev
```

## API Endpoints

### POST `/analyze`

Analyzes a children's story using text and PDF files.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `textFile`: Text file (.txt) containing the story content
  - `pdfFile`: PDF file of the storybook

**Response:**

```json
{
  "success": true,
  "data": {
    "characters": {
      "primary": ["Character names and types"],
      "secondary": ["Supporting characters"]
    },
    "settings": {
      "primary": ["Main settings"],
      "secondary": ["Background settings"]
    },
    "themes": {
      "primary": ["Core themes"],
      "secondary": ["Supporting themes"]
    },
    "events": {
      "primary": ["Main plot points"],
      "secondary": ["Supporting events"]
    },
    "emotions": {
      "primary": ["Core emotions"],
      "secondary": ["Supporting emotions"]
    },
    "keywords": ["Relevant keywords"]
  }
}
```

### POST `/analyze-text`

Analyzes a children's story using text file only (no PDF required).

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `textFile`: Text file (.txt) containing the story content

**Response:**

Same JSON structure as `/analyze` endpoint above.

### GET `/health`

Health check endpoint to verify server and Gemini API status.

### GET `/schema`

Returns the JSON schema used for validation.

### GET `/prompt`

Returns the analysis prompt template (for PDF + text analysis).

### GET `/prompt-text`

Returns the text-only analysis prompt template.

## Usage Examples

```bash
# Using curl for full analysis (text + PDF)
curl -X POST http://localhost:3000/analyze \
  -F "textFile=@story.txt" \
  -F "pdfFile=@story.pdf"

# Using curl for text-only analysis
curl -X POST http://localhost:3000/analyze-text \
  -F "textFile=@story.txt"
```

## Development

```bash
# Development with hot reload
bun run dev

# Production build
bun run build

# Type checking
bun run type-check

# Batch processing (requires both text and PDF files)
bun run batch-analyze

# Text-only batch processing (requires only text files)
bun run batch-analyze-text
```

## Environment Variables

- `GOOGLE_API_KEY` - Your Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) (required)
- `GEMINI_API_KEY` - Alternative name for the API key (backward compatibility)
- `PORT` - Server port (default: 3000)
- `DEBUG` - Enable debug logging (optional)

## Technology Stack

- **Bun** - Fast JavaScript runtime
- **Hono** - Lightweight web framework
- **@google/genai** - Official Google Gemini SDK with Gemini 2.0 support
- **AJV** - JSON schema validation
- **TypeScript** - Type safety

## Project Structure

```
src/
├── index.ts        # Main server file
├── gemini.ts       # Gemini API service
├── validator.ts    # JSON schema validation
└── types.ts        # TypeScript type definitions
schema.json         # JSON schema for validation
prompt.md          # Analysis prompt template
```

## API Key Setup

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey) and add it to your `.env` file:

```bash
GOOGLE_API_KEY=your_actual_api_key_here
```
