import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";

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

function extractStoriesFromCatalog(): { swCode: string; storySlug: string }[] {
  const catalogPath = path.join(__dirname, "catalog.xml");
  const xmlContent = fs.readFileSync(catalogPath, "utf-8");

  // Extract entries between <entry> tags
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const stories: { swCode: string; storySlug: string }[] = [];

  let entryMatch;
  while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
    const entryContent = entryMatch[1];

    // Extract SW code from the PDF link - looking for both formats
    const swCodeMatch =
      entryContent.match(
        /<link[^>]*type="application\/pdf\+zip"[^>]*href="https:\/\/storyweaver\.org\.in\/api\/v0\/story\/pdf\/(SW-\d+)"/
      ) ||
      entryContent.match(
        /href="https:\/\/storyweaver\.org\.in\/api\/v0\/story\/pdf\/(SW-\d+)"[^>]*type="application\/pdf\+zip"/
      );

    // Extract title
    const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);

    // Extract ID as fallback
    const idMatch = entryContent.match(/<id>urn:uuid:(SW-\d+)<\/id>/);

    if ((swCodeMatch || idMatch) && titleMatch) {
      const swCode = swCodeMatch ? swCodeMatch[1] : idMatch ? idMatch[1] : "";
      const title = titleMatch[1];

      if (!swCode) {
        console.log(`⚠️  No SW code found for title: ${title}`);
        continue;
      }

      // Generate story slug from title
      const numericId = swCode.replace("SW-", "");
      const titleSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and dashes
        .replace(/\s+/g, "-") // Replace spaces with dashes
        .replace(/-+/g, "-") // Replace multiple dashes with single dash
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes

      const storySlug = `${numericId}-${titleSlug}`;

      stories.push({ swCode, storySlug });
      console.log(`📖 Extracted: ${swCode} -> ${storySlug} (${title})`);
    } else {
      // Log failed extractions for debugging
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "Unknown title";
      console.log(`⚠️  Failed to extract SW code for: ${title}`);

      // Show the entry content for debugging (first 200 chars)
      console.log(
        `   Entry preview: ${entryContent
          .substring(0, 200)
          .replace(/\s+/g, " ")}...`
      );
    }
  }

  console.log(`📚 Extracted ${stories.length} stories from catalog`);
  return stories;
}

