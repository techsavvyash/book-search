import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { Queue, Worker, Job, QueueEvents } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const execAsync = promisify(exec);

interface TranslationData {
  ok: boolean;
  data: {
    downloadLinks: { type: string; href: string }[];
    downloadLinksMobile: { type: string; href: string[] }[];
    translations: any[];
    [key: string]: any;
  };
}

interface StoryJob {
  swCode: string;
  storySlug: string;
}

interface ProcessResult {
  success: boolean;
  files: {
    translationData: boolean;
    textFile: boolean;
    pdfFile: boolean;
  };
  error?: string;
}

const SESSION_COOKIE = "_session_id=86d99bf95e09c0d2a53b1d9d9dbc1c85";
const TEXT_FILES_DIR = "../STEM-text-files";
const PDF_FILES_DIR = "pdf-assets";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: redisUrl.includes("upstash.io") ? {} : undefined, // Enable TLS for Upstash
});

// Queue setup with rate limiting
const storyQueue = new Queue("story-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Queue events for monitoring
const queueEvents = new QueueEvents("story-processing", {
  connection: redisConnection,
});

async function createDirectories() {
  const dirs = [
    "translations-and-videos",
    PDF_FILES_DIR,
    "temp-downloads",
    TEXT_FILES_DIR,
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function extractSWCodesFromCatalog(): string[] {
  const catalogPath = path.join(__dirname, "catalog.xml");
  const xmlContent = fs.readFileSync(catalogPath, "utf-8");

  const pdfLinkRegex =
    /<link type="application\/pdf\+zip" href="https:\/\/storyweaver\.org\.in\/api\/v0\/story\/pdf\/(SW-\d+)"/g;
  const swCodes: string[] = [];

  let match;
  while ((match = pdfLinkRegex.exec(xmlContent)) !== null) {
    swCodes.push(match[1]);
  }

  console.log(`📚 Found ${swCodes.length} SW codes in catalog`);
  return swCodes;
}

function loadStoryMetadata(): Record<string, string> {
  const metadataPath = path.join(
    __dirname,
    "..",
    "story_meta_tags_comprehensive.json"
  );
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  const storyMapping: Record<string, string> = {};
  for (const story of metadata) {
    const filename = story.filename;
    const match = filename.match(/^(\d+)-(.+)\.txt$/);
    if (match) {
      const storyId = match[1];
      const storySlug = match[2];
      const fullSlug = `${storyId}-${storySlug}`;
      storyMapping[storyId] = fullSlug;
    }
  }

  console.log(
    `📋 Loaded ${Object.keys(storyMapping).length} known story mappings`
  );
  return storyMapping;
}

async function tryDiscoverStorySlug(swCode: string): Promise<string | null> {
  const numericId = swCode.replace("SW-", "");

  const patterns = [
    numericId,
    `${numericId}-story`,
    `${numericId}-untitled`,
    `story-${numericId}`,
  ];

  for (const pattern of patterns) {
    try {
      const apiUrl = `https://storyweaver.org.in/node/api/v1/stories/${pattern}/translations_and_videos`;
      const response = await fetch(apiUrl, {
        headers: {
          Cookie: SESSION_COOKIE,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (response.ok) {
        return pattern;
      }
    } catch (error) {
      // Continue trying other patterns
    }
  }

  return null;
}

async function fetchTranslationsAndVideos(
  storySlug: string
): Promise<TranslationData | null> {
  try {
    const apiUrl = `https://storyweaver.org.in/node/api/v1/stories/${storySlug}/translations_and_videos`;

    const response = await fetch(apiUrl, {
      headers: {
        Cookie: SESSION_COOKIE,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TranslationData;
    return data;
  } catch (error) {
    throw new Error(`API request failed: ${error}`);
  }
}

function findEnglishStory(
  data: TranslationData,
  originalSlug: string
): string | null {
  // Check if the original story is in English
  if (originalSlug.includes("-") && !originalSlug.match(/^\d+-\d+/)) {
    return originalSlug; // Likely English if it has descriptive slug
  }

  // Look for English translations
  if (data.data.translations) {
    for (const translation of data.data.translations) {
      if (
        translation.language === "English" ||
        translation.language.includes("English")
      ) {
        return translation.slug;
      }
    }
  }

  return null; // No English version found
}

async function downloadAndExtractFiles(
  storySlug: string,
  data: TranslationData
): Promise<{ pdf: boolean; text: boolean }> {
  const result = { pdf: false, text: false };

  try {
    // Extract PDF links from downloadLinks only (skip mobile links)
    const pdfLinks: string[] = [];
    if (data.data.downloadLinks) {
      for (const link of data.data.downloadLinks) {
        if (link.type === "PDF") {
          pdfLinks.push(link.href);
          break; // Only take the first one
        }
      }
    }

    if (pdfLinks.length === 0) {
      return result;
    }

    const assetUrl = pdfLinks[0];
    const response = await fetch(assetUrl, {
      headers: {
        Cookie: SESSION_COOKIE,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return result;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip empty files
    if (buffer.length < 1024) {
      return result;
    }

    // Check ZIP header
    const zipMagicNumber = buffer.subarray(0, 4);
    const isPkZip = zipMagicNumber[0] === 0x50 && zipMagicNumber[1] === 0x4b;

    if (!isPkZip) {
      return result;
    }

    // Extract ZIP
    const tempZipFile = `temp-downloads/${storySlug}.zip`;
    const extractDir = `temp-downloads/${storySlug}`;

    fs.writeFileSync(tempZipFile, buffer);
    await execAsync(`unzip -o "${tempZipFile}" -d "${extractDir}"`);

    // Find all files in extracted content
    const extractedFiles = fs.readdirSync(extractDir, { recursive: true });

    // Process PDF files
    const pdfFiles = extractedFiles.filter(
      (file) => typeof file === "string" && file.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length > 0) {
      const pdfFile = pdfFiles[0];
      const sourcePath = path.join(extractDir, pdfFile as string);
      const filename = `${PDF_FILES_DIR}/${storySlug}.pdf`;

      fs.copyFileSync(sourcePath, filename);
      result.pdf = true;
    }

    // Process text files (look for .txt files, especially attribution files)
    const textFiles = extractedFiles.filter(
      (file) => typeof file === "string" && file.toLowerCase().endsWith(".txt")
    );

    if (textFiles.length > 0) {
      // Find the story content file (usually longer than attribution)
      let mainTextFile = textFiles[0];

      for (const textFile of textFiles) {
        const textPath = path.join(extractDir, textFile as string);
        const content = fs.readFileSync(textPath, "utf-8");

        // If this file looks like story content (longer and doesn't start with "Title:")
        if (content.length > 500 && !content.startsWith("Title:")) {
          mainTextFile = textFile;
          break;
        }
      }

      if (mainTextFile) {
        const sourcePath = path.join(extractDir, mainTextFile as string);
        const filename = `${TEXT_FILES_DIR}/${storySlug}.txt`;

        fs.copyFileSync(sourcePath, filename);
        result.text = true;
      }
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(tempZipFile);

    return result;
  } catch (error) {
    throw new Error(`Download/extract failed: ${error}`);
  }
}

function saveTranslationData(
  storySlug: string,
  data: TranslationData
): boolean {
  try {
    const filename = `translations-and-videos/${storySlug}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

// Worker function to process individual stories
async function processStory(job: Job<StoryJob>): Promise<ProcessResult> {
  const { swCode, storySlug } = job.data;

  job.updateProgress(10);

  try {
    // Fetch translation data
    const data = await fetchTranslationsAndVideos(storySlug);
    if (!data) {
      throw new Error("Failed to fetch translation data");
    }

    job.updateProgress(30);

    // Find English version
    const englishSlug = findEnglishStory(data, storySlug);
    if (!englishSlug) {
      return {
        success: true,
        files: { translationData: false, textFile: false, pdfFile: false },
      };
    }

    job.updateProgress(50);

    // Save translation data
    const translationSaved = saveTranslationData(englishSlug, data);

    job.updateProgress(70);

    // Download and extract files
    const downloadResult = await downloadAndExtractFiles(englishSlug, data);

    job.updateProgress(100);

    return {
      success: true,
      files: {
        translationData: translationSaved,
        textFile: downloadResult.text,
        pdfFile: downloadResult.pdf,
      },
    };
  } catch (error) {
    throw new Error(`Processing failed for ${swCode}: ${error}`);
  }
}

// Create worker with rate limiting
const worker = new Worker("story-processing", processStory, {
  connection: redisConnection,
  concurrency: 3, // Process 3 jobs concurrently
  limiter: {
    max: 10, // Maximum 10 jobs
    duration: 60000, // per 60 seconds (1 minute)
  },
});

// Worker event handlers
worker.on("completed", (job, result: ProcessResult) => {
  const { swCode } = job.data;
  console.log(
    `✅ ${swCode}: Text=${result.files.textFile}, PDF=${result.files.pdfFile}, Translation=${result.files.translationData}`
  );
});

worker.on("failed", (job, err) => {
  if (job) {
    const { swCode } = job.data;
    console.log(`❌ ${swCode}: ${err.message}`);
  }
});

worker.on("progress", (job, progress) => {
  const { swCode } = job.data;
  console.log(`🔄 ${swCode}: ${progress}%`);
});

// Queue event handlers for monitoring
queueEvents.on("completed", ({ jobId }) => {
  // Job completed
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.log(`Job ${jobId} failed: ${failedReason}`);
});

async function addStoriesToQueue(
  swCodes: string[],
  storyMapping: Record<string, string>
) {
  console.log("🔄 Adding stories to queue...");

  let addedCount = 0;
  let discoveredCount = 0;
  const maxDiscovery = 100; // Limit initial discovery

  for (let i = 0; i < swCodes.length; i++) {
    const swCode = swCodes[i];
    const numericId = swCode.replace("SW-", "");
    let storySlug = storyMapping[numericId];

    // Try to discover mapping if not known
    if (!storySlug && discoveredCount < maxDiscovery) {
      console.log(
        `🔍 Discovering ${swCode}... (${discoveredCount + 1}/${maxDiscovery})`
      );
      const discoveredSlug = await tryDiscoverStorySlug(swCode);
      if (discoveredSlug) {
        storySlug = discoveredSlug;
      }
      discoveredCount++;

      // Rate limit discovery
      if (discoveredCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (storySlug) {
      await storyQueue.add(
        "process-story",
        { swCode, storySlug },
        {
          priority: 1000 - i, // Higher priority for earlier items
          delay: addedCount * 100, // Stagger job addition
        }
      );
      addedCount++;
    }
  }

  console.log(
    `📋 Added ${addedCount} jobs to queue (discovered ${discoveredCount} new mappings)`
  );
  return addedCount;
}

async function getQueueStats() {
  const waiting = await storyQueue.getWaiting();
  const active = await storyQueue.getActive();
  const completed = await storyQueue.getCompleted();
  const failed = await storyQueue.getFailed();

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    total: waiting.length + active.length + completed.length + failed.length,
  };
}

async function monitorProgress() {
  const interval = setInterval(async () => {
    const stats = await getQueueStats();
    const processed = stats.completed + stats.failed;
    const total = stats.total;
    const percentage =
      total > 0 ? ((processed / total) * 100).toFixed(1) : "0.0";

    console.log(
      `📊 Progress: ${processed}/${total} (${percentage}%) | Active: ${stats.active} | Failed: ${stats.failed}`
    );

    if (stats.waiting === 0 && stats.active === 0) {
      console.log("🎉 All jobs completed!");
      clearInterval(interval);

      // Show final stats
      const finalStats = await getQueueStats();
      console.log("\n📊 Final Statistics:");
      console.log(
        `  - Total processed: ${finalStats.completed + finalStats.failed}`
      );
      console.log(`  - Successful: ${finalStats.completed}`);
      console.log(`  - Failed: ${finalStats.failed}`);
      console.log(
        `  - Success rate: ${(
          (finalStats.completed / (finalStats.completed + finalStats.failed)) *
          100
        ).toFixed(1)}%`
      );

      // Close connections
      await worker.close();
      await storyQueue.close();
      await queueEvents.close();
      await redisConnection.quit();

      process.exit(0);
    }
  }, 10000); // Check every 10 seconds
}

async function main() {
  console.log("📚 Story Weaver BullMQ Scraper Starting...\n");

  // Test Redis connection
  try {
    await redisConnection.ping();
    console.log("✅ Redis connection successful");
  } catch (error) {
    console.error("❌ Redis connection failed:", error);
    process.exit(1);
  }

  // Create output directories
  await createDirectories();

  // Extract SW codes from catalog
  const swCodes = extractSWCodesFromCatalog();

  // Load story metadata
  const storyMapping = loadStoryMetadata();

  // Clear any existing jobs (optional - remove if you want to resume)
  await storyQueue.obliterate();

  // Add stories to queue
  const jobCount = await addStoriesToQueue(swCodes, storyMapping);

  if (jobCount === 0) {
    console.log("❌ No jobs to process. Exiting...");
    process.exit(1);
  }

  console.log(
    `🚀 Starting to process ${jobCount} stories with rate limiting...`
  );
  console.log("📁 Files will be saved in:");
  console.log(`  - Text files: ${TEXT_FILES_DIR}/`);
  console.log(`  - PDF files: ${PDF_FILES_DIR}/`);
  console.log(`  - Translation data: translations-and-videos/`);
  console.log("\n🔍 Monitoring progress...\n");

  // Start monitoring
  await monitorProgress();
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⚠️  Shutting down gracefully...");
  await worker.close();
  await storyQueue.close();
  await queueEvents.close();
  await redisConnection.quit();
  process.exit(0);
});

// Run the scraper
main().catch(async (error) => {
  console.error("💥 Fatal error:", error);
  await redisConnection.quit();
  process.exit(1);
});
