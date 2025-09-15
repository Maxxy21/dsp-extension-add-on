const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

console.log('🔨 Building extension with dual manifests...');

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

        // Create both self-hosted and Mozilla-signed versions
        await createSelfHostedVersion(version, manifest);
        await createMozillaVersion(version, manifest);

        console.log('✅ Build completed successfully!');

    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

async function createSelfHostedVersion(version, manifest) {
    console.log('🌐 Creating self-hosted version (with update_url)...');

    // Ensure self-hosted manifest has update_url
    const selfHostedManifest = {
        ...manifest,
        browser_specific_settings: {
            gecko: {
                id: "dsp-roster-management@maxwell.com",
                strict_min_version: "75.0",
                update_url: "https://maxxy21.github.io/dsp-extension-hosting/updates.json"
            }
        }
    };

    const xpiPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}.xpi`);
    await createXPI(CONFIG.sourceDir, xpiPath, selfHostedManifest);

    const hash = await generateSHA256(xpiPath);
    const hashPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}.sha256`);
    fs.writeFileSync(hashPath, hash);

    console.log(`✅ Self-hosted version: ${xpiPath}`);
    console.log(`🔐 SHA256: ${hash}`);
}

async function createMozillaVersion(version, manifest) {
    console.log('🦊 Creating Mozilla-signed version (no update_url)...');

    // Remove update_url for Mozilla signing
    const mozillaManifest = {
        ...manifest,
        browser_specific_settings: {
            gecko: {
                id: "dsp-roster-management@maxwell.com",
                strict_min_version: "75.0"
                // No update_url for Mozilla signing
            }
        }
    };

    const xpiPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}-mozilla.xpi`);
    await createXPI(CONFIG.sourceDir, xpiPath, mozillaManifest);

    const hash = await generateSHA256(xpiPath);
    const hashPath = path.join(CONFIG.outputDir, `dsp-extension-v${version}-mozilla.sha256`);
    fs.writeFileSync(hashPath, hash);

    console.log(`✅ Mozilla version: ${xpiPath}`);
    console.log(`🔐 SHA256: ${hash}`);
}

function createXPI(sourceDir, outputPath, customManifest = null) {
    return new Promise((resolve, reject) => {
        console.log(`🗜️  Creating XPI: ${path.basename(outputPath)}`);

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

        // Add all files except manifest.json first
        archive.glob('**/*', {
            cwd: sourceDir,
            ignore: [...CONFIG.excludePatterns, 'manifest.json']
        });

        // Add custom manifest or original
        if (customManifest) {
            archive.append(JSON.stringify(customManifest, null, 2), { name: 'manifest.json' });
        } else {
            archive.file(path.join(sourceDir, 'manifest.json'), { name: 'manifest.json' });
        }

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