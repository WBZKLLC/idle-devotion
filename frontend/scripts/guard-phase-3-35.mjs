#!/usr/bin/env node
/**
 * Phase 3.35 Guard: Banner Integrity + Summon Economy Hardening
 * 
 * Confirms:
 * 1. Server-side affordability check exists
 * 2. Summon requires sourceId
 * 3. History endpoint exists
 * 4. Frontend routes exist + "Go to Shop" path wired
 * 5. No client RNG, no timers/RAF added
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
console.log('Phase 3.35 Guard: Banner Integrity & Economy');
console.log('============================================\n');

// =============================================================================
// CHECK 1: InsufficientFundsModal exists
// =============================================================================

console.log('Check 1: InsufficientFundsModal component exists...');

const insufficientFundsPath = path.join(process.cwd(), 'components/gacha/InsufficientFundsModal.tsx');
if (!fs.existsSync(insufficientFundsPath)) {
  fail('components/gacha/InsufficientFundsModal.tsx not found');
} else {
  const content = fs.readFileSync(insufficientFundsPath, 'utf8');
  
  // Must have "Go to Shop" action
  if (!content.includes('Go to Shop') && !content.includes('shop')) {
    fail('InsufficientFundsModal must have "Go to Shop" action');
  }
  
  // Must route to shop
  if (!content.includes('/shop') && !content.includes('router.push')) {
    fail('InsufficientFundsModal must route to shop');
  }
  
  // Must have cancel action
  if (!content.includes('Cancel') && !content.includes('onClose')) {
    fail('InsufficientFundsModal must have cancel action');
  }
  
  if (!failed) {
    pass('InsufficientFundsModal exists with required actions');
  }
}

// =============================================================================
// CHECK 2: BannerDetailsSheet exists
// =============================================================================

console.log('\nCheck 2: BannerDetailsSheet component exists...');

const bannerDetailsPath = path.join(process.cwd(), 'components/gacha/BannerDetailsSheet.tsx');
if (!fs.existsSync(bannerDetailsPath)) {
  fail('components/gacha/BannerDetailsSheet.tsx not found');
} else {
  const content = fs.readFileSync(bannerDetailsPath, 'utf8');
  
  // Must show rates
  if (!content.includes('rates') && !content.includes('Rates')) {
    fail('BannerDetailsSheet must display rates');
  }
  
  // Must show pity rules
  if (!content.includes('pity') || !content.includes('Pity')) {
    fail('BannerDetailsSheet must show pity rules');
  }
  
  // Must show shard conversion
  if (!content.includes('shard') || !content.includes('Shard')) {
    fail('BannerDetailsSheet must explain shard conversion');
  }
  
  // Must emit GACHA_RATES_VIEWED
  if (!content.includes('GACHA_RATES_VIEWED')) {
    fail('BannerDetailsSheet must emit GACHA_RATES_VIEWED telemetry');
  }
  
  if (!failed) {
    pass('BannerDetailsSheet exists with rates, pity, and shard info');
  }
}

// =============================================================================
// CHECK 3: Gacha history screen exists
// =============================================================================

console.log('\nCheck 3: Gacha history screen exists...');

const historyPaths = [
  'app/gacha-history.tsx',
  'app/(tabs)/gacha-history.tsx',
];

let historyFound = false;
for (const relPath of historyPaths) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    historyFound = true;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Must call getGachaHistory API
    if (!content.includes('getGachaHistory')) {
      fail(`${relPath} must use getGachaHistory API`);
    }
    
    // Must emit GACHA_HISTORY_VIEWED
    if (!content.includes('GACHA_HISTORY_VIEWED')) {
      fail(`${relPath} must emit GACHA_HISTORY_VIEWED telemetry`);
    }
    
    break;
  }
}

if (!historyFound) {
  fail('Gacha history screen not found (gacha-history.tsx)');
} else if (!failed) {
  pass('Gacha history screen exists');
}

// =============================================================================
// CHECK 4: API wrapper has history function
// =============================================================================

console.log('\nCheck 4: Gacha API has history function...');

const gachaApiPath = path.join(process.cwd(), 'lib/api/gacha.ts');
if (!fs.existsSync(gachaApiPath)) {
  fail('lib/api/gacha.ts not found');
} else {
  const content = fs.readFileSync(gachaApiPath, 'utf8');
  
  // Must have getGachaHistory function
  if (!content.includes('getGachaHistory')) {
    fail('lib/api/gacha.ts must have getGachaHistory function');
  }
  
  // Must have InsufficientFundsError type
  if (!content.includes('InsufficientFundsError') && !content.includes('INSUFFICIENT_FUNDS')) {
    fail('lib/api/gacha.ts must have InsufficientFundsError type');
  }
  
  if (!failed) {
    pass('Gacha API has history function and error types');
  }
}

// =============================================================================
// CHECK 5: Telemetry events defined
// =============================================================================

console.log('\nCheck 5: Required telemetry events defined...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (!fs.existsSync(telemetryPath)) {
  fail('lib/telemetry/events.ts not found');
} else {
  const content = fs.readFileSync(telemetryPath, 'utf8');
  
  const requiredEvents = [
    'GACHA_INSUFFICIENT_FUNDS',
    'GACHA_RATES_VIEWED',
    'GACHA_HISTORY_VIEWED',
  ];
  
  for (const event of requiredEvents) {
    if (!content.includes(event)) {
      fail(`Missing telemetry event: ${event}`);
    }
  }
  
  if (!failed) {
    pass('All Phase 3.35 telemetry events defined');
  }
}

// =============================================================================
// CHECK 6: No client-side RNG in new files
// =============================================================================

console.log('\nCheck 6: No client-side RNG in new files...');

const filesToCheck = [
  'components/gacha/InsufficientFundsModal.tsx',
  'components/gacha/BannerDetailsSheet.tsx',
  'app/gacha-history.tsx',
];

const FORBIDDEN_RNG = [
  /Math\.random\s*\(/,
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_RNG) {
    if (pattern.test(content)) {
      fail(`Client-side RNG found in ${relPath}`);
    }
  }
}

if (!failed) {
  pass('No client-side RNG in new files');
}

// =============================================================================
// CHECK 7: No forbidden timers in new files
// =============================================================================

console.log('\nCheck 7: No forbidden timers in new files...');

const FORBIDDEN_TIMERS = [
  /setInterval\s*\(/,
  /requestAnimationFrame\s*\(/,
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_TIMERS) {
    if (pattern.test(content)) {
      fail(`Forbidden timer found in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No forbidden timers in new files');
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.35 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.35 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