function loadStoryMetadata(): Record<string, string> {
  const metadataPath = path.join(
    __dirname,
    "..",
    "story_meta_tags_comprehensive.json"
  );

  if (!fs.existsSync(metadataPath)) {
    console.log("📋 No existing story metadata found, starting fresh");
    return {};
  }

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
    console.log(`🌐 API request to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        Cookie: SESSION_COOKIE,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    console.log(`📡 API response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.log(
        `❌ API request failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    // Get response text to check if it's HTML (Cloudflare protection)
    const responseText = await response.text();

    // Check if response is HTML instead of JSON (Cloudflare protection)
    if (
      responseText.trim().startsWith("<!DOCTYPE html>") ||
      responseText.includes("<html") ||
      responseText.includes("cloudflare") ||
      responseText.includes("Checking your browser")
    ) {
      console.log(`🛡️  CLOUDFLARE PROTECTION DETECTED for ${storySlug}`);
      console.log(
        `🌐 Please run this URL in your browser to bypass Cloudflare:`
      );
      console.log(`   ${apiUrl}`);
      console.log(`🔄 After bypassing, the scraper will continue...`);
      console.log(`⏸️  PAUSING execution...`);

      // Pause execution and wait for user input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      await new Promise<void>((resolve) => {
        rl.question(
          "Press Enter after you have run the URL in browser and bypassed Cloudflare...",
          () => {
            rl.close();
            resolve();
          }
        );
      });

      console.log(`🔄 Retrying API request for ${storySlug}...`);

      // Retry the request
      const retryResponse = await fetch(apiUrl, {
        headers: {
          Cookie: SESSION_COOKIE,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!retryResponse.ok) {
        console.log(
          `❌ Retry failed: ${retryResponse.status} ${retryResponse.statusText}`
        );
        return null;
      }

      const retryText = await retryResponse.text();

      // Check again if it's still HTML
      if (
        retryText.trim().startsWith("<!DOCTYPE html>") ||
        retryText.includes("<html") ||
        retryText.includes("cloudflare")
      ) {
        console.log(
          `❌ Still getting HTML response after retry for ${storySlug}`
        );
        console.log(`🔍 Response preview: ${retryText.substring(0, 200)}...`);
        return null;
      }

      // Parse the retry response
      try {
        const data = JSON.parse(retryText) as TranslationData;
        console.log(
          `✅ Successfully parsed JSON after Cloudflare bypass for ${storySlug}`
        );
        console.log(`📊 API data received for ${storySlug}:`);
        console.log(`  - OK: ${data.ok}`);
        console.log(
          `  - Download links: ${data.data?.downloadLinks?.length || 0}`
        );
        console.log(
          `  - Mobile download links: ${
            data.data?.downloadLinksMobile?.length || 0
          }`
        );
        console.log(
          `  - Translations: ${data.data?.translations?.length || 0}`
        );

        if (data.data?.downloadLinks) {
          console.log(`  📋 Download links detail:`);
          data.data.downloadLinks.forEach((link, i) => {
            console.log(`    ${i + 1}. Type: ${link.type}, URL: ${link.href}`);
          });
        }

        return data;
      } catch (parseError) {
        console.log(
          `❌ Failed to parse retry response as JSON for ${storySlug}: ${parseError}`
        );
        console.log(`🔍 Response preview: ${retryText.substring(0, 200)}...`);
        return null;
      }
    }

    // Parse the original response as JSON
    try {
      const data = JSON.parse(responseText) as TranslationData;
      console.log(`📊 API data received for ${storySlug}:`);
      console.log(`  - OK: ${data.ok}`);
      console.log(
        `  - Download links: ${data.data?.downloadLinks?.length || 0}`
      );
      console.log(
        `  - Mobile download links: ${
          data.data?.downloadLinksMobile?.length || 0
        }`
      );
      console.log(`  - Translations: ${data.data?.translations?.length || 0}`);

      if (data.data?.downloadLinks) {
        console.log(`  📋 Download links detail:`);
        data.data.downloadLinks.forEach((link, i) => {
          console.log(`    ${i + 1}. Type: ${link.type}, URL: ${link.href}`);
        });
      }

      return data;
    } catch (parseError) {
      console.log(
        `❌ Failed to parse response as JSON for ${storySlug}: ${parseError}`
      );
      console.log(`🔍 Response preview: ${responseText.substring(0, 200)}...`);
      return null;
    }
  } catch (error) {
    console.log(`💥 API request error for ${storySlug}: ${error}`);
    throw new Error(`API request failed: ${error}`);
  }
}

function findEnglishStory(
  data: TranslationData,
  originalSlug: string
): string | null {
  console.log(`    🔍 === FINDING ENGLISH VERSION for: ${originalSlug} ===`);

  // Check if the original story is in English
  const hasDescriptiveName =
    originalSlug.includes("-") && !originalSlug.match(/^\d+-\d+$/);
  console.log(`    📋 Original slug analysis:`);
  console.log(`      - Contains dash: ${originalSlug.includes("-")}`);
  console.log(
    `      - Is numeric pattern (\\d+-\\d+): ${
      originalSlug.match(/^\d+-\d+$/) ? "yes" : "no"
    }`
  );
  console.log(`      - Has descriptive name: ${hasDescriptiveName}`);

  if (hasDescriptiveName) {
    console.log(
      `    ✅ Original slug appears to be English (descriptive): ${originalSlug}`
    );
    return originalSlug;
  }

  console.log(
    `    🌍 Original slug appears non-English, searching translations...`
  );

  // Look for English translations
  if (!data.data.translations) {
    console.log(`    ❌ No translations array found in data`);
    console.log(
      `    📊 Data structure: ${JSON.stringify(Object.keys(data.data || {}))}`
    );
    return null;
  }

  console.log(
    `    📋 Found ${data.data.translations.length} translations to analyze:`
  );

  // Show first few translations for context
  data.data.translations.slice(0, 10).forEach((translation, i) => {
    console.log(
      `      ${i + 1}. "${translation.language}" -> ${
        translation.slug
      } (${translation.title.substring(0, 30)}...)`
    );
  });

  if (data.data.translations.length > 10) {
    console.log(
      `      ... and ${data.data.translations.length - 10} more translations`
    );
  }

  // Search for English
  console.log(`    🔍 Searching for English translations...`);

  for (let i = 0; i < data.data.translations.length; i++) {
    const translation = data.data.translations[i];
    const isEnglish =
      translation.language === "English" ||
      translation.language.toLowerCase().includes("english");

    console.log(
      `      Checking: "${translation.language}" -> English? ${isEnglish}`
    );

    if (isEnglish) {
      console.log(`    ✅ Found English translation: ${translation.slug}`);
      console.log(`    📖 English title: "${translation.title}"`);
      return translation.slug;
    }
  }

  console.log(
    `    ❌ No English translation found in ${data.data.translations.length} available translations`
  );
  console.log(
    `    📋 Available languages: ${data.data.translations
      .map((t) => t.language)
      .slice(0, 10)
      .join(", ")}${data.data.translations.length > 10 ? "..." : ""}`
  );
  console.log(`    === END ENGLISH SEARCH ===`);
  return null;
}

async function downloadAndExtractFiles(
  storySlug: string,
  data: TranslationData
): Promise<{ pdf: boolean; text: boolean }> {
  const result = { pdf: false, text: false };

  console.log(`\n    📥 === DOWNLOAD & EXTRACT DETAILS for ${storySlug} ===`);

  try {
    // Extract PDF links from downloadLinks only (skip mobile links)
    const pdfLinks: string[] = [];
    console.log(`    🔍 STEP 4.1: Analyzing downloadLinks...`);

    if (!data.data) {
      console.log(`    ❌ STEP 4.1 FAILED: No 'data' property in response`);
      console.log(
        `    📊 Response structure: ${JSON.stringify(Object.keys(data))}`
      );
      return result;
    }

    if (!data.data.downloadLinks) {
      console.log(
        `    ❌ STEP 4.1 FAILED: No 'downloadLinks' property in data`
      );
      console.log(
        `    📊 Data properties: ${JSON.stringify(Object.keys(data.data))}`
      );
      return result;
    }

    console.log(
      `    📋 STEP 4.1: Found ${data.data.downloadLinks.length} download links`
    );

    for (let i = 0; i < data.data.downloadLinks.length; i++) {
      const link = data.data.downloadLinks[i];
      console.log(`    📎 Link ${i + 1}: Type="${link.type}"`);
      console.log(`        URL: ${link.href}`);

      if (link.type === "PDF") {
        pdfLinks.push(link.href);
        console.log(`    ✅ Found PDF link! Added to download queue`);
        break; // Only take the first one
      }
    }

    if (pdfLinks.length === 0) {
      console.log(
        `    ❌ STEP 4.1 FAILED: No PDF links found in ${data.data.downloadLinks.length} download links`
      );
      console.log(
        `    📋 Available link types: ${data.data.downloadLinks
          .map((l) => l.type)
          .join(", ")}`
      );
      return result;
    }

    console.log(
      `    ✅ STEP 4.1 SUCCESS: Found ${pdfLinks.length} PDF link(s)`
    );

    // Download the ZIP file
    const assetUrl = pdfLinks[0];
    console.log(`\n    📦 STEP 4.2: Downloading ZIP file...`);
    console.log(`    🌐 Download URL: ${assetUrl}`);

    const response = await fetch(assetUrl, {
      headers: {
        Cookie: SESSION_COOKIE,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    console.log(
      `    📡 Download response: ${response.status} ${response.statusText}`
    );
    console.log(
      `    📊 Content-Type: ${
        response.headers.get("content-type") || "unknown"
      }`
    );
    console.log(
      `    📊 Content-Length: ${
        response.headers.get("content-length") || "unknown"
      } bytes`
    );

    if (!response.ok) {
      console.log(
        `    ❌ STEP 4.2 FAILED: HTTP ${response.status} ${response.statusText}`
      );
      return result;
    }

    console.log(`    ✅ STEP 4.2 SUCCESS: Download response received`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`    📦 Downloaded buffer size: ${buffer.length} bytes`);

    // Check file size
    if (buffer.length < 1024) {
      console.log(
        `    ❌ STEP 4.2 FAILED: File too small (${buffer.length} bytes), likely empty or error`
      );
      // Show first 100 bytes as text to see what we got
      const preview = buffer.toString("utf8", 0, Math.min(100, buffer.length));
      console.log(`    🔍 File content preview: "${preview}"`);
      return result;
    }

    // Analyze file type
    console.log(`\n    🔍 STEP 4.3: Analyzing downloaded file...`);
    const first4Bytes = buffer.subarray(0, 4);
    console.log(
      `    📊 First 4 bytes: [${first4Bytes[0]}, ${first4Bytes[1]}, ${first4Bytes[2]}, ${first4Bytes[3]}]`
    );
    console.log(
      `    📊 First 4 bytes (hex): [0x${first4Bytes[0]?.toString(
        16
      )}, 0x${first4Bytes[1]?.toString(16)}, 0x${first4Bytes[2]?.toString(
        16
      )}, 0x${first4Bytes[3]?.toString(16)}]`
    );

    const isPkZip = first4Bytes[0] === 0x50 && first4Bytes[1] === 0x4b;
    const isPdf =
      first4Bytes[0] === 0x25 &&
      first4Bytes[1] === 0x50 &&
      first4Bytes[2] === 0x44 &&
      first4Bytes[3] === 0x46; // %PDF

    console.log(`    📦 Is ZIP file: ${isPkZip}`);
    console.log(`    📄 Is PDF file: ${isPdf}`);

    if (isPdf) {
      console.log(`    ✅ STEP 4.3: Direct PDF detected, saving...`);
      const filename = `${PDF_FILES_DIR}/${storySlug}.pdf`;
      fs.writeFileSync(filename, buffer);
      console.log(`    💾 PDF saved to: ${filename}`);
      result.pdf = true;
      return result;
    }

    if (!isPkZip) {
      console.log(`    ❌ STEP 4.3 FAILED: File is neither ZIP nor PDF`);
      // Show file header as text
      const headerText = buffer.toString(
        "utf8",
        0,
        Math.min(200, buffer.length)
      );
      console.log(`    🔍 File header as text: "${headerText}"`);
      return result;
    }

    console.log(`    ✅ STEP 4.3 SUCCESS: Valid ZIP file detected`);

    // Extract ZIP
    console.log(`\n    📂 STEP 4.4: Extracting ZIP file...`);
    const tempZipFile = `temp-downloads/${storySlug}.zip`;
    const extractDir = `temp-downloads/${storySlug}`;

    console.log(`    💾 Saving ZIP to: ${tempZipFile}`);
    fs.writeFileSync(tempZipFile, buffer);

    console.log(`    📂 Extracting to: ${extractDir}`);
    try {
      const { stdout, stderr } = await execAsync(
        `unzip -o "${tempZipFile}" -d "${extractDir}"`
      );
      console.log(`    ✅ ZIP extraction successful`);
      if (stdout)
        console.log(`    📋 Unzip stdout: ${stdout.substring(0, 200)}...`);
      if (stderr)
        console.log(`    ⚠️  Unzip stderr: ${stderr.substring(0, 200)}...`);
    } catch (unzipError: any) {
      console.log(
        `    ❌ STEP 4.4 FAILED: ZIP extraction error: ${unzipError.message}`
      );
      if (unzipError.stdout)
        console.log(`    📋 Unzip stdout: ${unzipError.stdout}`);
      if (unzipError.stderr)
        console.log(`    📋 Unzip stderr: ${unzipError.stderr}`);
      throw unzipError;
    }

    // Scan extracted files
    console.log(`\n    🔍 STEP 4.5: Scanning extracted files...`);
    const extractedFiles = fs.readdirSync(extractDir, { recursive: true });
    console.log(`    📁 Found ${extractedFiles.length} extracted items:`);

    extractedFiles.forEach((file, i) => {
      const fullPath = path.join(extractDir, file as string);
      const stats = fs.statSync(fullPath);
      const type = stats.isDirectory() ? "DIR" : "FILE";
      const size = stats.isDirectory() ? 0 : stats.size;
      console.log(`      ${i + 1}. ${file} (${type}, ${size} bytes)`);
    });

    // Process PDF files
    console.log(`\n    📄 STEP 4.6: Looking for PDF files...`);
    const pdfFiles = extractedFiles.filter(
      (file) => typeof file === "string" && file.toLowerCase().endsWith(".pdf")
    );

    console.log(
      `    📄 Found ${pdfFiles.length} PDF files: ${pdfFiles.join(", ")}`
    );

    if (pdfFiles.length > 0) {
      const pdfFile = pdfFiles[0];
      const sourcePath = path.join(extractDir, pdfFile as string);
      const targetPath = `${PDF_FILES_DIR}/${storySlug}.pdf`;

      console.log(`    📄 Processing PDF: ${sourcePath} → ${targetPath}`);

      const pdfStats = fs.statSync(sourcePath);
      console.log(`    📊 PDF file size: ${pdfStats.size} bytes`);

      fs.copyFileSync(sourcePath, targetPath);
      console.log(`    ✅ PDF copied successfully`);
      result.pdf = true;
    } else {
      console.log(`    ❌ STEP 4.6: No PDF files found`);
    }

    // Process text files
    console.log(`\n    📝 STEP 4.7: Looking for text files...`);
    const textFiles = extractedFiles.filter(
      (file) => typeof file === "string" && file.toLowerCase().endsWith(".txt")
    );

    console.log(
      `    📝 Found ${textFiles.length} text files: ${textFiles.join(", ")}`
    );

    if (textFiles.length > 0) {
      let mainTextFile = textFiles[0];
      let maxLength = 0;

      console.log(`    🔍 Analyzing text files for main content...`);

      for (const textFile of textFiles) {
        const textPath = path.join(extractDir, textFile as string);
        const content = fs.readFileSync(textPath, "utf-8");
        const preview = content.substring(0, 50).replace(/\n/g, "\\n");

        console.log(
          `      - ${textFile}: ${content.length} chars, starts: "${preview}..."`
        );

        if (content.length > maxLength && content.length > 100) {
          mainTextFile = textFile;
          maxLength = content.length;
          console.log(
            `        ✅ This looks like main content (${content.length} chars)`
          );
        }
      }

      if (mainTextFile) {
        const sourcePath = path.join(extractDir, mainTextFile as string);
        const targetPath = `${TEXT_FILES_DIR}/${storySlug}.txt`;

        console.log(
          `    📝 Processing main text: ${sourcePath} → ${targetPath}`
        );
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`    ✅ Text file copied successfully`);
        result.text = true;
      }
    } else {
      console.log(`    ❌ STEP 4.7: No text files found`);
    }

    // Cleanup
    console.log(`\n    🧹 STEP 4.8: Cleaning up temporary files...`);
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(tempZipFile);
    console.log(`    ✅ Cleanup complete`);

    console.log(
      `    📊 === FINAL RESULT: PDF=${result.pdf}, Text=${result.text} ===\n`
    );
    return result;
  } catch (error) {
    console.log(`    💥 DOWNLOAD/EXTRACT ERROR: ${error}`);
    console.log(
      `    📊 === FAILED RESULT: PDF=${result.pdf}, Text=${result.text} ===\n`
    );
    throw new Error(`Download/extract failed: ${error}`);
  }
}

function saveTranslationData(
  storySlug: string,
  data: TranslationData
): boolean {
  try {
    const filename = `translations-and-videos/${storySlug}.json`;
    console.log(`💾 Saving translation data to: ${filename}`);

    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Translation data saved successfully: ${filename}`);
    return true;
  } catch (error) {
    console.log(
      `❌ Failed to save translation data for ${storySlug}: ${error}`
    );
    return false;
  }
}

