#!/usr/bin/env node
/**
 * Phase 3.27: Hero Stage Intimacy v2 Guard
 *
 * Validates:
 * - Camera drift params exist and are tier-gated
 * - useHeroCameraDrift hook exists
 * - No timers/RAF in drift code
 * - Telemetry events for hero stage
 */

import fs from 'fs';
import path from 'path';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

let exitCode = 0;
let warnings = 0;

function check(condition, message, warning = false) {
  if (condition) {
    console.log(`${PASS} ${message}`);
    return true;
  } else if (warning) {
    console.log(`${WARN} ${message}`);
    warnings++;
    return true;
  } else {
    console.log(`${FAIL} ${message}`);
    exitCode = 1;
    return false;
  }
}

console.log('============================================================');
console.log('Phase 3.27: Hero Stage Intimacy v2 Guard');
console.log('============================================================\n');

// Read motion.ts
const motionPath = path.join(process.cwd(), 'lib/hero/motion.ts');
const motionContent = fs.readFileSync(motionPath, 'utf8');

// Read hero screen
const heroPath = path.join(process.cwd(), 'app/hero/[id].tsx');
const heroContent = fs.readFileSync(heroPath, 'utf8');

// Read telemetry events
const eventsPath = path.join(process.cwd(), 'lib/telemetry/events.ts');
const eventsContent = fs.readFileSync(eventsPath, 'utf8');

console.log('--- Camera Drift System ---\n');

// Check camera drift params exist
check(
  motionContent.includes('CAMERA_DRIFT_PARAMS'),
  'CAMERA_DRIFT_PARAMS table exists'
);

// Check useHeroCameraDrift hook exists
check(
  motionContent.includes('useHeroCameraDrift'),
  'useHeroCameraDrift hook exists'
);

// Check tier gating for drift (intimate tier only in inspect mode)
check(
  motionContent.includes('tier >= 4') && motionContent.includes('isInspectMode'),
  'Camera drift is tier-gated (intimate tier in inspect mode only)'
);

// Check no timers in motion file (excluding comments)
const nonCommentContent = motionContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hasTimers = /setTimeout|setInterval|requestAnimationFrame/.test(nonCommentContent);
check(
  !hasTimers,
  'No timers/RAF in motion.ts (Reanimated-only)'
);

console.log('\n--- Hero Screen Integration ---\n');

// Check hero screen uses camera drift
check(
  heroContent.includes('useHeroCameraDrift'),
  'Hero screen uses useHeroCameraDrift hook'
);

// Check hero screen has inspect mode
check(
  heroContent.includes('isInspectMode'),
  'Hero screen has inspect mode state'
);

// Check telemetry integration
check(
  heroContent.includes('HERO_STAGE_VIEWED'),
  'Hero screen emits HERO_STAGE_VIEWED telemetry'
);

check(
  heroContent.includes('HERO_STAGE_CAMERA_MODE_RESOLVED'),
  'Hero screen emits HERO_STAGE_CAMERA_MODE_RESOLVED telemetry'
);

console.log('\n--- Telemetry Events ---\n');

// Check telemetry events defined
check(
  eventsContent.includes('HERO_STAGE_VIEWED'),
  'HERO_STAGE_VIEWED event defined'
);

check(
  eventsContent.includes('HERO_STAGE_INSPECT_TOGGLED'),
  'HERO_STAGE_INSPECT_TOGGLED event defined'
);

check(
  eventsContent.includes('HERO_STAGE_CAMERA_MODE_RESOLVED'),
  'HERO_STAGE_CAMERA_MODE_RESOLVED event defined'
);

console.log('\n--- Reduce Motion Support ---\n');

// Check reduce motion in drift
check(
  motionContent.includes('reduceMotion') && motionContent.includes('useHeroCameraDrift'),
  'Camera drift respects Reduce Motion preference'
);

console.log('\n============================================================');
if (exitCode === 0) {
  if (warnings > 0) {
    console.log(`\x1b[33mPhase 3.27 passed with ${warnings} warning(s)\x1b[0m`);
  } else {
    console.log('\x1b[32mPhase 3.27 guard PASSED!\x1b[0m');
  }
} else {
  console.log('\x1b[31mPhase 3.27 guard FAILED!\x1b[0m');
}
console.log('============================================================');

process.exit(exitCode);
