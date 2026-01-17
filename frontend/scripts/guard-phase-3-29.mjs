#!/usr/bin/env node
/**
 * Phase 3.29: Events/Quests System Guard
 *
 * Validates:
 * - events.tsx screen exists
 * - event_claim is valid RewardSource
 * - Claim endpoint uses canonical receipt
 * - No timers/RAF in events screen
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
console.log('Phase 3.29: Events/Quests System Guard');
console.log('============================================================\n');

// Read events.tsx
const eventsPath = path.join(process.cwd(), 'app/events.tsx');
const eventsExists = fs.existsSync(eventsPath);

check(
  eventsExists,
  '/app/events.tsx screen exists'
);

if (!eventsExists) {
  console.log('\n\x1b[31mPhase 3.29 guard FAILED! (events.tsx missing)\x1b[0m');
  process.exit(1);
}

const eventsContent = fs.readFileSync(eventsPath, 'utf8');

// Read receipt types
const receiptPath = path.join(process.cwd(), 'lib/types/receipt.ts');
const receiptContent = fs.readFileSync(receiptPath, 'utf8');

console.log('--- Events Screen ---\n');

// Check event claim function exists
check(
  eventsContent.includes('claimQuestReward') || eventsContent.includes('claimEventReward'),
  'Event claim function integrated'
);

// Check telemetry events
check(
  eventsContent.includes('EVENTS_VIEWED'),
  'EVENTS_VIEWED telemetry emitted'
);

check(
  eventsContent.includes('EVENT_CLAIM_SUBMITTED'),
  'EVENT_CLAIM_SUBMITTED telemetry emitted'
);

// Check canonical receipt handling
check(
  eventsContent.includes('isValidReceipt') || eventsContent.includes('formatReceiptItems'),
  'Canonical receipt handling in events screen'
);

console.log('\n--- RewardSource Validation ---\n');

// Check event_claim is valid source
check(
  receiptContent.includes("'event_claim'"),
  'event_claim is valid RewardSource'
);

console.log('\n--- No Timers/RAF Check ---\n');

// Check no timers in events screen (excluding comments)
const nonCommentContent = eventsContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hasTimers = /setTimeout|setInterval|requestAnimationFrame/.test(nonCommentContent);

check(
  !hasTimers,
  'No timers/RAF in events screen'
);

console.log('\n============================================================');
if (exitCode === 0) {
  console.log('\x1b[32mPhase 3.29 guard PASSED!\x1b[0m');
} else {
  console.log('\x1b[31mPhase 3.29 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
