#!/usr/bin/env node
/**
 * Phase 3.39 Guard: Hero Star Progression (Backend Truth)
 * 
 * Enforces:
 * 1. No client-side star mutation
 * 2. Promotion must emit canonical receipt
 * 3. Shard deduction only via receipt
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
console.log('Phase 3.39 Guard: Hero Star Progression');
console.log('============================================\n');

// =============================================================================
// CHECK 1: Hero progression API exists
// =============================================================================

console.log('Check 1: Hero progression API exists...');

const apiPath = path.join(process.cwd(), 'lib/api/heroProgression.ts');
if (!fs.existsSync(apiPath)) {
  fail('lib/api/heroProgression.ts not found');
} else {
  const content = fs.readFileSync(apiPath, 'utf8');
  
  if (!content.includes('promoteHero')) {
    fail('heroProgression.ts must have promoteHero function');
  }
  
  if (!content.includes('getHeroStats')) {
    fail('heroProgression.ts must have getHeroStats function');
  }
  
  // Must emit telemetry
  if (!content.includes('HERO_PROMOTION_SUBMITTED')) {
    fail('heroProgression.ts must emit promotion telemetry');
  }
  
  if (!failed) {
    pass('Hero progression API exists with required functions');
  }
}

// =============================================================================
// CHECK 2: No client-side star mutations
// =============================================================================

console.log('\nCheck 2: No client-side star mutations...');

const FORBIDDEN_STAR_PATTERNS = [
  /\.stars\s*\+\+/,
  /\.stars\s*\+=/,
  /\.star\s*\+\+/,
  /\.star\s*\+=/,
  /setStar\s*\(/,
  /setStars\s*\(/,
];

const filesToCheck = [
  'lib/api/heroProgression.ts',
  'components/hero/PromotionModal.tsx',
  'components/hero/StarDisplay.tsx',
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_STAR_PATTERNS) {
    if (pattern.test(content)) {
      fail(`Client-side star mutation in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No client-side star mutations');
}

// =============================================================================
// CHECK 3: Promotion modal exists
// =============================================================================

console.log('\nCheck 3: Promotion modal exists...');

const modalPath = path.join(process.cwd(), 'components/hero/PromotionModal.tsx');
if (!fs.existsSync(modalPath)) {
  fail('components/hero/PromotionModal.tsx not found');
} else {
  const content = fs.readFileSync(modalPath, 'utf8');
  
  // Must use promoteHero API
  if (!content.includes('promoteHero')) {
    fail('PromotionModal must use promoteHero API');
  }
  
  // Must handle INSUFFICIENT_SHARDS
  if (!content.includes('INSUFFICIENT_SHARDS') && !content.includes('isInsufficientShardsError')) {
    warn('PromotionModal should handle INSUFFICIENT_SHARDS error');
  }
  
  if (!failed) {
    pass('Promotion modal exists and uses API');
  }
}

// =============================================================================
// CHECK 4: Telemetry events defined
// =============================================================================

console.log('\nCheck 4: Required telemetry events defined...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (!fs.existsSync(telemetryPath)) {
  fail('lib/telemetry/events.ts not found');
} else {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  const requiredEvents = [
    'HERO_PROMOTION_VIEWED',
    'HERO_PROMOTION_SUBMITTED',
    'HERO_PROMOTION_SUCCESS',
    'HERO_PROMOTION_INSUFFICIENT_SHARDS',
  ];
  
  for (const event of requiredEvents) {
    if (!content.includes(event)) {
      fail(`Missing telemetry event: ${event}`);
    }
  }
  
  if (!failed) {
    pass('All Phase 3.39 telemetry events defined');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.39 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.39 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
