#!/usr/bin/env node
/**
 * guard-entitlements-refresh-discipline.mjs
 * 
 * Phase 3.14: Enforces entitlements refresh discipline
 * 
 * RULES:
 * 1. refreshFromServer() - ONLY allowed in:
 *    - entitlementStore.ts (where it's defined)
 *    - purchase-flow.ts (belt+suspenders post-purchase)
 * 
 * 2. ensureFreshEntitlements() - ONLY allowed in:
 *    - entitlementStore.ts (where it's defined)
 *    - gating.ts (premium gates trigger freshness check)
 *    - _layout.tsx (startup + app resume via hook)
 *    - useAppResumeReconcile.ts (app resume hook)
 * 
 * 3. AppState listener for entitlements - ONLY allowed in:
 *    - useAppResumeReconcile.ts
 * 
 * This keeps refresh discipline centralized and prevents drift.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

const FRONTEND_ROOT = new URL('..', import.meta.url).pathname;

// Files allowed to call refreshFromServer
const ALLOWED_REFRESH_FROM_SERVER_FILES = new Set([
  'entitlementStore.ts',  // Where it's defined
  'purchase-flow.ts',     // Belt+suspenders post-purchase
]);

// Files allowed to call ensureFreshEntitlements
const ALLOWED_ENSURE_FRESH_FILES = new Set([
  'entitlementStore.ts',      // Where it's defined
  'gating.ts',                // Premium gates
  '_layout.tsx',              // Startup
  'useAppResumeReconcile.ts', // App resume hook
]);

// Files allowed to use AppState for entitlements
const ALLOWED_APPSTATE_ENTITLEMENT_FILES = new Set([
  'useAppResumeReconcile.ts', // ONLY place AppState is used for entitlements
]);

// Patterns to detect
const REFRESH_FROM_SERVER_PATTERN = /refreshFromServer\s*\(/;
const ENSURE_FRESH_PATTERN = /ensureFreshEntitlements\s*\(/;
const APPSTATE_ENTITLEMENT_PATTERN = /AppState\.addEventListener.*entitlement|AppState.*ensureFresh/i;

// Directories to scan
const SCAN_DIRS = [
  join(FRONTEND_ROOT, 'app'),
  join(FRONTEND_ROOT, 'components'),
  join(FRONTEND_ROOT, 'stores'),
  join(FRONTEND_ROOT, 'lib'),
  join(FRONTEND_ROOT, 'hooks'),
];

function getAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip node_modules and hidden dirs
        if (item === 'node_modules' || item.startsWith('.')) continue;
        getAllFiles(fullPath, files);
      } else if (stat.isFile()) {
        const ext = extname(item);
        if (['.ts', '.tsx'].includes(ext)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip files we can't read
    }
  }
  return files;
}

function checkFile(filePath) {
  const violations = [];
  const fileName = basename(filePath);
  
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    
    // Check for refreshFromServer() outside allowed files
    if (!ALLOWED_REFRESH_FROM_SERVER_FILES.has(fileName)) {
      if (REFRESH_FROM_SERVER_PATTERN.test(line)) {
        violations.push({
          file: filePath.replace(FRONTEND_ROOT, ''),
          line: lineNum,
          type: 'DIRECT_REFRESH_FROM_SERVER',
          content: line.trim().substring(0, 80),
        });
      }
    }
    
    // Check for ensureFreshEntitlements() outside allowed files
    if (!ALLOWED_ENSURE_FRESH_FILES.has(fileName)) {
      if (ENSURE_FRESH_PATTERN.test(line)) {
        violations.push({
          file: filePath.replace(FRONTEND_ROOT, ''),
          line: lineNum,
          type: 'UNALLOWED_ENSURE_FRESH',
          content: line.trim().substring(0, 80),
        });
      }
    }
    
    // Check for AppState + entitlement patterns outside allowed files
    if (!ALLOWED_APPSTATE_ENTITLEMENT_FILES.has(fileName)) {
      if (APPSTATE_ENTITLEMENT_PATTERN.test(line)) {
        violations.push({
          file: filePath.replace(FRONTEND_ROOT, ''),
          line: lineNum,
          type: 'APPSTATE_ENTITLEMENT_DRIFT',
          content: line.trim().substring(0, 80),
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔄 Checking entitlements refresh discipline (Phase 3.14)...\n');
  
  let allViolations = [];
  
  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir);
    for (const file of files) {
      const violations = checkFile(file);
      allViolations = allViolations.concat(violations);
    }
  }
  
  if (allViolations.length === 0) {
    console.log('✅ Entitlements refresh discipline is maintained.');
    console.log('   All refresh calls go through canonical entry points.\n');
    process.exit(0);
  }
  
  console.log('❌ FORBIDDEN: Entitlements refresh discipline violations!\n');
  console.log('Rules:');
  console.log('  - refreshFromServer(): only in entitlementStore.ts, purchase-flow.ts');
  console.log('  - ensureFreshEntitlements(): only in gating.ts, _layout.tsx, useAppResumeReconcile.ts');
  console.log('  - AppState for entitlements: only in useAppResumeReconcile.ts\n');
  
  for (const v of allViolations) {
    console.log(`  [${v.file}:${v.line}] ${v.type}`);
    console.log(`    ${v.content}`);
    console.log('');
  }
  
  console.log(`\nTotal violations: ${allViolations.length}`);
  process.exit(1);
}

main();
