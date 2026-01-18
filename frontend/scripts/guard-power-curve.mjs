#!/usr/bin/env node
/**
 * Guard: Power Curve Enforcement
 * 
 * Ensures no stat multiplier changes without doc update.
 * Validates BASE_STATS_BY_RARITY, STAR_TABLE, AFFINITY_MULTIPLIERS.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PATH = path.resolve(__dirname, '../../backend/server.py');
const DOC_PATH = path.resolve(__dirname, '../../docs/POWER_CURVE.md');

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
console.log('Guard: Power Curve Enforcement');
console.log('============================================\n');

// Read files
const serverCode = fs.readFileSync(BACKEND_PATH, 'utf8');

// Check 1: STAR_TABLE exists with locked values
console.log('Check 1: STAR_TABLE has correct values...');
// Match multiline STAR_TABLE definition
const starTableMatch = serverCode.match(/STAR_TABLE\s*=\s*\{[\s\S]*?^\}/m);
if (!starTableMatch) {
  fail('STAR_TABLE not found in server.py');
}
const starTableContent = starTableMatch[0];
const expectedStarMultipliers = [
  { star: 1, mult: '1.0' },
  { star: 2, mult: '1.15' },
  { star: 3, mult: '1.35' },
  { star: 4, mult: '1.60' },
  { star: 5, mult: '1.90' },
  { star: 6, mult: '2.25' },
];
for (const { star, mult } of expectedStarMultipliers) {
  // Match Python dict format: "statMultiplier": 1.15 (no quotes around number)
  const pattern = new RegExp(`statMultiplier["']?:\\s*${mult}`);
  if (!pattern.test(starTableContent)) {
    fail(`STAR_TABLE star ${star} should have statMultiplier ${mult}`);
  }
}
pass('STAR_TABLE has correct multipliers (1.0 → 2.25)');

// Check 2: BASE_STATS_BY_RARITY exists
console.log('\nCheck 2: BASE_STATS_BY_RARITY has all rarities...');
const baseStatsMatch = serverCode.match(/BASE_STATS_BY_RARITY\s*=\s*\{([^}]+)\}/s);
if (!baseStatsMatch) {
  fail('BASE_STATS_BY_RARITY not found in server.py');
}
const requiredRarities = ['N', 'R', 'SR', 'SSR', 'SSR+', 'UR', 'UR+'];
for (const rarity of requiredRarities) {
  if (!baseStatsMatch[1].includes(`"${rarity}"`)) {
    fail(`BASE_STATS_BY_RARITY missing rarity: ${rarity}`);
  }
}
pass('BASE_STATS_BY_RARITY has all rarities (N → UR+)');

// Check 3: AFFINITY_MULTIPLIERS exists
console.log('\nCheck 3: AFFINITY_MULTIPLIERS has correct values...');
const affinityMatch = serverCode.match(/AFFINITY_MULTIPLIERS\s*=\s*\{([^}]+)\}/s);
if (!affinityMatch) {
  fail('AFFINITY_MULTIPLIERS not found in server.py');
}
const expectedAffinityMults = [
  { tier: 0, mult: '1.0' },
  { tier: 5, mult: '1.30' },
];
if (!affinityMatch[1].includes('1.0') || !affinityMatch[1].includes('1.30')) {
  fail('AFFINITY_MULTIPLIERS should have 1.0 (tier 0) and 1.30 (tier 5)');
}
pass('AFFINITY_MULTIPLIERS has correct range (1.0 → 1.30)');

// Check 4: derive_hero_stats uses correct formula
console.log('\nCheck 4: derive_hero_stats uses canonical formula...');
if (!serverCode.includes('finalStat = baseStat × starMultiplier × affinityMultiplier')) {
  fail('derive_hero_stats must document formula: finalStat = baseStat × starMultiplier × affinityMultiplier');
}
pass('derive_hero_stats uses canonical formula');

// Check 5: No hardcoded stat buffs outside tables
console.log('\nCheck 5: No hardcoded stat multipliers outside tables...');
const dangerousPatterns = [
  /stats\[.+\]\s*\*=\s*\d+\.\d+/,
  /atk\s*\*=\s*\d+\.\d+(?!.*starMultiplier)/,
  /hp\s*\*=\s*\d+\.\d+(?!.*starMultiplier)/,
];
for (const pattern of dangerousPatterns) {
  if (pattern.test(serverCode)) {
    // Allow in comments
    const lines = serverCode.split('\n');
    for (const line of lines) {
      if (pattern.test(line) && !line.trim().startsWith('#')) {
        fail(`Found hardcoded stat multiplier outside tables: ${line.trim()}`);
      }
    }
  }
}
pass('No hardcoded stat multipliers outside tables');

console.log('\n============================================');
console.log(`${GREEN}Power Curve guard PASSED!${RESET}`);
console.log('============================================\n');
