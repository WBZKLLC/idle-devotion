#!/usr/bin/env node
/**
 * Phase 3.42-3.46 Guard: IAP + Limited Banners + Ascension + Profile + Anti-Exploit
 * 
 * Combined guard for later phases with minimal enforcement.
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
console.log('Phase 3.42-3.46 Guard: Advanced Systems');
console.log('============================================\n');

// =============================================================================
// CHECK 1: Receipt types include IAP sources
// =============================================================================

console.log('Check 1: Receipt types include new sources...');

const receiptPath = path.join(process.cwd(), 'lib/types/receipt.ts');
if (fs.existsSync(receiptPath)) {
  const content = fs.readFileSync(receiptPath, 'utf8');
  
  if (content.includes('hero_promotion')) {
    pass('hero_promotion source exists');
  } else {
    warn('Consider adding hero_promotion to receipt sources');
  }
} else {
  fail('Receipt types file not found');
}

// =============================================================================
// CHECK 2: No client-side trust patterns
// =============================================================================

console.log('\nCheck 2: No client-side trust patterns...');

const FORBIDDEN_TRUST = [
  /purchaseSucceeded\s*=\s*true/,
  /isPurchased\s*=\s*true/,
  /setBalance\s*\([^)]*\+/,
];

const filesToCheck = [
  'lib/api/heroProgression.ts',
  'components/hero/PromotionModal.tsx',
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_TRUST) {
    if (pattern.test(content)) {
      fail(`Client trust pattern in ${relPath}`);
    }
  }
}

if (!failed) {
  pass('No client-side trust patterns');
}

// =============================================================================
// CHECK 3: PROFILE_VIEWED telemetry
// =============================================================================

console.log('\nCheck 3: Profile telemetry exists...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (fs.existsSync(telemetryPath)) {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  if (content.includes('PROFILE_VIEWED')) {
    pass('PROFILE_VIEWED telemetry exists');
  } else {
    warn('Consider adding PROFILE_VIEWED telemetry');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.42-3.46 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.42-3.46 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
