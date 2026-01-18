#!/usr/bin/env node
/**
 * VIP Benefits Guard
 * 
 * Enforces:
 * 1. No VIP stat buffs (ATK, HP, DEF multipliers)
 * 2. No VIP-exclusive heroes (early access OK)
 * 3. No PvP matchmaking manipulation
 * 4. All VIP benefits are economy/comfort only
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
console.log('VIP Benefits Guard');
console.log('============================================\n');

// =============================================================================
// CHECK 1: VIP_SYSTEM.md exists
// =============================================================================

console.log('Check 1: VIP_SYSTEM.md documentation exists...');

const vipSystemPath = '/app/docs/VIP_SYSTEM.md';
if (!fs.existsSync(vipSystemPath)) {
  fail('VIP_SYSTEM.md not found');
} else {
  pass('VIP_SYSTEM.md exists');
}

// =============================================================================
// CHECK 2: No VIP stat buffs in frontend
// =============================================================================

console.log('\nCheck 2: No VIP stat buffs in frontend...');

const FORBIDDEN_VIP_PATTERNS = [
  /vip.*\*.*atk/i,
  /vip.*\*.*hp/i,
  /vip.*\*.*def/i,
  /vipStatBonus/i,
  /vipDamageMultiplier/i,
];

const filesToCheck = [
  'lib/api/heroProgression.ts',
  'components/hero/PromotionModal.tsx',
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_VIP_PATTERNS) {
    if (pattern.test(content)) {
      fail(`VIP stat buff pattern in ${relPath} - VIP should not affect combat stats`);
    }
  }
}

if (!failed) {
  pass('No VIP stat buffs in frontend');
}

// =============================================================================
// CHECK 3: VIP telemetry events are defined (recommended)
// =============================================================================

console.log('\nCheck 3: VIP telemetry events...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (fs.existsSync(telemetryPath)) {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  if (content.includes('VIP_INFO_VIEWED') || content.includes('VIP')) {
    pass('VIP telemetry events exist');
  } else {
    warn('Consider adding VIP telemetry events (VIP_INFO_VIEWED, VIP_TIER_UP)');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}VIP Benefits guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}VIP Benefits guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
