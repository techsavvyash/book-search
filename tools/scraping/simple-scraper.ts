import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const execAsync = promisify(exec);

const SESSION_COOKIE = "_session_id=86d99bf95e09c0d2a53b1d9d9dbc1c85";
const PDF_FILES_DIR = "pdf-assets";
const TEXT_FILES_DIR = "../STEM-text-files";

interface TranslationData {
  ok: boolean;
  data: {
    downloadLinks: { type: string; href: string }[];
    downloadLinksMobile: { type: string; href: string[] }[];
    translations: any[];
    [key: string]: any;
  };
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

interface ProcessStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
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
      // Continue to next pattern
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
      if (response.status === 429) {
        throw new Error(`Rate limited (429) - will retry`);
      }
      return null;
    }

    const data = (await response.json()) as TranslationData;
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("429")) {
      throw error; // Re-throw rate limit errors for retry
    }
    return null;
  }
}

function findEnglishStory(
  data: TranslationData,
  originalSlug: string
): string | null {
  if (originalSlug.includes("-") && !originalSlug.match(/^\d+-\d+/)) {
    return originalSlug;
  }

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

  return null;
}

async function downloadAndExtractFiles(
  storySlug: string,
  data: TranslationData
): Promise<{ pdf: boolean; text: boolean }> {
  let pdfDownloaded = false;
  let textDownloaded = false;

  try {
    const zipLink = data.data.downloadLinks.find((link) =>
      link.type.includes("zip")
    );

    if (!zipLink) {
      return { pdf: false, text: false };
    }

    const zipUrl = zipLink.href;
    const response = await fetch(zipUrl, {
      headers: {
        Cookie: SESSION_COOKIE,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`Download rate limited (429) - will retry`);
      }
      return { pdf: false, text: false };
    }

    const arrayBuffer = await response.arrayBuffer();
    const zipPath = path.join("temp-downloads", `${storySlug}.zip`);
    fs.writeFileSync(zipPath, Buffer.from(arrayBuffer));

    const extractDir = path.join("temp-downloads", storySlug);
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    await execAsync(
      `cd temp-downloads && unzip -o "${storySlug}.zip" -d "${storySlug}"`
    );

    const extractedFiles = fs.readdirSync(extractDir);

    for (const file of extractedFiles) {
      const filePath = path.join(extractDir, file);
      const fileExt = path.extname(file).toLowerCase();

      if (fileExt === ".pdf") {
        const targetPath = path.join(
          PDF_FILES_DIR,
          `${storySlug}${path.basename(file)}`
        );
        fs.copyFileSync(filePath, targetPath);
        pdfDownloaded = true;
      } else if (fileExt === ".txt") {
        const targetPath = path.join(TEXT_FILES_DIR, `${storySlug}.txt`);
        fs.copyFileSync(filePath, targetPath);
        textDownloaded = true;
      }
    }

    // Clean up
    fs.rmSync(zipPath);
    fs.rmSync(extractDir, { recursive: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("429")) {
      throw error; // Re-throw rate limit errors for retry
    }
    // Log other errors but don't throw
  }

  return { pdf: pdfDownloaded, text: textDownloaded };
}

function saveTranslationData(
  storySlug: string,
  data: TranslationData
): boolean {
  try {
    const filePath = path.join("translations-and-videos", `${storySlug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

async function processStory(swCode: string): Promise<ProcessResult> {
  try {
    // Discovery
    const storySlug = await tryDiscoverStorySlug(swCode);
    if (!storySlug) {
      return {
        success: false,
        files: { translationData: false, textFile: false, pdfFile: false },
        error: `Could not discover story slug for ${swCode}`,
      };
    }

    // Fetch data
    const data = await fetchTranslationsAndVideos(storySlug);
    if (!data) {
      return {
        success: false,
        files: { translationData: false, textFile: false, pdfFile: false },
        error: `Could not fetch translation data for ${storySlug}`,
      };
    }

    // Check for English version
    let englishSlug = storySlug;
    let englishData = data;

    const englishStorySlug = findEnglishStory(data, storySlug);
    if (englishStorySlug && englishStorySlug !== storySlug) {
      const fetchedEnglishData = await fetchTranslationsAndVideos(
        englishStorySlug
      );
      if (fetchedEnglishData) {
        englishSlug = englishStorySlug;
        englishData = fetchedEnglishData;
      }
    }

    // Download and extract files
    const { pdf, text } = await downloadAndExtractFiles(
      englishSlug,
      englishData
    );

    // Save translation data
    const translationSaved = saveTranslationData(englishSlug, englishData);

    const success = pdf || text || translationSaved;
    return {
      success,
      files: {
        translationData: translationSaved,
        textFile: text,
        pdfFile: pdf,
      },
      error: success
        ? undefined
        : `No files were successfully processed for ${swCode}`,
    };
  } catch (error) {
    return {
      success: false,
      files: { translationData: false, textFile: false, pdfFile: false },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Rate limiting
async function rateLimitedDelay() {
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff for rate limiting
      if (error instanceof Error && error.message.includes("429")) {
        const delay = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
        console.log(
          `⏳ Rate limited, waiting ${delay / 1000}s before retry ${
            attempt + 1
          }/${maxRetries}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error("Max retries exceeded");
}

function showProgress(stats: ProcessStats) {
  const percentage = ((stats.processed / stats.total) * 100).toFixed(1);
  console.log(
    `📊 Progress: ${stats.processed}/${stats.total} (${percentage}%) | Success: ${stats.successful} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`
  );
}

async function main() {
  console.log("🚀 Simple StoryWeaver Scraper\n");

  // Create directories
  await createDirectories();

  // Extract SW codes
  const swCodes = extractSWCodesFromCatalog();

  const stats: ProcessStats = {
    total: swCodes.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };

  console.log(`🔄 Processing ${stats.total} stories...\n`);

  // Process each story
  for (let i = 0; i < swCodes.length; i++) {
    const swCode = swCodes[i];

    try {
      // Rate limiting
      if (i > 0) {
        await rateLimitedDelay();
      }

      // Process with retry logic
      const result = await retryWithBackoff(async () => {
        return await processStory(swCode);
      });

      stats.processed++;

      if (result.success) {
        stats.successful++;
        console.log(
          `✅ ${swCode}: Text=${result.files.textFile}, PDF=${result.files.pdfFile}, Translation=${result.files.translationData}`
        );
      } else {
        stats.failed++;
        console.log(`❌ ${swCode}: ${result.error}`);
      }

      // Show progress every 10 items
      if (stats.processed % 10 === 0) {
        showProgress(stats);
      }
    } catch (error) {
      stats.processed++;
      stats.failed++;
      console.log(
        `💥 ${swCode}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Show progress on errors too
      if (stats.processed % 10 === 0) {
        showProgress(stats);
      }
    }
  }

  // Final statistics
  console.log("\n🎉 Scraping completed!");
  console.log("\n📊 Final Statistics:");
  console.log(`  - Total stories: ${stats.total}`);
  console.log(`  - Processed: ${stats.processed}`);
  console.log(`  - Successful: ${stats.successful}`);
  console.log(`  - Failed: ${stats.failed}`);
  console.log(
    `  - Success rate: ${((stats.successful / stats.processed) * 100).toFixed(
      1
    )}%`
  );

  console.log("\n📁 Files saved in:");
  console.log(`  - Text files: ${TEXT_FILES_DIR}/`);
  console.log(`  - PDF files: ${PDF_FILES_DIR}/`);
  console.log(`  - Translation data: translations-and-videos/`);
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Scraping interrupted by user. Exiting...");
  process.exit(0);
});

// Run the scraper
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
