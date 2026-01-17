#!/usr/bin/env node
/**
 * Phase 3.34 Guard: Summon Results & Hero Acquisition UX
 * 
 * Enforces:
 * 1. Results UI uses receipt data only (no recomputation)
 * 2. No client-side RNG
 * 3. No timers / RAF / auto-advance
 * 4. Shard conversion displayed when present
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
// CHECK 1: SummonResultsModal exists
// =============================================================================

console.log('\n============================================');
console.log('Phase 3.34 Guard: Summon Results UX');
console.log('============================================\n');

console.log('Check 1: SummonResultsModal component exists...');

const modalPath = path.join(process.cwd(), 'components/gacha/SummonResultsModal.tsx');
if (!fs.existsSync(modalPath)) {
  fail('components/gacha/SummonResultsModal.tsx not found');
} else {
  pass('SummonResultsModal component exists');
}

// =============================================================================
// CHECK 2: No timers / RAF / auto-advance in results modal
// =============================================================================

console.log('\nCheck 2: No timers / RAF / auto-advance in results modal...');

const RESULTS_FILES = [
  'components/gacha/SummonResultsModal.tsx',
];

const FORBIDDEN_TIMER_PATTERNS = [
  /setTimeout\s*\(/,
  /setInterval\s*\(/,
  /requestAnimationFrame\s*\(/,
  /setTimeout\s*,/,  // setTimeout as callback
];

// Exception: setTimeout for haptic/UI feedback is allowed in close handlers
const ALLOWED_TIMEOUT_CONTEXTS = [
  'haptic',
  'onClose',
];

for (const relPath of RESULTS_FILES) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    
    for (const pattern of FORBIDDEN_TIMER_PATTERNS) {
      if (pattern.test(line)) {
        // Check if it's in an allowed context
        const contextLines = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        const isAllowed = ALLOWED_TIMEOUT_CONTEXTS.some(ctx => contextLines.includes(ctx));
        
        if (!isAllowed) {
          fail(`Timer/RAF found in ${relPath}:${i+1} - no auto-advance allowed`);
        }
      }
    }
  }
}

if (!failed) {
  pass('No forbidden timers in results modal');
}

// =============================================================================
// CHECK 3: No client-side RNG
// =============================================================================

console.log('\nCheck 3: No client-side RNG in results modal...');

const FORBIDDEN_RNG = [
  /Math\.random\s*\(/,
  /crypto\.getRandomValues/,
];

for (const relPath of RESULTS_FILES) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  for (const pattern of FORBIDDEN_RNG) {
    if (pattern.test(content)) {
      fail(`Client-side RNG found in ${relPath}: ${pattern.toString()}`);
    }
  }
}

if (!failed) {
  pass('No client-side RNG in results modal');
}

// =============================================================================
// CHECK 4: Results modal consumes receipt data
// =============================================================================

console.log('\nCheck 4: Results modal uses receipt data...');

if (fs.existsSync(modalPath)) {
  const content = fs.readFileSync(modalPath, 'utf8');
  
  // Must accept GachaReceipt prop
  if (!content.includes('GachaReceipt') && !content.includes('receipt')) {
    fail('SummonResultsModal must accept GachaReceipt data');
  }
  
  // Must read from receipt.results
  if (!content.includes('receipt.results') && !content.includes('results.map')) {
    fail('SummonResultsModal must read from receipt.results');
  }
  
  // Must show shard conversion
  if (!content.includes('shard') && !content.includes('Shard')) {
    fail('SummonResultsModal must display shard conversion');
  }
  
  if (!failed) {
    pass('Results modal uses receipt data correctly');
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
    'GACHA_RESULTS_VIEWED',
    'GACHA_NEW_HERO_ACQUIRED',
    'GACHA_DUPLICATE_CONVERTED',
  ];
  
  for (const event of requiredEvents) {
    if (!content.includes(event)) {
      fail(`Missing telemetry event: ${event}`);
    }
  }
  
  if (!failed) {
    pass('All Phase 3.34 telemetry events defined');
  }
}

// =============================================================================
// CHECK 6: Telemetry emitted in results modal
// =============================================================================

console.log('\nCheck 6: Telemetry emitted in results modal...');

if (fs.existsSync(modalPath)) {
  const content = fs.readFileSync(modalPath, 'utf8');
  
  // Must import track and Events
  if (!content.includes('track') || !content.includes('Events')) {
    fail('SummonResultsModal must import track and Events for telemetry');
  }
  
  // Must emit GACHA_RESULTS_VIEWED
  if (!content.includes('GACHA_RESULTS_VIEWED')) {
    fail('SummonResultsModal must emit GACHA_RESULTS_VIEWED telemetry');
  }
  
  if (!failed) {
    pass('Results modal emits telemetry');
  }
}

// =============================================================================
// CHECK 7: Single exit action (Back to Banner)
// =============================================================================

console.log('\nCheck 7: Single exit action exists...');

if (fs.existsSync(modalPath)) {
  const content = fs.readFileSync(modalPath, 'utf8');
  
  // Must have onClose handler
  if (!content.includes('onClose')) {
    fail('SummonResultsModal must have onClose handler');
  }
  
  // Must have Back to Banner text
  if (!content.includes('Back to Banner') && !content.includes('back') && !content.includes('Close')) {
    warn('SummonResultsModal should have clear exit action text');
  }
  
  if (!failed) {
    pass('Single exit action exists');
  }
}

// =============================================================================
// FINAL RESULT
// =============================================================================

console.log('\n============================================');
if (failed) {
  console.log(`${RED}Phase 3.34 guard FAILED!${RESET}`);
  console.log('============================================\n');
  process.exit(1);
} else {
  console.log(`${GREEN}Phase 3.34 guard PASSED!${RESET}`);
  console.log('============================================\n');
  process.exit(0);
}
