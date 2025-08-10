#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DATA_JOYFUL_FOLDER = resolve(__dirname, '../../data-joyful');
const API_URL = 'http://localhost:3000/analyze-pdf';
const OUTPUT_DIR = resolve(__dirname, 'batch-results');

// Create output directory if it doesn't exist
import { mkdir } from 'fs/promises';
try {
    await mkdir(OUTPUT_DIR, { recursive: true });
} catch (error) {
    // Directory already exists, ignore
}

// Helper function to create form data for PDF-only analysis
async function createFormData(pdfPath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const formData = new FormData();
    const pdfFile = await fileFromPath(pdfPath);

    formData.append('pdfFile', pdfFile);

    return formData;
}

// Helper function to make API request
async function analyzeStorybookPdfOnly(pdfPath, storyId) {
    try {
        console.log(`📚 Analyzing ${storyId} (PDF-only)...`);

        const formData = await createFormData(pdfPath);

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server error response: ${errorText}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Analysis failed');
        }

        console.log(`✅ Successfully analyzed ${storyId} (PDF-only)`);
        return {
            storyId,
            success: true,
            data: result.data,
            validationErrors: result.validationErrors || [],
            analysisType: 'pdf-only'
        };

    } catch (error) {
        console.error(`❌ Error analyzing ${storyId} (PDF-only):`, error.message);
        return {
            storyId,
            success: false,
            error: error.message,
            analysisType: 'pdf-only'
        };
    }
}

// Helper function to find PDF files from data-joyful folder
async function findPdfFiles() {
    const pdfFiles = [];

    try {
        const joyfulFiles = await readdir(DATA_JOYFUL_FOLDER);
        const joyfulPdfFiles = joyfulFiles.filter(f => f.endsWith('.pdf'));

        for (const pdfFile of joyfulPdfFiles) {
            const baseName = pdfFile.replace('.pdf', '');
            pdfFiles.push({
                storyId: `joyful-${baseName}`,
                pdfPath: join(DATA_JOYFUL_FOLDER, pdfFile),
                source: 'joyful'
            });
        }
        console.log(`📁 Found ${joyfulPdfFiles.length} PDF files in data-joyful folder`);
    } catch (error) {
        console.warn(`⚠️ Could not read data-joyful folder: ${error.message}`);
    }

    return pdfFiles;
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
        analysis_type: result.analysisType || 'pdf-only',

        // Characters
        characters_primary: result.data?.characters?.primary?.join('; ') || '',
        characters_secondary: result.data?.characters?.secondary?.join('; ') || '',

        // Settings
        settings_primary: result.data?.settings?.primary?.join('; ') || '',
        settings_secondary: result.data?.settings?.secondary?.join('; ') || '',

        // Themes
        themes_primary: result.data?.themes?.primary?.join('; ') || '',
        themes_secondary: result.data?.themes?.secondary?.join('; ') || '',
        themes_amazon: result.data?.themes?.amazon || '',

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
    console.log('🚀 Starting batch PDF-only analysis...');
    console.log(`📁 Data-joyful folder: ${DATA_JOYFUL_FOLDER}`);
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

    // Find all PDF files
    const pdfFiles = await findPdfFiles();
    console.log(`📊 Found ${pdfFiles.length} PDF files to process`);

    if (pdfFiles.length === 0) {
        console.log('No files to process. Exiting.');
        return;
    }

    // Show file breakdown by source
    const joyfulCount = pdfFiles.filter(f => f.source === 'joyful').length;
    console.log(`  - Data-joyful folder: ${joyfulCount} files`);

    // Process files with rate limiting (to avoid overwhelming the API)
    const results = [];
    const BATCH_SIZE = 3; // Process 3 at a time (slower due to PDF processing)
    const DELAY_MS = 1000; // 1000ms delay between batches (slower for PDF analysis)

    for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, i + BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pdfFiles.length / BATCH_SIZE)}`);

        // Process batch in parallel
        const batchPromises = batch.map(file =>
            analyzeStorybookPdfOnly(file.pdfPath, file.storyId)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < pdfFiles.length) {
            console.log(`⏱️ Waiting ${DELAY_MS}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    // Generate output files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save full JSON results
    const jsonOutputPath = join(OUTPUT_DIR, `pdf-only-analysis-results-${timestamp}.json`);
    await writeFile(jsonOutputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n💾 Saved JSON results to: ${jsonOutputPath}`);

    // Save CSV results
    const csvContent = resultsToCSV(results);
    const csvOutputPath = join(OUTPUT_DIR, `pdf-only-analysis-results-${timestamp}.csv`);
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

    // Breakdown by source
    const joyfulResults = results.filter(r => r.storyId.startsWith('joyful-'));
    console.log('\n📊 BREAKDOWN BY SOURCE:');
    console.log(`Data-joyful folder: ${joyfulResults.length} processed (${joyfulResults.filter(r => r.success).length} successful)`);

    if (failed > 0) {
        console.log('\n❌ FAILURES:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  ${r.storyId}: ${r.error}`);
        });
    }

    console.log('\n🎉 Batch PDF-only analysis complete!');
}

// Run the script
main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
}); 