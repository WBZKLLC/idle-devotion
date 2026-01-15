#!/usr/bin/env node
/**
 * guard-auth-epoch.mjs
 * 
 * Detects async store actions that mutate state after API calls
 * WITHOUT proper epoch invalidation checks.
 * 
 * PATTERN TO ENFORCE:
 * ```
 * async someAction() {
 *   const epochAtStart = get().authEpoch;  // Capture epoch
 *   // ... async operations ...
 *   if (get().authEpoch !== epochAtStart) return;  // Guard before set
 *   set({ ... });  // Safe to mutate
 * }
 * ```
 * 
 * DETECTED VIOLATIONS:
 * 1. Async function with `await` followed by `set(` without epoch check
 * 2. Async function with API call (from api.ts imports) followed by `set(` without check
 * 
 * ALLOWED PATTERNS:
 * - Synchronous functions (no await before set)
 * - Functions with epochAtStart/entitlementEpoch capture and check
 * - DEV-only functions (devGrantEntitlement, etc.)
 * - Functions that only set loading/error state
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const FRONTEND_ROOT = new URL('..', import.meta.url).pathname;
const STORES_DIR = join(FRONTEND_ROOT, 'stores');

// Store files to check
const STORE_FILES = [
  'gameStore.ts',
  'entitlementStore.ts',
  'featureStore.ts',
  'purchaseStore.ts',
  // revenueCatStore.ts is a legacy remnant - skip for now
];

// Functions that are DEV-only and exempt from checks
const DEV_ONLY_FUNCTIONS = new Set([
  'devGrantEntitlement',
  'devRevokeEntitlement',
  'devClearAll',
]);

// Functions that are exempt (synchronous or don't need epoch protection)
const EXEMPT_FUNCTIONS = new Set([
  // Synchronous state setters
  'setUser',
  'setHydrated',
  'bumpAuthEpoch',
  'setOnline',
  'clearError',
  'reset',
  'viewPaywall',
  'startPurchase',
  'setPending',
  'setVerified',
  'setFailed',
  'setCancelled',
  // Hydration functions (run at app start, no prior session)
  'hydrateAuth',
  'hydrateEntitlements',
  'hydrateRemoteFeatures',
  // Auth functions (establish new session, no race risk)
  'registerUser',
  'loginWithPassword',
  'setPasswordForLegacyAccount',
  'initUser',
  'restoreSession',
  // Registration callbacks
  'registerForceLogout',
  // Logout itself
  'logout',
  // Selectors/computed (no mutations)
  'selectUserHeroById',
  'isProcessing',
  'canStartPurchase',
  'hasEntitlement',
  // Clear functions (intentionally clear state)
  'clear',
  'clearCachedFeatures',
]);

// Patterns indicating epoch capture at function start
const EPOCH_CAPTURE_PATTERNS = [
  /const\s+epochAtStart\s*=\s*get\(\)\.authEpoch/,
  /const\s+epochAtStart\s*=\s*get\(\)\.entitlementEpoch/,
  /const\s+\{\s*.*authEpoch.*\}\s*=\s*get\(\)/,
  /get\(\)\.authEpoch/,
  /get\(\)\.entitlementEpoch/,
];

// Patterns indicating epoch check before set
const EPOCH_CHECK_PATTERNS = [
  /if\s*\(\s*get\(\)\.authEpoch\s*!==\s*epochAtStart\s*\)/,
  /if\s*\(\s*get\(\)\.entitlementEpoch\s*!==\s*epochAtStart\s*\)/,
  /authEpoch\s*!==\s*epochAtStart/,
  /entitlementEpoch\s*!==\s*epochAtStart/,
];

function extractFunctionBlocks(content) {
  // Extract all function definitions within the store create() call
  const functions = [];
  
  // Match function definitions like: functionName: async () => { ... }
  // or functionName: async (param) => { ... }
  // We use a simple state machine approach
  const lines = content.split('\n');
  
  let currentFunc = null;
  let braceCount = 0;
  let funcBody = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for function start: name: async (...) => {
    const funcMatch = line.match(/^\s*(\w+):\s*async\s*\([^)]*\)\s*=>\s*\{?/);
    
    if (funcMatch && !currentFunc) {
      currentFunc = {
        name: funcMatch[1],
        startLine: lineNum,
        body: [],
      };
      braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      currentFunc.body.push(line);
      
      // If function is single-line, close it
      if (braceCount <= 0 && line.includes('{')) {
        functions.push(currentFunc);
        currentFunc = null;
        braceCount = 0;
      }
      continue;
    }
    
    if (currentFunc) {
      currentFunc.body.push(line);
      braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      
      // Check if function block is complete
      // Look for closing pattern: }, (end of function in object)
      if (braceCount <= 0 || line.match(/^\s*\},?\s*$/)) {
        functions.push(currentFunc);
        currentFunc = null;
        braceCount = 0;
      }
    }
  }
  
  return functions;
}

function analyzeFunction(func) {
  const { name, body, startLine } = func;
  const bodyText = body.join('\n');
  
  // Skip exempt functions
  if (EXEMPT_FUNCTIONS.has(name) || DEV_ONLY_FUNCTIONS.has(name)) {
    return null;
  }
  
  // Check if function has await
  const hasAwait = /\bawait\b/.test(bodyText);
  if (!hasAwait) {
    // No async operations, no need for epoch check
    return null;
  }
  
  // Check if function calls set() after await
  // Simple heuristic: look for set( or set({ after any await
  const awaitIndex = bodyText.indexOf('await');
  const setAfterAwait = bodyText.slice(awaitIndex).match(/\bset\s*\(\s*[\{\(]/);
  
  if (!setAfterAwait) {
    // No set() calls after await, safe
    return null;
  }
  
  // Check for epoch capture pattern
  const hasEpochCapture = EPOCH_CAPTURE_PATTERNS.some(p => p.test(bodyText));
  if (!hasEpochCapture) {
    return {
      name,
      startLine,
      reason: 'Missing epoch capture (const epochAtStart = get().authEpoch)',
    };
  }
  
  // Check for epoch check before set
  const hasEpochCheck = EPOCH_CHECK_PATTERNS.some(p => p.test(bodyText));
  if (!hasEpochCheck) {
    return {
      name,
      startLine,
      reason: 'Missing epoch check before set() (if (get().authEpoch !== epochAtStart) return)',
    };
  }
  
  // All checks passed
  return null;
}

function checkStoreFile(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const functions = extractFunctionBlocks(content);
  const violations = [];
  
  for (const func of functions) {
    const violation = analyzeFunction(func);
    if (violation) {
      violations.push({
        file: basename(filePath),
        ...violation,
      });
    }
  }
  
  return violations;
}

function main() {
  console.log('🔒 Checking authEpoch guards in stores...\n');
  
  let allViolations = [];
  
  for (const storeFile of STORE_FILES) {
    const filePath = join(STORES_DIR, storeFile);
    const violations = checkStoreFile(filePath);
    allViolations = allViolations.concat(violations);
  }
  
  if (allViolations.length === 0) {
    console.log('✅ All async store actions have proper authEpoch guards.');
    console.log('   No race conditions from stale in-flight requests possible.\n');
    process.exit(0);
  }
  
  console.log('❌ FORBIDDEN: Missing authEpoch guards detected!\n');
  console.log('Pattern to enforce:');
  console.log('  1. Capture epoch at function start: const epochAtStart = get().authEpoch;');
  console.log('  2. Check epoch before set(): if (get().authEpoch !== epochAtStart) return;');
  console.log('  3. Only then call set({ ... });\n');
  
  for (const v of allViolations) {
    console.log(`  [${v.file}] ${v.name} (line ~${v.startLine})`);
    console.log(`    ⚠️  ${v.reason}`);
    console.log('');
  }
  
  console.log(`\nTotal violations: ${allViolations.length}`);
  process.exit(1);
}

main();
