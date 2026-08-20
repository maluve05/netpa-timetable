#!/usr/bin/env node

/**
 * Validation Script for Nova IMS Timetable Export
 * 
 * Verifies:
 * 1. Manifest V3 JSON schema & required fields
 * 2. Existence of all files declared in manifest.json & popup.html
 * 3. Icon files exist and are valid
 * 4. JavaScript syntax verification (node --check)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const MANIFEST_PATH = path.join(EXT_DIR, 'manifest.json');

let errors = 0;
let warnings = 0;

function logInfo(msg) {
  console.log(`\x1b[34mℹ\x1b[0m ${msg}`);
}

function logPass(msg) {
  console.log(`\x1b[32m✔\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
  warnings++;
}

function logError(msg) {
  console.log(`\x1b[31m✖\x1b[0m ${msg}`);
  errors++;
}

console.log('\n=== Validating Nova IMS Timetable Export Extension ===\n');

// 1. Check Extension Directory
if (!fs.existsSync(EXT_DIR)) {
  logError(`Extension directory not found at: ${EXT_DIR}`);
  process.exit(1);
}
logPass('Extension directory located');

// 2. Check & Parse manifest.json
if (!fs.existsSync(MANIFEST_PATH)) {
  logError(`manifest.json not found at: ${MANIFEST_PATH}`);
  process.exit(1);
}

let manifest;
try {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  manifest = JSON.parse(content);
  logPass('manifest.json parsed successfully');
} catch (err) {
  logError(`Failed to parse manifest.json: ${err.message}`);
  process.exit(1);
}

// 3. Manifest V3 Rules
if (manifest.manifest_version !== 3) {
  logError(`manifest_version must be 3, found: ${manifest.manifest_version}`);
} else {
  logPass('manifest_version is 3 (Manifest V3 compliant)');
}

const requiredFields = ['name', 'version', 'description', 'action', 'icons'];
for (const field of requiredFields) {
  if (!manifest[field]) {
    logError(`Missing required manifest field: "${field}"`);
  } else {
    logPass(`Required field present: "${field}"`);
  }
}

// 4. Validate Referenced Files
const filesToCheck = [];

// Icons
if (manifest.icons && typeof manifest.icons === 'object') {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    filesToCheck.push({ label: `Icon (${size}px)`, relPath: iconPath });
  }
}

// Action Default Icon & Popup
if (manifest.action) {
  if (manifest.action.default_popup) {
    filesToCheck.push({ label: 'Action Popup', relPath: manifest.action.default_popup });
  }
  if (manifest.action.default_icon && typeof manifest.action.default_icon === 'object') {
    for (const [size, iconPath] of Object.entries(manifest.action.default_icon)) {
      filesToCheck.push({ label: `Action Icon (${size}px)`, relPath: iconPath });
    }
  }
}

// Background Service Worker
if (manifest.background) {
  if (manifest.background.service_worker) {
    filesToCheck.push({ label: 'Background Service Worker', relPath: manifest.background.service_worker });
  } else {
    logError('Background field defined but service_worker path missing');
  }
}

// Content Scripts
if (Array.isArray(manifest.content_scripts)) {
  manifest.content_scripts.forEach((cs, i) => {
    if (Array.isArray(cs.js)) {
      cs.js.forEach(jsPath => {
        filesToCheck.push({ label: `Content Script [${i}]`, relPath: jsPath });
      });
    }
    if (Array.isArray(cs.css)) {
      cs.css.forEach(cssPath => {
        filesToCheck.push({ label: `Content CSS [${i}]`, relPath: cssPath });
      });
    }
  });
}

// Check each file
for (const item of filesToCheck) {
  const fullPath = path.join(EXT_DIR, item.relPath);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      logWarn(`${item.label} "${item.relPath}" exists but is empty (0 bytes)`);
    } else {
      logPass(`${item.label} found: ${item.relPath} (${stats.size} bytes)`);
    }
  } else {
    logError(`${item.label} missing: ${item.relPath} (expected at ${fullPath})`);
  }
}

// 5. Check Popup HTML Dependencies
const popupHtmlPath = path.join(EXT_DIR, 'popup.html');
if (fs.existsSync(popupHtmlPath)) {
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf-8');
  
  // Extract script src
  const scriptMatches = [...popupHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  scriptMatches.forEach(m => {
    const scriptSrc = m[1];
    if (!scriptSrc.startsWith('http')) {
      const fullPath = path.join(EXT_DIR, scriptSrc);
      if (fs.existsSync(fullPath)) {
        logPass(`Popup script dependency found: ${scriptSrc}`);
      } else {
        logError(`Popup script dependency missing: ${scriptSrc}`);
      }
    }
  });

  // Extract link css href
  const cssMatches = [...popupHtml.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)];
  cssMatches.forEach(m => {
    const cssHref = m[1];
    if (!cssHref.startsWith('http')) {
      const fullPath = path.join(EXT_DIR, cssHref);
      if (fs.existsSync(fullPath)) {
        logPass(`Popup stylesheet dependency found: ${cssHref}`);
      } else {
        logError(`Popup stylesheet dependency missing: ${cssHref}`);
      }
    }
  });
}

// 6. JavaScript Syntax Check (node --check)
console.log('\n--- Checking JavaScript Syntax ---');
const jsFiles = [
  'background.js',
  'content.js',
  'popup.js'
];

for (const jsFile of jsFiles) {
  const fullPath = path.join(EXT_DIR, jsFile);
  if (fs.existsSync(fullPath)) {
    try {
      execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
      logPass(`Syntax valid: ${jsFile}`);
    } catch (err) {
      logError(`Syntax error in ${jsFile}:\n${err.stderr.toString()}`);
    }
  }
}

// Summary
console.log('\n=== Validation Summary ===');
if (errors === 0) {
  console.log(`\x1b[32m✔ Extension is fully valid and ready for packaging!\x1b[0m (${warnings} warnings)\n`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✖ Validation failed with ${errors} error(s) and ${warnings} warning(s).\x1b[0m\n`);
  process.exit(1);
}
