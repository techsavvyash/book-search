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

// Helper function to create form data
async function createFormData(textPath, pdfPath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const formData = new FormData();
    const textFile = await fileFromPath(textPath);
    const pdfFile = await fileFromPath(pdfPath);

    formData.append('textFile', textFile);
    formData.append('pdfFile', pdfFile);

    return formData;
}

// Helper function to make API request
async function analyzeStorybook(textPath, pdfPath, storyId) {
    try {
        console.log(`📚 Analyzing ${storyId}...`);

        const formData = await createFormData(textPath, pdfPath);

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
            validationErrors: result.validationErrors || []
        };

    } catch (error) {
        console.error(`❌ Error analyzing ${storyId}:`, error.message);
        return {
            storyId,
            success: false,
            error: error.message
        };
    }
}

// Helper function to find file pairs
async function findFilePairs() {
    const files = await readdir(DATA_FOLDER);
    const textFiles = files.filter(f => f.endsWith('.txt') && f !== 'processing_report.csv');

    const pairs = [];

    for (const textFile of textFiles) {
        const baseName = textFile.replace('.txt', '');
        const pdfFile = baseName + '.pdf';

        if (files.includes(pdfFile)) {
            pairs.push({
                storyId: baseName,
                textPath: join(DATA_FOLDER, textFile),
                pdfPath: join(DATA_FOLDER, pdfFile)
            });
        } else {
            console.warn(`⚠️ No matching PDF found for ${textFile}`);
        }
    }

    return pairs;
}

// Helper function to flatten analysis result for CSV
function flattenAnalysisResult(result) {
    const flat = {
        story_id: result.storyId,
        story_title: result.data?.story_title || '',
        level: result.data?.level || '',
        success: result.success,
        error: result.error || '',
        validation_errors: result.validationErrors?.join('; ') || '',

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

// Main execution function
async function main() {
    console.log('🚀 Starting batch analysis...');
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

    // Find all file pairs
    const filePairs = await findFilePairs();
    console.log(`📊 Found ${filePairs.length} storybook pairs to process`);

    if (filePairs.length === 0) {
        console.log('No files to process. Exiting.');
        return;
    }

    // Process files with rate limiting (to avoid overwhelming the API)
    const results = [];
    const BATCH_SIZE = 3; // Process 3 at a time
    const DELAY_MS = 1000; // 1 second delay between batches

    for (let i = 0; i < filePairs.length; i += BATCH_SIZE) {
        const batch = filePairs.slice(i, i + BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filePairs.length / BATCH_SIZE)}`);

        // Process batch in parallel
        const batchPromises = batch.map(pair =>
            analyzeStorybook(pair.textPath, pair.pdfPath, pair.storyId)
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
    const jsonOutputPath = join(OUTPUT_DIR, `analysis-results-${timestamp}.json`);
    await writeFile(jsonOutputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n💾 Saved JSON results to: ${jsonOutputPath}`);

    // Save CSV results
    const csvContent = resultsToCSV(results);
    const csvOutputPath = join(OUTPUT_DIR, `analysis-results-${timestamp}.csv`);
    await writeFile(csvOutputPath, csvContent, 'utf-8');
    console.log(`💾 Saved CSV results to: ${csvOutputPath}`);

    // Print summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const withValidationErrors = results.filter(r => r.validationErrors && r.validationErrors.length > 0).length;

    console.log('\n📈 SUMMARY:');
    console.log(`Total processed: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`With validation errors: ${withValidationErrors}`);

    if (failed > 0) {
        console.log('\n❌ FAILURES:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  ${r.storyId}: ${r.error}`);
        });
    }

    console.log('\n🎉 Batch analysis complete!');
}

// Run the script
main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
}); 