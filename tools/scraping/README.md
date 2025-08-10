# StoryWeaver BullMQ Scraper

A robust, queue-based scraper for downloading stories from StoryWeaver.org using Redis and BullMQ for reliable task management and rate limiting.

## Features

- ✅ **Redis-based queue management** with BullMQ
- ✅ **Rate limiting** to respect API limits (10 requests per minute)
- ✅ **Resumable downloads** with persistent state
- ✅ **Concurrent processing** (3 workers)
- ✅ **Automatic retry** with exponential backoff
- ✅ **English story filtering**
- ✅ **PDF and text file extraction** from ZIP archives
- ✅ **Progress monitoring** with detailed statistics
- ✅ **Graceful shutdown** handling

## Requirements

1. **Redis server** running locally or accessible via URL
2. **Node.js** or **Bun** runtime
3. **Environment variables** in `.env` file

## Setup

1. **Install dependencies:**

   ```bash
   cd tools
   npm install
   # or
   bun install
   ```

2. **Set up Redis:**

   ```bash
   # Install Redis (macOS)
   brew install redis

   # Start Redis server
   redis-server
   ```

3. **Configure environment:**
   Create a `.env` file in the parent directory:
   ```env
   REDIS_URL=redis://localhost:6379
   ```

## Usage

### Single Command to Run Everything

```bash
npm run scrape
```

This command will:

1. Connect to Redis and verify the connection
2. Extract all 1,614 SW codes from `catalog.xml`
3. Load existing story mappings from metadata
4. Discover new story slugs (up to 200 additional)
5. Queue all stories for processing
6. Download PDF and text files with rate limiting
7. Save files to appropriate directories
8. Show real-time progress updates

### Alternative Commands

```bash
# Using Bun (TypeScript version)
npm run scrape-ts

# Development mode with auto-reload
npm run dev
```

## Output Structure

Files are saved to:

```
tools/
├── pdf-assets/           # PDF files
├── translations-and-videos/  # API response data
├── temp-downloads/       # Temporary ZIP extraction
└── ../STEM-text-files/   # Story text files
```

## Queue Management

The scraper uses BullMQ with Redis for robust queue management:

- **Queue name:** `story-processing`
- **Concurrency:** 3 workers processing simultaneously
- **Rate limit:** 10 jobs per minute
- **Retry logic:** 3 attempts with exponential backoff
- **Job persistence:** Completed jobs kept for debugging

## Progress Monitoring

The scraper shows real-time progress:

```
📊 Progress: 45/210 (21.4%) | Active: 3 | Failed: 2
✅ SW-12345: Text=true, PDF=true, Translation=true
🔄 SW-67890: 70%
❌ SW-11111: Failed to fetch translation data
```

## Rate Limiting

The scraper respects API limits:

- **Discovery phase:** 2-second delays every 10 requests
- **Processing phase:** 10 jobs per 60 seconds
- **Job staggering:** 100ms delay between job additions

## Graceful Shutdown

Press `Ctrl+C` to stop the scraper gracefully:

```
⚠️  Shutting down gracefully...
```

This ensures:

- Current jobs finish processing
- Queue connections are properly closed
- Redis connections are terminated
- Progress state is preserved

## Resuming Downloads

To resume from where you left off:

1. Comment out the `await storyQueue.obliterate()` line in the script
2. Run the scraper again

The queue will pick up where it stopped, processing only remaining jobs.

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check Redis URL in .env
echo $REDIS_URL
```

### No Jobs to Process

- Verify `catalog.xml` exists in tools directory
- Check if `story_meta_tags_comprehensive.json` exists in parent directory
- Increase `maxDiscovery` limit in the script if needed

### API Rate Limiting

The scraper automatically handles rate limiting. If you see many failures:

- Reduce `concurrency` (currently 3)
- Reduce `max` jobs per duration (currently 10/minute)
- Increase delays in discovery phase

## Statistics

Upon completion, you'll see:

```
📊 Final Statistics:
  - Total processed: 150
  - Successful: 142
  - Failed: 8
  - Success rate: 94.7%
```

## File Processing

For each story, the scraper:

1. Fetches translation data via API
2. Filters for English versions only
3. Downloads ZIP file containing PDF and text
4. Extracts main story text file (not attribution)
5. Saves PDF, text, and translation data separately

The text file selection prioritizes story content over attribution files by checking file length and content patterns.
