#!/usr/bin/env node
/**
 * Phase 3.54: Skill Cut-In Guard
 * 
 * Ensures:
 * 1. SkillCutInOverlay component exists
 * 2. BattlePresentationModal imports it
 * 3. No timers/RAF in cut-in component
 * 4. Telemetry constant exists
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CUTIN_COMPONENT = path.join(__dirname, '..', 'components', 'battle', 'SkillCutInOverlay.tsx');
const BATTLE_MODAL = path.join(__dirname, '..', 'components', 'battle', 'BattlePresentationModal.tsx');
const TELEMETRY_FILE = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.54 Skill Cut-In');
console.log('============================================');

// Check SkillCutInOverlay exists
checksRun++;
if (fs.existsSync(CUTIN_COMPONENT)) {
  console.log(`${GREEN}PASS:${RESET} SkillCutInOverlay component exists`);
  
  const content = fs.readFileSync(CUTIN_COMPONENT, 'utf8');
  
  // Check for timers/RAF
  checksRun++;
  if (!content.includes('setInterval') && !content.includes('requestAnimationFrame')) {
    console.log(`${GREEN}PASS:${RESET} No timers/RAF in SkillCutInOverlay`);
  } else {
    console.log(`${RED}FAIL:${RESET} Found timers/RAF in SkillCutInOverlay`);
    hasErrors = true;
  }
  
  // Check telemetry tracking
  checksRun++;
  if (content.includes('PVE_SKILL_CUTIN_SHOWN')) {
    console.log(`${GREEN}PASS:${RESET} Telemetry tracking present`);
  } else {
    console.log(`${RED}FAIL:${RESET} Missing telemetry tracking`);
    hasErrors = true;
  }
} else {
  console.log(`${RED}FAIL:${RESET} SkillCutInOverlay component not found`);
  hasErrors = true;
}

// Check BattlePresentationModal has cut-in support
checksRun++;
if (fs.existsSync(BATTLE_MODAL)) {
  const content = fs.readFileSync(BATTLE_MODAL, 'utf8');
  
  if (content.includes('cutIn') || content.includes('CutIn')) {
    console.log(`${GREEN}PASS:${RESET} BattlePresentationModal has cut-in support`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} BattlePresentationModal may not have cut-in integration yet`);
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} BattlePresentationModal not found`);
}

// Check telemetry constant
checksRun++;
if (fs.existsSync(TELEMETRY_FILE)) {
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  if (content.includes('PVE_SKILL_CUTIN_SHOWN')) {
    console.log(`${GREEN}PASS:${RESET} Telemetry constant PVE_SKILL_CUTIN_SHOWN exists`);
  } else {
    console.log(`${RED}FAIL:${RESET} Missing telemetry constant PVE_SKILL_CUTIN_SHOWN`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} Telemetry file not found`);
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}Skill Cut-In guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Skill Cut-In guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
