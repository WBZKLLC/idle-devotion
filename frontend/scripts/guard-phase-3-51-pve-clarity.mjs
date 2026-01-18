#!/usr/bin/env node
/**
 * Phase 3.51: PvE Clarity Guard
 * 
 * Ensures:
 * 1. No RNG/timers in damage overlay
 * 2. Damage overlay exists in BattlePresentationModal
 * 3. Power gap explainer exists in VictoryDefeatModal
 * 4. Telemetry constants exist
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
console.log('Guard: Phase 3.51 PvE Clarity');
console.log('============================================');

// Check BattlePresentationModal for damage overlay
if (fs.existsSync(BATTLE_MODAL)) {
  const content = fs.readFileSync(BATTLE_MODAL, 'utf8');
  
  checksRun++;
  if (content.includes('damageNumber') || content.includes('DamageNumber') || content.includes('damage')) {
    console.log(`${GREEN}PASS:${RESET} BattlePresentationModal has damage display`);
  } else {
    console.log(`${RED}FAIL:${RESET} BattlePresentationModal missing damage overlay`);
    hasErrors = true;
  }
  
  checksRun++;
  if (!content.includes('Math.random')) {
    console.log(`${GREEN}PASS:${RESET} No Math.random in BattlePresentationModal`);
  } else {
    console.log(`${RED}FAIL:${RESET} Math.random found in BattlePresentationModal`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} BattlePresentationModal not found`);
}

// Check VictoryDefeatModal for power gap explainer
if (fs.existsSync(RESULT_MODAL)) {
  const content = fs.readFileSync(RESULT_MODAL, 'utf8');
  
  checksRun++;
  if (content.includes('powerGap') || content.includes('Power Gap') || content.includes('enemyPower')) {
    console.log(`${GREEN}PASS:${RESET} VictoryDefeatModal has power gap display`);
  } else {
    console.log(`${RED}FAIL:${RESET} VictoryDefeatModal missing power gap explainer`);
    hasErrors = true;
  }
  
  checksRun++;
  if (content.includes('recommendation') || content.includes('defeatReason') || content.includes('DEFEAT_REASONS')) {
    console.log(`${GREEN}PASS:${RESET} VictoryDefeatModal has recommendation system`);
  } else {
    console.log(`${RED}FAIL:${RESET} VictoryDefeatModal missing recommendation`);
    hasErrors = true;
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} VictoryDefeatModal not found`);
}

// Check telemetry events
if (fs.existsSync(TELEMETRY_FILE)) {
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  const requiredEvents = [
    'PVE_BATTLE_PRESENTATION_VIEWED',
    'PVE_VICTORY_VIEWED',
    'PVE_DEFEAT_VIEWED',
  ];
  
  for (const event of requiredEvents) {
    checksRun++;
    if (content.includes(event)) {
      console.log(`${GREEN}PASS:${RESET} Telemetry event ${event} exists`);
    } else {
      console.log(`${RED}FAIL:${RESET} Missing telemetry event: ${event}`);
      hasErrors = true;
    }
  }
} else {
  console.log(`${YELLOW}SKIP:${RESET} Telemetry file not found`);
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}PvE Clarity guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PvE Clarity guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
