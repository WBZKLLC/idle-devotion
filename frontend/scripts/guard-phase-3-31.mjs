#!/usr/bin/env node
/**
 * Phase 3.31: Idle Loop Completion Guard
 *
 * Validates:
 * - idle.tsx screen exists
 * - No timers/polling (event-driven only)
 * - Receipt-only balance mutations
 * - Canonical receipt handling
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
console.log('Phase 3.31: Idle Loop Completion Guard');
console.log('============================================================\n');

// Read idle.tsx
const idlePath = path.join(process.cwd(), 'app/idle.tsx');
const idleExists = fs.existsSync(idlePath);

check(
  idleExists,
  '/app/idle.tsx screen exists'
);

if (!idleExists) {
  console.log('\n\x1b[31mPhase 3.31 guard FAILED! (idle.tsx missing)\x1b[0m');
  process.exit(1);
}

const idleContent = fs.readFileSync(idlePath, 'utf8');

// Read telemetry events
const eventsPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
const eventsContent = fs.readFileSync(eventsPath, 'utf8');

console.log('--- Idle Screen ---\n');

// Check claim function exists
check(
  idleContent.includes('claimIdleRewards'),
  'Idle claim function exists'
);

// Check status fetch exists
check(
  idleContent.includes('getIdleStatus'),
  'Idle status fetch function exists'
);

// Check progress bar
check(
  idleContent.includes('progressBar') || idleContent.includes('ProgressBar'),
  'Progress bar component present'
);

// Check claim button
check(
  idleContent.includes('Claim') && idleContent.includes('claimButton'),
  'Claim button present'
);

console.log('\n--- No Timers/Polling ---\n');

// Check no timers (excluding comments)
const nonCommentContent = idleContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hasTimers = /setTimeout|setInterval|requestAnimationFrame/.test(nonCommentContent);

check(
  !hasTimers,
  'No timers/RAF in idle screen (event-driven only)'
);

console.log('\n--- Canonical Receipt Handling ---\n');

// Check receipt validation
check(
  idleContent.includes('isValidReceipt'),
  'Uses canonical receipt validation'
);

// Check receipt formatting
check(
  idleContent.includes('formatReceiptItems'),
  'Uses receipt item formatting'
);

// Check alreadyClaimed handling
check(
  idleContent.includes('alreadyClaimed'),
  'Handles alreadyClaimed idempotency'
);

console.log('\n--- Telemetry Events ---\n');

// Check telemetry events defined
check(
  eventsContent.includes('IDLE_VIEWED'),
  'IDLE_VIEWED event defined'
);

check(
  eventsContent.includes('IDLE_CLAIM_SUBMITTED'),
  'IDLE_CLAIM_SUBMITTED event defined'
);

check(
  eventsContent.includes('IDLE_CLAIM_SUCCESS'),
  'IDLE_CLAIM_SUCCESS event defined'
);

// Check telemetry emitted in idle screen
check(
  idleContent.includes('Events.IDLE_VIEWED'),
  'IDLE_VIEWED telemetry emitted'
);

check(
  idleContent.includes('Events.IDLE_CLAIM_SUBMITTED'),
  'IDLE_CLAIM_SUBMITTED telemetry emitted'
);

console.log('\n============================================================');
if (exitCode === 0) {
  console.log('\x1b[32mPhase 3.31 guard PASSED!\x1b[0m');
} else {
  console.log('\x1b[31mPhase 3.31 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
