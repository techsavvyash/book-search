import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

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

interface StoryMapping {
  swCode: string;
  storySlug: string;
}

interface QueueItem {
  swCode: string;
  storySlug: string;
  status: "pending" | "processing" | "completed" | "failed";
  lastAttempt?: string;
  error?: string;
  downloads: {
    translationData: boolean;
    textFile: boolean;
    pdfFile: boolean;
  };
}

interface QueueState {
  totalItems: number;
  completed: number;
  failed: number;
  currentIndex: number;
  lastUpdated: string;
  queue: QueueItem[];
}

const SESSION_COOKIE = "_session_id=86d99bf95e09c0d2a53b1d9d9dbc1c85";
const QUEUE_STATE_FILE = "download-queue-state.json";
const TEXT_FILES_DIR = "../STEM-text-files";
const PDF_FILES_DIR = "pdf-assets";

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

  // Extract SW codes from PDF links
  const pdfLinkRegex =
    /<link type="application\/pdf\+zip" href="https:\/\/storyweaver\.org\.in\/api\/v0\/story\/pdf\/(SW-\d+)"/g;
  const swCodes: string[] = [];

  let match;
  while ((match = pdfLinkRegex.exec(xmlContent)) !== null) {
    swCodes.push(match[1]);
  }

  console.log(`Found ${swCodes.length} SW codes in catalog`);
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

  console.log(`Loaded ${Object.keys(storyMapping).length} story mappings`);
  return storyMapping;
}

async function tryDiscoverStorySlug(swCode: string): Promise<string | null> {
  const numericId = swCode.replace("SW-", "");

  // Try common patterns for story slug discovery
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
        console.log(`✅ Discovered mapping: ${swCode} -> ${pattern}`);
        return pattern;
      }
    } catch (error) {
      // Continue trying other patterns
    }
  }

  return null;
}

function loadQueueState(): QueueState | null {
  if (fs.existsSync(QUEUE_STATE_FILE)) {
    try {
      const data = fs.readFileSync(QUEUE_STATE_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading queue state:", error);
    }
  }
  return null;
}

function saveQueueState(state: QueueState) {
  fs.writeFileSync(QUEUE_STATE_FILE, JSON.stringify(state, null, 2));
}

async function initializeQueue(
  swCodes: string[],
  storyMapping: Record<string, string>
): Promise<QueueState> {
  const existingState = loadQueueState();

  if (existingState) {
    console.log(
      `📋 Resuming from existing queue: ${existingState.completed}/${existingState.totalItems} completed`
    );
    return existingState;
  }

  console.log("🔄 Initializing new download queue...");

  const queue: QueueItem[] = [];

  // Discover mappings for a subset first (to avoid overwhelming the API)
  const maxDiscovery = 50; // Limit discovery to prevent rate limiting
  let discoveryCount = 0;

  for (const swCode of swCodes) {
    const numericId = swCode.replace("SW-", "");
    let storySlug = storyMapping[numericId];

    if (!storySlug && discoveryCount < maxDiscovery) {
      console.log(
        `🔍 Discovering ${swCode}... (${discoveryCount + 1}/${maxDiscovery})`
      );
      const discoveredSlug = await tryDiscoverStorySlug(swCode);
      if (discoveredSlug) {
        storySlug = discoveredSlug;
      }
      discoveryCount++;

      if (discoveryCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Rate limiting
      }
    }

    if (storySlug) {
      queue.push({
        swCode,
        storySlug,
        status: "pending",
        downloads: {
          translationData: false,
          textFile: false,
          pdfFile: false,
        },
      });
    }
  }

  const state: QueueState = {
    totalItems: queue.length,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    lastUpdated: new Date().toISOString(),
    queue,
  };

  saveQueueState(state);
  console.log(`📋 Queue initialized: ${queue.length} items ready for download`);

  return state;
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
      console.error(`API request failed for ${storySlug}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as TranslationData;
    return data;
  } catch (error) {
    console.error(`Error fetching ${storySlug}:`, error);
    return null;
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

// Text files are now extracted from ZIP archives along with PDFs

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
      console.log(`    ⚠️  No PDF links found for ${storySlug}`);
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
      console.log(
        `    ⚠️  ZIP download failed for ${storySlug}: ${response.status}`
      );
      return result;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip empty files
    if (buffer.length < 1024) {
      console.log(`    ⚠️  ZIP too small for ${storySlug}`);
      return result;
    }

    // Check ZIP header
    const zipMagicNumber = buffer.subarray(0, 4);
    const isPkZip = zipMagicNumber[0] === 0x50 && zipMagicNumber[1] === 0x4b;

    if (!isPkZip) {
      console.log(`    ⚠️  Not a valid ZIP file for ${storySlug}`);
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
      const stats = fs.statSync(filename);
      console.log(
        `    ✅ PDF file: ${filename} (${(stats.size / 1024 / 1024).toFixed(
          2
        )} MB)`
      );
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
        const stats = fs.statSync(filename);
        console.log(
          `    ✅ Text file: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`
        );
        result.text = true;
      }
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(tempZipFile);

    return result;
  } catch (error) {
    console.error(
      `    ❌ Error downloading/extracting files for ${storySlug}:`,
      error
    );
    return result;
  }
}

function saveTranslationData(
  storySlug: string,
  data: TranslationData
): boolean {
  try {
    const filename = `translations-and-videos/${storySlug}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`    ✅ Translation data: ${filename}`);
    return true;
  } catch (error) {
    console.error(
      `    ❌ Error saving translation data for ${storySlug}:`,
      error
    );
    return false;
  }
}

