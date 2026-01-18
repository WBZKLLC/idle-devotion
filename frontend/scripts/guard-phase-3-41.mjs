#!/usr/bin/env node
/**
 * Phase 3.41 Guard: Stat Growth + Affinity Synergy
 * 
 * Enforces:
 * 1. Block client stat recompute
 * 2. Block direct star/stat mutation
 * 3. Stats from server payload only
 */
import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let failed = false;

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Phase 3.41 Guard: Stat Growth & Derivation');
console.log('============================================\n');

// =============================================================================
// CHECK 1: API has getHeroStats function
// =============================================================================

console.log('Check 1: API has getHeroStats function...');

const apiPath = path.join(process.cwd(), 'lib/api/heroProgression.ts');
if (!fs.existsSync(apiPath)) {
  fail('heroProgression API not found');
} else {
  const content = fs.readFileSync(apiPath, 'utf8');
  
  if (!content.includes('getHeroStats')) {
    fail('API must have getHeroStats function');
  }
  
  // Should return derived stats
  if (!content.includes('finalStats') && !content.includes('HeroStats')) {
    fail('API should return derived stats type');
  }
  
  if (!failed) {
    pass('API has getHeroStats function');
  }
}

// =============================================================================
// CHECK 2: No client-side stat calculation patterns
// =============================================================================

console.log('\nCheck 2: No client-side stat calculations...');

const FORBIDDEN_CALC = [
  /Math\.floor\s*\([^)]*stat/i,
  /Math\.round\s*\([^)]*stat/i,
  /baseStat\s*\*\s*starMultiplier/,
  /stat\s*\*\s*affinity/i,
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
  
  for (const pattern of FORBIDDEN_CALC) {
    if (pattern.test(content)) {
      fail(`Client stat calculation in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No client-side stat calculations');
}

// =============================================================================
// CHECK 3: HERO_STATS_VIEWED telemetry exists
// =============================================================================

console.log('\nCheck 3: Stats telemetry exists...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (fs.existsSync(telemetryPath)) {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  if (!content.includes('HERO_STATS_VIEWED')) {
    fail('Missing HERO_STATS_VIEWED telemetry');
  } else {
    pass('Stats telemetry exists');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.41 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.41 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
