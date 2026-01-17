#!/usr/bin/env node
// /app/frontend/scripts/guard-hero-motion.mjs
// Phase 3.25: Hero Motion Guard
//
// Ensures hero motion implementation follows constraints:
// 1. NO timers (setTimeout, setInterval)
// 2. NO requestAnimationFrame
// 3. NO manual animation loops in JS
// 4. Uses only Reanimated worklets for motion
// 5. Respects Reduce Motion accessibility
//
// "Motion via Reanimated only - no JS animation loops."

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;
let warnings = 0;

function error(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  exitCode = 1;
}

function warn(msg) {
  console.warn(`${YELLOW}⚠ ${msg}${RESET}`);
  warnings++;
}

function success(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

// Files to check for motion implementation
const MOTION_FILES = [
  'lib/hero/motion.ts',
  'app/hero/[id].tsx',
];

// Forbidden patterns in motion files
const FORBIDDEN_PATTERNS = [
  { pattern: /setInterval\s*\(/, name: 'setInterval' },
  { pattern: /setTimeout\s*\((?!.*clearTimeout)/, name: 'setTimeout (without cleanup)' },
  { pattern: /requestAnimationFrame\s*\(/, name: 'requestAnimationFrame' },
  { pattern: /cancelAnimationFrame\s*\(/, name: 'cancelAnimationFrame' },
  { pattern: /new\s+AnimationLoop/, name: 'AnimationLoop class' },
  { pattern: /while\s*\(true\)/, name: 'infinite while loop' },
  { pattern: /for\s*\(;;\)/, name: 'infinite for loop' },
];

// Required patterns (must exist)
const REQUIRED_PATTERNS = [
  { pattern: /useAnimatedStyle/, name: 'useAnimatedStyle (Reanimated)' },
  { pattern: /withRepeat|withTiming|withSequence/, name: 'Reanimated timing functions' },
  { pattern: /reduceMotion|isReduceMotionEnabled/, name: 'Reduce Motion check' },
];

function checkMotionFile(filePath) {
  const fullPath = path.join(ROOT, filePath);
  
  if (!fs.existsSync(fullPath)) {
    if (filePath.includes('motion.ts')) {
      error(`${filePath} not found - motion system missing`);
    } else {
      warn(`${filePath} not found`);
    }
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fileName = path.basename(filePath);
  
  console.log(`\n  Checking ${fileName}...`);
  
  // Check for forbidden patterns
  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      // Special case: setInterval in interactions.ts is for idle tick (not motion)
      if (name === 'setInterval' && filePath.includes('interactions.ts')) {
        warn(`${fileName}: ${name} found (verify it's not for visual motion)`);
      } else if (name === 'setInterval' || name === 'requestAnimationFrame') {
        error(`${fileName}: Forbidden API "${name}" found - use Reanimated instead`);
      } else {
        warn(`${fileName}: ${name} found`);
      }
    }
  }
  
  // Check for required patterns (only in motion.ts)
  if (filePath.includes('motion.ts')) {
    for (const { pattern, name } of REQUIRED_PATTERNS) {
      if (pattern.test(content)) {
        success(`${fileName}: ${name} found`);
      } else {
        error(`${fileName}: Missing required "${name}"`);
      }
    }
  }
  
  // Check hero screen uses motion hook
  if (filePath.includes('[id].tsx')) {
    if (content.includes('useHeroIdleMotion')) {
      success(`${fileName}: Uses useHeroIdleMotion hook`);
    } else {
      warn(`${fileName}: Not using useHeroIdleMotion hook`);
    }
    
    if (content.includes('driftingFog={false}') || content.includes('driftingFog: false')) {
      success(`${fileName}: Drifting fog disabled`);
    } else if (content.includes('AtmosphereStack')) {
      warn(`${fileName}: Verify drifting fog is disabled`);
    }
  }
}

function checkMotionTierConfig() {
  console.log('\n--- Motion Tier Configuration ---');
  
  const motionPath = path.join(ROOT, 'lib', 'hero', 'motion.ts');
  if (!fs.existsSync(motionPath)) {
    error('lib/hero/motion.ts not found');
    return;
  }
  
  const content = fs.readFileSync(motionPath, 'utf-8');
  
  // Check tier 0-1 are static
  if (content.includes('breathing: false') && content.includes('sway: false')) {
    success('Tier 0-1 are properly static');
  } else {
    warn('Verify Tier 0-1 have no motion');
  }
  
  // Check tiers exist
  const tierCount = (content.match(/\/\/ Tier \d:/g) || []).length;
  if (tierCount >= 5) {
    success(`${tierCount} motion tiers defined`);
  } else {
    warn(`Only ${tierCount} tiers found (expected 6: 0-5)`);
  }
  
  // Check resolveMotionTier exists
  if (content.includes('resolveMotionTier')) {
    success('resolveMotionTier function exists');
  } else {
    error('Missing resolveMotionTier function');
  }
}

// =============================================================================
// Run all checks
// =============================================================================
console.log('='.repeat(60));
console.log('Phase 3.25: Hero Motion Guard');
console.log('='.repeat(60));

console.log('\n--- Motion File Checks ---');
for (const file of MOTION_FILES) {
  checkMotionFile(file);
}

checkMotionTierConfig();

// Summary
console.log('\n' + '='.repeat(60));
if (exitCode === 0 && warnings === 0) {
  console.log(`${GREEN}Hero motion guard PASSED!${RESET}`);
} else if (exitCode === 0) {
  console.log(`${YELLOW}Passed with ${warnings} warning(s)${RESET}`);
} else {
  console.log(`${RED}Hero motion guard FAILED${RESET}`);
}
console.log('='.repeat(60));

process.exit(exitCode);
