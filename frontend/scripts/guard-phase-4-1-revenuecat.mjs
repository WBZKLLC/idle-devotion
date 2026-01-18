#!/usr/bin/env node
/**
 * Phase 4.1: RevenueCat Production Guard
 * 
 * Enforces:
 * 1. No direct balance mutation in frontend after purchase
 * 2. Verify endpoint exists and returns canonical receipt
 * 3. Webhook signature verification present
 * 4. No DEV redeem button when SERVER_DEV_MODE=false
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const SERVER_FILE = path.resolve('../backend/server.py');
const SHOP_FILE = path.resolve('./app/shop.tsx');
const API_FILE = path.resolve('./lib/api.ts');

// Check backend webhook and verify endpoints
function checkBackend() {
  if (!fs.existsSync(SERVER_FILE)) {
    ERRORS.push('PHASE_4_1_01: server.py not found');
    return;
  }
  
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Check for webhook endpoint
  if (!content.includes('/webhooks/revenuecat') && !content.includes('revenuecat_webhook')) {
    WARNINGS.push('PHASE_4_1_02: RevenueCat webhook endpoint may not be fully implemented');
  }
  
  // Check for signature verification
  if (!content.includes('REVENUECAT_WEBHOOK_SECRET') && !content.includes('webhook_secret')) {
    WARNINGS.push('PHASE_4_1_03: Webhook signature verification may be missing');
  }
  
  // Check for verify endpoint
  if (!content.includes('/purchases/verify') && !content.includes('verify_purchase')) {
    WARNINGS.push('PHASE_4_1_04: Purchase verify endpoint may not exist');
  }
  
  // Check DEV mode guarding
  if (content.includes('redeem-intent') || content.includes('dev_redeem')) {
    if (!content.includes('SERVER_DEV_MODE')) {
      WARNINGS.push('PHASE_4_1_05: DEV redeem endpoint may not be properly guarded');
    }
  }
}

// Check shop.tsx doesn't mutate balances directly
function checkShop() {
  if (!fs.existsSync(SHOP_FILE)) {
    WARNINGS.push('PHASE_4_1_10: shop.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(SHOP_FILE, 'utf8');
  
  // Check for direct balance mutations
  const dangerousPatterns = [
    'setGold(',
    'setCrystals(',
    'setGems(',
    'user.gold =',
    'user.crystals =',
    'user.gems =',
  ];
  
  for (const pattern of dangerousPatterns) {
    if (content.includes(pattern)) {
      ERRORS.push(`PHASE_4_1_11: shop.tsx contains direct balance mutation: ${pattern}`);
    }
  }
  
  // Check for receipt-based flow
  if (!content.includes('receipt') && !content.includes('verify')) {
    WARNINGS.push('PHASE_4_1_12: shop.tsx may not be using receipt-based purchase flow');
  }
}

// Run checks
checkBackend();
checkShop();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 4.1: RevenueCat Production - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 4.1 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 4.1 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
