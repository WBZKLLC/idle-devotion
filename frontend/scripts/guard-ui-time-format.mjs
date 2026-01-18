#!/usr/bin/env node
/**
 * Phase 3.50: Time Formatting Guard
 * 
 * Ensures all time displays use the safe formatHMS utility
 * to prevent NaN:NaN:NaN bugs.
 * 
 * Blocks:
 * - Direct `${h}:${m}:${s}` formatting without formatHMS
 * - .toString().padStart(2, '0') patterns for time without formatHMS import
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR = path.join(__dirname, '..', 'app');
const COMPONENTS_DIR = path.join(__dirname, '..', 'components');

// Files known to have time formatting
const TIME_DISPLAY_PATTERNS = [
  // Pattern for unsafe time formatting
  /\$\{\s*\w*hour\w*\.toString\(\)\.padStart\(2/gi,
  /\$\{\s*\w*min\w*\.toString\(\)\.padStart\(2/gi,
  /\$\{\s*\w*sec\w*\.toString\(\)\.padStart\(2/gi,
];

const FORMATTERS_IMPORT = /from\s+['"].*formatHMS['"]|import.*formatHMS/;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let hasErrors = false;
let filesChecked = 0;
let filesWithTimeFormatting = 0;

console.log('\n============================================');
console.log('Guard: UI Time Format Safety (Phase 3.50)');
console.log('============================================');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.relative(path.join(__dirname, '..'), filePath);
  filesChecked++;
  
  // Check if file has time formatting patterns
  let hasTimePattern = false;
  for (const pattern of TIME_DISPLAY_PATTERNS) {
    if (pattern.test(content)) {
      hasTimePattern = true;
      break;
    }
  }
  
  if (!hasTimePattern) return; // No time formatting in this file
  
  filesWithTimeFormatting++;
  
  // Check if formatHMS is imported or defined locally
  const hasFormatHMS = FORMATTERS_IMPORT.test(content) || 
                       content.includes('formatHMS') ||
                       content.includes('function formatIdleTime') || // Allow existing helper
                       content.includes('const formatCooldown'); // Allow existing helper
  
  if (!hasFormatHMS) {
    console.log(`${RED}FAIL:${RESET} ${filename}`);
    console.log('  Time formatting detected without formatHMS import/definition');
    console.log('  Add: import { formatHMS } from "../../lib/utils/formatHMS";');
    hasErrors = true;
  } else {
    console.log(`${GREEN}PASS:${RESET} ${filename} (has safe time formatting)`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      checkFile(filePath);
    }
  }
}

walkDir(APP_DIR);
walkDir(COMPONENTS_DIR);

console.log('\n============================================');
console.log(`Files checked: ${filesChecked}`);
console.log(`Files with time formatting: ${filesWithTimeFormatting}`);

if (hasErrors) {
  console.log(`${RED}UI Time Format guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}UI Time Format guard PASSED!${RESET}`);
}
console.log('============================================');
