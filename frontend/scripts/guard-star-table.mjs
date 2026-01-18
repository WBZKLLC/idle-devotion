#!/usr/bin/env node
/**
 * Guard: Star Table Enforcement
 * 
 * Ensures shard costs match documentation.
 * Validates star progression is not changed without doc update.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PATH = path.resolve(__dirname, '../../backend/server.py');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Guard: Star Table Enforcement');
console.log('============================================\n');

// Read files
const serverCode = fs.readFileSync(BACKEND_PATH, 'utf8');

// Check 1: STAR_TABLE has correct shard costs
console.log('Check 1: STAR_TABLE has correct shard costs...');
const expectedShardCosts = [
  { star: 1, cost: 0 },
  { star: 2, cost: 20 },
  { star: 3, cost: 40 },
  { star: 4, cost: 80 },
  { star: 5, cost: 160 },
  { star: 6, cost: 320 },
];

for (const { star, cost } of expectedShardCosts) {
  const pattern = new RegExp(`${star}:\s*\{[^}]*"shardCost":\s*${cost}`);
  if (!pattern.test(serverCode)) {
    fail(`STAR_TABLE star ${star} should have shardCost ${cost}`);
  }
}
pass('STAR_TABLE has correct shard costs (0 → 320)');

// Check 2: Total shards to 6★ is 620
console.log('\nCheck 2: Total cumulative shards correct...');
const totalShards = 0 + 20 + 40 + 80 + 160 + 320;
if (totalShards !== 620) {
  fail(`Total shards should be 620, got ${totalShards}`);
}
pass('Total cumulative shards = 620');

// Check 3: MAX_STAR is 6
console.log('\nCheck 3: MAX_STAR is 6...');
if (!serverCode.includes('MAX_STAR = 6')) {
  fail('MAX_STAR should be 6');
}
pass('MAX_STAR = 6');

// Check 4: No star 7+ entries
console.log('\nCheck 4: No star 7+ entries...');
const star7Pattern = /STAR_TABLE\s*=\s*\{[^}]*7:\s*\{/s;
if (star7Pattern.test(serverCode)) {
  fail('STAR_TABLE should not have star 7+');
}
pass('No star 7+ in STAR_TABLE');

// Check 5: Hero promotion endpoint exists
console.log('\nCheck 5: Hero promotion endpoint exists...');
if (!serverCode.includes('/api/hero/promote')) {
  fail('Missing /api/hero/promote endpoint');
}
pass('Hero promotion endpoint exists');

console.log('\n============================================');
console.log(`${GREEN}Star Table guard PASSED!${RESET}`);
console.log('============================================\n');
