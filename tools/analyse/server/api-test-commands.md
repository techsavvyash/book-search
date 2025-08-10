# API Testing Commands

## 🚀 Prerequisites

1. Start the server: `bun run dev`
2. Set your `GOOGLE_API_KEY` in the `.env` file

## 📋 Available Endpoints

### 1. Health Check (Simple Test)

```bash
curl -X GET http://localhost:3000/health
```

**Expected Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "gemini": "connected"
  }
}
```

### 2. Get API Information

```bash
curl -X GET http://localhost:3000/
```

### 3. Get JSON Schema

```bash
curl -X GET http://localhost:3000/schema
```

### 4. Get Analysis Prompt

```bash
curl -X GET http://localhost:3000/prompt
```

### 5. Main Analysis Endpoint (Full Test)

```bash
curl -X POST http://localhost:3000/analyze \
  -F "textFile=@./test-files/sample-story.txt" \
  -F "pdfFile=@./test-files/sample-story.pdf"
```

## 📱 **POSTMAN SETUP**

### For the Main Analysis Endpoint:

1. **Method**: `POST`
2. **URL**: `http://localhost:3000/analyze`
3. **Headers**: Leave empty (Content-Type will be set automatically)
4. **Body**:
   - Select `form-data`
   - Add Key: `textFile`, Type: `File`, Value: Select your `.txt` file
   - Add Key: `pdfFile`, Type: `File`, Value: Select your `.pdf` file

### For Other Endpoints:

- **Method**: `GET`
- **URLs**:
  - `http://localhost:3000/health`
  - `http://localhost:3000/schema`
  - `http://localhost:3000/prompt`
  - `http://localhost:3000/`

## 🧪 Test Files Location

- Text file: `./test-files/sample-story.txt`
- PDF file: `./test-files/sample-story.pdf`

## ✅ Expected Analysis Response Format

```json
{
  "success": true,
  "data": {
    "characters": {
      "primary": ["Nemo", "Fish", "Little Fish"],
      "secondary": ["Shelly", "Turtle", "Old Turtle", "Sea creatures"]
    },
    "settings": {
      "primary": ["Ocean", "Deep blue ocean", "Coral reef"],
      "secondary": ["Deeper waters", "Reef", "Sea"]
    },
    "themes": {
      "primary": ["Adventure", "Courage", "Exploration", "Friendship"],
      "secondary": ["Safety", "Wisdom", "Discovery", "Growing up"]
    },
    "events": {
      "primary": [
        "Nemo, a curious little fish, meets wise turtle Shelly",
        "Shelly warns Nemo about staying safe near the coral reef",
        "Nemo ventures into deeper waters and discovers new wonders"
      ],
      "secondary": [
        "Nemo returns home excited to share his adventure",
        "Shelly gives advice about following your heart while staying safe"
      ]
    },
    "emotions": {
      "primary": ["Curiosity", "Bravery", "Excitement", "Wonder"],
      "secondary": ["Caution", "Wisdom", "Pride", "Inspiration"]
    },
    "keywords": [
      "fish",
      "ocean",
      "reef",
      "turtle",
      "adventure",
      "exploration",
      "courage",
      "discovery"
    ]
  }
}
```

## 🚨 Common Issues

### Error: No API key

```json
{
  "success": false,
  "error": "GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required"
}
```

**Solution**: Set your API key in `.env` file

### Error: File validation failed

```json
{
  "success": false,
  "error": "Both textFile and pdfFile are required"
}
```

**Solution**: Make sure both files are included in the form-data

### Error: Invalid file type

```json
{
  "success": false,
  "error": "Text file must be a .txt file"
}
```

**Solution**: Use `.txt` and `.pdf` file extensions
