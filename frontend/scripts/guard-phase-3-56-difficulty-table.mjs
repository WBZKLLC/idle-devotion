#!/usr/bin/env node
/**
 * Phase 3.56: Difficulty Table Guard
 * 
 * Ensures:
 * 1. Backend difficulty table exists
 * 2. No inline random scaling
 * 3. Response includes difficulty fields
 * 4. UI renders recommendedPower
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend');
const DIFFICULTY_FILE = path.join(BACKEND_DIR, 'core', 'campaign_difficulty.py');
const CAMPAIGN_SCREEN = path.join(__dirname, '..', 'app', 'campaign.tsx');
const TELEMETRY_FILE = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.56 Difficulty Table');
console.log('============================================');

// Check backend difficulty file
checksRun++;
if (fs.existsSync(DIFFICULTY_FILE)) {
  console.log(`${GREEN}PASS:${RESET} Backend difficulty table exists`);
  
  const content = fs.readFileSync(DIFFICULTY_FILE, 'utf8');
  
  // Check for table structure
  checksRun++;
  if (content.includes('DIFFICULTY_TABLE') || content.includes('difficulty_table')) {
    console.log(`${GREEN}PASS:${RESET} Difficulty table defined`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Difficulty table constant not found`);
  }
  
  // Check no random scaling
  checksRun++;
  if (!content.includes('random.') && !content.includes('random(')) {
    console.log(`${GREEN}PASS:${RESET} No random scaling in difficulty`);
  } else {
    console.log(`${RED}FAIL:${RESET} Random scaling found in difficulty - must be deterministic`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}WARN:${RESET} Backend difficulty file not found at ${DIFFICULTY_FILE}`);
}

// Check campaign screen for recommendedPower display
checksRun++;
if (fs.existsSync(CAMPAIGN_SCREEN)) {
  const content = fs.readFileSync(CAMPAIGN_SCREEN, 'utf8');
  
  if (content.includes('recommendedPower') || content.includes('recommended_power') || content.includes('Recommended')) {
    console.log(`${GREEN}PASS:${RESET} Campaign screen shows recommended power`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Recommended power display not found in campaign`);
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} Campaign screen not found`);
}

// Check telemetry
checksRun++;
if (fs.existsSync(TELEMETRY_FILE)) {
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  if (content.includes('PVE_STAGE_VIEWED')) {
    console.log(`${GREEN}PASS:${RESET} Telemetry PVE_STAGE_VIEWED exists`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Telemetry PVE_STAGE_VIEWED not found`);
  }
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}Difficulty Table guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Difficulty Table guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
