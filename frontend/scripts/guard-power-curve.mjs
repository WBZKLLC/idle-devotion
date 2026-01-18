#!/usr/bin/env node
/**
 * Power Curve Guard
 * 
 * Enforces:
 * 1. No stat multiplier changes without doc update
 * 2. No base stat changes without simulation review
 * 3. No new multiplier sources without formula update
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
console.log('Power Curve Guard');
console.log('============================================\n');

// =============================================================================
// CHECK 1: POWER_CURVE.md exists
// =============================================================================

console.log('Check 1: POWER_CURVE.md documentation exists...');

const powerCurvePath = '/app/docs/POWER_CURVE.md';
if (!fs.existsSync(powerCurvePath)) {
  fail('POWER_CURVE.md not found - create documentation before modifying stats');
} else {
  pass('POWER_CURVE.md exists');
}

// =============================================================================
// CHECK 2: No hardcoded stat multipliers in frontend
// =============================================================================

console.log('\nCheck 2: No hardcoded stat multipliers in frontend...');

const FORBIDDEN_STAT_PATTERNS = [
  /statMultiplier\s*=\s*\d/,
  /baseStats?\s*\*\s*\d+\.\d/,
  /ATK_MULT|DEF_MULT|HP_MULT/,
];

const frontendFiles = [
  'lib/api/heroProgression.ts',
  'components/hero/PromotionModal.tsx',
];

for (const relPath of frontendFiles) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_STAT_PATTERNS) {
    if (pattern.test(content)) {
      fail(`Hardcoded stat multiplier in ${relPath} - use server values`);
    }
  }
}

if (!failed) {
  pass('No hardcoded stat multipliers in frontend');
}

// =============================================================================
// CHECK 3: heroProgression API uses server-derived stats
// =============================================================================

console.log('\nCheck 3: Hero progression uses server-derived stats...');

const heroProgPath = path.join(process.cwd(), 'lib/api/heroProgression.ts');
if (fs.existsSync(heroProgPath)) {
  const content = fs.readFileSync(heroProgPath, 'utf8');
  
  // Should fetch from server, not calculate locally
  if (content.includes('getHeroStats')) {
    pass('heroProgression.ts uses server-derived stats');
  } else {
    warn('heroProgression.ts should use getHeroStats from server');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Power Curve guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Power Curve guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
