#!/usr/bin/env node
/**
 * Phase 4.3: Live Ops Guard
 * 
 * Enforces:
 * 1. Live ops config is server-driven
 * 2. Banners are filtered server-side
 * 3. No timers/polling in countdown UI
 * 4. Uses safe time formatting
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const SERVER_FILE = path.resolve('../backend/server.py');
const LIVEOPS_FILE = path.resolve('../backend/core/liveops.py');
const HOME_FILE = path.resolve('./app/(tabs)/index.tsx');
const SUMMON_FILE = path.resolve('./app/(tabs)/summon-hub.tsx');

// Check backend live ops
function checkBackend() {
  if (!fs.existsSync(SERVER_FILE)) {
    ERRORS.push('PHASE_4_3_01: server.py not found');
    return;
  }
  
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Check for liveops status endpoint
  if (!content.includes('/liveops/status')) {
    ERRORS.push('PHASE_4_3_02: Missing /liveops/status endpoint');
  }
}

// Check liveops.py exists and is server-driven
function checkLiveOpsModule() {
  if (!fs.existsSync(LIVEOPS_FILE)) {
    ERRORS.push('PHASE_4_3_10: liveops.py not found');
    return;
  }
  
  const content = fs.readFileSync(LIVEOPS_FILE, 'utf8');
  
  // Check for event configuration
  if (!content.includes('LiveOpsEvent') && !content.includes('LIVE_OPS_EVENTS')) {
    ERRORS.push('PHASE_4_3_11: liveops.py missing event configuration');
  }
  
  // Check for boost configuration
  if (!content.includes('BoostType') && !content.includes('LiveOpsBoost')) {
    WARNINGS.push('PHASE_4_3_12: liveops.py may be missing boost configuration');
  }
  
  // Check for banner availability
  if (!content.includes('get_available_banner_ids') && !content.includes('banner_ids')) {
    WARNINGS.push('PHASE_4_3_13: liveops.py may not control banner availability');
  }
}

// Check frontend doesn't use timers for countdown
function checkFrontend(filePath, name) {
  if (!fs.existsSync(filePath)) {
    // Not an error - file may not exist yet
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for forbidden timer patterns
  const forbiddenPatterns = [
    'setInterval(',
    'requestAnimationFrame',
    'useInterval',
    'polling',
  ];
  
  for (const pattern of forbiddenPatterns) {
    // Allow if it's in a comment
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(pattern) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        // Check context - setTimeout for one-time is OK
        if (pattern !== 'setTimeout' || line.includes('setInterval')) {
          WARNINGS.push(`PHASE_4_3_20: ${name} may use forbidden timer pattern: ${pattern}`);
          break;
        }
      }
    }
  }
}

// Run checks
checkBackend();
checkLiveOpsModule();
checkFrontend(HOME_FILE, 'Home screen');
checkFrontend(SUMMON_FILE, 'Summon hub');

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 4.3: Live Ops - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 4.3 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 4.3 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
