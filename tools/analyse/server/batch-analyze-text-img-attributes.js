#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DATA_FOLDER = resolve(__dirname, '../../data');
const API_URL = 'http://localhost:3000/analyze';
const OUTPUT_DIR = resolve(__dirname, 'batch-results');

// Create output directory if it doesn't exist
import { mkdir } from 'fs/promises';
try {
    await mkdir(OUTPUT_DIR, { recursive: true });
} catch (error) {
    // Directory already exists, ignore
}

// Helper function to parse image descriptions
function parseImageDescriptions(imageContent) {
    const lines = imageContent.split('\n').filter(line => line.trim());
    const descriptions = {};
    
    for (const line of lines) {
        // Match patterns like "Page 2: : A girl eating" or "Cover page: : A young happy girl"
        const match = line.match(/^(Cover page|Page \d+)\s*:\s*:\s*(.+)$/i);
        if (match) {
            const pageKey = match[1].toLowerCase().replace(/\s+/g, '_');
            descriptions[pageKey] = match[2].trim();
        }
    }
    
    return descriptions;
}

// Helper function to create form data with image descriptions
async function createFormDataWithImages(textPath, imagePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const formData = new FormData();
    
    // Add the story text file
    const textFile = await fileFromPath(textPath);
    formData.append('textFile', textFile);
    
    // Read and parse image descriptions
    const imageContent = await readFile(imagePath, 'utf-8');
    const imageDescriptions = parseImageDescriptions(imageContent);
    
    // Add image descriptions as JSON
    formData.append('imageDescriptions', JSON.stringify(imageDescriptions));

    return formData;
}

// Helper function to make API request with image data
async function analyzeStorybookWithImages(textPath, imagePath, storyId) {
    try {
        console.log(`📚 Analyzing ${storyId} (with image descriptions)...`);

        const formData = await createFormDataWithImages(textPath, imagePath);

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Analysis failed');
        }

        console.log(`✅ Successfully analyzed ${storyId}`);
        return {
            storyId,
            success: true,
            data: result.data,
            validationErrors: result.validationErrors || [],
            hasImageDescriptions: true
        };

    } catch (error) {
        console.error(`❌ Error analyzing ${storyId}:`, error.message);
        return {
            storyId,
            success: false,
            error: error.message,
            hasImageDescriptions: true
        };
    }
}

// Helper function to find story-image pairs from URLs file
async function findStoryImagePairs() {
    const pairs = [];
    
    try {
        // Look for a URLs file in the data folder
        const urlsFile = join(DATA_FOLDER, 'urls.txt');
        const urlsContent = await readFile(urlsFile, 'utf-8');
        
        const lines = urlsContent.split('\n').filter(line => line.trim());
        const fileMap = new Map();
        
        // Parse the URLs file to create a map of files
        for (const line of lines) {
            const [filename, url] = line.split('\t');
            if (filename && url) {
                fileMap.set(filename.trim(), url.trim());
            }
        }
        
        // Find pairs: story.txt and story_image.txt
        const storyFiles = Array.from(fileMap.keys()).filter(f => 
            f.endsWith('.txt') && !f.endsWith('_image.txt')
        );
        
        for (const storyFile of storyFiles) {
            const baseName = storyFile.replace('.txt', '');
            const imageFile = baseName + '_image.txt';
            
            if (fileMap.has(imageFile)) {
                // Check if actual files exist in data folder
                const storyPath = join(DATA_FOLDER, storyFile);
                const imagePath = join(DATA_FOLDER, imageFile);
                
                try {
                    await readFile(storyPath, 'utf-8');
                    await readFile(imagePath, 'utf-8');
                    
                    pairs.push({
                        storyId: baseName,
                        textPath: storyPath,
                        imagePath: imagePath,
                        storyUrl: fileMap.get(storyFile),
                        imageUrl: fileMap.get(imageFile)
                    });
                } catch (fileError) {
                    console.warn(`⚠️ Files not found locally for ${baseName}, skipping`);
                }
            } else {
                console.warn(`⚠️ No matching image file found for ${storyFile}`);
            }
        }
    } catch (error) {
        console.error('❌ Error reading URLs file:', error.message);
        
        // Fallback: scan directory for existing file pairs
        console.log('📁 Falling back to directory scan...');
        const files = await readdir(DATA_FOLDER);
        const storyFiles = files.filter(f => f.endsWith('.txt') && !f.endsWith('_image.txt'));
        
        for (const storyFile of storyFiles) {
            const baseName = storyFile.replace('.txt', '');
            const imageFile = baseName + '_image.txt';
            
            if (files.includes(imageFile)) {
                pairs.push({
                    storyId: baseName,
                    textPath: join(DATA_FOLDER, storyFile),
                    imagePath: join(DATA_FOLDER, imageFile),
                    storyUrl: 'local',
                    imageUrl: 'local'
                });
            }
        }
    }

    return pairs;
}

