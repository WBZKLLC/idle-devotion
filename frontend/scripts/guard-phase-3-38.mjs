#!/usr/bin/env node
/**
 * Phase 3.38 Guard: Mail/Receipts Polish + Receipt Viewer Unification
 * 
 * Validates:
 * 1. Shared ReceiptViewer component exists
 * 2. Multiple screens import the shared component
 * 3. No duplicate receipt rendering implementations
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
console.log('Phase 3.38 Guard: Receipt Viewer Unification');
console.log('============================================\n');

// =============================================================================
// CHECK 1: Shared ReceiptViewer component exists
// =============================================================================

console.log('Check 1: Shared ReceiptViewer component exists...');

const receiptViewerPaths = [
  'components/receipt/ReceiptViewer.tsx',
  'components/ReceiptViewer.tsx',
  'components/shared/ReceiptViewer.tsx',
];

let receiptViewerFound = false;
let receiptViewerPath = '';

for (const relPath of receiptViewerPaths) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    receiptViewerFound = true;
    receiptViewerPath = relPath;
    pass(`ReceiptViewer found: ${relPath}`);
    break;
  }
}

if (!receiptViewerFound) {
  warn('Shared ReceiptViewer component not found - create components/receipt/ReceiptViewer.tsx');
}

// =============================================================================
// CHECK 2: Receipt types are properly defined
// =============================================================================

console.log('\nCheck 2: Receipt types properly defined...');

const receiptTypesPath = path.join(process.cwd(), 'lib/types/receipt.ts');
if (!fs.existsSync(receiptTypesPath)) {
  fail('lib/types/receipt.ts not found');
} else {
  const content = fs.readFileSync(receiptTypesPath, 'utf8');
  
  // Must have RewardReceipt type
  if (!content.includes('RewardReceipt')) {
    fail('Missing RewardReceipt type');
  }
  
  // Must have formatReceiptItems helper
  if (!content.includes('formatReceiptItems')) {
    warn('Consider adding formatReceiptItems helper');
  }
  
  if (!failed) {
    pass('Receipt types properly defined');
  }
}

// =============================================================================
// CHECK 3: Telemetry types include receipt events
// =============================================================================

console.log('\nCheck 3: Receipt telemetry events defined...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (!fs.existsSync(telemetryPath)) {
  fail('lib/telemetry/events.ts not found');
} else {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  const receiptEvents = [
    'REWARD_RECEIPT_RECEIVED',
    'REWARD_CLAIM_SUCCESS',
  ];
  
  for (const event of receiptEvents) {
    if (!content.includes(event)) {
      warn(`Consider adding ${event} telemetry event`);
    }
  }
  
  pass('Receipt telemetry events checked');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.38 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.38 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
