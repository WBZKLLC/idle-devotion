#!/usr/bin/env node
/**
 * Guard: API Configuration Enforcement
 * 
 * Ensures all API calls use centralized config.
 * No hardcoded API_BASE definitions in individual files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_API_PATH = path.resolve(__dirname, '../lib/api');
const APP_PATH = path.resolve(__dirname, '../app');

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
console.log('Guard: API Configuration Enforcement');
console.log('============================================\n');

// Check 1: config.ts exists
console.log('Check 1: Centralized API config exists...');
const configPath = path.join(LIB_API_PATH, 'config.ts');
if (!fs.existsSync(configPath)) {
  fail('lib/api/config.ts does not exist');
}
const configContent = fs.readFileSync(configPath, 'utf8');
if (!configContent.includes('export const API_BASE') && !configContent.includes('export { API_BASE')) {
  fail('lib/api/config.ts must export API_BASE');
}
pass('Centralized API config exists with API_BASE export');

// Check 2: config.ts uses correct env var
console.log('\nCheck 2: Config uses EXPO_PUBLIC_BACKEND_URL...');
if (!configContent.includes('EXPO_PUBLIC_BACKEND_URL')) {
  fail('lib/api/config.ts must use EXPO_PUBLIC_BACKEND_URL');
}
pass('Config uses EXPO_PUBLIC_BACKEND_URL');

// Check 3: No hardcoded API_BASE in lib/api files (except config)
console.log('\nCheck 3: No hardcoded API_BASE in lib/api/ files...');
const apiFiles = glob.sync(path.join(LIB_API_PATH, '*.ts'));
let violations = [];

for (const file of apiFiles) {
  if (file.endsWith('config.ts')) continue;
  
  const content = fs.readFileSync(file, 'utf8');
  const filename = path.basename(file);
  
  // Check for hardcoded API_BASE definition
  if (/const\s+API_BASE\s*=/.test(content)) {
    violations.push(`${filename}: hardcoded API_BASE definition`);
  }
  
  // Check for direct process.env.EXPO_PUBLIC_API_URL usage
  if (content.includes('process.env.EXPO_PUBLIC_API_URL')) {
    violations.push(`${filename}: direct env var usage (should import from config)`);
  }
  
  // Check for relative API calls (fetch('/api/... or fetch("/api/...)
  if (/fetch\s*\(\s*['"]\/api\//.test(content)) {
    violations.push(`${filename}: relative fetch('/api/...) call (should use apiUrl())`);
  }
}

if (violations.length > 0) {
  console.log('  Violations found:');
  violations.forEach(v => console.log(`    - ${v}`));
  fail('lib/api files must import API_BASE from ./config');
}
pass('No hardcoded API_BASE in lib/api/ files');

// Check 4: No hardcoded API_BASE or relative API calls in app/ files
console.log('\nCheck 4: No hardcoded API_BASE in app/ files...');
const appFiles = glob.sync(path.join(APP_PATH, '**/*.tsx'));
violations = [];

for (const file of appFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const filename = path.relative(APP_PATH, file);
  
  // Check for hardcoded API_BASE definition
  if (/const\s+API_BASE\s*=\s*process\.env/.test(content)) {
    violations.push(`${filename}: hardcoded API_BASE definition`);
  }
  
  // Check for relative API calls (fetch('/api/... or fetch("/api/...)
  if (/fetch\s*\(\s*['"]\/api\//.test(content)) {
    violations.push(`${filename}: relative fetch('/api/...) call (should use apiUrl())`);
  }
}

if (violations.length > 0) {
  console.log('  Violations found:');
  violations.forEach(v => console.log(`    - ${v}`));
  fail('app/ files must import API_BASE from lib/api/config');
}
pass('No hardcoded API_BASE in app/ files');

// Check 5: .env has EXPO_PUBLIC_BACKEND_URL
console.log('\nCheck 5: .env has EXPO_PUBLIC_BACKEND_URL...');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('EXPO_PUBLIC_BACKEND_URL')) {
    warn('.env missing EXPO_PUBLIC_BACKEND_URL (using fallback)');
  } else {
    pass('.env has EXPO_PUBLIC_BACKEND_URL');
  }
} else {
  warn('.env file not found');
}

console.log('\n============================================');
console.log(`${GREEN}API Config guard PASSED!${RESET}`);
console.log('============================================\n');