// Helper function to flatten analysis result for CSV (enhanced for images)
function flattenAnalysisResult(result) {
    const flat = {
        story_id: result.storyId,
        story_title: result.data?.story_title || '',
        level: result.data?.level || '',
        success: result.success,
        error: result.error || '',
        validation_errors: result.validationErrors?.join('; ') || '',
        has_image_descriptions: result.hasImageDescriptions || false,

        // Characters
        characters_primary: result.data?.characters?.primary?.join('; ') || '',
        characters_secondary: result.data?.characters?.secondary?.join('; ') || '',

        // Settings
        settings_primary: result.data?.settings?.primary?.join('; ') || '',
        settings_secondary: result.data?.settings?.secondary?.join('; ') || '',

        // Themes
        themes_primary: result.data?.themes?.primary?.join('; ') || '',
        themes_secondary: result.data?.themes?.secondary?.join('; ') || '',

        // Events
        events_primary: result.data?.events?.primary?.join('; ') || '',
        events_secondary: result.data?.events?.secondary?.join('; ') || '',

        // Emotions
        emotions_primary: result.data?.emotions?.primary?.join('; ') || '',
        emotions_secondary: result.data?.emotions?.secondary?.join('; ') || '',

        // Keywords
        keywords: result.data?.keywords?.join('; ') || '',

        // Image-specific data (if your API returns this)
        visual_elements: result.data?.visual_elements?.join('; ') || '',
        visual_themes: result.data?.visual_themes?.join('; ') || '',
        page_count: result.data?.page_count || '',

        // Metadata
        processed_at: new Date().toISOString()
    };

    return flat;
}

