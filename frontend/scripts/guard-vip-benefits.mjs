#!/usr/bin/env node
/**
 * Guard: VIP Benefits Enforcement
 * 
 * Ensures VIP provides only economy/comfort benefits.
 * No stat buffs, no PvP advantages, no gated content.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PATH = path.resolve(__dirname, '../../backend/server.py');
const IDLE_RESOURCES_PATH = path.resolve(__dirname, '../../backend/core/idle_resources.py');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Guard: VIP Benefits Enforcement');
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

// Check 2: VIP idle benefits are rate/cap only
console.log('\nCheck 2: VIP idle benefits are rate/cap only...');
if (!allCode.includes('get_vip_idle_rate_multiplier') && !allCode.includes('idle_hours')) {
  fail('VIP idle benefits should use rate multiplier or cap hours');
}
pass('VIP idle benefits are rate/cap based');

// Check 3: No VIP-exclusive heroes
console.log('\nCheck 3: No VIP-exclusive heroes...');
const exclusiveHeroPatterns = [
  /vip.*exclusive.*hero/i,
  /vip_only.*hero/i,
  /hero.*vip_required/i,
];
for (const pattern of exclusiveHeroPatterns) {
  if (pattern.test(allCode)) {
    const lines = allCode.split('\n');
    for (const line of lines) {
      if (pattern.test(line) && !line.trim().startsWith('#') && !line.includes('early access')) {
        fail(`VIP-exclusive hero detected: ${line.trim()}`);
      }
    }
  }
}
pass('No VIP-exclusive heroes found');

// Check 4: VIP tiers exist (0-15)
console.log('\nCheck 4: VIP tiers 0-15 exist...');
if (!serverCode.includes('VIP_TIERS')) {
  fail('VIP_TIERS not found');
}
if (!serverCode.includes('15:')) {
  fail('VIP tier 15 not found');
}
pass('VIP tiers 0-15 exist');

// Check 5: Calculate VIP level from total_spent
console.log('\nCheck 5: VIP level from total_spent...');
if (!serverCode.includes('calculate_vip_level') || !serverCode.includes('total_spent')) {
  fail('VIP level must be calculated from total_spent');
}
pass('VIP level calculated from total_spent');

console.log('\n============================================');
console.log(`${GREEN}VIP Benefits guard PASSED!${RESET}`);
console.log('============================================\n');
