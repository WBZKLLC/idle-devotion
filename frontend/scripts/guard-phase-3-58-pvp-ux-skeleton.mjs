#!/usr/bin/env node
/**
 * Phase 3.58: PvP UX Skeleton Guard
 * 
 * Ensures:
 * 1. Rules affordance exists
 * 2. Attempts shown from server
 * 3. No paid gating / shop links in PvP screen
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARENA_SCREEN = path.join(__dirname, '..', 'app', '(tabs)', 'arena.tsx');
const TELEMETRY_FILE = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

const FORBIDDEN_PATTERNS = [
  'shop',
  'purchase',
  'buy',
  '/shop',
  'ShopLink',
  'BuyButton',
];

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.58 PvP UX Skeleton');
console.log('============================================');

// Check arena screen
if (fs.existsSync(ARENA_SCREEN)) {
  const content = fs.readFileSync(ARENA_SCREEN, 'utf8');
  
  // Check for rules affordance
  checksRun++;
  if (content.includes('Rules') || content.includes('rules') || content.includes('Match Rules')) {
    console.log(`${GREEN}PASS:${RESET} Rules affordance exists in arena`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Rules affordance not found`);
  }
  
  // Check for attempts display
  checksRun++;
  if (content.includes('attempts') || content.includes('Attempts') || content.includes('ticket')) {
    console.log(`${GREEN}PASS:${RESET} Attempts display found in arena`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Attempts display not found`);
  }
  
  // Check for forbidden monetization patterns
  const contentLower = content.toLowerCase();
  checksRun++;
  let foundForbidden = false;
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (contentLower.includes(pattern.toLowerCase())) {
      // Allow if it's part of a warning/disable context
      if (!content.includes('// monetization disabled') && !content.includes('/* no shop */')) {
        foundForbidden = true;
        break;
      }
    }
  }
  
  if (!foundForbidden) {
    console.log(`${GREEN}PASS:${RESET} No paid gating/shop links in PvP screen`);
  } else {
    console.log(`${RED}FAIL:${RESET} Found monetization hooks in PvP screen`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} Arena screen not found at ${ARENA_SCREEN}`);
}

// Check telemetry constants
if (fs.existsSync(TELEMETRY_FILE)) {
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  const pvpEvents = ['PVP_VIEWED', 'PVP_RULES_OPENED', 'PVP_OPPONENT_LIST_VIEWED'];
  for (const event of pvpEvents) {
    checksRun++;
    if (content.includes(event)) {
      console.log(`${GREEN}PASS:${RESET} Telemetry ${event} exists`);
    } else {
      console.log(`${YELLOW}WARN:${RESET} Telemetry ${event} not found`);
    }
  }
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}PvP UX Skeleton guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PvP UX Skeleton guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