// Helper function to escape CSV values
function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Helper function to convert results to CSV
function resultsToCSV(results) {
    const flatResults = results.map(flattenAnalysisResult);

    if (flatResults.length === 0) return '';

    // Get all unique keys from all results
    const allKeys = new Set();
    flatResults.forEach(result => {
        Object.keys(result).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    const csvHeaders = headers.join(',');

    const csvRows = flatResults.map(result => {
        return headers.map(header => escapeCsvValue(result[header])).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
}

// Helper function to preview image descriptions
function previewImageDescriptions(imagePath, storyId) {
    return readFile(imagePath, 'utf-8')
        .then(content => {
            const descriptions = parseImageDescriptions(content);
            const pageCount = Object.keys(descriptions).length;
            console.log(`  📖 ${storyId}: Found ${pageCount} page descriptions`);
            
            // Show first few descriptions as preview
            const entries = Object.entries(descriptions).slice(0, 3);
            entries.forEach(([page, desc]) => {
                console.log(`    ${page}: ${desc.substring(0, 50)}${desc.length > 50 ? '...' : ''}`);
            });
            
            return descriptions;
        })
        .catch(error => {
            console.warn(`⚠️ Could not preview ${imagePath}:`, error.message);
            return {};
        });
}

// Main execution function
async function main() {
    console.log('🚀 Starting enhanced batch analysis with image descriptions...');
    console.log(`📁 Data folder: ${DATA_FOLDER}`);
    console.log(`🌐 API URL: ${API_URL}`);

    // Check if server is running
    try {
        const healthCheck = await fetch('http://localhost:3000/health');
        if (!healthCheck.ok) {
            throw new Error('Server health check failed');
        }
        console.log('✅ Server is running');
    } catch (error) {
        console.error('❌ Cannot connect to server. Make sure it\'s running on port 3000');
        process.exit(1);
    }

    // Find all story-image pairs
    const filePairs = await findStoryImagePairs();
    console.log(`📊 Found ${filePairs.length} story-image pairs to process`);

    if (filePairs.length === 0) {
        console.log('No story-image pairs to process. Exiting.');
        return;
    }

    // Preview image descriptions for first few files
    console.log('\n🖼️ Image descriptions preview:');
    for (let i = 0; i < Math.min(3, filePairs.length); i++) {
        await previewImageDescriptions(filePairs[i].imagePath, filePairs[i].storyId);
    }

    // Process files with rate limiting
    const results = [];
    const BATCH_SIZE = 2; // Reduced batch size since we're processing more data
    const DELAY_MS = 1500; // Slightly longer delay

    for (let i = 0; i < filePairs.length; i += BATCH_SIZE) {
        const batch = filePairs.slice(i, i + BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filePairs.length / BATCH_SIZE)}`);

        // Process batch in parallel
        const batchPromises = batch.map(pair =>
            analyzeStorybookWithImages(pair.textPath, pair.imagePath, pair.storyId)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < filePairs.length) {
            console.log(`⏱️ Waiting ${DELAY_MS}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    // Generate output files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save full JSON results
    const jsonOutputPath = join(OUTPUT_DIR, `enhanced-analysis-results-${timestamp}.json`);
    await writeFile(jsonOutputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n💾 Saved JSON results to: ${jsonOutputPath}`);

    // Save CSV results
    const csvContent = resultsToCSV(results);
    const csvOutputPath = join(OUTPUT_DIR, `enhanced-analysis-results-${timestamp}.csv`);
    await writeFile(csvOutputPath, csvContent, 'utf-8');
    console.log(`💾 Saved CSV results to: ${csvOutputPath}`);

    // Generate a detailed report
    const reportContent = generateDetailedReport(results, filePairs);
    const reportPath = join(OUTPUT_DIR, `processing-report-${timestamp}.md`);
    await writeFile(reportPath, reportContent, 'utf-8');
    console.log(`📋 Saved detailed report to: ${reportPath}`);

    // Print summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const withValidationErrors = results.filter(r => r.validationErrors && r.validationErrors.length > 0).length;

    console.log('\n📈 SUMMARY:');
    console.log(`Total processed: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`With validation errors: ${withValidationErrors}`);
    console.log(`With image descriptions: ${results.length}`);

    if (failed > 0) {
        console.log('\n❌ FAILURES:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  ${r.storyId}: ${r.error}`);
        });
    }

    console.log('\n🎉 Enhanced batch analysis complete!');
}

// Helper function to generate detailed report
function generateDetailedReport(results, filePairs) {
    const timestamp = new Date().toISOString();
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let report = `# Enhanced Storybook Analysis Report\n\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Total Stories:** ${results.length}\n`;
    report += `**Successful:** ${successful.length}\n`;
    report += `**Failed:** ${failed.length}\n\n`;
    
    if (successful.length > 0) {
        report += `## Successfully Processed Stories\n\n`;
        successful.forEach(result => {
            report += `### ${result.storyId}\n`;
            report += `- **Title:** ${result.data?.story_title || 'N/A'}\n`;
            report += `- **Level:** ${result.data?.level || 'N/A'}\n`;
            report += `- **Characters:** ${result.data?.characters?.primary?.join(', ') || 'N/A'}\n`;
            report += `- **Main Themes:** ${result.data?.themes?.primary?.join(', ') || 'N/A'}\n`;
            if (result.validationErrors && result.validationErrors.length > 0) {
                report += `- **Validation Issues:** ${result.validationErrors.join(', ')}\n`;
            }
            report += `\n`;
        });
    }
    
    if (failed.length > 0) {
        report += `## Failed Processing\n\n`;
        failed.forEach(result => {
            report += `### ${result.storyId}\n`;
            report += `- **Error:** ${result.error}\n\n`;
        });
    }
    
    return report;
}

// Run the script
main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
});