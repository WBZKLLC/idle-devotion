#!/usr/bin/env node
/**
 * Phase E3: Hero Stage Live Motion Guard
 * 
 * Asserts:
 * - HeroStageLiveMotion.tsx exists
 * - No Math.random usage in hero stage components
 * - No setInterval/requestAnimationFrame usage in hero stage components
 * - Telemetry event names exist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HERO_STAGE_DIR = path.join(__dirname, '..', 'components', 'heroStage');
const EVENTS_PATH = path.join(__dirname, '..', 'lib', 'telemetry', 'events.ts');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasErrors = false;

function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  hasErrors = true;
}

function pass(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

// Check HeroStageLiveMotion.tsx exists
const liveMotionPath = path.join(HERO_STAGE_DIR, 'HeroStageLiveMotion.tsx');
if (!fs.existsSync(liveMotionPath)) {
  fail('HeroStageLiveMotion.tsx not found');
} else {
  pass('HeroStageLiveMotion.tsx exists');
  
  const content = fs.readFileSync(liveMotionPath, 'utf-8');
  
  // Remove comments before checking
  const codeOnly = content
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
    .replace(/\/\/.*$/gm, '');          // Remove line comments
  
  // Check for NO Math.random
  if (codeOnly.includes('Math.random')) {
    fail('HeroStageLiveMotion contains Math.random (must be deterministic)');
  } else {
    pass('HeroStageLiveMotion is deterministic (no Math.random)');
  }
  
  // Check for NO setInterval
  if (codeOnly.includes('setInterval')) {
    fail('HeroStageLiveMotion contains setInterval (not allowed)');
  } else {
    pass('HeroStageLiveMotion has no setInterval');
  }
  
  // Check for NO requestAnimationFrame direct usage
  // (Reanimated's internal use is fine, but explicit RAF calls are not)
  const rafPattern = /(?<!\w)requestAnimationFrame\s*\(/;
  if (rafPattern.test(codeOnly)) {
    fail('HeroStageLiveMotion contains direct requestAnimationFrame call');
  } else {
    pass('HeroStageLiveMotion has no direct requestAnimationFrame');
  }
  
  // Check for reduceMotion prop handling
  if (content.includes('reduceMotion')) {
    pass('HeroStageLiveMotion handles reduceMotion');
  } else {
    fail('HeroStageLiveMotion missing reduceMotion handling');
  }
}

// Check telemetry events exist
if (!fs.existsSync(EVENTS_PATH)) {
  fail('events.ts not found');
} else {
  const eventsContent = fs.readFileSync(EVENTS_PATH, 'utf-8');
  
  const requiredEvents = [
    'HERO_STAGE_VIEWED',
    'HERO_STAGE_MOTION_ENABLED',
    'HERO_STAGE_MOTION_DISABLED'
  ];
  
  const missingEvents = requiredEvents.filter(e => !eventsContent.includes(e));
  if (missingEvents.length === 0) {
    pass('All Phase E3 telemetry events present');
  } else {
    fail(`Missing telemetry events: ${missingEvents.join(', ')}`);
  }
}

console.log('');
if (hasErrors) {
  console.error(`${RED}Phase E3 Hero Stage guard FAILED${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Phase E3 Hero Stage guard PASSED${RESET}`);
  process.exit(0);
}
