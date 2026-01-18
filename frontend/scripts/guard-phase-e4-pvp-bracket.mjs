#!/usr/bin/env node
/**
 * Phase E4: PvP Bracket Tournament Guard
 * 
 * Asserts:
 * - pvp-tournament.tsx exists and contains "Quarterfinal" and "Final"
 * - PvpRulesSheet.tsx exists and contains "Attempts" and "Normalization"
 * - No "/shop" navigation inside pvp-tournament or pvp rules components
 * - No "Purchases", "RevenueCat", or "buy" references in PvP UI files
 * - Telemetry event names exist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..', 'app');
const PVP_COMPONENTS_DIR = path.join(__dirname, '..', 'components', 'pvp');
const EVENTS_PATH = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasErrors = false;

function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  hasErrors = true;
}

function pass(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

// Check pvp-tournament.tsx exists and has required content
const tournamentPath = path.join(APP_DIR, 'pvp-tournament.tsx');
if (!fs.existsSync(tournamentPath)) {
  fail('pvp-tournament.tsx not found');
} else {
  const content = fs.readFileSync(tournamentPath, 'utf-8');
  
  // Check for bracket stages
  if (content.includes('Quarterfinal') || content.includes('quarterfinal')) {
    pass('pvp-tournament.tsx contains "Quarterfinal"');
  } else {
    fail('pvp-tournament.tsx missing "Quarterfinal" text');
  }
  
  if (content.includes('Final')) {
    pass('pvp-tournament.tsx contains "Final"');
  } else {
    fail('pvp-tournament.tsx missing "Final" text');
  }
  
  // Check for NO shop navigation
  if (content.includes('/shop') || content.includes("'/shop") || content.includes('"/shop')) {
    fail('pvp-tournament.tsx contains /shop navigation (ethics violation)');
  } else {
    pass('pvp-tournament.tsx has no shop navigation');
  }
  
  // Check for NO monetization references
  const monetizationPatterns = ['Purchases', 'RevenueCat', 'purchase', 'buy now', 'Buy Now'];
  const hasMonetization = monetizationPatterns.some(p => content.toLowerCase().includes(p.toLowerCase()));
  if (hasMonetization) {
    fail('pvp-tournament.tsx contains monetization references (ethics violation)');
  } else {
    pass('pvp-tournament.tsx is ethics-safe (no monetization)');
  }
}

// Check PvpRulesSheet.tsx exists and has required content
const rulesPath = path.join(PVP_COMPONENTS_DIR, 'PvpRulesSheet.tsx');
if (!fs.existsSync(rulesPath)) {
  fail('PvpRulesSheet.tsx not found');
} else {
  const content = fs.readFileSync(rulesPath, 'utf-8');
  
  if (content.includes('Attempts') || content.includes('attempts')) {
    pass('PvpRulesSheet.tsx contains "Attempts"');
  } else {
    fail('PvpRulesSheet.tsx missing "Attempts" text');
  }
  
  if (content.includes('Normalization') || content.includes('normalization')) {
    pass('PvpRulesSheet.tsx contains "Normalization"');
  } else {
    fail('PvpRulesSheet.tsx missing "Normalization" text');
  }
  
  // Check for NO shop navigation
  if (content.includes('/shop')) {
    fail('PvpRulesSheet.tsx contains /shop navigation (ethics violation)');
  } else {
    pass('PvpRulesSheet.tsx has no shop navigation');
  }
  
  // Check for ethics statement
  if (content.includes('pay-to-win') || content.includes('Fair Play') || content.includes('skill-based')) {
    pass('PvpRulesSheet.tsx contains ethics statement');
  } else {
    fail('PvpRulesSheet.tsx missing ethics statement');
  }
}

// Check telemetry events exist
if (!fs.existsSync(EVENTS_PATH)) {
  fail('events.ts not found');
} else {
  const eventsContent = fs.readFileSync(EVENTS_PATH, 'utf-8');
  
  const requiredEvents = [
    'PVP_TOURNAMENT_VIEWED',
    'PVP_TOURNAMENT_MATCH_SELECTED',
    'PVP_RULES_SHEET_OPENED'
  ];
  
  const missingEvents = requiredEvents.filter(e => !eventsContent.includes(e));
  if (missingEvents.length === 0) {
    pass('All Phase E4 telemetry events present');
  } else {
    fail(`Missing telemetry events: ${missingEvents.join(', ')}`);
  }
}

console.log('');
if (hasErrors) {
  console.error(`${RED}Phase E4 PvP Bracket guard FAILED${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Phase E4 PvP Bracket guard PASSED${RESET}`);
  process.exit(0);
}
