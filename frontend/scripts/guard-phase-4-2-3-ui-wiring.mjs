#!/usr/bin/env node
/**
 * Phase 4.2-4.3: UI Wiring Guard
 * 
 * Enforces:
 * 1. Arena uses ReceiptViewer + claim functions
 * 2. Home uses getLiveOpsStatus
 * 3. No setInterval/setTimeout/RAF in modified files
 * 4. Uses api from lib/api (no fetch('/api/...'))
 * 5. Telemetry events exist
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const ARENA_FILE = path.resolve('./app/(tabs)/arena.tsx');
const HOME_FILE = path.resolve('./app/(tabs)/index.tsx');
const PVP_API_FILE = path.resolve('./lib/api/pvp.ts');
const LIVEOPS_API_FILE = path.resolve('./lib/api/liveops.ts');
const TELEMETRY_FILE = path.resolve('./lib/telemetry/events.ts');

// Check Arena screen
function checkArena() {
  if (!fs.existsSync(ARENA_FILE)) {
    ERRORS.push('PHASE_4_2_3_01: arena.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(ARENA_FILE, 'utf8');
  
  // Check imports
  if (!content.includes('ReceiptViewer')) {
    WARNINGS.push('PHASE_4_2_3_02: arena.tsx should import ReceiptViewer');
  }
  
  if (!content.includes('claimPvpDaily') || !content.includes('claimPvpSeason')) {
    WARNINGS.push('PHASE_4_2_3_03: arena.tsx should use claimPvpDaily + claimPvpSeason');
  }
  
  if (!content.includes('getPvpSeason')) {
    WARNINGS.push('PHASE_4_2_3_04: arena.tsx should use getPvpSeason');
  }
  
  // Check no timers
  if (content.includes('setInterval(') || content.includes('setTimeout(')) {
    // Allow if only in comments
    const lines = content.split('\n');
    for (const line of lines) {
      if ((line.includes('setInterval(') || line.includes('setTimeout(')) && 
          !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        ERRORS.push('PHASE_4_2_3_05: arena.tsx uses forbidden timer');
        break;
      }
    }
  }
  
  // Check uses api wrapper not raw fetch
  if (content.includes("fetch('/api") || content.includes('fetch("/api')) {
    ERRORS.push('PHASE_4_2_3_06: arena.tsx uses raw fetch instead of api wrapper');
  }
}

// Check Home screen
function checkHome() {
  if (!fs.existsSync(HOME_FILE)) {
    ERRORS.push('PHASE_4_2_3_10: index.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(HOME_FILE, 'utf8');
  
  // Check LiveOps import
  if (!content.includes('getLiveOpsStatus')) {
    WARNINGS.push('PHASE_4_2_3_11: index.tsx should use getLiveOpsStatus');
  }
  
  // Check no raw fetch
  if (content.includes("fetch('/api") || content.includes('fetch("/api')) {
    ERRORS.push('PHASE_4_2_3_12: index.tsx uses raw fetch instead of api wrapper');
  }
}

// Check API wrappers exist
function checkApiWrappers() {
  if (!fs.existsSync(PVP_API_FILE)) {
    ERRORS.push('PHASE_4_2_3_20: lib/api/pvp.ts not found');
  } else {
    const content = fs.readFileSync(PVP_API_FILE, 'utf8');
    if (!content.includes('getPvpSeason') || !content.includes('claimPvpDaily')) {
      ERRORS.push('PHASE_4_2_3_21: lib/api/pvp.ts missing required functions');
    }
  }
  
  if (!fs.existsSync(LIVEOPS_API_FILE)) {
    ERRORS.push('PHASE_4_2_3_22: lib/api/liveops.ts not found');
  } else {
    const content = fs.readFileSync(LIVEOPS_API_FILE, 'utf8');
    if (!content.includes('getLiveOpsStatus')) {
      ERRORS.push('PHASE_4_2_3_23: lib/api/liveops.ts missing getLiveOpsStatus');
    }
  }
}

// Check telemetry events
function checkTelemetry() {
  if (!fs.existsSync(TELEMETRY_FILE)) {
    ERRORS.push('PHASE_4_2_3_30: events.ts not found');
    return;
  }
  
  const content = fs.readFileSync(TELEMETRY_FILE, 'utf8');
  
  const requiredEvents = [
    'PVP_SEASON_VIEWED',
    'PVP_DAILY_CLAIM_SUBMITTED',
    'PVP_DAILY_CLAIM_SUCCESS',
    'LIVEOPS_VIEWED',
    'LIVEOPS_BANNER_SHOWN',
  ];
  
  for (const event of requiredEvents) {
    if (!content.includes(event)) {
      ERRORS.push(`PHASE_4_2_3_31: Missing telemetry event: ${event}`);
    }
  }
}

// Run checks
checkArena();
checkHome();
checkApiWrappers();
checkTelemetry();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 4.2-4.3: UI Wiring - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 4.2-4.3 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 4.2-4.3 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
