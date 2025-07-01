const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

console.log('🔨 Building extension locally...');

// Configuration
const CONFIG = {
    sourceDir: './extension',
    outputDir: './dist',
    excludePatterns: [
        '*.log',
        '.DS_Store',
        'Thumbs.db',
        '*.tmp',
        'manifest-v3.json',
        'web-ext-artifacts',
        '*.zip',
        '*.xpi',
        '*.sh',
        'scripts/',
        'package.json',
        'package-lock.json',
        'node_modules/',
        '.git/',
        '.github/',
        'docs/',
        'README.md',
        '.gitignore'
    ]
};

async function buildExtension() {
    try {
        // Ensure dist directory exists
        if (!fs.existsSync(CONFIG.outputDir)) {
            fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        }

        // Load manifest to get version
        const manifestPath = path.join(CONFIG.sourceDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error('manifest.json not found in extension directory');
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const version = manifest.version;

        console.log(`📦 Building version ${version}`);

        // Create XPI file
        const xpiPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}.xpi`);
        await createXPI(CONFIG.sourceDir, xpiPath);

        // Generate SHA256 hash
        const hash = await generateSHA256(xpiPath);
        const hashPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}.sha256`);
        fs.writeFileSync(hashPath, hash);

        console.log(`✅ Built: ${xpiPath}`);
        console.log(`🔐 SHA256: ${hash}`);
        console.log(`💾 Hash saved: ${hashPath}`);

        // Create build info
        const buildInfo = {
            version,
            filename: `dsp-extension-v${version}.xpi`,
            sha256: hash,
            buildDate: new Date().toISOString(),
            size: fs.statSync(xpiPath).size
        };

        const buildInfoPath = path.join(CONFIG.outputDir, 'build-info.json');
        fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
        console.log(`📋 Build info saved: ${buildInfoPath}`);

    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

function createXPI(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        console.log('🗜️  Creating XPI archive...');

        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
            console.log(`📦 Archive created: ${archive.pointer()} bytes`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add files to archive with filtering
        archive.glob('**/*', {
            cwd: sourceDir,
            ignore: CONFIG.excludePatterns
        });

        archive.finalize();
    });
}

function generateSHA256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', (error) => {
            reject(error);
        });
    });
}

// Run if called directly
if (require.main === module) {
    buildExtension();
}

module.exports = { buildExtension };