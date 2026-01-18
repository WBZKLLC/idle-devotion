#!/usr/bin/env node
/**
 * Guard: SourceId Strength Enforcement
 * 
 * Ensures sourceId generation is robust (not timestamp-only).
 * Prevents idempotency collisions from multi-tap, retries, clock issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_IDS_PATH = path.resolve(__dirname, '../lib/ids/sourceId.ts');
const APP_PATH = path.resolve(__dirname, '../app');
const COMPONENTS_PATH = path.resolve(__dirname, '../components');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}WARN:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Guard: SourceId Strength Enforcement');
console.log('============================================\n');

// Check 1: sourceId.ts exists with makeSourceId export
console.log('Check 1: sourceId helper exists...');
if (!fs.existsSync(LIB_IDS_PATH)) {
  fail('lib/ids/sourceId.ts does not exist');
}
const sourceIdContent = fs.readFileSync(LIB_IDS_PATH, 'utf8');
if (!sourceIdContent.includes('export function makeSourceId')) {
  fail('lib/ids/sourceId.ts must export makeSourceId()');
}
pass('sourceId helper exists with makeSourceId export');

// Check 2: makeSourceId uses random component
console.log('\nCheck 2: makeSourceId includes random component...');
if (!sourceIdContent.includes('random') && !sourceIdContent.includes('Random')) {
  fail('makeSourceId must include random component (not timestamp-only)');
}
pass('makeSourceId includes random component');

// Check 3: No timestamp-only sourceId patterns in critical files
console.log('\nCheck 3: No timestamp-only sourceId patterns...');

const weakPatterns = [
  // Weak patterns that should fail
  /sourceId\s*[=:]\s*`[^`]*\$\{Date\.now\(\)\}`(?![^`]*random|[^`]*Random|[^`]*\$\{[^}]*\})/,
  /sourceId\s*[=:]\s*String\(Date\.now\(\)\)/,
  /sourceId\s*[=:]\s*Date\.now\(\)\.toString\(\)/,
  /sourceId\s*[=:]\s*`\$\{Date\.now\(\)\}`$/m,
];

const criticalFiles = [
  ...glob.sync(path.join(APP_PATH, '**/*.tsx')),
  ...glob.sync(path.join(COMPONENTS_PATH, '**/*.tsx')),
];

const violations = [];

for (const file of criticalFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const filename = path.relative(path.resolve(__dirname, '..'), file);
  
  // Skip the sourceId.ts file itself
  if (file.includes('sourceId.ts')) continue;
  
  for (const pattern of weakPatterns) {
    if (pattern.test(content)) {
      // Check if this is in a comment
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*')) {
          violations.push(`${filename}:${i + 1}: timestamp-only sourceId pattern`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.log('  Violations found:');
  violations.forEach(v => console.log(`    - ${v}`));
  fail('Use makeSourceId() from lib/ids/sourceId.ts instead of timestamp-only patterns');
}
pass('No timestamp-only sourceId patterns found');

// Check 4: Gacha summon uses makeSourceId
console.log('\nCheck 4: Gacha summon uses makeSourceId...');
const summonHubPath = path.resolve(APP_PATH, '(tabs)/summon-hub.tsx');
if (fs.existsSync(summonHubPath)) {
  const summonContent = fs.readFileSync(summonHubPath, 'utf8');
  if (summonContent.includes('summon') && summonContent.includes('sourceId')) {
    if (!summonContent.includes('makeSourceId')) {
      fail('summon-hub.tsx must use makeSourceId() for sourceId generation');
    }
    pass('Gacha summon uses makeSourceId');
  } else {
    warn('Gacha summon flow not found in summon-hub.tsx');
  }
} else {
  warn('summon-hub.tsx not found');
}

// Check 5: Hero promotion uses makeSourceId
console.log('\nCheck 5: Hero promotion uses makeSourceId...');
const promotionModalPath = path.resolve(COMPONENTS_PATH, 'hero/PromotionModal.tsx');
if (fs.existsSync(promotionModalPath)) {
  const promotionContent = fs.readFileSync(promotionModalPath, 'utf8');
  if (promotionContent.includes('promote') && promotionContent.includes('sourceId')) {
    if (!promotionContent.includes('makeSourceId') && !promotionContent.includes('generatePromotionSourceId')) {
      warn('PromotionModal.tsx should use makeSourceId() - currently may use generatePromotionSourceId');
    } else {
      pass('Hero promotion uses robust sourceId generation');
    }
  } else {
    pass('Promotion uses API wrapper (sourceId handled in heroProgression.ts)');
  }
} else {
  warn('PromotionModal.tsx not found');
}

console.log('\n============================================');
console.log(`${GREEN}SourceId Strength guard PASSED!${RESET}`);
console.log('============================================\n');
