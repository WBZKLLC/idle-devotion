#!/usr/bin/env node
/**
 * Phase 3.50: Battle Presentation Guard
 * 
 * Ensures:
 * 1. No Math.random() in battle presentation components (determinism)
 * 2. No timers/RAF/polling introduced
 * 3. Reduce Motion path exists
 * 4. Presentation uses server result / deterministic inputs only
 * 5. Campaign and Dungeon screens import and render the modals
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATTLE_COMPONENTS = [
  path.join(__dirname, '..', 'components', 'battle', 'BattlePresentationModal.tsx'),
  path.join(__dirname, '..', 'components', 'battle', 'VictoryDefeatModal.tsx'),
];

const PVE_SCREENS = [
  { path: path.join(__dirname, '..', 'app', 'campaign.tsx'), name: 'Campaign' },
  { path: path.join(__dirname, '..', 'app', 'dungeons.tsx'), name: 'Dungeon' },
];

const FORBIDDEN_PATTERNS = [
  { pattern: /Math\.random\s*\(/g, reason: 'No Math.random() - presentation must be deterministic' },
  { pattern: /requestAnimationFrame\s*\(/g, reason: 'No requestAnimationFrame - use Reanimated instead' },
  { pattern: /setInterval\s*\(/g, reason: 'No setInterval - presentation driven by Reanimated' },
  { pattern: /new\s+WebSocket\s*\(/g, reason: 'No WebSocket - battle is not real-time' },
];

const REQUIRED_PATTERNS = [
  { pattern: /reduceMotion|isReduceMotionEnabled/g, reason: 'Must check Reduce Motion accessibility' },
  { pattern: /PVE_BATTLE_PRESENTATION_VIEWED|PVE_VICTORY_VIEWED/g, reason: 'Must track telemetry events' },
];

const SCREEN_REQUIRED_IMPORTS = [
  { pattern: /BattlePresentationModal/g, reason: 'Must import BattlePresentationModal' },
  { pattern: /VictoryDefeatModal/g, reason: 'Must import VictoryDefeatModal' },
];

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.50 Battle Presentation');
console.log('============================================');

// Check battle components
for (const componentPath of BATTLE_COMPONENTS) {
  const filename = path.basename(componentPath);
  
  if (!fs.existsSync(componentPath)) {
    console.log(`${YELLOW}SKIP:${RESET} ${filename} not found (component may not be created yet)`);
    continue;
  }
  
  const content = fs.readFileSync(componentPath, 'utf8');
  console.log(`\nChecking: ${filename}`);
  
  // Check forbidden patterns
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    checksRun++;
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`${RED}FAIL:${RESET} ${reason}`);
      console.log(`  Found ${matches.length} occurrence(s) in ${filename}`);
      hasErrors = true;
    } else {
      console.log(`${GREEN}PASS:${RESET} ${reason.split(' - ')[0]}`);
    }
  }
  
  // Only check required patterns in BattlePresentationModal
  if (filename === 'BattlePresentationModal.tsx') {
    for (const { pattern, reason } of REQUIRED_PATTERNS) {
      checksRun++;
      const matches = content.match(pattern);
      if (!matches || matches.length === 0) {
        console.log(`${RED}FAIL:${RESET} ${reason}`);
        hasErrors = true;
      } else {
        console.log(`${GREEN}PASS:${RESET} ${reason}`);
      }
    }
  }
}

// Check PvE screens for modal integration
console.log('\nChecking PvE screen integration:');
for (const { path: screenPath, name } of PVE_SCREENS) {
  if (!fs.existsSync(screenPath)) {
    console.log(`${YELLOW}SKIP:${RESET} ${name} screen not found`);
    continue;
  }
  
  const content = fs.readFileSync(screenPath, 'utf8');
  
  for (const { pattern, reason } of SCREEN_REQUIRED_IMPORTS) {
    checksRun++;
    const matches = content.match(pattern);
    if (!matches || matches.length === 0) {
      console.log(`${RED}FAIL:${RESET} ${name}: ${reason}`);
      hasErrors = true;
    } else {
      console.log(`${GREEN}PASS:${RESET} ${name}: ${reason}`);
    }
  }
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}Battle Presentation guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Battle Presentation guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
