#!/usr/bin/env node
/**
 * Phase 3.32: Daily Login System Guard
 *
 * Validates:
 * - daily.tsx screen exists
 * - daily_claim is valid RewardSource
 * - No timers/polling (event-driven only)
 * - Canonical receipt handling
 * - Idempotency (alreadyClaimed)
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
console.log('Phase 3.32: Daily Login System Guard');
console.log('============================================================\n');

// Read daily.tsx
const dailyPath = path.join(process.cwd(), 'app/daily.tsx');
const dailyExists = fs.existsSync(dailyPath);

check(
  dailyExists,
  '/app/daily.tsx screen exists'
);

if (!dailyExists) {
  console.log('\n\x1b[31mPhase 3.32 guard FAILED! (daily.tsx missing)\x1b[0m');
  process.exit(1);
}

const dailyContent = fs.readFileSync(dailyPath, 'utf8');

// Read receipt types
const receiptPath = path.join(process.cwd(), 'lib/types/receipt.ts');
const receiptContent = fs.readFileSync(receiptPath, 'utf8');

// Read telemetry events
const eventsPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
const eventsContent = fs.readFileSync(eventsPath, 'utf8');

console.log('--- Daily Screen ---\n');

// Check status fetch exists
check(
  dailyContent.includes('getDailyStatus'),
  'Daily status fetch function exists'
);

// Check claim function exists
check(
  dailyContent.includes('claimDailyReward'),
  'Daily claim function exists'
);

// Check calendar display
check(
  dailyContent.includes('calendar') && dailyContent.includes('CalendarDay'),
  'Calendar display present'
);

// Check claim button
check(
  dailyContent.includes('Claim') && dailyContent.includes('claimButton'),
  'Claim button present'
);

console.log('\n--- RewardSource Validation ---\n');

// Check daily_claim is valid source
check(
  receiptContent.includes("'daily_claim'"),
  'daily_claim is valid RewardSource'
);

console.log('\n--- No Timers/Polling ---\n');

// Check no timers (excluding comments)
const nonCommentContent = dailyContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hasTimers = /setTimeout|setInterval|requestAnimationFrame/.test(nonCommentContent);

check(
  !hasTimers,
  'No timers/RAF in daily screen (event-driven only)'
);

console.log('\n--- Canonical Receipt Handling ---\n');

// Check receipt validation
check(
  dailyContent.includes('isValidReceipt'),
  'Uses canonical receipt validation'
);

// Check receipt formatting
check(
  dailyContent.includes('formatReceiptItems'),
  'Uses receipt item formatting'
);

// Check alreadyClaimed handling
check(
  dailyContent.includes('alreadyClaimed'),
  'Handles alreadyClaimed idempotency'
);

console.log('\n--- Telemetry Events ---\n');

// Check telemetry events defined
check(
  eventsContent.includes('DAILY_VIEWED'),
  'DAILY_VIEWED event defined'
);

check(
  eventsContent.includes('DAILY_CLAIM_SUBMITTED'),
  'DAILY_CLAIM_SUBMITTED event defined'
);

check(
  eventsContent.includes('DAILY_CLAIM_SUCCESS'),
  'DAILY_CLAIM_SUCCESS event defined'
);

// Check telemetry emitted in daily screen
check(
  dailyContent.includes('Events.DAILY_VIEWED'),
  'DAILY_VIEWED telemetry emitted'
);

check(
  dailyContent.includes('Events.DAILY_CLAIM_SUBMITTED'),
  'DAILY_CLAIM_SUBMITTED telemetry emitted'
);

console.log('\n============================================================');
if (exitCode === 0) {
  console.log('\x1b[32mPhase 3.32 guard PASSED!\x1b[0m');
} else {
  console.log('\x1b[31mPhase 3.32 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
