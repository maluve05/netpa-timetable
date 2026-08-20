#!/usr/bin/env node

/**
 * Packaging Script for Nova IMS Timetable Export
 * 
 * Creates a clean, store-ready ZIP archive in `dist/` using the embedded JSZip.
 * Excludes development files, documentation, and OS artifacts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MANIFEST_PATH = path.join(EXT_DIR, 'manifest.json');

console.log('\n=== Packaging Nova IMS Timetable Export ===\n');

// 1. Check & read manifest.json
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('\x1b[31m✖ Error: manifest.json not found!\x1b[0m');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const version = manifest.version || '1.0.0';
console.log(`\x1b[34mℹ\x1b[0m Extension Name: ${manifest.name}`);
console.log(`\x1b[34mℹ\x1b[0m Version: ${version}`);

// 2. Ensure dist/ exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 3. Load JSZip from extension directory
let JSZip;
try {
  JSZip = require(path.join(EXT_DIR, 'jszip.min.js'));
} catch (err) {
  console.error(`\x1b[31m✖ Error loading JSZip: ${err.message}\x1b[0m`);
  process.exit(1);
}

const zip = new JSZip();

// Files and folders to include in distribution bundle
const filesToInclude = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'jszip.min.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

let totalUncompressedBytes = 0;

console.log('\n--- Adding files to archive ---');
for (const relPath of filesToInclude) {
  const fullPath = path.join(EXT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    const fileBuffer = fs.readFileSync(fullPath);
    totalUncompressedBytes += fileBuffer.length;
    zip.file(relPath.replace(/\\/g, '/'), fileBuffer);
    console.log(`\x1b[32m✔\x1b[0m Added: ${relPath} (${fileBuffer.length} bytes)`);
  } else {
    console.warn(`\x1b[33m⚠ Warning: File not found: ${relPath}\x1b[0m`);
  }
}

// 4. Generate zip file
const zipFilename = `nova-ims-timetable-v${version}.zip`;
const zipOutputPath = path.join(DIST_DIR, zipFilename);

zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 }
}).then(zipBuffer => {
  fs.writeFileSync(zipOutputPath, zipBuffer);

  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  console.log('\n=== Package Built Successfully ===');
  console.log(`\x1b[32m✔ Archive:\x1b[0m ${zipOutputPath}`);
  console.log(`\x1b[34mℹ Uncompressed Size:\x1b[0m ${(totalUncompressedBytes / 1024).toFixed(2)} KB`);
  console.log(`\x1b[34mℹ Compressed Size:\x1b[0m   ${(zipBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`\x1b[34mℹ SHA-256 Checksum:\x1b[0m  ${hash}`);
  console.log('\nThis ZIP is ready to be uploaded directly to the Chrome Developer Dashboard.\n');
}).catch(err => {
  console.error(`\x1b[31m✖ Error creating ZIP: ${err.message}\x1b[0m`);
  process.exit(1);
});
