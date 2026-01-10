#!/usr/bin/env node
/**
 * CI Guard: Feature Flag Architecture
 * 
 * Ensures:
 * 1. UI only imports isFeatureEnabled from lib/features.ts (read-only)
 * 2. No direct AsyncStorage reads for feature flags in UI
 * 3. No direct /v1/features calls outside lib/api.ts
 * 4. No direct featureStore access in UI screens (except bootstrap)
 * 5. No calls to internal feature mutators in UI code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

// UI directories to scan
const UI_DIRS = ['app', 'components', 'screens'];

// Files allowed to bypass certain rules (bootstrap layer)
const BOOTSTRAP_EXCEPTIONS = [
  'app/_layout.tsx',
];

// Only these exports from lib/features are allowed in UI
const ALLOWED_FEATURE_IMPORTS = new Set([
  'isFeatureEnabled',
  'FeatureKey',      // type-only, safe
  'DEFAULT_FLAGS',   // read-only constant, safe for reference
]);

// These function calls are forbidden in UI (internal mutators)
const FORBIDDEN_FEATURE_CALLS = [
  'setRemoteFeatures(',
  'clearRemoteFeatures(',
  'getRemoteFeaturesSnapshot(',
  'setDevFeatureOverride(',
  'clearDevFeatureOverride(',
  'clearAllDevFeatureOverrides(',
];

// Pattern-based violations (from original guard)
const PATTERN_VIOLATIONS = [
  {
    name: 'Direct featureStore import in UI',
    pattern: /from\s+['"].*stores\/featureStore['"]/,
    message: 'UI should use isFeatureEnabled() from lib/features.ts, not featureStore directly',
    allowedFiles: BOOTSTRAP_EXCEPTIONS,
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

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function isUIPath(relativePath) {
  return UI_DIRS.some(dir => relativePath.startsWith(dir + '/') || relativePath.startsWith(dir + '\\'));
}

function isBootstrapException(relativePath) {
  return BOOTSTRAP_EXCEPTIONS.some(exc => relativePath.includes(exc));
}

/**
 * Parse named imports from an import line.
 * Handles: import { a, b as c, type D } from '...';
 * Returns array of imported names (without aliases).
 */
function parseNamedImports(importLine) {
  const m = importLine.match(/import\s+\{([^}]+)\}\s+from\s+['"](.+?)['"]/);
  if (!m) return null;
  
  const raw = m[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^type\s+/, '').trim()); // handle `import { type X }`
  
  return raw.map(x => x.split(/\s+as\s+/)[0].trim());
}

// ─────────────────────────────────────────────────────────────
// GUARD CHECKS
// ─────────────────────────────────────────────────────────────

function checkPatternViolations(content, relativePath) {
  const issues = [];
  
  for (const violation of PATTERN_VIOLATIONS) {
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

function checkFeatureImports(content, relativePath) {
  const issues = [];
  
  // Only check UI paths, skip bootstrap exceptions
  if (!isUIPath(relativePath) || isBootstrapException(relativePath)) {
    return issues;
  }
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Only check named imports from lib/features
    if (!line.includes('from') || !line.includes('lib/features')) continue;
    if (!line.includes('import') || !line.includes('{')) continue;
    
    const importedNames = parseNamedImports(line);
    if (!importedNames) continue;
    
    for (const name of importedNames) {
      if (!ALLOWED_FEATURE_IMPORTS.has(name)) {
        issues.push({
          file: relativePath,
          line: i + 1,
          violation: 'Forbidden feature import in UI',
          message: `UI must only import { isFeatureEnabled } from lib/features. Found: "${name}"`,
        });
      }
    }
  }
  
  return issues;
}

function checkForbiddenFeatureCalls(content, relativePath) {
  const issues = [];
  
  // Only check UI paths, skip bootstrap exceptions
  if (!isUIPath(relativePath) || isBootstrapException(relativePath)) {
    return issues;
  }
  
  for (const token of FORBIDDEN_FEATURE_CALLS) {
    const idx = content.indexOf(token);
    if (idx !== -1) {
      // Find line number
      const beforeMatch = content.slice(0, idx);
      const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
      
      issues.push({
        file: relativePath,
        line: lineNum,
        violation: 'Forbidden feature API call in UI',
        message: `UI must not call internal feature APIs: ${token.replace('(', '()')}`,
      });
    }
  }
  
  return issues;
}

// ─────────────────────────────────────────────────────────────
// FILE SCANNING
// ─────────────────────────────────────────────────────────────

function scanFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Run all checks
  issues.push(...checkPatternViolations(content, relativePath));
  issues.push(...checkFeatureImports(content, relativePath));
  issues.push(...checkForbiddenFeatureCalls(content, relativePath));
  
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
      // Skip node_modules, .git, etc.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      issues.push(...scanDirectory(fullPath, relativePath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      issues.push(...scanFile(fullPath, relativePath));
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

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
    const loc = issue.line ? `:${issue.line}` : '';
    console.error(`  ${issue.file}${loc}`);
    console.error(`    Violation: ${issue.violation}`);
    console.error(`    Fix: ${issue.message}\n`);
  }
  
  process.exit(1);
} else {
  console.log('[guard:feature-flags] ✅ Feature flag architecture enforced (read-only UI).');
  process.exit(0);
}
