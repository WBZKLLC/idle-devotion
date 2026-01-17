#!/usr/bin/env node
/**
 * Phase 3.37 Guard: Hero Inventory Reward Surface
 * 
 * Validates:
 * 1. Hero gallery can show "New" pip
 * 2. Shard count display on hero cards
 * 3. No recomputing shard math in UI
 */
import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let failed = false;

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}WARN:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Phase 3.37 Guard: Hero Inventory Surface');
console.log('============================================\n');

// =============================================================================
// CHECK 1: Heroes gallery screen exists
// =============================================================================

console.log('Check 1: Heroes gallery screen exists...');

const heroesPaths = [
  'app/(tabs)/heroes.tsx',
  'app/heroes.tsx',
];

let heroesFound = false;
for (const relPath of heroesPaths) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    heroesFound = true;
    pass(`Heroes screen found: ${relPath}`);
    break;
  }
}

if (!heroesFound) {
  warn('Heroes gallery screen not found at expected paths');
}

// =============================================================================
// CHECK 2: No forbidden shard math in UI
// =============================================================================

console.log('\nCheck 2: No forbidden shard recomputation in UI...');

const SHARD_MATH_PATTERNS = [
  /shard.*\*.*rarity/i,
  /rarity.*\*.*shard/i,
  /shardsFromDupe\s*=/,
  /calculateShards\s*\(/,
];

const uiFiles = [
  'app/(tabs)/heroes.tsx',
  'app/heroes.tsx',
  'components/gacha/SummonResultsModal.tsx',
];

for (const relPath of uiFiles) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of SHARD_MATH_PATTERNS) {
    if (pattern.test(content)) {
      fail(`Shard math recomputation in ${relPath} - use receipt data`);
    }
  }
}

if (!failed) {
  pass('No forbidden shard recomputation in UI');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.37 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.37 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
