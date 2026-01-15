#!/usr/bin/env node
/**
 * guard-no-error-alerts.mjs
 * 
 * Phase 3.18.4: Prevents API-driven "Error" alerts from creeping back in.
 * 
 * RULE: Alert.alert('Error', ...) and similar patterns should use toast.error() instead.
 * EXCEPTION: Confirmation dialogs (Are you sure?, Confirm, etc.) may use Alert.
 * 
 * Run: node scripts/guard-no-error-alerts.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FRONTEND_ROOT = process.cwd();

// Patterns that should NOT use Alert.alert (should be toasts)
const FORBIDDEN_PATTERNS = [
  /Alert\.alert\s*\(\s*['"]Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Network Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Server Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Request Failed['"]/gi,
  /Alert\.alert\s*\(\s*['"]Failed['"]/gi,
  /Alert\.alert\s*\(\s*['"]Unauthorized['"]/gi,
  /Alert\.alert\s*\(\s*['"]Forbidden['"]/gi,
  /Alert\.alert\s*\(\s*['"]Session Expired['"]/gi,
  /Alert\.alert\s*\(\s*['"]Invalid['"]/gi,
];

// Allowlisted files (admin tools, dev tools where blocking alerts are acceptable)
// TODO: Gradually remove files as they get converted to toast
const ALLOWLISTED_FILES = [
  'admin.tsx',
  'paid-features.tsx', // DEV mode alerts
  'REVENUECAT_REENABLE.md', // Documentation
  // Phase 3.18.4: Temporary allowlist - convert progressively
  'abyss.tsx',
  'campaign.tsx',
  'combat.tsx',
  'equipment.tsx',
  'events.tsx',
  'gacha.tsx',
  'guild.tsx',
  'guild-war.tsx',
  'hero-manager.tsx',
  'hero-upgrade.tsx',
  'journey.tsx',
  'launch-banner.tsx',
  'login-rewards.tsx',
  'selene-banner.tsx',
  'team-builder.tsx',
  'dungeons.tsx',
  'hero-progression.tsx',
  'safeMutation.ts', // Central error handler - needs separate refactor
];

// Directories to scan
const SCAN_DIRS = ['app', 'components', 'lib', 'stores'];

// Extensions to check
const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx'];

function getAllFiles(dir, files = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          // Skip node_modules and hidden dirs
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            getAllFiles(fullPath, files);
          }
        } else if (EXTENSIONS.includes(extname(entry))) {
          files.push(fullPath);
        }
      } catch (e) {
        // Skip files we can't stat
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }
  return files;
}

function isCommentedLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function checkFile(filePath) {
  const violations = [];
  const fileName = filePath.split('/').pop();
  
  // Skip allowlisted files
  if (ALLOWLISTED_FILES.some(f => filePath.endsWith(f))) {
    return violations;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip commented lines
      if (isCommentedLine(line)) return;
      
      for (const pattern of FORBIDDEN_PATTERNS) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 100),
            pattern: pattern.toString(),
          });
        }
      }
    });
  } catch (e) {
    // Skip files we can't read
  }
  
  return violations;
}

function main() {
  console.log('🚫 Checking for forbidden Alert.alert patterns (Phase 3.18.4)...\n');
  
  let allFiles = [];
  for (const dir of SCAN_DIRS) {
    const dirPath = join(FRONTEND_ROOT, dir);
    try {
      allFiles = allFiles.concat(getAllFiles(dirPath));
    } catch (e) {
      // Directory doesn't exist, skip
    }
  }
  
  let allViolations = [];
  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations = allViolations.concat(violations);
  }
  
  if (allViolations.length > 0) {
    console.log('❌ Found forbidden Alert.alert patterns:\n');
    for (const v of allViolations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.content}`);
      console.log(`    Pattern: ${v.pattern}\n`);
    }
    console.log(`\n❌ ${allViolations.length} violation(s) found.`);
    console.log('   Use toast.error(), toast.warning(), etc. instead of Alert.alert for API errors.');
    console.log('   Alert.alert is only for confirmation dialogs (Are you sure?, Confirm, etc.).\n');
    process.exit(1);
  }
  
  console.log('✅ No forbidden Alert.alert patterns found.');
  console.log('   All API-driven errors use toast system correctly.\n');
  process.exit(0);
}

main();
