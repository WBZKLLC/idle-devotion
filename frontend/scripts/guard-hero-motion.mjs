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
// 6. Uses centralized deriveHeroStageConfig + useHeroIdleMotion
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
      if (name === 'setInterval' || name === 'requestAnimationFrame') {
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
  
  // Check hero screen uses centralized config
  if (filePath.includes('[id].tsx')) {
    if (content.includes('deriveHeroStageConfig')) {
      success(`${fileName}: Uses deriveHeroStageConfig (centralized)`);
    } else {
      error(`${fileName}: Not using deriveHeroStageConfig - tier/camera should come from centralized config`);
    }
    
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
    
    if (content.includes('logHeroStageConfig')) {
      success(`${fileName}: Has DEV logging for config`);
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
  
  // Check MOTION_PARAMS exists with locked values
  if (content.includes('MOTION_PARAMS')) {
    success('MOTION_PARAMS table exists (single source of truth)');
  } else {
    error('Missing MOTION_PARAMS table');
  }
  
  // Check tier 0-1 are static (breathingScale: 0)
  const tier0Match = content.match(/0:\s*\{[^}]*breathingScale:\s*0/);
  const tier1Match = content.match(/1:\s*\{[^}]*breathingScale:\s*0/);
  if (tier0Match && tier1Match) {
    success('Tier 0-1 are properly static (breathingScale: 0)');
  } else {
    warn('Verify Tier 0-1 have no motion');
  }
  
  // Check locked values for tier 2-5
  const lockedValues = [
    { tier: 2, breathing: 0.006, bobY: 0.8 },
    { tier: 3, breathing: 0.010, swayX: 1.2 },
    { tier: 4, breathing: 0.013, swayX: 1.8 },
    { tier: 5, breathing: 0.016, swayX: 2.4 },
  ];
  
  let valuesCorrect = true;
  for (const v of lockedValues) {
    if (!content.includes(`breathingScale: ${v.breathing}`)) {
      valuesCorrect = false;
    }
  }
  
  if (valuesCorrect) {
    success('Locked motion values match spec (0.006, 0.010, 0.013, 0.016)');
  } else {
    error('Motion values do not match locked spec');
  }
  
  // Check resolveMotionTier exists
  if (content.includes('resolveMotionTier')) {
    success('resolveMotionTier function exists');
  } else {
    error('Missing resolveMotionTier function');
  }
  
  // Check deriveHeroStageConfig exists
  if (content.includes('deriveHeroStageConfig')) {
    success('deriveHeroStageConfig function exists');
  } else {
    error('Missing deriveHeroStageConfig function');
  }
  
  // Check getHeroMotionSpecByHeroDataId (alias-aware)
  if (content.includes('getHeroMotionSpecByHeroDataId')) {
    success('getHeroMotionSpecByHeroDataId (alias-aware) exists');
  } else {
    warn('Missing getHeroMotionSpecByHeroDataId');
  }
  
  // Check Selene alias resolution
  if (content.includes('char_selene_ssr') && content.includes('HERO_ID_ALIASES')) {
    success('Selene alias resolution exists (char_selene_ssr)');
  } else {
    warn('Verify Selene alias resolution');
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
