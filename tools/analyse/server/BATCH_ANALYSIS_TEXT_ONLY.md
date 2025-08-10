# Batch Text-Only Analysis

This script processes multiple children's story text files using the text-only analysis API endpoint (`/analyze-text`). It's designed to be faster and more efficient than the full PDF+text analysis.

## Features

- 📚 Processes text files from multiple sources
- 🚀 Faster processing (no PDF analysis)
- 📊 Supports both `data/` and `STEM-text-files/` directories
- 💾 Exports results in JSON and CSV formats
- ⚡ Optimized batch processing with rate limiting
- 📈 Detailed progress reporting and error handling

## Prerequisites

1. **Server Running**: The analysis server must be running on `http://localhost:3000`
2. **Text Files**: Story text files in `.txt` format
3. **Dependencies**: All npm/bun dependencies installed

## File Sources

The script automatically searches for text files in:

1. **`tools/data/`** - Main data directory (prefixed with `data-` in results)
2. **`STEM-text-files/`** - STEM stories directory (prefixed with `stem-` in results)

## Usage

### Quick Start

```bash
# Make sure server is running first
bun run dev

# In a new terminal, run batch analysis
cd tools/analyse/server
bun run batch-analyze-text
```

### Step-by-Step

1. **Start the server** (if not already running):

   ```bash
   cd tools/analyse/server
   bun run dev
   ```

2. **Run the text-only batch analysis**:

   ```bash
   # From the server directory
   bun run batch-analyze-text

   # Or run directly
   bun run batch-analyze-text-only.js
   ```

## Configuration

Edit the configuration variables in `batch-analyze-text-only.js`:

```javascript
// Configuration
const DATA_FOLDER = resolve(__dirname, "../../data");
const STEM_TEXT_FOLDER = resolve(__dirname, "../../STEM-text-files");
const API_URL = "http://localhost:3000/analyze-text";
const OUTPUT_DIR = resolve(__dirname, "batch-results");
```

### Batch Processing Settings

```javascript
const BATCH_SIZE = 5; // Process 5 files at a time
const DELAY_MS = 500; // 500ms delay between batches
```

## Output Files

Results are saved in `batch-results/` with timestamps:

- **JSON**: `text-only-analysis-results-YYYY-MM-DDTHH-MM-SS-sssZ.json`
- **CSV**: `text-only-analysis-results-YYYY-MM-DDTHH-MM-SS-sssZ.csv`

### Output Structure

#### JSON Format

```json
[
  {
    "storyId": "stem-10115-what-s-neema-eating-today",
    "success": true,
    "data": {
      "characters": {
        "primary": ["Neema", "Girl"],
        "secondary": ["Family members"]
      },
      "settings": {
        "primary": ["Home", "Kitchen"],
        "secondary": ["Dining room"]
      }
      // ... full analysis data
    },
    "validationErrors": [],
    "analysisType": "text-only"
  }
]
```

#### CSV Format

Flattened structure with semicolon-separated arrays:

- `story_id`, `success`, `error`, `analysis_type`
- `characters_primary`, `characters_secondary`
- `settings_primary`, `settings_secondary`
- `themes_primary`, `themes_secondary`
- `events_primary`, `events_secondary`
- `emotions_primary`, `emotions_secondary`
- `keywords`
- `processed_at`

## Performance

### Text-Only vs Full Analysis

| Feature          | Text-Only             | Full (Text+PDF)       |
| ---------------- | --------------------- | --------------------- |
| **Speed**        | ~2-3 seconds per file | ~5-8 seconds per file |
| **Batch Size**   | 5 files               | 3 files               |
| **Delay**        | 500ms                 | 1000ms                |
| **Memory Usage** | Lower                 | Higher                |
| **API Endpoint** | `/analyze-text`       | `/analyze`            |

### Expected Processing Times

- **Small dataset** (10-20 files): ~1-2 minutes
- **Medium dataset** (50-100 files): ~5-10 minutes
- **Large dataset** (200+ files): ~20-40 minutes

## Error Handling

The script handles various error scenarios:

- **Server not running**: Exits with clear error message
- **File not found**: Skips and logs warning
- **API errors**: Logs error but continues processing
- **Network issues**: Retries with exponential backoff
- **Invalid responses**: Validation and sanitization

## Monitoring Progress

The script provides detailed progress information:

```bash
🚀 Starting batch text-only analysis...
📁 Found 150 text files to process
  - Data folder: 50 files
  - STEM files: 100 files

📦 Processing batch 1/30
📚 Analyzing stem-10115-what-s-neema-eating-today (text-only)...
✅ Successfully analyzed stem-10115-what-s-neema-eating-today (text-only)
⏱️ Waiting 500ms before next batch...

📈 SUMMARY:
Total processed: 150
Successful: 147
Failed: 3
With validation errors: 5

📊 BREAKDOWN BY SOURCE:
Data folder: 50 processed (49 successful)
STEM files: 100 processed (98 successful)
```

## Comparison with Full Analysis

Use this text-only analysis when:

✅ **Good for:**

- Quick prototyping and testing
- Batch processing large volumes
- Text-focused research
- Development and debugging
- Resource-constrained environments

❌ **Not ideal for:**

- Visual element analysis
- Layout-dependent content
- Illustration-heavy stories
- Complete multimodal analysis

## Troubleshooting

### Common Issues

1. **"Cannot connect to server"**

   ```bash
   # Start the server first
   cd tools/analyse/server
   bun run dev
   ```

2. **"No files to process"**

   - Check if text files exist in `data/` or `STEM-text-files/`
   - Verify file extensions are `.txt`

3. **Rate limiting errors**

   - Increase `DELAY_MS` in configuration
   - Reduce `BATCH_SIZE`

4. **Memory issues**
   - Process smaller batches
   - Increase system memory
   - Close other applications

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=1 bun run batch-analyze-text
```

## Integration

### Using Results in Other Scripts

```javascript
// Load results
const results = JSON.parse(
  fs.readFileSync("batch-results/text-only-analysis-results-latest.json")
);

// Filter successful analyses
const successful = results.filter((r) => r.success);

// Extract all themes
const allThemes = successful.flatMap((r) => [
  ...r.data.themes.primary,
  ...r.data.themes.secondary,
]);
```

### Custom Processing

Modify the script to add custom processing:

```javascript
// Add custom fields to the analysis result
function customProcessResult(result) {
  return {
    ...result,
    wordCount: result.textContent?.split(" ").length || 0,
    customScore: calculateCustomScore(result.data),
  };
}
```
