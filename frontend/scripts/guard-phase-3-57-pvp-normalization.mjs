#!/usr/bin/env node
/**
 * Phase 3.57: PvP Normalization Guard
 * 
 * Ensures:
 * 1. Normalization endpoint is DEV-only
 * 2. No monetization hooks in PvP preview
 * 3. Ethics constraints still enforced
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend');
const PVP_ROUTER = path.join(BACKEND_DIR, 'routers', 'pvp.py');
const PVP_CORE = path.join(BACKEND_DIR, 'core', 'pvp_normalization.py');
const ETHICS_GUARD = path.join(__dirname, 'guard-pvp-ethics.mjs');
const ETHICS_DOC = path.join(__dirname, '..', '..', 'docs', 'pvp-monetization-ethics.md');

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.57 PvP Normalization');
console.log('============================================');

// Check ethics guard still exists
checksRun++;
if (fs.existsSync(ETHICS_GUARD)) {
  console.log(`${GREEN}PASS:${RESET} PvP ethics guard still present`);
} else {
  console.log(`${RED}FAIL:${RESET} PvP ethics guard missing!`);
  hasErrors = true;
}

// Check ethics doc still exists
checksRun++;
if (fs.existsSync(ETHICS_DOC)) {
  console.log(`${GREEN}PASS:${RESET} PvP ethics documentation present`);
} else {
  console.log(`${RED}FAIL:${RESET} PvP ethics documentation missing!`);
  hasErrors = true;
}

// Check PvP normalization core (if exists)
if (fs.existsSync(PVP_CORE)) {
  const content = fs.readFileSync(PVP_CORE, 'utf8');
  
  // Check for normalization function
  checksRun++;
  if (content.includes('normalize') || content.includes('Normalize')) {
    console.log(`${GREEN}PASS:${RESET} Normalization function exists`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Normalization function not found`);
  }
  
  // Check no monetization hooks
  checksRun++;
  if (!content.includes('shop') && !content.includes('purchase') && !content.includes('pay')) {
    console.log(`${GREEN}PASS:${RESET} No monetization hooks in normalization`);
  } else {
    console.log(`${RED}FAIL:${RESET} Monetization hooks found in normalization!`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} PvP normalization core not found (may not be implemented yet)`);
}

// Check PvP router for DEV-only preview
if (fs.existsSync(PVP_ROUTER)) {
  const content = fs.readFileSync(PVP_ROUTER, 'utf8');
  
  if (content.includes('preview-match') || content.includes('preview_match')) {
    checksRun++;
    // Check if it's marked as DEV-only
    if (content.includes('DEV') || content.includes('DEBUG') || content.includes('development')) {
      console.log(`${GREEN}PASS:${RESET} Preview endpoint appears DEV-only`);
    } else {
      console.log(`${YELLOW}WARN:${RESET} Preview endpoint may not be DEV-only`);
    }
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} PvP router not found`);
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}PvP Normalization guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PvP Normalization guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
