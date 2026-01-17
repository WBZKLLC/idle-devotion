#!/usr/bin/env node
/**
 * Phase 3.30: Store & Economy System Guard
 *
 * Validates:
 * - shop.tsx screen exists
 * - No billing library imports
 * - Store intent endpoint usage
 * - Canonical receipt for redeem (if exists)
 */

import fs from 'fs';
import path from 'path';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

let exitCode = 0;

function check(condition, message, warning = false) {
  if (condition) {
    console.log(`${PASS} ${message}`);
    return true;
  } else if (warning) {
    console.log(`${WARN} ${message}`);
    return true;
  } else {
    console.log(`${FAIL} ${message}`);
    exitCode = 1;
    return false;
  }
}

console.log('============================================================');
console.log('Phase 3.30: Store & Economy System Guard');
console.log('============================================================\n');

// Read shop.tsx
const shopPath = path.join(process.cwd(), 'app/shop.tsx');
const shopExists = fs.existsSync(shopPath);

check(
  shopExists,
  '/app/shop.tsx screen exists'
);

if (!shopExists) {
  console.log('\n\x1b[31mPhase 3.30 guard FAILED! (shop.tsx missing)\x1b[0m');
  process.exit(1);
}

const shopContent = fs.readFileSync(shopPath, 'utf8');

// Read store API
const storeApiPath = path.join(process.cwd(), 'lib/api/store.ts');
const storeApiExists = fs.existsSync(storeApiPath);
const storeApiContent = storeApiExists ? fs.readFileSync(storeApiPath, 'utf8') : '';

// Read receipt types
const receiptPath = path.join(process.cwd(), 'lib/types/receipt.ts');
const receiptContent = fs.readFileSync(receiptPath, 'utf8');

console.log('--- Shop Screen ---\n');

// Check purchase intent function
check(
  shopContent.includes('createPurchaseIntent'),
  'createPurchaseIntent function used in shop'
);

// Check catalog loading
check(
  shopContent.includes('getStoreCatalog'),
  'getStoreCatalog function used in shop'
);

// Check telemetry
check(
  shopContent.includes('STORE_VIEWED'),
  'STORE_VIEWED telemetry emitted'
);

check(
  shopContent.includes('STORE_ITEM_SELECTED'),
  'STORE_ITEM_SELECTED telemetry emitted'
);

console.log('\n--- No Billing Libraries ---\n');

// Check no billing library imports (react-native-iap, purchases-react-native direct usage outside existing RevenueCat)
const hasBillingLib = /import.*from\s+['"]react-native-iap['"]/.test(shopContent);
check(
  !hasBillingLib,
  'No direct billing library imports in shop.tsx'
);

console.log('\n--- Store API ---\n');

check(
  storeApiExists,
  'lib/api/store.ts exists'
);

if (storeApiExists) {
  check(
    storeApiContent.includes('createPurchaseIntent'),
    'createPurchaseIntent API function exists'
  );
  
  check(
    storeApiContent.includes('redeemIntent'),
    'redeemIntent (DEV-only) API function exists'
  );
}

console.log('\n--- Canonical Receipt (Redeem) ---\n');

// Check store_redeem is valid source
check(
  receiptContent.includes("'store_redeem'"),
  'store_redeem is valid RewardSource'
);

// Check redeem uses canonical receipt
if (storeApiExists) {
  check(
    storeApiContent.includes('isValidReceipt'),
    'Redeem uses canonical receipt validation'
  );
}

console.log('\n============================================================');
if (exitCode === 0) {
  console.log('\x1b[32mPhase 3.30 guard PASSED!\x1b[0m');
} else {
  console.log('\x1b[31mPhase 3.30 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