async function processQueueItem(
  item: QueueItem,
  state: QueueState
): Promise<void> {
  console.log(`\n--- Processing ${item.swCode} -> ${item.storySlug} ---`);
  console.log(
    `Progress: ${state.currentIndex + 1}/${state.totalItems} (${
      state.completed
    } completed, ${state.failed} failed)`
  );

  item.status = "processing";
  item.lastAttempt = new Date().toISOString();

  try {
    // Fetch translation data
    const data = await fetchTranslationsAndVideos(item.storySlug);
    if (!data) {
      throw new Error("Failed to fetch translation data");
    }

    // Find English version
    const englishSlug = findEnglishStory(data, item.storySlug);
    if (!englishSlug) {
      console.log(`    ⚠️  No English version found, skipping...`);
      item.status = "completed";
      state.completed++;
      return;
    }

    console.log(`    📖 English version: ${englishSlug}`);

    // Save translation data
    item.downloads.translationData = saveTranslationData(englishSlug, data);

    // Download and extract both PDF and text files from ZIP
    const downloadResult = await downloadAndExtractFiles(englishSlug, data);
    item.downloads.textFile = downloadResult.text;
    item.downloads.pdfFile = downloadResult.pdf;

    item.status = "completed";
    state.completed++;

    console.log(
      `    ✅ Completed ${item.swCode}: Text=${item.downloads.textFile}, PDF=${item.downloads.pdfFile}`
    );
  } catch (error) {
    console.error(`    ❌ Failed to process ${item.swCode}:`, error);
    item.status = "failed";
    item.error = error instanceof Error ? error.message : String(error);
    state.failed++;
  }

  // Update state
  state.currentIndex++;
  state.lastUpdated = new Date().toISOString();
  saveQueueState(state);
}

async function processQueue(state: QueueState) {
  console.log(`\n🚀 Starting queue processing...`);
  console.log(
    `📊 Queue status: ${state.completed}/${state.totalItems} completed, ${state.failed} failed`
  );

  const startIndex = state.currentIndex;

  for (let i = startIndex; i < state.queue.length; i++) {
    const item = state.queue[i];

    if (item.status === "completed") {
      continue; // Skip already completed items
    }

    await processQueueItem(item, state);

    // Rate limiting - wait between requests
    if (i < state.queue.length - 1) {
      console.log(`    ⏳ Waiting 3 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n🎉 Queue processing completed!`);
  console.log(`📊 Final statistics:`);
  console.log(`  - Total items: ${state.totalItems}`);
  console.log(`  - Completed: ${state.completed}`);
  console.log(`  - Failed: ${state.failed}`);
  console.log(
    `  - Success rate: ${((state.completed / state.totalItems) * 100).toFixed(
      1
    )}%`
  );
}

async function main() {
  console.log("📚 Story Weaver Queue Downloader Starting...\n");

  // Create output directories
  await createDirectories();

  // Extract SW codes from catalog
  const swCodes = extractSWCodesFromCatalog();

  // Load story metadata
  const storyMapping = loadStoryMetadata();

  // Initialize or resume queue
  const state = await initializeQueue(swCodes, storyMapping);

  if (state.totalItems === 0) {
    console.log("❌ No items in queue. Exiting...");
    return;
  }

  // Process the queue
  await processQueue(state);

  console.log(`\n📁 Files saved in:`);
  console.log(`  - Text files: ${TEXT_FILES_DIR}/`);
  console.log(`  - PDF files: ${PDF_FILES_DIR}/`);
  console.log(`  - Translation data: translations-and-videos/`);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Process interrupted. Progress has been saved.");
  console.log("💡 Run the script again to resume from where it left off.");
  process.exit(0);
});

// Run the downloader
main().catch(console.error);
