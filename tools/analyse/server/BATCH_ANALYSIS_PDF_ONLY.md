# PDF-Only Analysis Documentation

This document describes the new PDF-only analysis functionality that has been added to the Children's Literature Analysis API.

## Overview

The PDF-only analysis system allows you to analyze children's storybooks using only PDF files, without requiring separate text files. This is particularly useful for the data in the `data-joyful` folder which contains only PDF files.

## Components

### 1. API Endpoint: `/analyze-pdf`

**Method:** POST  
**Content-Type:** multipart/form-data  
**Parameters:**

- `pdfFile`: A PDF file containing the children's story

**Example usage:**

```bash
curl -X POST http://localhost:3000/analyze-pdf \
  -F "pdfFile=@path/to/story.pdf"
```

### 2. Prompt Template: `prompt-pdf-only.v1-1.md`

This prompt is specifically designed for PDF-only analysis and instructs the AI to:

- Analyze both text content and visual elements from the PDF
- Extract detailed attributes including characters, settings, themes, events, emotions, and keywords
- Consider visual storytelling elements from illustrations
- Include themes conveyed through artistic style and colors

**Access the prompt:**

```bash
curl http://localhost:3000/prompt-pdf
```

### 3. Batch Analysis Script: `batch-analyze-pdf-only.ts`

A TypeScript script that processes all PDF files from the `data-joyful` folder in batches.

**Features:**

- Processes PDFs from the `../../data-joyful` directory
- Rate limiting with configurable batch size and delays
- Generates both JSON and CSV output files
- Comprehensive error handling and progress reporting
- Results saved to `batch-results/` directory

## Usage Instructions

### Prerequisites

1. **Start the Analysis Server:**

   ```bash
   cd tools/analyse/server
   bun run dev
   ```

2. **Verify Server is Running:**
   ```bash
   curl http://localhost:3000/health
   ```

### Single PDF Analysis

Analyze a single PDF file:

```bash
curl -X POST http://localhost:3000/analyze-pdf \
  -F "pdfFile=@../../data-joyful/352163-paati-s-gold.pdf" \
  | jq .
```

### Batch Analysis

Run the batch analysis script to process all PDFs in the `data-joyful` folder:

```bash
cd tools/analyse/server
bun run batch-analyze-pdf-only.ts
```

## Configuration

### Batch Script Configuration

You can modify these constants in `batch-analyze-pdf-only.ts`:

```typescript
const BATCH_SIZE = 3; // Number of PDFs to process simultaneously
const DELAY_MS = 1000; // Delay between batches in milliseconds
```

### Rate Limiting Guidelines

- **BATCH_SIZE**: Set to 3 for PDF analysis (slower than text-only)
- **DELAY_MS**: Set to 1000ms to avoid overwhelming the API
- PDF processing is more resource-intensive than text-only analysis

## Output Files

### JSON Output

- **Location:** `batch-results/pdf-only-analysis-results-[timestamp].json`
- **Format:** Array of analysis results with full structured data

### CSV Output

- **Location:** `batch-results/pdf-only-analysis-results-[timestamp].csv`
- **Format:** Flattened results suitable for spreadsheet analysis

### Output Structure

Each analysis result contains:

```json
{
  "storyId": "joyful-352163-paati-s-gold",
  "success": true,
  "data": {
    "story_title": "Paati's Gold",
    "characters": {
      "primary": ["Paati", "Grandmother"],
      "secondary": ["Family members"]
    },
    "settings": {
      "primary": ["Home", "Kitchen"],
      "secondary": ["Garden", "Village"]
    },
    "themes": {
      "primary": ["Family, Personal & Social Issues"],
      "secondary": ["Tradition", "Family bonds", "Cooking"]
    },
    "events": {
      "primary": ["Story events in chronological order"],
      "secondary": ["Supporting plot details"]
    },
    "emotions": {
      "primary": ["Love", "Tradition", "Pride"],
      "secondary": ["Nostalgia", "Warmth"]
    },
    "keywords": ["cooking", "recipes", "grandmother", "tradition"]
  },
  "validationErrors": [],
  "analysisType": "pdf-only"
}
```

## Error Handling

The system includes comprehensive error handling:

- **Server connectivity checks** before starting batch processing
- **File validation** to ensure PDF format
- **API response validation** with retry logic
- **Result sanitization** for malformed AI responses
- **Detailed error reporting** in both console and output files

## Performance Considerations

### Processing Speed

- PDF analysis is slower than text-only analysis due to:
  - PDF parsing overhead
  - Visual element analysis
  - Larger file sizes being sent to the AI

### Resource Usage

- Each PDF file is converted to base64 for API transmission
- Memory usage scales with PDF file sizes
- Batch processing helps manage resource consumption

## Data Sources

### data-joyful Folder

- **Location:** `tools/data-joyful/`
- **Content:** ~55 PDF storybooks
- **Naming:** Files follow pattern `[id]-[title].pdf`
- **Processing:** All PDFs are automatically discovered and processed

## API Endpoints Summary

| Endpoint       | Method | Purpose                      |
| -------------- | ------ | ---------------------------- |
| `/analyze-pdf` | POST   | Analyze single PDF file      |
| `/prompt-pdf`  | GET    | Get PDF-only prompt template |
| `/health`      | GET    | Check server status          |
| `/`            | GET    | List all available endpoints |

## Troubleshooting

### Common Issues

1. **Server not running:**

   ```bash
   # Check if server is running
   curl http://localhost:3000/health
   ```

2. **PDF file too large:**

   - Check file size (recommend < 10MB)
   - Verify PDF is not corrupted

3. **Analysis failures:**

   - Check server logs for detailed error messages
   - Verify GOOGLE_API_KEY or GEMINI_API_KEY is set

4. **Batch script TypeScript errors:**

   ```bash
   # Install dependencies
   bun install

   # Run with explicit runtime
   bun run batch-analyze-pdf-only.ts
   ```

### Monitoring Progress

The batch script provides real-time progress updates:

- Files discovered and processing status
- Batch completion progress
- Success/failure counts
- Detailed error reporting for failed analyses

## Comparison with Other Analysis Types

| Analysis Type | Input     | Visual Analysis | Use Case                |
| ------------- | --------- | --------------- | ----------------------- |
| PDF + Text    | PDF + TXT | ✅ Full         | Best accuracy           |
| Text Only     | TXT       | ❌ None         | Fast processing         |
| **PDF Only**  | PDF       | ✅ Full         | No text files available |

The PDF-only analysis is ideal when:

- Text files are not available
- Visual elements are important for analysis
- You want comprehensive analysis from a single file source
