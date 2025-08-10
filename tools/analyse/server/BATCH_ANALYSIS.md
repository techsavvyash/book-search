# Batch Analysis Tool

This script processes all storybook files in the `/data` folder through the analysis API and generates both CSV and JSON output files.

## Prerequisites

1. Make sure the analysis server is running:

   ```bash
   bun run start
   ```

2. Install the required dependencies (if not already installed):
   ```bash
   bun install
   ```

## Running the Batch Analysis

### Option 1: Using npm script

```bash
bun run batch-analyze
```

### Option 2: Direct execution

```bash
./batch-analyze.js
```

### Option 3: Using node/bun directly

```bash
bun batch-analyze.js
```

## What it does

1. **Scans the data folder**: Finds all `.txt` files and their corresponding `.pdf` files
2. **Rate limiting**: Processes files in batches of 3 with 1-second delays to avoid overwhelming the API
3. **Error handling**: Continues processing even if some files fail
4. **Progress tracking**: Shows real-time progress and status
5. **Output generation**: Creates both CSV and JSON files with timestamped filenames

## Output Files

Files are saved in the `batch-results/` directory:

- `analysis-results-{timestamp}.json` - Complete analysis results in JSON format
- `analysis-results-{timestamp}.csv` - Flattened data in CSV format

## CSV Columns

The CSV file will contain the following columns:

| Column                 | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `story_id`             | The base filename (e.g., "5699-how-old-is-muttajji") |
| `story_title`          | The title extracted from the analysis                |
| `level`                | Reading level (if detected)                          |
| `success`              | Whether the analysis succeeded (true/false)          |
| `error`                | Error message (if analysis failed)                   |
| `validation_errors`    | Any validation issues (semicolon-separated)          |
| `characters_primary`   | Main characters (semicolon-separated)                |
| `characters_secondary` | Supporting characters (semicolon-separated)          |
| `settings_primary`     | Main settings (semicolon-separated)                  |
| `settings_secondary`   | Supporting settings (semicolon-separated)            |
| `themes_primary`       | Main themes (semicolon-separated)                    |
| `themes_secondary`     | Supporting themes (semicolon-separated)              |
| `events_primary`       | Main plot events (semicolon-separated)               |
| `events_secondary`     | Supporting events (semicolon-separated)              |
| `emotions_primary`     | Primary emotions (semicolon-separated)               |
| `emotions_secondary`   | Supporting emotions (semicolon-separated)            |
| `keywords`             | All keywords (semicolon-separated)                   |
| `processed_at`         | ISO timestamp of when the analysis was completed     |

## Example Usage

```bash
# Start the server in one terminal
cd tools/analyse/server
bun run start

# Run batch analysis in another terminal
cd tools/analyse/server
bun run batch-analyze
```

## Monitoring Progress

The script provides detailed console output including:

- ✅ Successful analyses
- ❌ Failed analyses
- ⚠️ Missing file pairs
- 📊 Final summary with success/failure counts

## Error Handling

- If a PDF is missing for a text file, it will be skipped with a warning
- If an individual analysis fails, the script continues with the next file
- Network errors are retried automatically by the underlying fetch implementation
- All errors are logged and included in the final summary
