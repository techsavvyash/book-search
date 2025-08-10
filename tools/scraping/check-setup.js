const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkSetup() {
    console.log('🔍 Checking StoryWeaver Scraper Setup...\n');

    let allGood = true;

    // Check 1: Redis connection
    console.log('1. Checking Redis connection...');
    try {
        const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        await redis.ping();
        console.log('   ✅ Redis connection successful');
        await redis.quit();
    } catch (error) {
        console.log('   ❌ Redis connection failed:', error.message);
        console.log('   💡 Make sure Redis is running: redis-server');
        allGood = false;
    }

    // Check 2: Environment file
    console.log('\n2. Checking environment configuration...');
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        console.log('   ✅ .env file found');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('REDIS_URL')) {
            console.log('   ✅ REDIS_URL configured');
        } else {
            console.log('   ⚠️  REDIS_URL not found in .env, using default');
        }
    } else {
        console.log('   ⚠️  .env file not found, using defaults');
    }

    // Check 3: Catalog file
    console.log('\n3. Checking catalog.xml...');
    const catalogPath = path.join(__dirname, 'catalog.xml');
    if (fs.existsSync(catalogPath)) {
        const catalogContent = fs.readFileSync(catalogPath, 'utf-8');
        const swCodes = catalogContent.match(/SW-\d+/g) || [];
        console.log(`   ✅ Catalog found with ${swCodes.length} SW codes`);
    } else {
        console.log('   ❌ catalog.xml not found');
        allGood = false;
    }

    // Check 4: Metadata file
    console.log('\n4. Checking story metadata...');
    const metadataPath = path.join(__dirname, '..', 'story_meta_tags_comprehensive.json');
    if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        console.log(`   ✅ Story metadata found with ${metadata.length} entries`);
    } else {
        console.log('   ⚠️  Story metadata not found, will start fresh discovery');
    }

    // Check 5: Required directories
    console.log('\n5. Checking output directories...');
    const dirs = ['pdf-assets', 'translations-and-videos', 'temp-downloads', '../STEM-text-files'];
    dirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`   ✅ ${dir} exists`);
        } else {
            console.log(`   📁 ${dir} will be created automatically`);
        }
    });

    // Check 6: Dependencies
    console.log('\n6. Checking dependencies...');
    const packagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        const requiredDeps = ['bullmq', 'ioredis', 'dotenv'];
        const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);

        if (missingDeps.length === 0) {
            console.log('   ✅ All required dependencies installed');
        } else {
            console.log(`   ❌ Missing dependencies: ${missingDeps.join(', ')}`);
            console.log('   💡 Run: npm install');
            allGood = false;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allGood) {
        console.log('🎉 Setup looks good! Ready to scrape.');
        console.log('\nTo start scraping, run:');
        console.log('   npm run scrape');
    } else {
        console.log('⚠️  Please fix the issues above before running the scraper.');
    }
    console.log('='.repeat(50));
}

checkSetup().catch(console.error); 