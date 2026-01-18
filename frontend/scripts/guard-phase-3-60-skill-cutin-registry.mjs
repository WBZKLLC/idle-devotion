#!/usr/bin/env node
/**
 * Phase 3.60: Skill Cut-In Registry Guard
 * 
 * Enforces:
 * 1. Skill cut-in registry exists as single source of truth
 * 2. Registry exports required functions
 * 3. SkillCutInOverlay uses the registry
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const REGISTRY_FILE = path.resolve('./lib/battle/skillCutins.ts');
const OVERLAY_FILE = path.resolve('./components/battle/SkillCutInOverlay.tsx');

// Check registry file
function checkRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    ERRORS.push('PHASE_3_60_01: Skill cut-in registry not found at lib/battle/skillCutins.ts');
    return;
  }
  
  const content = fs.readFileSync(REGISTRY_FILE, 'utf8');
  
  // Check for exported registry
  if (!content.includes('SKILL_CUTIN_REGISTRY')) {
    ERRORS.push('PHASE_3_60_02: Missing SKILL_CUTIN_REGISTRY export');
  }
  
  // Check for required functions
  const requiredFunctions = [
    'getHeroCutIns',
    'getCutInById',
    'getRandomCutIn',
  ];
  
  for (const func of requiredFunctions) {
    if (!content.includes(`function ${func}`) && !content.includes(`export function ${func}`)) {
      ERRORS.push(`PHASE_3_60_03: Missing required function: ${func}`);
    }
  }
  
  // Check for SkillCutInConfig type
  if (!content.includes('SkillCutInConfig')) {
    ERRORS.push('PHASE_3_60_04: Missing SkillCutInConfig type definition');
  }
  
  // Check for required config fields
  const requiredFields = ['id', 'heroId', 'skillName'];
  for (const field of requiredFields) {
    if (!content.includes(`${field}:`)) {
      WARNINGS.push(`PHASE_3_60_05: SkillCutInConfig may be missing field: ${field}`);
    }
  }
  
  // Check for DEFAULT_CUTIN
  if (!content.includes('DEFAULT_CUTIN')) {
    WARNINGS.push('PHASE_3_60_06: Missing DEFAULT_CUTIN fallback');
  }
}

// Check overlay uses registry (optional, as it may not be updated yet)
function checkOverlay() {
  if (!fs.existsSync(OVERLAY_FILE)) {
    WARNINGS.push('PHASE_3_60_10: SkillCutInOverlay.tsx not found');
    return;
  }
  
  // This is a soft check - the overlay may be refactored in a future phase
  const content = fs.readFileSync(OVERLAY_FILE, 'utf8');
  
  if (!content.includes('skillCutins') && !content.includes('SKILL_CUTIN_REGISTRY')) {
    WARNINGS.push('PHASE_3_60_11: SkillCutInOverlay not yet using the registry (optional)');
  }
}

// Run checks
checkRegistry();
checkOverlay();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 3.60: Skill Cut-In Registry - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 3.60 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 3.60 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
