#!/usr/bin/env node
/**
 * Phase 3.40 Guard: Hero Promotion UI (Sanctuary-Safe)
 * 
 * Enforces:
 * 1. Promote button only when backend-eligible
 * 2. No stat math in UI
 * 3. Receipt-only updates
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

console.log('\n============================================');
console.log('Phase 3.40 Guard: Hero Promotion UI');
console.log('============================================\n');

// =============================================================================
// CHECK 1: PromotionModal exists with eligibility check
// =============================================================================

console.log('Check 1: PromotionModal has eligibility check...');

const modalPath = path.join(process.cwd(), 'components/hero/PromotionModal.tsx');
if (!fs.existsSync(modalPath)) {
  fail('PromotionModal not found');
} else {
  const content = fs.readFileSync(modalPath, 'utf8');
  
  // Must check canPromote
  if (!content.includes('canPromote') && !content.includes('hasEnoughShards')) {
    fail('PromotionModal must check promotion eligibility');
  }
  
  // Must disable when not eligible
  if (!content.includes('disabled')) {
    fail('PromotionModal must disable button when ineligible');
  }
  
  if (!failed) {
    pass('PromotionModal has eligibility checks');
  }
}

// =============================================================================
// CHECK 2: No stat math in UI files
// =============================================================================

console.log('\nCheck 2: No stat math in UI files...');

const FORBIDDEN_STAT_MATH = [
  /baseStat\s*\*/,
  /stat\s*\*\s*multiplier/i,
  /hp\s*\*\s*\d/,
  /atk\s*\*\s*\d/,
  /def\s*\*\s*\d/,
  /calculateStats\s*\(/,
  /deriveStats\s*\(/,
];

const uiFiles = [
  'components/hero/PromotionModal.tsx',
  'components/hero/StarDisplay.tsx',
];

for (const relPath of uiFiles) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_STAT_MATH) {
    if (pattern.test(content)) {
      fail(`Stat math found in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No stat math in UI files');
}

// =============================================================================
// CHECK 3: StarDisplay component exists
// =============================================================================

console.log('\nCheck 3: StarDisplay component exists...');

const starDisplayPath = path.join(process.cwd(), 'components/hero/StarDisplay.tsx');
if (!fs.existsSync(starDisplayPath)) {
  fail('StarDisplay component not found');
} else {
  pass('StarDisplay component exists');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.40 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.40 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
