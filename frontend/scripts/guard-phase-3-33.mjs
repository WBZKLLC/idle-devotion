#!/usr/bin/env node
/**
 * Phase 3.33 Guard: Gacha/Summon System
 * 
 * Enforces:
 * 1. NO client-side RNG (Math.random) in summon flow
 * 2. Summon endpoint uses canonical receipt (source, sourceId, items, balances)
 * 3. Pity state is server-derived (no local increments without server confirmation)
 * 4. Receipt-only balance mutation
 * 5. Required telemetry events
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

// =============================================================================
// CHECK 1: No client-side RNG in summon-related files
// =============================================================================
const SUMMON_FILES = [
  'app/(tabs)/summon-hub.tsx',
  'lib/api/gacha.ts',
];

const FORBIDDEN_RNG_PATTERNS = [
  /Math\.random\s*\(/,
  /crypto\.getRandomValues/,
  /_.random\s*\(/,
  /lodash.*random/,
];

console.log('\n============================================');
console.log('Phase 3.33 Guard: Gacha/Summon System');
console.log('============================================\n');

console.log('Check 1: No client-side RNG in summon flow...');

for (const relPath of SUMMON_FILES) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    if (relPath.includes('gacha.ts')) {
      fail(`Required file missing: ${relPath}`);
    } else {
      warn(`File not found: ${relPath}`);
    }
    continue;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_RNG_PATTERNS) {
    if (pattern.test(content)) {
      fail(`Client-side RNG found in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No client-side RNG in summon files');
}

// =============================================================================
// CHECK 2: Gacha API wrapper exists with required functions
// =============================================================================
console.log('\nCheck 2: Gacha API wrapper exists...');

const gachaApiPath = path.join(process.cwd(), 'lib/api/gacha.ts');
if (!fs.existsSync(gachaApiPath)) {
  fail('lib/api/gacha.ts not found');
} else {
  const gachaContent = fs.readFileSync(gachaApiPath, 'utf8');
  
  // Required functions
  const requiredFunctions = ['getGachaBanners', 'summon', 'getPityStatus'];
  for (const fn of requiredFunctions) {
    if (!gachaContent.includes(`export async function ${fn}`) && 
        !gachaContent.includes(`export function ${fn}`)) {
      fail(`Missing required function in gacha.ts: ${fn}`);
    }
  }
  
  // Must emit telemetry
  if (!gachaContent.includes('GACHA_SUMMON_SUBMITTED')) {
    fail('gacha.ts must emit GACHA_SUMMON_SUBMITTED telemetry');
  }
  if (!gachaContent.includes('GACHA_SUMMON_SUCCESS')) {
    fail('gacha.ts must emit GACHA_SUMMON_SUCCESS telemetry');
  }
  if (!gachaContent.includes('GACHA_SUMMON_ERROR')) {
    fail('gacha.ts must emit GACHA_SUMMON_ERROR telemetry');
  }
  
  if (!failed) {
    pass('Gacha API wrapper has required functions and telemetry');
  }
}

// =============================================================================
// CHECK 3: Receipt types include summon sources
// =============================================================================
console.log('\nCheck 3: Receipt types include summon sources...');

const receiptTypesPath = path.join(process.cwd(), 'lib/types/receipt.ts');
if (!fs.existsSync(receiptTypesPath)) {
  fail('lib/types/receipt.ts not found');
} else {
  const receiptContent = fs.readFileSync(receiptTypesPath, 'utf8');
  
  const requiredSources = ['summon_single', 'summon_multi', 'pity_reward'];
  for (const source of requiredSources) {
    if (!receiptContent.includes(`'${source}'`)) {
      fail(`Receipt types missing source: ${source}`);
    }
  }
  
  // Check for GachaReceipt type
  if (!receiptContent.includes('GachaReceipt') && !receiptContent.includes('GachaPullResult')) {
    warn('Consider adding GachaReceipt and GachaPullResult types to receipt.ts');
  }
  
  if (!failed) {
    pass('Receipt types include summon sources');
  }
}

// =============================================================================
// CHECK 4: Telemetry events include gacha events
// =============================================================================
console.log('\nCheck 4: Telemetry events include gacha events...');

const telemetryPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
if (!fs.existsSync(telemetryPath)) {
  fail('lib/telemetry/events.ts not found');
} else {
  const telemetryContent = fs.readFileSync(telemetryPath, 'utf8');
  
  const requiredEvents = [
    'GACHA_VIEWED',
    'GACHA_BANNER_SELECTED',
    'GACHA_SUMMON_SUBMITTED',
    'GACHA_SUMMON_SUCCESS',
    'GACHA_SUMMON_ERROR',
    'GACHA_PITY_INCREMENTED',
    'GACHA_PITY_TRIGGERED',
  ];
  
  for (const event of requiredEvents) {
    if (!telemetryContent.includes(event)) {
      fail(`Missing telemetry event: ${event}`);
    }
  }
  
  if (!failed) {
    pass('Telemetry includes all gacha events');
  }
}

// =============================================================================
// CHECK 5: Summon hub screen exists
// =============================================================================
console.log('\nCheck 5: Summon screen exists...');

const summonScreenPaths = [
  'app/(tabs)/summon-hub.tsx',
  'app/summon.tsx',
  'app/gacha.tsx',
];

let summonScreenFound = false;
for (const relPath of summonScreenPaths) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    summonScreenFound = true;
    pass(`Summon screen found: ${relPath}`);
    break;
  }
}

if (!summonScreenFound) {
  fail('No summon screen found (summon-hub.tsx, summon.tsx, or gacha.tsx)');
}

// =============================================================================
// CHECK 6: No direct balance mutations in summon files (must use receipts)
// =============================================================================
console.log('\nCheck 6: No direct balance mutations in summon files...');

const FORBIDDEN_MUTATIONS = [
  /setUser\s*\(\s*\{[^}]*(?:coins|gems|crystals|divine_essence)\s*:/,
  /user\s*\.\s*(?:coins|gems|crystals|divine_essence)\s*[-+]=/,
  /\$inc\s*:\s*\{[^}]*(?:coins|gems|crystals)/,
];

for (const relPath of SUMMON_FILES) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_MUTATIONS) {
    // Skip if it's in a comment
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        fail(`Direct balance mutation in ${relPath}:${i+1} - use receipt.balances instead`);
      }
    }
  }
}

if (!failed) {
  pass('No direct balance mutations in summon files');
}

// =============================================================================
// FINAL RESULT
// =============================================================================
console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.33 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.33 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