// Process individual stories
async function processStory({
  swCode,
  storySlug,
}: StoryJob): Promise<ProcessResult> {
  console.log(
    `\n🎯 ============= PROCESSING ${swCode} (${storySlug}) =============`
  );

  // Add a small pause to make logs readable
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    console.log(
      `📋 STEP 1: Starting translation data fetch for ${storySlug}...`
    );
    console.log(
      `   🌐 Target URL: https://storyweaver.org.in/node/api/v1/stories/${storySlug}/translations_and_videos`
    );

    // Fetch translation data
    const data = await fetchTranslationsAndVideos(storySlug);
    if (!data) {
      console.log(
        `❌ STEP 1 FAILED: No translation data received for ${swCode}`
      );
      throw new Error("Failed to fetch translation data");
    }
    console.log(`✅ STEP 1 SUCCESS: Translation data fetched for ${swCode}`);
    console.log(
      `   📊 Data summary: OK=${data.ok}, downloadLinks=${
        data.data?.downloadLinks?.length || 0
      }`
    );

    // Add pause between steps
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(`\n🔍 STEP 2: Looking for English version of ${storySlug}...`);
    const englishSlug = findEnglishStory(data, storySlug);
    if (!englishSlug) {
      console.log(
        `⚠️  STEP 2 RESULT: No English version found for ${swCode}, will skip download`
      );
      console.log(
        `   📋 Available translations: ${data.data?.translations?.length || 0}`
      );
      if (data.data?.translations) {
        data.data.translations.slice(0, 5).forEach((t, i) => {
          console.log(`     ${i + 1}. ${t.language}: ${t.slug}`);
        });
        if (data.data.translations.length > 5) {
          console.log(`     ... and ${data.data.translations.length - 5} more`);
        }
      }

      // Still save translation data even if no English version
      console.log(`💾 STEP 3: Saving translation data for ${storySlug}...`);
      const translationSaved = saveTranslationData(storySlug, data);
      console.log(
        `${
          translationSaved ? "✅" : "❌"
        } STEP 3 RESULT: Translation data save = ${translationSaved}`
      );

      return {
        success: true,
        files: {
          translationData: translationSaved,
          textFile: false,
          pdfFile: false,
        },
      };
    }
    console.log(
      `✅ STEP 2 SUCCESS: English version found: ${englishSlug} for ${swCode}`
    );

    // Add pause
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(`\n💾 STEP 3: Saving translation data for ${englishSlug}...`);
    const translationSaved = saveTranslationData(englishSlug, data);
    console.log(
      `${
        translationSaved ? "✅" : "❌"
      } STEP 3 RESULT: Translation data save = ${translationSaved}`
    );

    // Add pause
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(
      `\n📥 STEP 4: Starting download and extraction for ${englishSlug}...`
    );
    console.log(`   🔍 Checking download links in data...`);

    if (!data.data?.downloadLinks) {
      console.log(`❌ STEP 4 FAILED: No downloadLinks array found in data`);
      console.log(
        `   📊 Data structure: ${JSON.stringify(Object.keys(data.data || {}))}`
      );
    } else {
      console.log(
        `   📋 Found ${data.data.downloadLinks.length} download links:`
      );
      data.data.downloadLinks.forEach((link, i) => {
        console.log(
          `     ${i + 1}. Type: ${link.type}, URL: ${link.href.substring(
            0,
            100
          )}...`
        );
      });
    }

    const downloadResult = await downloadAndExtractFiles(englishSlug, data);
    console.log(
      `📊 STEP 4 RESULT: PDF=${downloadResult.pdf}, Text=${downloadResult.text}`
    );

    const result = {
      success: true,
      files: {
        translationData: translationSaved,
        textFile: downloadResult.text,
        pdfFile: downloadResult.pdf,
      },
    };

    console.log(`\n🎉 JOB COMPLETED for ${swCode}:`);
    console.log(`   📋 Translation data: ${result.files.translationData}`);
    console.log(`   📝 Text file: ${result.files.textFile}`);
    console.log(`   📄 PDF file: ${result.files.pdfFile}`);
    console.log(`🎯 ============= END ${swCode} =============\n`);

    return result;
  } catch (error) {
    console.log(`💥 JOB FAILED for ${swCode}: ${error}`);
    console.log(`🎯 ============= FAILED ${swCode} =============\n`);
    throw new Error(`Processing failed for ${swCode}: ${error}`);
  }
}

