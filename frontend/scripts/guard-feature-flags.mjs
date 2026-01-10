#!/usr/bin/env node
/**
 * CI Guard: Feature Flag Architecture
 * 
 * Ensures:
 * 1. UI only imports isFeatureEnabled from lib/features.ts (or lib/progression.ts barrel)
 * 2. No direct AsyncStorage reads for feature flags in UI
 * 3. No direct /v1/features calls outside lib/api.ts
 * 4. No direct featureStore access in UI screens (use isFeatureEnabled)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Files/folders to scan
const UI_DIRS = ['app', 'components'];
const ALLOWED_FEATURE_SOURCES = ['lib/features', 'lib/progression'];

// Patterns that indicate violations
const VIOLATIONS = [
  {
    name: 'Direct featureStore import in UI',
    pattern: /from\s+['"].*stores\/featureStore['"]/,
    message: 'UI should use isFeatureEnabled() from lib/features.ts, not featureStore directly',
    // _layout.tsx is allowed because it handles app boot hydration
    allowedFiles: ['app/_layout.tsx'],
  },
  {
    name: 'Direct /v1/features fetch',
    pattern: /['"]\/v1\/features['"]|['"]\/api\/v1\/features['"]/,
    message: 'Only lib/api.ts should call /v1/features endpoint',
    allowedFiles: ['lib/api.ts'],
  },
  {
    name: 'Direct FEATURES_STORAGE_KEY access',
    pattern: /FEATURES_STORAGE_KEY|@idledevotion\/features/,
    message: 'Only featureStore should access feature flag cache storage',
    allowedFiles: ['lib/featureUtils.ts', 'stores/featureStore.ts'],
  },
  {
    name: 'Direct featureUtils import in UI',
    pattern: /from\s+['"].*lib\/featureUtils['"]/,
    message: 'UI should not import featureUtils directly - use lib/features.ts',
  },
];

function scanFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  for (const violation of VIOLATIONS) {
    // Skip if this file is in the allowed list
    if (violation.allowedFiles?.some(allowed => relativePath.includes(allowed))) {
      continue;
    }

    if (violation.pattern.test(content)) {
      issues.push({
        file: relativePath,
        violation: violation.name,
        message: violation.message,
      });
    }
  }

  return issues;
}

function scanDirectory(dir, baseDir = '') {
  const issues = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      issues.push(...scanDirectory(fullPath, relativePath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      issues.push(...scanFile(fullPath, relativePath));
    }
  }

  return issues;
}

// Main execution
console.log('[guard:feature-flags] Checking feature flag architecture...');

let allIssues = [];

for (const uiDir of UI_DIRS) {
  const dirPath = path.join(ROOT, uiDir);
  if (fs.existsSync(dirPath)) {
    allIssues.push(...scanDirectory(dirPath, uiDir));
  }
}

if (allIssues.length > 0) {
  console.error('\n[guard:feature-flags] ❌ Architecture violations found:\n');
  for (const issue of allIssues) {
    console.error(`  ${issue.file}:`);
    console.error(`    Violation: ${issue.violation}`);
    console.error(`    Fix: ${issue.message}\n`);
  }
  process.exit(1);
} else {
  console.log('[guard:feature-flags] ✅ Feature flag architecture enforced.');
  process.exit(0);
}
