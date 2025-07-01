const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const newVersion = packageJson.version;

const manifestPath = 'extension/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = newVersion;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✅ Updated extension manifest to version ${newVersion}`);
