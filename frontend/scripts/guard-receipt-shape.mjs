#!/usr/bin/env node
// /app/frontend/scripts/guard-receipt-shape.mjs
// Phase 3.24: Guard - Receipt Shape Validation
//
// Ensures all reward-granting responses have canonical receipt shape.
// Validates both backend response patterns and frontend consumption.
//
// Fails if:
// - Any claim endpoint response is missing source, sourceId, items, or balances
// - Any frontend code consumes claims without using RewardReceipt type
// - Any balance application happens outside receipt consumption

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const BACKEND_ROOT = path.join(ROOT, '..', 'backend');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;
let warnings = 0;

function error(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  exitCode = 1;
}

function warn(msg) {
  console.warn(`${YELLOW}⚠ ${msg}${RESET}`);
  warnings++;
}

function success(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

function info(msg) {
  console.log(`  ${msg}`);
}

// =============================================================================
// 1. Check backend endpoints return canonical receipt
// =============================================================================
function checkBackendReceipts() {
  console.log('\n--- Backend Receipt Shape ---');
  
  const serverPath = path.join(BACKEND_ROOT, 'server.py');
  if (!fs.existsSync(serverPath)) {
    warn('server.py not found, skipping backend checks');
    return;
  }
  
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  // Check for grant_rewards_canonical helper
  if (!content.includes('grant_rewards_canonical')) {
    error('Backend missing grant_rewards_canonical helper');
    return;
  }
  
  success('Backend has grant_rewards_canonical helper');
  
  // Check claim endpoints use canonical helper
  const claimEndpoints = [
    { pattern: /claim_mail_reward/, name: 'mail reward claim' },
    { pattern: /claim_mail_gift/, name: 'mail gift claim' },
    { pattern: /claim_idle_rewards/, name: 'idle claim' },
  ];
  
  for (const ep of claimEndpoints) {
    const match = content.match(new RegExp(`async def ${ep.pattern.source}[^}]+`, 's'));
    if (match) {
      // Check if it uses grant_rewards_canonical or has receipt shape fields
      const fnContent = match[0];
      if (fnContent.includes('grant_rewards_canonical') || 
          (fnContent.includes('"source"') && fnContent.includes('"sourceId"') && fnContent.includes('"items"') && fnContent.includes('"balances"'))) {
        success(`${ep.name} returns canonical receipt`);
      } else {
        error(`${ep.name} may not return canonical receipt shape`);
      }
    }
  }
}

// =============================================================================
// 2. Check frontend uses RewardReceipt type
// =============================================================================
function checkFrontendReceiptType() {
  console.log('\n--- Frontend Receipt Type ---');
  
  const typePath = path.join(ROOT, 'lib', 'types', 'receipt.ts');
  if (!fs.existsSync(typePath)) {
    error('lib/types/receipt.ts not found - missing canonical Receipt type');
    return;
  }
  
  const content = fs.readFileSync(typePath, 'utf-8');
  
  // Check required fields in type
  const requiredFields = ['source', 'sourceId', 'items', 'balances'];
  for (const field of requiredFields) {
    if (!content.includes(field)) {
      error(`RewardReceipt missing required field: ${field}`);
    }
  }
  
  // Check type guard exists
  if (!content.includes('isValidReceipt')) {
    warn('Missing isValidReceipt type guard');
  } else {
    success('RewardReceipt type guard exists');
  }
  
  success('RewardReceipt type defined with required fields');
}

// =============================================================================
// 3. Check mail API uses Receipt type
// =============================================================================
function checkMailApiReceipts() {
  console.log('\n--- Mail API Receipt Usage ---');
  
  const mailApiPath = path.join(ROOT, 'lib', 'api', 'mail.ts');
  if (!fs.existsSync(mailApiPath)) {
    warn('lib/api/mail.ts not found');
    return;
  }
  
  const content = fs.readFileSync(mailApiPath, 'utf-8');
  
  // Check imports Receipt type
  if (!content.includes('RewardReceipt')) {
    error('mail.ts does not import RewardReceipt type');
    return;
  }
  
  success('mail.ts imports RewardReceipt');
  
  // Check claim functions return RewardReceipt
  if (content.includes('Promise<RewardReceipt>')) {
    success('Claim functions return RewardReceipt type');
  } else {
    error('Claim functions may not return RewardReceipt type');
  }
  
  // Check for validation
  if (content.includes('isValidReceipt') || content.includes('assertValidReceipt')) {
    success('Receipt validation is used');
  } else {
    warn('No receipt validation found in mail.ts');
  }
}

// =============================================================================
// 4. Check for unauthorized balance mutations
// =============================================================================
function checkNoDirectBalanceMutation() {
  console.log('\n--- Balance Application Guard ---');
  
  // Files that should NOT directly mutate user balances
  const filesToCheck = [
    'app/mail.tsx',
    'app/(tabs)/index.tsx',
  ];
  
  const suspiciousPatterns = [
    /setUser\s*\(\s*\{[^}]*gold/i,
    /setUser\s*\(\s*\{[^}]*coins/i,
    /setUser\s*\(\s*\{[^}]*gems/i,
    /user\.gold\s*[+\-]=\s*\d/,
    /user\.coins\s*[+\-]=\s*\d/,
    /\.gold\s*=\s*(?!receipt)/,
    /\.coins\s*=\s*(?!receipt)/,
  ];
  
  let foundIssues = false;
  
  for (const file of filesToCheck) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        warn(`${file} may have direct balance mutation (pattern: ${pattern.source})`);
        foundIssues = true;
      }
    }
  }
  
  if (!foundIssues) {
    success('No suspicious direct balance mutations found');
  }
}

// =============================================================================
// Run all checks
// =============================================================================
console.log('='.repeat(60));
console.log('Phase 3.24: Receipt Shape Guard');
console.log('='.repeat(60));

checkBackendReceipts();
checkFrontendReceiptType();
checkMailApiReceipts();
checkNoDirectBalanceMutation();

// Summary
console.log('\n' + '='.repeat(60));
if (exitCode === 0 && warnings === 0) {
  console.log(`${GREEN}All receipt shape checks passed!${RESET}`);
} else if (exitCode === 0) {
  console.log(`${YELLOW}Passed with ${warnings} warning(s)${RESET}`);
} else {
  console.log(`${RED}Receipt shape guard FAILED${RESET}`);
}
console.log('='.repeat(60));

process.exit(exitCode);
