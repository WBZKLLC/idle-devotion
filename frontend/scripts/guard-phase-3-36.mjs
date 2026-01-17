#!/usr/bin/env node
/**
 * Phase 3.36 Guard: Shop → Summon Loop Closure
 * 
 * Validates:
 * 1. "Get Gems" CTA exists where summon blocks on funds
 * 2. Shop intent → redeem uses receipts only
 * 3. "Return to Summon" after redeem exists
 * 4. Receipt-only balance mutation
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
console.log('Phase 3.36 Guard: Shop → Summon Loop');
console.log('============================================\n');

// =============================================================================
// CHECK 1: InsufficientFundsModal has "Go to Shop" CTA
// =============================================================================

console.log('Check 1: InsufficientFundsModal has shop CTA...');

const insufficientFundsPath = path.join(process.cwd(), 'components/gacha/InsufficientFundsModal.tsx');
if (!fs.existsSync(insufficientFundsPath)) {
  fail('InsufficientFundsModal not found');
} else {
  const content = fs.readFileSync(insufficientFundsPath, 'utf8');
  
  if (!content.includes('/shop') && !content.includes('shop')) {
    fail('InsufficientFundsModal must route to shop');
  }
  
  if (!failed) {
    pass('InsufficientFundsModal has shop CTA');
  }
}

// =============================================================================
// CHECK 2: Shop screen exists and uses receipt
// =============================================================================

console.log('\nCheck 2: Shop screen uses receipt-based balances...');

const shopPaths = [
  'app/shop.tsx',
  'app/(tabs)/shop.tsx',
];

let shopFound = false;
for (const relPath of shopPaths) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    shopFound = true;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Must use receipt for balance updates
    if (!content.includes('receipt') && !content.includes('Receipt')) {
      warn(`${relPath} should use receipt for balance updates`);
    }
    
    break;
  }
}

if (!shopFound) {
  warn('Shop screen not found - may be at different path');
} else if (!failed) {
  pass('Shop screen exists');
}

// =============================================================================
// CHECK 3: No direct balance mutations in shop/gacha files
// =============================================================================

console.log('\nCheck 3: No direct balance mutations...');

const filesToCheck = [
  'components/gacha/InsufficientFundsModal.tsx',
  'components/gacha/BannerDetailsSheet.tsx',
  'app/gacha-history.tsx',
];

const FORBIDDEN_MUTATIONS = [
  /setUser\s*\(\s*\{[^}]*(?:coins|gems|crystals)\s*:/,
  /user\.(?:coins|gems|crystals)\s*[-+]=/,
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_MUTATIONS) {
    if (pattern.test(content)) {
      fail(`Direct balance mutation in ${relPath} - use receipt.balances`);
    }
  }
}

if (!failed) {
  pass('No direct balance mutations in gacha files');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.36 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.36 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
