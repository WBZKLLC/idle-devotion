#!/usr/bin/env node
/**
 * guard-get-user-hero-signature.mjs
 * 
 * Ensures getUserHeroById is called with correct signature:
 *   ✅ getUserHeroById(heroId)
 *   ✅ getUserHeroById(heroId, { forceRefresh: true })
 *   ❌ getUserHeroById(user.username, heroId)  // WRONG - old signature
 *   ❌ getUserHeroById(user?.username, heroId) // WRONG - old signature
 * 
 * This catches the exact mistake where username was passed as first arg.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Directories to scan (UI code that might call getUserHeroById)
const SCAN_DIRS = ['app', 'components', 'screens'];

// Patterns that indicate wrong signature usage
const WRONG_PATTERNS = [
  {
    // getUserHeroById(user.username, ...)
    pattern: /getUserHeroById\s*\(\s*user\.username/g,
    message: 'getUserHeroById(user.username, ...) is wrong. Use getUserHeroById(heroId) or getUserHeroById(heroId, { forceRefresh: true })',
  },
  {
    // getUserHeroById(user?.username, ...)
    pattern: /getUserHeroById\s*\(\s*user\?\.username/g,
    message: 'getUserHeroById(user?.username, ...) is wrong. Use getUserHeroById(heroId) or getUserHeroById(heroId, { forceRefresh: true })',
  },
  {
    // getUserHeroById(username, ...) where username is a variable
    pattern: /getUserHeroById\s*\(\s*username\s*,/g,
    message: 'getUserHeroById(username, ...) looks like wrong signature. First arg should be heroId, not username.',
  },
];

function scanFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  for (const { pattern, message } of WRONG_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.slice(0, match.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
      
      issues.push({
        file: relativePath,
        line: lineNum,
        message,
        snippet: match[0],
      });
    }
  }

  return issues;
}

function scanDirectory(dir, baseDir = '') {
  const issues = [];
  
  if (!fs.existsSync(dir)) return issues;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      issues.push(...scanDirectory(fullPath, relativePath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      issues.push(...scanFile(fullPath, relativePath));
    }
  }

  return issues;
}

// Main
console.log('[guard:get-user-hero-signature] Checking getUserHeroById call signatures...');

let allIssues = [];

for (const scanDir of SCAN_DIRS) {
  const dirPath = path.join(ROOT, scanDir);
  if (fs.existsSync(dirPath)) {
    allIssues.push(...scanDirectory(dirPath, scanDir));
  }
}

if (allIssues.length > 0) {
  console.error('\n[guard:get-user-hero-signature] ❌ Wrong signature detected:\n');
  
  for (const issue of allIssues) {
    console.error(`  ${issue.file}:${issue.line}`);
    console.error(`    Found: ${issue.snippet}`);
    console.error(`    Fix: ${issue.message}\n`);
  }
  
  console.error('Correct usage:');
  console.error('  getUserHeroById(heroId)');
  console.error('  getUserHeroById(heroId, { forceRefresh: true })\n');
  
  process.exit(1);
} else {
  console.log('[guard:get-user-hero-signature] ✅ All getUserHeroById calls use correct signature.');
  process.exit(0);
}
