#!/usr/bin/env node
/**
 * Phase E2: RN Equivalency Guard
 * 
 * Asserts:
 * - BattlePresentationModal contains Key Moment Timeline labels
 * - VictoryDefeatModal contains Reward Record text
 * - No Math.random usage in battle components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = path.join(__dirname, '..', 'components', 'battle');

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

// Check BattlePresentationModal
const battlePath = path.join(COMPONENTS_DIR, 'BattlePresentationModal.tsx');
if (!fs.existsSync(battlePath)) {
  fail('BattlePresentationModal.tsx not found');
} else {
  const battleContent = fs.readFileSync(battlePath, 'utf-8');
  
  // Check for Key Moment Timeline
  const keyMoments = ['OPENING', 'SKILL', 'DAMAGE', 'CLUTCH', 'FINAL'];
  const hasKeyMoments = keyMoments.some(m => battleContent.includes(m));
  if (hasKeyMoments) {
    pass('BattlePresentationModal has Key Moment Timeline labels');
  } else {
    fail('BattlePresentationModal missing Key Moment Timeline labels (OPENING, SKILL, etc.)');
  }
  
  // Check for damage tags
  const damageTags = ['CRIT', 'GLANCING', 'DEVASTATING', 'BLOCKED'];
  const hasDamageTags = damageTags.every(t => battleContent.includes(t));
  if (hasDamageTags) {
    pass('BattlePresentationModal has all damage number tags');
  } else {
    fail('BattlePresentationModal missing damage tags (CRIT, GLANCING, DEVASTATING, BLOCKED)');
  }
  
  // Check for NO Math.random
  if (battleContent.includes('Math.random')) {
    fail('BattlePresentationModal contains Math.random (must be deterministic)');
  } else {
    pass('BattlePresentationModal is deterministic (no Math.random)');
  }
}

// Check VictoryDefeatModal
const victoryPath = path.join(COMPONENTS_DIR, 'VictoryDefeatModal.tsx');
if (!fs.existsSync(victoryPath)) {
  fail('VictoryDefeatModal.tsx not found');
} else {
  const victoryContent = fs.readFileSync(victoryPath, 'utf-8');
  
  // Check for Reward Record
  if (victoryContent.includes('Reward Record') || victoryContent.includes('rewardRecord')) {
    pass('VictoryDefeatModal has Reward Record');
  } else {
    fail('VictoryDefeatModal missing "Reward Record" text');
  }
  
  // Check for crown/badge equivalent
  if (victoryContent.includes('crownBadge') || victoryContent.includes('Victory') || victoryContent.includes('crown')) {
    pass('VictoryDefeatModal has crown/badge equivalent');
  } else {
    fail('VictoryDefeatModal missing crown/badge equivalent');
  }
  
  // Check for NO Math.random
  if (victoryContent.includes('Math.random')) {
    fail('VictoryDefeatModal contains Math.random (must be deterministic)');
  } else {
    pass('VictoryDefeatModal is deterministic (no Math.random)');
  }
}

// Check telemetry events exist
const eventsPath = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');
if (!fs.existsSync(eventsPath)) {
  fail('events.ts not found');
} else {
  const eventsContent = fs.readFileSync(eventsPath, 'utf-8');
  
  const requiredEvents = [
    'PVE_KEY_MOMENT_BEAT_SHOWN',
    'PVE_DAMAGE_NUMBER_BATCH_SHOWN',
    'PVE_VICTORY_CEREMONY_VIEWED',
    'PVE_REWARD_RECORD_VIEWED'
  ];
  
  const missingEvents = requiredEvents.filter(e => !eventsContent.includes(e));
  if (missingEvents.length === 0) {
    pass('All Phase E2 telemetry events present');
  } else {
    fail(`Missing telemetry events: ${missingEvents.join(', ')}`);
  }
}

console.log('');
if (hasErrors) {
  console.error(`${RED}Phase E2 Equivalency guard FAILED${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Phase E2 Equivalency guard PASSED${RESET}`);
  process.exit(0);
}
