#!/usr/bin/env node
/**
 * guard-no-error-alerts.mjs (Phase 3.18.4 - STRICT MODE)
 * 
 * Prevents API-driven "Error" alerts from being used anywhere.
 * Only allows Alert.alert for explicit confirmations with ALERT_ALLOWED annotation.
 * 
 * RULE: All alerts require one of these patterns on the line ABOVE:
 *   // ALERT_ALLOWED: destructive_confirm
 *   // ALERT_ALLOWED: logout_confirm
 *   // ALERT_ALLOWED: purchase_confirm
 *   // ALERT_ALLOWED: rewards_modal (celebratory, user dismisses)
 *   // ALERT_ALLOWED: legacy_account_flow (decision required)
 *   // ALERT_ALLOWED: dev_mode (paid-features.tsx only)
 * 
 * Run: node scripts/guard-no-error-alerts.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FRONTEND_ROOT = process.cwd();

// Valid ALERT_ALLOWED reasons
const VALID_ALERT_REASONS = [
  'destructive_confirm',
  'logout_confirm',
  'purchase_confirm',
  'rewards_modal',
  'legacy_account_flow',
  'dev_mode',
];

// Patterns that are ALWAYS forbidden (even with annotation)
const ALWAYS_FORBIDDEN_PATTERNS = [
  /Alert\.alert\s*\(\s*['"]Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Network Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Server Error['"]/gi,
  /Alert\.alert\s*\(\s*['"]Request Failed['"]/gi,
  /Alert\.alert\s*\(\s*['"]Failed['"]/gi,
  /Alert\.alert\s*\(\s*['"]Unauthorized['"]/gi,
  /Alert\.alert\s*\(\s*['"]Forbidden['"]/gi,
  /Alert\.alert\s*\(\s*['"]Session Expired['"]/gi,
];

// Files that are completely exempt (documentation, tests)
const EXEMPT_FILES = [
  'REVENUECAT_REENABLE.md',
  'guard-no-error-alerts.mjs', // This file
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
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            getAllFiles(fullPath, files);
          }
        } else if (EXTENSIONS.includes(extname(entry))) {
          files.push(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return files;
}

function isCommentedLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function hasValidAlertAllowedAnnotation(lines, lineIndex) {
  // Check the line above for ALERT_ALLOWED annotation
  if (lineIndex === 0) return { valid: false, reason: null };
  
  const prevLine = lines[lineIndex - 1].trim();
  const match = prevLine.match(/\/\/\s*ALERT_ALLOWED:\s*(\w+)/);
  
  if (!match) return { valid: false, reason: null };
  
  const reason = match[1];
  if (VALID_ALERT_REASONS.includes(reason)) {
    return { valid: true, reason };
  }
  
  return { valid: false, reason, invalid: true };
}

function checkFile(filePath) {
  const violations = [];
  const fileName = filePath.split('/').pop();
  
  // Skip exempt files
  if (EXEMPT_FILES.some(f => filePath.endsWith(f))) {
    return violations;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip commented lines
      if (isCommentedLine(line)) return;
      
      // Check for any Alert.alert usage
      const alertMatch = line.match(/Alert\.alert\s*\(/);
      if (!alertMatch) return;
      
      // Check for ALWAYS_FORBIDDEN patterns first
      for (const pattern of ALWAYS_FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 100),
            type: 'forbidden_error_alert',
            message: 'Error alerts must use toast.error() instead',
          });
          return; // Don't double-report
        }
      }
      
      // Check for valid ALERT_ALLOWED annotation
      const annotation = hasValidAlertAllowedAnnotation(lines, index);
      
      if (!annotation.valid) {
        if (annotation.invalid) {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 100),
            type: 'invalid_annotation',
            message: `Invalid ALERT_ALLOWED reason: "${annotation.reason}". Valid: ${VALID_ALERT_REASONS.join(', ')}`,
          });
        } else {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 100),
            type: 'missing_annotation',
            message: 'Alert.alert requires // ALERT_ALLOWED: <reason> on the line above',
          });
        }
      }
    });
  } catch (e) {}
  
  return violations;
}

function main() {
  console.log('🚫 Checking Alert.alert patterns (Phase 3.18.4 STRICT)...\n');
  console.log('   Valid annotations: ' + VALID_ALERT_REASONS.join(', ') + '\n');
  
  let allFiles = [];
  for (const dir of SCAN_DIRS) {
    const dirPath = join(FRONTEND_ROOT, dir);
    try {
      allFiles = allFiles.concat(getAllFiles(dirPath));
    } catch (e) {}
  }
  
  let allViolations = [];
  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations = allViolations.concat(violations);
  }
  
  if (allViolations.length > 0) {
    // Group by type
    const forbidden = allViolations.filter(v => v.type === 'forbidden_error_alert');
    const missing = allViolations.filter(v => v.type === 'missing_annotation');
    const invalid = allViolations.filter(v => v.type === 'invalid_annotation');
    
    if (forbidden.length > 0) {
      console.log('❌ FORBIDDEN Error Alerts (must use toast):\n');
      for (const v of forbidden) {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.content}`);
        console.log(`    → ${v.message}\n`);
      }
    }
    
    if (missing.length > 0) {
      console.log('⚠️  Missing ALERT_ALLOWED annotations:\n');
      for (const v of missing) {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.content}`);
        console.log(`    → Add: // ALERT_ALLOWED: <reason> on the line above\n`);
      }
    }
    
    if (invalid.length > 0) {
      console.log('❌ Invalid ALERT_ALLOWED annotations:\n');
      for (const v of invalid) {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    → ${v.message}\n`);
      }
    }
    
    console.log(`\n❌ ${allViolations.length} violation(s) found.`);
    console.log('   - Error/Network/Server alerts → use toast.error() or toast.warning()');
    console.log('   - Confirmation alerts → add // ALERT_ALLOWED: <reason> annotation\n');
    process.exit(1);
  }
  
  console.log('✅ All Alert.alert usages are properly annotated.');
  console.log('   No forbidden error alert patterns found.\n');
  process.exit(0);
}

main();
