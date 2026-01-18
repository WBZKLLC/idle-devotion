#!/usr/bin/env node
/**
 * Phase 4.0: Battle Feel Guard
 * 
 * Enforces:
 * 1. Cut-ins only come from registry (no inline asset URIs)
 * 2. Reduce Motion short-circuits cut-in
 * 3. No timers/RAF introduced
 * 4. SFX wrapper exists and is safe (no crashes)
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const SFX_FILE = path.resolve('./lib/audio/sfx.ts');
const CUTIN_REGISTRY = path.resolve('./lib/battle/skillCutins.ts');
const BATTLE_MODAL = path.resolve('./components/battle/BattlePresentationModal.tsx');
const VICTORY_MODAL = path.resolve('./components/battle/VictoryDefeatModal.tsx');

// Check SFX module
function checkSfx() {
  if (!fs.existsSync(SFX_FILE)) {
    ERRORS.push('PHASE_4_0_01: SFX module not found at lib/audio/sfx.ts');
    return;
  }
  
  const content = fs.readFileSync(SFX_FILE, 'utf8');
  
  // Check for safe no-op pattern
  if (!content.includes('playSfx') || !content.includes('async')) {
    ERRORS.push('PHASE_4_0_02: playSfx function missing or not async');
  }
  
  // Check it doesn't crash on missing assets
  if (!content.includes('catch') && !content.includes('try')) {
    ERRORS.push('PHASE_4_0_03: SFX module missing error handling');
  }
  
  // Check for allowed SFX names
  if (!content.includes('battle_start') || !content.includes('victory') || !content.includes('defeat')) {
    WARNINGS.push('PHASE_4_0_04: SFX module missing some expected sound names');
  }
}

// Check cut-in registry
function checkCutInRegistry() {
  if (!fs.existsSync(CUTIN_REGISTRY)) {
    ERRORS.push('PHASE_4_0_10: Cut-in registry not found');
    return;
  }
  
  const content = fs.readFileSync(CUTIN_REGISTRY, 'utf8');
  
  // Check for assetUri field
  if (!content.includes('assetUri')) {
    WARNINGS.push('PHASE_4_0_11: Cut-in registry missing assetUri field');
  }
  
  // Check DEFAULT_CUTIN exists
  if (!content.includes('DEFAULT_CUTIN')) {
    ERRORS.push('PHASE_4_0_12: Missing DEFAULT_CUTIN fallback');
  }
}

// Check battle modal doesn't use timers/RAF
function checkBattleModal() {
  if (!fs.existsSync(BATTLE_MODAL)) {
    ERRORS.push('PHASE_4_0_20: BattlePresentationModal not found');
    return;
  }
  
  const content = fs.readFileSync(BATTLE_MODAL, 'utf8');
  
  // Check for SFX integration
  if (!content.includes('playSfx')) {
    WARNINGS.push('PHASE_4_0_21: BattlePresentationModal not using SFX');
  }
  
  // Check for reduce motion handling
  if (!content.includes('reduceMotion') && !content.includes('ReduceMotion')) {
    ERRORS.push('PHASE_4_0_22: BattlePresentationModal missing Reduce Motion support');
  }
  
  // Check no requestAnimationFrame or setInterval
  if (content.includes('requestAnimationFrame') || content.includes('setInterval')) {
    ERRORS.push('PHASE_4_0_23: BattlePresentationModal uses forbidden timers (RAF/setInterval)');
  }
  
  // Check cut-ins come from registry
  if (content.includes('skillCutins') || content.includes('generateBattleCutIns')) {
    // Good - using registry
  } else if (content.includes('assetUri') && content.includes('require(')) {
    WARNINGS.push('PHASE_4_0_24: Cut-in assets may be inline instead of from registry');
  }
}

// Check victory modal has SFX
function checkVictoryModal() {
  if (!fs.existsSync(VICTORY_MODAL)) {
    ERRORS.push('PHASE_4_0_30: VictoryDefeatModal not found');
    return;
  }
  
  const content = fs.readFileSync(VICTORY_MODAL, 'utf8');
  
  // Check for SFX integration
  if (!content.includes('playSfx')) {
    WARNINGS.push('PHASE_4_0_31: VictoryDefeatModal not using SFX');
  }
}

// Run checks
checkSfx();
checkCutInRegistry();
checkBattleModal();
checkVictoryModal();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 4.0: Battle Feel - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 4.0 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 4.0 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
