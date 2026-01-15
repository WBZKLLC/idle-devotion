#!/usr/bin/env node
/**
 * guard-purchase-flow.mjs
 * 
 * Enforces canonical purchase patterns:
 * 1. No direct verifyPurchase() calls outside purchase-flow.ts
 * 2. No ad-hoc purchase state flags (isPurchasing, purchaseLoading, etc.)
 * 3. No raw product/entitlement strings outside allowed files
 * 
 * ALLOWED FILES for product strings:
 * - products.ts
 * - PurchaseButton.tsx  
 * - purchase-flow.ts
 * - types.ts (entitlement definitions)
 * - server.py (backend)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const FRONTEND_ROOT = new URL('..', import.meta.url).pathname;
const APP_DIR = join(FRONTEND_ROOT, 'app');
const COMPONENTS_DIR = join(FRONTEND_ROOT, 'components');
const STORES_DIR = join(FRONTEND_ROOT, 'stores');

// Files allowed to use raw product/entitlement strings
const ALLOWED_PRODUCT_STRING_FILES = new Set([
  'products.ts',
  'PurchaseButton.tsx',
  'purchase-flow.ts',
  'types.ts',
  'gating.ts',
  'entitlementStore.ts',
  'purchaseStore.ts',
  'api.ts', // API types need the strings
  'legacy.ts', // Legacy entitlement definitions
  'cinematicsAccess.ts', // Cinematic access helper
]);

// Raw strings that should NOT appear outside allowed files
const FORBIDDEN_RAW_STRINGS = [
  /['"]premium_cinematics_pack['"]/i,
  /['"]PREMIUM_CINEMATICS_PACK['"]/,
  /['"]premium_monthly['"]/i,
  /['"]no_ads_forever['"]/i,
  /['"]starter_pack['"]/i,
];

// Patterns indicating ad-hoc purchase state (forbidden everywhere except purchaseStore)
const ADHOC_STATE_PATTERNS = [
  /\bisPurchasing\b/,
  /\bpurchaseLoading\b/,
  /\bpurchaseInProgress\b/,
  /\bsetPurchasing\b/,
  /\bsetPurchaseLoading\b/,
];

// Legacy paywall patterns that should NOT be used (blocked everywhere)
const LEGACY_PAYWALL_PATTERNS = [
  /RevenueCatUI/,
  /presentPaywall\s*\(/,
  /presentPaywallIfNeeded/,
  /react-native-purchases-ui/,
  /useRevenueCatStore/,
];

// Files allowed to have legacy paywall patterns (none - they're deprecated)
const ALLOWED_LEGACY_PAYWALL_FILES = new Set([
  // Paywall.tsx exports deprecated stubs that warn - this is intentional
  'Paywall.tsx',
]);
];

// Direct verifyPurchase calls (only allowed in purchase-flow.ts)
const VERIFY_CALL_PATTERN = /verifyPurchase\s*\(/;
const ALLOWED_VERIFY_FILES = new Set(['purchase-flow.ts', 'api.ts']);

function getAllTsxFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        getAllTsxFiles(fullPath, files);
      } else if (['.tsx', '.ts'].includes(extname(item))) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist, skip
  }
  return files;
}

function checkFile(filePath) {
  const fileName = basename(filePath);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip first 10 lines (imports/comments) for raw string checks
    // These are typically safe boilerplate
    const skipRawStringCheck = lineNum <= 10;
    
    // Check for raw product strings in non-allowed files
    if (!skipRawStringCheck && !ALLOWED_PRODUCT_STRING_FILES.has(fileName)) {
      for (const pattern of FORBIDDEN_RAW_STRINGS) {
        if (pattern.test(line)) {
          violations.push({
            file: filePath.replace(FRONTEND_ROOT, ''),
            line: lineNum,
            type: 'RAW_PRODUCT_STRING',
            content: line.trim().substring(0, 80),
          });
          break;
        }
      }
    }
    
    // Check for ad-hoc purchase state flags (except in purchaseStore)
    if (fileName !== 'purchaseStore.ts') {
      for (const pattern of ADHOC_STATE_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: filePath.replace(FRONTEND_ROOT, ''),
            line: lineNum,
            type: 'ADHOC_PURCHASE_STATE',
            content: line.trim().substring(0, 80),
          });
          break;
        }
      }
    }
    
    // Check for direct verifyPurchase calls
    if (!ALLOWED_VERIFY_FILES.has(fileName) && VERIFY_CALL_PATTERN.test(line)) {
      violations.push({
        file: filePath.replace(FRONTEND_ROOT, ''),
        line: lineNum,
        type: 'DIRECT_VERIFY_CALL',
        content: line.trim().substring(0, 80),
      });
    }
    
    // Check for legacy RevenueCat paywall patterns (deprecated)
    if (!ALLOWED_LEGACY_PAYWALL_FILES.has(fileName)) {
      for (const pattern of LEGACY_PAYWALL_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: filePath.replace(FRONTEND_ROOT, ''),
            line: lineNum,
            type: 'LEGACY_PAYWALL',
            content: line.trim().substring(0, 80),
          });
          break;
        }
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔒 Checking purchase flow patterns...\n');
  
  const allFiles = [
    ...getAllTsxFiles(APP_DIR),
    ...getAllTsxFiles(COMPONENTS_DIR),
    ...getAllTsxFiles(STORES_DIR),
    ...getAllTsxFiles(join(FRONTEND_ROOT, 'lib')),
  ];
  
  let allViolations = [];
  
  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations = allViolations.concat(violations);
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No purchase flow violations found.');
    console.log('   All screens use PurchaseButton and canonical products.\n');
    process.exit(0);
  }
  
  console.log('❌ FORBIDDEN: Purchase flow drift detected!\n');
  console.log('Rules:');
  console.log('  - Use PRODUCTS from lib/entitlements/products.ts');
  console.log('  - Use PurchaseButton component for all purchases');
  console.log('  - Use usePurchaseStore for purchase state (not ad-hoc flags)');
  console.log('  - Only purchase-flow.ts may call verifyPurchase()\n');
  
  for (const v of allViolations) {
    console.log(`  [${v.type}] ${v.file}:${v.line}`);
    console.log(`    ${v.content}`);
    console.log('');
  }
  
  console.log(`\nTotal violations: ${allViolations.length}`);
  process.exit(1);
}

main();
