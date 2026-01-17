#!/usr/bin/env node
// /app/frontend/scripts/guard-phase-3-22-closure.mjs
// Phase 3.22 Closure Guard
//
// Verifies Phase 3.22 (Sanctuary Home) requirements are locked:
// 1. Rail behavior: Doors toggle only; Library icon opens DoorsSheet; NO timers/auto-collapse
// 2. AtmosphereStack: pointerEvents="none"; Reduce Motion respected
// 3. No polling timers in badges (event-driven only)
//
// "Sanctuary Home is stable - no regressions."

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

// =============================================================================
// 1. Rail Behavior Contract
// =============================================================================
function checkRailBehavior() {
  console.log('\n--- Phase 3.22.12: Rail Behavior Contract ---');
  
  const railPath = path.join(ROOT, 'components', 'home', 'HomeSideRail.tsx');
  if (!fs.existsSync(railPath)) {
    error('HomeSideRail.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(railPath, 'utf-8');
  
  // Check: NO auto-collapse timers
  if (content.includes('setTimeout') && content.match(/setTimeout.*collapse|auto.*collapse.*setTimeout/i)) {
    error('Rail contains auto-collapse timer - violates "manual tool only" contract');
  } else {
    success('Rail has no auto-collapse timers');
  }
  
  // Check: NO setInterval
  if (content.includes('setInterval')) {
    error('Rail contains setInterval - should be manual-only');
  } else {
    success('Rail has no polling intervals');
  }
  
  // Check: Doors button only toggles rail (doesn't open DoorsSheet directly)
  if (content.includes('handleDoorsToggle') && !content.match(/handleDoorsToggle.*onPressDoors/)) {
    success('Doors button toggles rail (not DoorsSheet)');
  } else {
    // Verify the toggle behavior
    const hasToggleOnly = content.includes('// ONLY toggles rail') || 
                          content.includes('Toggle only') ||
                          content.includes('toggles rail');
    if (hasToggleOnly) {
      success('Doors toggle behavior documented');
    } else {
      warn('Verify Doors button only toggles rail expansion');
    }
  }
  
  // Check: Library icon (apps) opens DoorsSheet
  if (content.includes("icon: 'apps'") && content.includes('onPressDoors')) {
    success('Library icon (apps) wired to open DoorsSheet');
  } else {
    warn('Verify Library icon opens DoorsSheet');
  }
  
  // Check: Backdrop collapse on tap outside
  if (content.includes('Pressable') && content.includes('collapse')) {
    success('Backdrop tap-to-collapse implemented');
  } else {
    warn('Verify tap-outside-to-collapse behavior');
  }
}

// =============================================================================
// 2. AtmosphereStack Contract
// =============================================================================
function checkAtmosphereStack() {
  console.log('\n--- Phase 3.22.12: AtmosphereStack Contract ---');
  
  const stackPath = path.join(ROOT, 'components', 'home', 'AtmosphereStack.tsx');
  if (!fs.existsSync(stackPath)) {
    error('AtmosphereStack.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(stackPath, 'utf-8');
  
  // Check: pointerEvents="none" on root
  if (content.includes('pointerEvents="none"') || content.includes("pointerEvents='none'")) {
    success('AtmosphereStack has pointerEvents="none"');
  } else {
    error('AtmosphereStack missing pointerEvents="none" - will block touches');
  }
  
  // Check: Reduce Motion respected
  if (content.includes('isReduceMotionEnabled') || content.includes('reduceMotionChanged')) {
    success('AtmosphereStack respects Reduce Motion');
  } else {
    error('AtmosphereStack does not check Reduce Motion accessibility setting');
  }
  
  // Check: Animation stops when reduceMotion is true
  if (content.includes('reduceMotion') && content.match(/if.*reduceMotion|reduceMotion.*return/)) {
    success('Animations disabled when Reduce Motion enabled');
  } else {
    warn('Verify animations are disabled with Reduce Motion');
  }
  
  // Check: Opacity budget (vignette should not be crushing)
  // Vignette corners should be <= 0.3 opacity
  const vignetteMatch = content.match(/rgba\(8,12,20,(0\.\d+)\)/g);
  if (vignetteMatch) {
    const opacities = vignetteMatch.map(m => {
      const match = m.match(/(0\.\d+)/);
      return match ? parseFloat(match[1]) : 0;
    });
    const maxVignetteOpacity = Math.max(...opacities);
    if (maxVignetteOpacity <= 0.35) {
      success(`Vignette opacity budget OK (max: ${maxVignetteOpacity})`);
    } else {
      error(`Vignette opacity too high (${maxVignetteOpacity}) - will "crush" the scene`);
    }
  }
}

// =============================================================================
// 3. Badges Event-Driven (No Polling)
// =============================================================================
function checkBadgesNoPoll() {
  console.log('\n--- Phase 3.22/3.23: Badges Event-Driven ---');
  
  const badgesPath = path.join(ROOT, 'lib', 'ui', 'badges.ts');
  if (!fs.existsSync(badgesPath)) {
    error('lib/ui/badges.ts not found');
    return;
  }
  
  const content = fs.readFileSync(badgesPath, 'utf-8');
  
  // Check: NO setInterval
  if (content.includes('setInterval')) {
    error('Badges contain setInterval - should be event-driven only');
  } else {
    success('Badges have no polling intervals');
  }
  
  // Check: Has triggerBadgeRefresh (manual refresh)
  if (content.includes('triggerBadgeRefresh')) {
    success('Manual triggerBadgeRefresh() available');
  } else {
    warn('Missing triggerBadgeRefresh for manual badge updates');
  }
  
  // Check: Refreshes on app foreground (event-driven)
  if (content.includes('AppState') && content.includes('active')) {
    success('Badges refresh on app foreground (event-driven)');
  } else {
    warn('Verify badges refresh on app foreground');
  }
  
  // Check: Events badge defaults to false/undefined (no always-lit)
  const hasNoAlwaysLit = content.includes('events: undefined') || content.includes('events: false');
  const hasAlwaysTrue = content.match(/events:\s*true(?!\s*\?)/);  // Avoid matching ternary
  
  if (hasNoAlwaysLit && !hasAlwaysTrue) {
    success('Events badge defaults to undefined (no always-lit)');
  } else if (hasAlwaysTrue) {
    error('Events badge may be always-lit - breaks sanctuary vibe');
  } else {
    warn('Verify events badge is not always-lit');
  }
}

// =============================================================================
// Run all checks
// =============================================================================
console.log('='.repeat(60));
console.log('Phase 3.22 Closure Guard');
console.log('='.repeat(60));

checkRailBehavior();
checkAtmosphereStack();
checkBadgesNoPoll();

// Summary
console.log('\n' + '='.repeat(60));
if (exitCode === 0 && warnings === 0) {
  console.log(`${GREEN}Phase 3.22 closure checks PASSED!${RESET}`);
} else if (exitCode === 0) {
  console.log(`${YELLOW}Phase 3.22 passed with ${warnings} warning(s)${RESET}`);
} else {
  console.log(`${RED}Phase 3.22 closure guard FAILED${RESET}`);
}
console.log('='.repeat(60));

process.exit(exitCode);
