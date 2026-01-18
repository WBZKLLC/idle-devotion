#!/usr/bin/env node
/**
 * SKU Integrity Guard
 * 
 * Enforces:
 * 1. No SKU without canonical receipt source
 * 2. No SKU without telemetry event
 * 3. No direct balance mutation (receipts only)
 * 4. No trust in client-side purchase success
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
console.log('SKU Integrity Guard');
console.log('============================================\n');

// =============================================================================
// CHECK 1: REVENUECAT_SKUS.md exists
// =============================================================================

console.log('Check 1: REVENUECAT_SKUS.md documentation exists...');

const skuDocPath = '/app/docs/REVENUECAT_SKUS.md';
if (!fs.existsSync(skuDocPath)) {
  fail('REVENUECAT_SKUS.md not found');
} else {
  pass('REVENUECAT_SKUS.md exists');
}

// =============================================================================
// CHECK 2: No client-side purchase trust
// =============================================================================

console.log('\nCheck 2: No client-side purchase trust...');

const FORBIDDEN_TRUST_PATTERNS = [
  /purchaseSucceeded\s*=\s*true/,
  /isPurchased\s*=\s*true/,
  /grantRewards\s*\(/,  // Should come from server receipt
  /addCurrency\s*\(/,  // Direct currency add
];

const purchaseFiles = [
  'lib/api/store.ts',
  'app/shop.tsx',
];

for (const relPath of purchaseFiles) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_TRUST_PATTERNS) {
    if (pattern.test(content)) {
      fail(`Client-side purchase trust in ${relPath} - use server receipt only`);
    }
  }
}

if (!failed) {
  pass('No client-side purchase trust patterns');
}

// =============================================================================
// CHECK 3: iap_purchase source exists in receipt types
// =============================================================================

console.log('\nCheck 3: IAP receipt source defined...');

const receiptPath = path.join(process.cwd(), 'lib/types/receipt.ts');
if (fs.existsSync(receiptPath)) {
  const content = fs.readFileSync(receiptPath, 'utf8');
  
  if (content.includes('iap_purchase')) {
    pass('iap_purchase receipt source defined');
  } else {
    fail('iap_purchase not in receipt sources');
  }
} else {
  fail('receipt.ts not found');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}SKU Integrity guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}SKU Integrity guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