async function processStoriesWithLimit(
  storyJobs: StoryJob[],
  maxConcurrent: number = 3,
  delayBetweenJobs: number = 1000
) {
  console.log(
    `🚀 Processing ${storyJobs.length} stories with max ${maxConcurrent} concurrent jobs`
  );

  const results: {
    job: StoryJob;
    result: ProcessResult | null;
    error?: string;
  }[] = [];
  let completed = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < storyJobs.length; i += maxConcurrent) {
    const batch = storyJobs.slice(i, i + maxConcurrent);
    console.log(
      `\n📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch
        .map((j) => j.swCode)
        .join(", ")}`
    );

    const batchPromises = batch.map(async (job) => {
      try {
        const result = await processStory(job);
        results.push({ job, result });

        const { swCode, storySlug } = job;
        const filesStr = Object.entries(result.files)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ");
        console.log(`✅ COMPLETED ${swCode} (${storySlug}): ${filesStr}`);

        // Show which files were actually created
        if (result.files.textFile) {
          console.log(
            `  📝 Text file saved: ${TEXT_FILES_DIR}/${storySlug}.txt`
          );
        }
        if (result.files.pdfFile) {
          console.log(`  📄 PDF file saved: ${PDF_FILES_DIR}/${storySlug}.pdf`);
        }
        if (result.files.translationData) {
          console.log(
            `  📋 Translation data saved: translations-and-videos/${storySlug}.json`
          );
        }

        completed++;
        return { job, result, success: true };
      } catch (error) {
        const { swCode, storySlug } = job;
        console.log(`❌ FAILED ${swCode} (${storySlug}): ${error}`);
        results.push({ job, result: null, error: String(error) });
        failed++;
        return { job, result: null, success: false, error: String(error) };
      }
    });

    // Wait for batch to complete
    await Promise.all(batchPromises);

    // Progress update
    const processed = completed + failed;
    const percentage = ((processed / storyJobs.length) * 100).toFixed(1);
    console.log(
      `📊 Progress: ${processed}/${storyJobs.length} (${percentage}%) | Completed: ${completed} | Failed: ${failed}`
    );

    // Delay between batches
    if (i + maxConcurrent < storyJobs.length) {
      console.log(`⏱️  Waiting ${delayBetweenJobs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayBetweenJobs));
    }
  }

  // Final statistics
  console.log("\n🎉 All jobs completed!");
  console.log("\n📊 Final Statistics:");
  console.log(`  - Total processed: ${completed + failed}`);
  console.log(`  - Successful: ${completed}`);
  console.log(`  - Failed: ${failed}`);

  if (completed + failed > 0) {
    console.log(
      `  - Success rate: ${((completed / (completed + failed)) * 100).toFixed(
        1
      )}%`
    );
  }

  return results;
}

async function main() {
  console.log("📚 Story Weaver Simple Scraper Starting...\n");

  // Create output directories
  await createDirectories();

  // Extract stories from catalog
  const stories = extractStoriesFromCatalog();

  // Load story metadata (for reference, but we'll use catalog slugs)
  const storyMapping = loadStoryMetadata();

  // Prepare story jobs - USE THE SLUGS WE ALREADY EXTRACTED!
  const storyJobs: StoryJob[] = [];

  console.log("🔄 Preparing story jobs using extracted slugs...");

  // Let's start with just the first 20 stories to see the end-to-end process working
  const storiesToProcess = stories.slice(0, 20); // Process first 20 stories

  for (let i = 0; i < storiesToProcess.length; i++) {
    const { swCode, storySlug } = storiesToProcess[i];

    // Use the slug we already extracted from catalog
    storyJobs.push({ swCode, storySlug });
    console.log(`✅ Job prepared: ${swCode} -> ${storySlug}`);
  }

  console.log(
    `\n📋 Prepared ${storyJobs.length} jobs from first ${storiesToProcess.length} stories`
  );
  console.log(
    `🎯 This will show you the complete end-to-end process for each story`
  );

  if (storyJobs.length === 0) {
    console.log("❌ No jobs to process. Exiting...");
    process.exit(1);
  }

  console.log("📁 Files will be saved in:");
  console.log(`  - Text files: ${TEXT_FILES_DIR}/`);
  console.log(`  - PDF files: ${PDF_FILES_DIR}/`);
  console.log(`  - Translation data: translations-and-videos/`);
  console.log("\n🚀 Starting end-to-end processing...\n");

  // Process stories - ONE AT A TIME to avoid download conflicts
  await processStoriesWithLimit(storyJobs, 1, 3000); // 1 concurrent only, 3 second delay between stories

  console.log(
    "\n🎉 Batch completed! You can now see exactly what happened with each story."
  );
  console.log(
    "📝 If this works well, we can increase the batch size or remove the limit."
  );
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⚠️  Shutting down gracefully...");
  process.exit(0);
});

// Run the scraper
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
