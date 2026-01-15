#!/usr/bin/env node
/**
 * guard-env-detection.mjs
 * 
 * Phase 3.17: Enforces centralized environment detection
 * 
 * RULE: Direct usage of `process.env.EXPO_PUBLIC_ENV` is FORBIDDEN
 * outside of lib/config/validate.ts
 * 
 * All code should use the exported helpers:
 * - getEnvironmentMode()
 * - isProductionEnvironment()
 * - isDevelopmentEnvironment()
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

const FRONTEND_ROOT = new URL('..', import.meta.url).pathname;

// Files allowed to directly access EXPO_PUBLIC_ENV
const ALLOWED_ENV_ACCESS_FILES = new Set([
  'validate.ts', // Where the helpers are defined
]);

// Pattern to detect direct EXPO_PUBLIC_ENV access
const DIRECT_ENV_PATTERN = /process\.env\.EXPO_PUBLIC_ENV/;

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
  
  // Skip allowed files
  if (ALLOWED_ENV_ACCESS_FILES.has(fileName)) {
    return violations;
  }
  
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
    
    // Check for direct EXPO_PUBLIC_ENV access
    if (DIRECT_ENV_PATTERN.test(line)) {
      violations.push({
        file: filePath.replace(FRONTEND_ROOT, ''),
        line: lineNum,
        content: line.trim().substring(0, 80),
      });
    }
  }
  
  return violations;
}

function main() {
  console.log('🌍 Checking centralized environment detection (Phase 3.17)...\n');
  
  let allViolations = [];
  
  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir);
    for (const file of files) {
      const violations = checkFile(file);
      allViolations = allViolations.concat(violations);
    }
  }
  
  if (allViolations.length === 0) {
    console.log('✅ Environment detection is centralized.');
    console.log('   All code uses getEnvironmentMode() / isProductionEnvironment() helpers.\n');
    process.exit(0);
  }
  
  console.log('❌ FORBIDDEN: Direct EXPO_PUBLIC_ENV access detected!\n');
  console.log('Use helpers from lib/config/validate.ts instead:');
  console.log('  - getEnvironmentMode()');
  console.log('  - isProductionEnvironment()');
  console.log('  - isDevelopmentEnvironment()\n');
  
  for (const v of allViolations) {
    console.log(`  [${v.file}:${v.line}]`);
    console.log(`    ${v.content}`);
    console.log('');
  }
  
  console.log(`\nTotal violations: ${allViolations.length}`);
  process.exit(1);
}

main();
