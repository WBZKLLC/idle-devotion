#!/usr/bin/env node
/**
 * Guard: PvP Monetization Ethics Enforcement
 * 
 * Ensures no paid-only PvP power, no VIP stat buffs,
 * and validates ethical monetization patterns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PATH = path.resolve(__dirname, '../../backend/server.py');
const IDLE_RESOURCES_PATH = path.resolve(__dirname, '../../backend/core/idle_resources.py');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}WARN:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Guard: PvP Monetization Ethics Enforcement');
console.log('============================================\n');

// Read files
const serverCode = fs.readFileSync(BACKEND_PATH, 'utf8');
let idleCode = '';
try {
  idleCode = fs.readFileSync(IDLE_RESOURCES_PATH, 'utf8');
} catch (e) {
  // Idle resources might be inline
}

const allCode = serverCode + idleCode;

// Check 1: No VIP stat buffs
console.log('Check 1: No VIP stat buffs (ATK, HP, DEF)...');
const statBuffPatterns = [
  /vip.*atk\s*\*=/i,
  /vip.*hp\s*\*=/i,
  /vip.*def\s*\*=/i,
  /vip_level.*stat_multiplier/i,
  /vip.*damage_bonus/i,
  /vip.*combat_power/i,
];
for (const pattern of statBuffPatterns) {
  if (pattern.test(allCode)) {
    const lines = allCode.split('\n');
    for (const line of lines) {
      if (pattern.test(line) && !line.trim().startsWith('#')) {
        fail(`VIP stat buff detected: ${line.trim()}`);
      }
    }
  }
}
pass('No VIP stat buffs found');

// Check 2: No paid-only hero superiority
console.log('\nCheck 2: No paid-only heroes with superior stats...');
const paidHeroPatterns = [
  /paid.*hero.*superior/i,
  /exclusive.*hero.*stats.*higher/i,
  /premium.*hero.*power/i,
];
for (const pattern of paidHeroPatterns) {
  if (pattern.test(allCode)) {
    const lines = allCode.split('\n');
    for (const line of lines) {
      if (pattern.test(line) && !line.trim().startsWith('#')) {
        fail(`Paid hero superiority detected: ${line.trim()}`);
      }
    }
  }
}
pass('No paid-only hero superiority found');

// Check 3: No matchmaking manipulation by spend
console.log('\nCheck 3: No matchmaking manipulation by spend...');
const matchmakingPatterns = [
  /vip.*matchmaking/i,
  /spend.*queue.*priority/i,
  /paid.*matchmaking.*advantage/i,
];
for (const pattern of matchmakingPatterns) {
  if (pattern.test(allCode)) {
    const lines = allCode.split('\n');
    for (const line of lines) {
      if (pattern.test(line) && !line.trim().startsWith('#')) {
        fail(`Matchmaking manipulation detected: ${line.trim()}`);
      }
    }
  }
}
pass('No matchmaking manipulation found');

// Check 4: Pity system exists (transparent odds)
console.log('\nCheck 4: Pity system exists for gacha...');
if (!serverCode.includes('pity') || !serverCode.includes('pity_counter')) {
  warn('Pity system not clearly implemented - verify gacha transparency');
} else {
  pass('Pity system exists for gacha transparency');
}

// Check 5: Rates/odds are defined (transparency)
console.log('\nCheck 5: Gacha rates are explicitly defined...');
const ratePatterns = ['UR_RATE', 'SSR_RATE', 'rate', 'probability'];
let foundRates = false;
for (const pattern of ratePatterns) {
  if (serverCode.toLowerCase().includes(pattern.toLowerCase())) {
    foundRates = true;
    break;
  }
}
if (!foundRates) {
  warn('Gacha rates not clearly defined - verify odds transparency');
} else {
  pass('Gacha rates are explicitly defined');
}

// Check 6: No unlimited PvP attempts for sale (check for caps)
console.log('\nCheck 6: PvP attempt caps exist (no unlimited purchases)...');
// This is more of a warning check - unlimited might not be in code yet
if (serverCode.includes('unlimited_pvp') || serverCode.includes('infinite_attempts')) {
  fail('Unlimited PvP attempts detected - must have caps');
}
pass('No unlimited PvP attempt patterns found');

// Check 7: VIP benefits are economy/comfort only
console.log('\nCheck 7: VIP benefits focus on economy/comfort...');
const validVipBenefits = ['idle', 'cap', 'rate', 'cosmetic', 'frame', 'bubble', 'convenience', 'storage'];
const vipSection = serverCode.indexOf('VIP_TIERS');
if (vipSection === -1) {
  warn('VIP_TIERS not found - cannot verify benefits');
} else {
  const vipCode = serverCode.substring(vipSection, vipSection + 2000);
  let foundValidBenefits = false;
  for (const benefit of validVipBenefits) {
    if (vipCode.toLowerCase().includes(benefit)) {
      foundValidBenefits = true;
      break;
    }
  }
  if (foundValidBenefits) {
    pass('VIP benefits include economy/comfort categories');
  } else {
    warn('VIP benefits unclear - verify they are not combat-related');
  }
}

// Check 8: Ethics doc exists
console.log('\nCheck 8: PvP ethics documentation exists...');
const ethicsDocPath = path.resolve(__dirname, '../../docs/pvp-monetization-ethics.md');
if (!fs.existsSync(ethicsDocPath)) {
  fail('Missing docs/pvp-monetization-ethics.md');
}
pass('PvP ethics documentation exists');

console.log('\n============================================');
console.log(`${GREEN}PvP Ethics guard PASSED!${RESET}`);
console.log('============================================\n');
