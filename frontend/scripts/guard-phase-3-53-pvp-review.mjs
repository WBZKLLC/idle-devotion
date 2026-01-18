#!/usr/bin/env node
/**
 * Phase 3.53: PvP Review Guard
 * 
 * Ensures:
 * 1. PvP loop review doc exists
 * 2. PvP normalization proposal doc exists
 * 3. Ethics guard still present and wired
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');
const ETHICS_GUARD = path.join(__dirname, 'guard-pvp-ethics.mjs');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

const REQUIRED_DOCS = [
  { file: 'pvp-loop-review.md', name: 'PvP Loop Review' },
  { file: 'pvp-normalization-proposal.md', name: 'PvP Normalization Proposal' },
  { file: 'pvp-monetization-ethics.md', name: 'PvP Monetization Ethics' },
];

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.53 PvP Review');
console.log('============================================');

// Check required docs
for (const { file, name } of REQUIRED_DOCS) {
  checksRun++;
  const docPath = path.join(DOCS_DIR, file);
  if (fs.existsSync(docPath)) {
    const content = fs.readFileSync(docPath, 'utf8');
    if (content.length > 100) {
      console.log(`${GREEN}PASS:${RESET} ${name} exists (${content.length} chars)`);
    } else {
      console.log(`${YELLOW}WARN:${RESET} ${name} exists but seems empty`);
    }
  } else {
    console.log(`${RED}FAIL:${RESET} ${name} not found at ${file}`);
    hasErrors = true;
  }
}

// Check ethics guard exists
checksRun++;
if (fs.existsSync(ETHICS_GUARD)) {
  console.log(`${GREEN}PASS:${RESET} PvP ethics guard exists`);
} else {
  console.log(`${RED}FAIL:${RESET} PvP ethics guard missing`);
  hasErrors = true;
}

// Check ethics guard is wired in package.json
checksRun++;
if (fs.existsSync(PACKAGE_JSON)) {
  const packageContent = fs.readFileSync(PACKAGE_JSON, 'utf8');
  if (packageContent.includes('guard:pvp-ethics') || packageContent.includes('guard-pvp-ethics')) {
    console.log(`${GREEN}PASS:${RESET} Ethics guard wired in package.json`);
  } else {
    console.log(`${RED}FAIL:${RESET} Ethics guard not wired in package.json`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} package.json not found`);
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}PvP Review guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PvP Review guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
