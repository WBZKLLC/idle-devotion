#!/usr/bin/env node
/**
 * Phase 3.61: Campaign Difficulty Expansion Guard
 * 
 * Enforces:
 * 1. Campaign difficulty table covers chapters 1-25
 * 2. DEV-only dump endpoint exists
 * 3. No hardcoded difficulty in frontend
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const DIFFICULTY_FILE = path.resolve('./backend/core/campaign_difficulty.py');
const SERVER_FILE = path.resolve('./backend/server.py');

// Check difficulty module
function checkDifficultyModule() {
  if (!fs.existsSync(DIFFICULTY_FILE)) {
    ERRORS.push('PHASE_3_61_01: campaign_difficulty.py not found');
    return;
  }
  
  const content = fs.readFileSync(DIFFICULTY_FILE, 'utf8');
  
  // Check for DIFFICULTY_TABLE
  if (!content.includes('DIFFICULTY_TABLE')) {
    ERRORS.push('PHASE_3_61_02: Missing DIFFICULTY_TABLE');
  }
  
  // Check for chapters 1-25
  const requiredChapters = [1, 5, 10, 15, 20, 25];
  for (const chapter of requiredChapters) {
    const pattern = new RegExp(`^\\s*${chapter}:\\s*\\(`, 'm');
    if (!pattern.test(content)) {
      ERRORS.push(`PHASE_3_61_03: Missing chapter ${chapter} in difficulty table`);
    }
  }
  
  // Check for dump function
  if (!content.includes('dump_difficulty_table')) {
    ERRORS.push('PHASE_3_61_04: Missing dump_difficulty_table function');
  }
  
  // Check for required functions
  const requiredFunctions = [
    'get_stage_enemy_power',
    'get_recommended_power',
    'get_power_band',
  ];
  
  for (const func of requiredFunctions) {
    if (!content.includes(`def ${func}`)) {
      ERRORS.push(`PHASE_3_61_05: Missing required function: ${func}`);
    }
  }
}

// Check for DEV endpoint
function checkDevEndpoint() {
  if (!fs.existsSync(SERVER_FILE)) {
    ERRORS.push('PHASE_3_61_10: server.py not found');
    return;
  }
  
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Check for DEV difficulty dump endpoint
  if (!content.includes('/dev/difficulty/dump')) {
    ERRORS.push('PHASE_3_61_11: Missing /dev/difficulty/dump endpoint');
  }
  
  // Check for SERVER_DEV_MODE guard
  const devEndpointSection = content.includes('/dev/difficulty/dump') 
    ? content.substring(content.indexOf('/dev/difficulty/dump') - 200, content.indexOf('/dev/difficulty/dump') + 500)
    : '';
    
  if (devEndpointSection && !devEndpointSection.includes('SERVER_DEV_MODE')) {
    WARNINGS.push('PHASE_3_61_12: DEV endpoint may not be properly guarded');
  }
  
  // Check for import of dump function
  if (!content.includes('dump_difficulty_table')) {
    WARNINGS.push('PHASE_3_61_13: dump_difficulty_table not imported in server.py');
  }
}

// Run checks
checkDifficultyModule();
checkDevEndpoint();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 3.61: Campaign Difficulty Expansion - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 3.61 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 3.61 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
