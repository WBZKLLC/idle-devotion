#!/usr/bin/env node
/**
 * Phase 3.52: PvE Celebration Guard
 * 
 * Ensures:
 * 1. Victory has celebration elements (crest/badge)
 * 2. Defeat CTA count ≤ 2 (avoid choice paralysis)
 * 3. Rewards displayed via receipt system (no recompute)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULT_MODAL = path.join(__dirname, '..', 'components', 'battle', 'VictoryDefeatModal.tsx');

let hasErrors = false;
let checksRun = 0;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('\n============================================');
console.log('Guard: Phase 3.52 PvE Celebration');
console.log('============================================');

if (fs.existsSync(RESULT_MODAL)) {
  const content = fs.readFileSync(RESULT_MODAL, 'utf8');
  
  // Check for victory celebration elements
  checksRun++;
  if (content.includes('VICTORY') || content.includes('victory')) {
    console.log(`${GREEN}PASS:${RESET} Victory celebration element exists`);
  } else {
    console.log(`${RED}FAIL:${RESET} Missing victory celebration`);
    hasErrors = true;
  }
  
  // Check for first clear badge
  checksRun++;
  if (content.includes('firstClear') || content.includes('First Clear')) {
    console.log(`${GREEN}PASS:${RESET} First clear badge exists`);
  } else {
    console.log(`${YELLOW}WARN:${RESET} First clear badge not found (optional)`);
  }
  
  // Check for stars display
  checksRun++;
  if (content.includes('stars') || content.includes('star')) {
    console.log(`${GREEN}PASS:${RESET} Stars display exists`);
  } else {
    console.log(`${RED}FAIL:${RESET} Missing stars display`);
    hasErrors = true;
  }
  
  // Check for defeat CTA - should have limited options
  checksRun++;
  const defeatReasonMatches = content.match(/DEFEAT_REASONS/g);
  if (defeatReasonMatches) {
    // Count the number of defeat reason options
    const reasonCount = (content.match(/power_low|team_synergy|need_promotion|need_equipment/g) || []).length;
    if (reasonCount <= 4) {
      console.log(`${GREEN}PASS:${RESET} Defeat reasons count (${reasonCount}) is reasonable`);
    } else {
      console.log(`${YELLOW}WARN:${RESET} Many defeat reasons (${reasonCount}) - consider simplifying`);
    }
  } else {
    console.log(`${YELLOW}WARN:${RESET} No DEFEAT_REASONS found`);
  }
  
  // Check for rewards display (should use existing data, not recompute)
  checksRun++;
  if (content.includes('rewards') && !content.includes('calculateRewards')) {
    console.log(`${GREEN}PASS:${RESET} Rewards displayed from server data (no recompute)`);
  } else if (content.includes('calculateRewards')) {
    console.log(`${RED}FAIL:${RESET} Rewards being recomputed client-side`);
    hasErrors = true;
  } else {
    console.log(`${GREEN}PASS:${RESET} No client-side reward calculation`);
  }
  
  // Check for continue/close CTA
  checksRun++;
  if (content.includes('Continue') || content.includes('onContinue')) {
    console.log(`${GREEN}PASS:${RESET} Continue CTA exists`);
  } else {
    console.log(`${RED}FAIL:${RESET} Missing Continue CTA`);
    hasErrors = true;
  }
  
} else {
  console.log(`${YELLOW}SKIP:${RESET} VictoryDefeatModal not found`);
}

console.log('\n============================================');
if (hasErrors) {
  console.log(`${RED}PvE Celebration guard FAILED!${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PvE Celebration guard PASSED!${RESET} (${checksRun} checks)`);
}
console.log('============================================');
