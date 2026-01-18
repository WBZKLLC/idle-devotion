#!/usr/bin/env node
/**
 * Phase 3.55: Combat Readability v2 Guard
 * 
 * Ensures:
 * 1. Deterministic crit/block tags (no RNG)
 * 2. Reduce Motion respected
 * 3. Key moment logic present
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATTLE_MODAL = path.join(__dirname, '..', 'components', 'battle', 'BattlePresentationModal.tsx');
const RESULT_MODAL = path.join(__dirname, '..', 'components', 'battle', 'VictoryDefeatModal.tsx');
const TELEMETRY_FILE = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.55 Combat Readability v2');
console.log('============================================');

// Check BattlePresentationModal for deterministic tags
if (fs.existsSync(BATTLE_MODAL)) {
  const content = fs.readFileSync(BATTLE_MODAL, 'utf8');
  
  // Check for deterministic power ratio logic
  checksRun++;
  if (content.includes('powerRatio') || content.includes('power ratio')) {
    console.log(`${GREEN}PASS:${RESET} Power ratio logic present`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Power ratio logic not found`);
  }
  
  // Check for combat tags
  checksRun++;
  if (content.includes('CRIT') || content.includes('combatTags')) {
    console.log(`${GREEN}PASS:${RESET} Combat tags present`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Combat tags not found`);
  }
  
  // Ensure no Math.random
  checksRun++;
  if (!content.includes('Math.random')) {
    console.log(`${GREEN}PASS:${RESET} No RNG in battle presentation (deterministic)`);
  } else {
    console.log(`${RED}FAIL:${RESET} Math.random found - tags must be deterministic`);
    hasErrors = true;
  }
  
  // Check Reduce Motion
  checksRun++;
  if (content.includes('reduceMotion') || content.includes('isReduceMotionEnabled')) {
    console.log(`${GREEN}PASS:${RESET} Reduce Motion check present`);
  } else {
    console.log(`${RED}FAIL:${RESET} Reduce Motion not respected`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} BattlePresentationModal not found`);
}

// Check VictoryDefeatModal for key moment
if (fs.existsSync(RESULT_MODAL)) {
  const content = fs.readFileSync(RESULT_MODAL, 'utf8');
  
  checksRun++;
  if (content.includes('keyMoment') || content.includes('Key moment')) {
    console.log(`${GREEN}PASS:${RESET} Key moment support in VictoryDefeatModal`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Key moment line not found (optional)`);
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} VictoryDefeatModal not found`);
}

// Check telemetry
if (fs.existsSync(TELEMETRY_FILE)) {
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  checksRun++;
  if (content.includes('PVE_BATTLE_KEY_MOMENT_SHOWN')) {
    console.log(`${GREEN}PASS:${RESET} Telemetry PVE_BATTLE_KEY_MOMENT_SHOWN exists`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} Telemetry PVE_BATTLE_KEY_MOMENT_SHOWN not found`);
  }
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}Combat Readability guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Combat Readability guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
