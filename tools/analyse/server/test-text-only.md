# Testing the Text-Only Analysis API

This guide shows how to test the new `/analyze-text` endpoint that analyzes children's stories using only text files (no PDF required).

## Prerequisites

1. Server is running on port 3000
2. You have a `.txt` file with a children's story

## Test Commands

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. Get Text-Only Prompt Template

```bash
curl http://localhost:3000/prompt-text
```

### 3. Test Text-Only Analysis

```bash
# Using a story from the STEM-text-files directory
curl -X POST http://localhost:3000/analyze-text \
  -F "textFile=@../../STEM-text-files/10115-what-s-neema-eating-today.txt"
```

### 4. Compare with Full Analysis (Text + PDF)

```bash
# This requires both text and PDF files
curl -X POST http://localhost:3000/analyze \
  -F "textFile=@../../STEM-text-files/10115-what-s-neema-eating-today.txt" \
  -F "pdfFile=@../data/10115-what-s-neema-eating-today.pdf"
```

## Expected Response Format

Both endpoints return the same JSON structure:

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

## Testing with JavaScript/Node.js

```javascript
// test-text-only.js
const FormData = require("form-data");
const fs = require("fs");

async function testTextOnlyAnalysis() {
  const form = new FormData();
  form.append(
    "textFile",
    fs.createReadStream(
      "../../STEM-text-files/10115-what-s-neema-eating-today.txt"
    )
  );

  try {
    const response = await fetch("http://localhost:3000/analyze-text", {
      method: "POST",
      body: form,
    });

    const result = await response.json();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testTextOnlyAnalysis();
```

## Advantages of Text-Only API

1. **Faster Processing**: No PDF processing required
2. **Lower Resource Usage**: Smaller payload, less memory usage
3. **Simpler Integration**: Only need text files
4. **Better for Batch Processing**: Ideal for processing large volumes of text files
5. **Development Friendly**: Easier to test and debug with plain text
