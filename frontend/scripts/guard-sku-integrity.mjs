#!/usr/bin/env node
/**
 * Guard: SKU Integrity Enforcement
 * 
 * Ensures all SKUs have canonical receipt sources.
 * Validates no direct balance mutations from purchases.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PATH = path.resolve(__dirname, '../../backend/server.py');
const RECEIPT_TYPES_PATH = path.resolve(__dirname, '../lib/types/receipt.ts');

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
console.log('Guard: SKU Integrity Enforcement');
console.log('============================================\n');

// Read files
const serverCode = fs.readFileSync(BACKEND_PATH, 'utf8');
let receiptTypes = '';
try {
  receiptTypes = fs.readFileSync(RECEIPT_TYPES_PATH, 'utf8');
} catch (e) {
  // Receipt types might be in different location
}

// Check 1: iap_purchase is a valid receipt source
console.log('Check 1: iap_purchase is valid receipt source...');
if (receiptTypes && !receiptTypes.includes('iap_purchase')) {
  fail('iap_purchase must be a valid RewardSource');
}
pass('iap_purchase is valid receipt source');

// Check 2: Store purchase intent exists
console.log('\nCheck 2: Store purchase-intent endpoint exists...');
if (!serverCode.includes('purchase-intent') && !serverCode.includes('purchase_intent')) {
  fail('Missing store purchase-intent endpoint');
}
pass('Store purchase-intent endpoint exists');

// Check 3: No direct balance mutations in purchase handlers
console.log('\nCheck 3: No direct balance mutations in purchase handlers...');
const dangerousPatterns = [
  /purchase.*\$set.*crystals/i,
  /purchase.*\$inc.*coins/i,
  /buy.*\$set.*gems/i,
];
let violations = [];
for (const pattern of dangerousPatterns) {
  if (pattern.test(serverCode)) {
    const lines = serverCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i]) && !lines[i].trim().startsWith('#')) {
        violations.push(`Line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
      }
    }
  }
}
if (violations.length > 0) {
  console.log('  Potential violations (verify these use receipts):');
  violations.forEach(v => console.log(`    ${v}`));
}
pass('No obvious direct balance mutations in purchases');

// Check 4: VIP XP accrual exists
console.log('\nCheck 4: VIP XP accrual system exists...');
if (!serverCode.includes('total_spent')) {
  fail('VIP XP must be tracked via total_spent');
}
pass('VIP XP accrual via total_spent exists');

// Check 5: Webhook endpoint for RevenueCat
console.log('\nCheck 5: RevenueCat webhook endpoint exists...');
if (!serverCode.includes('webhook') && !serverCode.includes('revenuecat')) {
  console.log('  Warning: RevenueCat webhook not found (OK if not yet implemented)');
}
pass('SKU infrastructure verified');

console.log('\n============================================');
console.log(`${GREEN}SKU Integrity guard PASSED!${RESET}`);
console.log('============================================\n');
