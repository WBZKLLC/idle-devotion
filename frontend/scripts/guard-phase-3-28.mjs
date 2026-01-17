#!/usr/bin/env node
/**
 * Phase 3.28: Friends Gift System Guard
 *
 * Validates:
 * - Gift button/modal exists in friends screen
 * - sendFriendGift + getFriendGiftStatus API functions used
 * - Canonical receipt flow for gift claims
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
console.log('Phase 3.28: Friends Gift System Guard');
console.log('============================================================\n');

// Read friends.tsx
const friendsPath = path.join(process.cwd(), 'app/friends.tsx');
const friendsContent = fs.readFileSync(friendsPath, 'utf8');

// Read friends API
const friendsApiPath = path.join(process.cwd(), 'lib/api/friends.ts');
const friendsApiContent = fs.readFileSync(friendsApiPath, 'utf8');

// Read mail.tsx for gift claim
const mailPath = path.join(process.cwd(), 'app/mail.tsx');
const mailContent = fs.readFileSync(mailPath, 'utf8');

console.log('--- Friends Gift UI ---\n');

// Check Gift button exists
check(
  friendsContent.includes('Gift') && friendsContent.includes('giftBtn'),
  'Gift button exists in friends screen'
);

// Check GiftModal component exists
check(
  friendsContent.includes('GiftModal'),
  'GiftModal component exists'
);

// Check gift types displayed
check(
  friendsContent.includes('gold') && friendsContent.includes('stamina') && friendsContent.includes('gems'),
  'Gift type choices displayed (gold, stamina, gems)'
);

console.log('\n--- Friends Gift API ---\n');

// Check sendFriendGift exists
check(
  friendsApiContent.includes('sendFriendGift'),
  'sendFriendGift API function exists'
);

// Check getFriendGiftStatus exists
check(
  friendsApiContent.includes('getFriendGiftStatus'),
  'getFriendGiftStatus API function exists'
);

// Check telemetry for gift sent
check(
  friendsApiContent.includes('FRIEND_GIFT_SENT'),
  'FRIEND_GIFT_SENT telemetry emitted'
);

console.log('\n--- Mail Gift Claim (Canonical Receipt) ---\n');

// Check mail gifts tab exists
check(
  mailContent.includes('Gifts') && mailContent.includes('giftsAvailable'),
  'Gifts tab exists in mail screen'
);

// Check canonical receipt handling in mail claims
check(
  mailContent.includes('claimMailGift') || mailContent.includes('formatReceiptItems'),
  'Mail gift claim uses canonical receipt handling'
);

console.log('\n============================================================');
if (exitCode === 0) {
  console.log('\x1b[32mPhase 3.28 guard PASSED!\x1b[0m');
} else {
  console.log('\x1b[31mPhase 3.28 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
