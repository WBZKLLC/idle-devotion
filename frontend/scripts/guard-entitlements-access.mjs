#!/usr/bin/env node
/**
 * guard-entitlements-access.mjs
 * 
 * Enforces that screens NEVER access entitlementStore directly.
 * All entitlement checks MUST go through gating helpers:
 *   - useHasEntitlement(key)
 *   - requireEntitlement(key)
 *   - hasEntitlement(key)
 *   - canAccessHeroCinematic(heroId)
 * 
 * BLOCKED PATTERNS:
 *   - useEntitlementStore(s => s.entitlementsByKey...)
 *   - useEntitlementStore.getState().entitlementsByKey
 *   - entitlementsByKey.KEY
 *   - entitlementsByKey[key]
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FRONTEND_ROOT = new URL('..', import.meta.url).pathname;
const APP_DIR = join(FRONTEND_ROOT, 'app');
const COMPONENTS_DIR = join(FRONTEND_ROOT, 'components');

// Patterns that indicate direct store access (forbidden)
const FORBIDDEN_PATTERNS = [
  // Direct selector access to entitlementsByKey
  /useEntitlementStore\s*\(\s*[^)]*entitlementsByKey/,
  // getState().entitlementsByKey
  /useEntitlementStore\.getState\(\)\.entitlementsByKey/,
  /getState\(\)\.entitlementsByKey/,
  // Direct property access on entitlementsByKey
  /entitlementsByKey\s*\[/,
  /entitlementsByKey\./,
  // Direct snapshot access (should use gating helpers)
  /useEntitlementStore\s*\(\s*[^)]*snapshot\.entitlements/,
];

// Files that are ALLOWED to access store directly (implementation files)
const ALLOWED_FILES = [
  'entitlementStore.ts',
  'gating.ts',
  'purchaseStore.ts',
  'paid-features.tsx', // DEV admin screen - needs direct access for dev tools
];

function getAllTsxFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        getAllTsxFiles(fullPath, files);
      } else if (['.tsx', '.ts'].includes(extname(item))) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist, skip
  }
  return files;
}

function checkFile(filePath) {
  const fileName = filePath.split('/').pop();
  
  // Skip allowed implementation files
  if (ALLOWED_FILES.includes(fileName)) {
    return [];
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath.replace(FRONTEND_ROOT, ''),
          line: lineNum,
          content: line.trim().substring(0, 100),
          pattern: pattern.toString(),
        });
        break; // One violation per line is enough
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔒 Checking entitlement store access patterns...\n');
  
  const allFiles = [
    ...getAllTsxFiles(APP_DIR),
    ...getAllTsxFiles(COMPONENTS_DIR),
  ];
  
  let allViolations = [];
  
  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations = allViolations.concat(violations);
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No direct entitlement store access found.');
    console.log('   All screens use gating helpers correctly.\n');
    process.exit(0);
  }
  
  console.log('❌ FORBIDDEN: Direct entitlement store access detected!\n');
  console.log('Screens must use gating helpers from lib/entitlements/gating.ts:');
  console.log('  - useHasEntitlement(key)');
  console.log('  - requireEntitlement(key)');
  console.log('  - hasEntitlement(key)');
  console.log('  - canAccessHeroCinematic(heroId)\n');
  
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.content}`);
    console.log('');
  }
  
  console.log(`\nTotal violations: ${allViolations.length}`);
  process.exit(1);
}

main();
