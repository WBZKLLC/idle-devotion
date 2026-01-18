#!/usr/bin/env node
/**
 * Phase 3.59: PvP Match Execution Guard
 * 
 * Enforces:
 * 1. PvP match endpoint exists and uses sourceId for idempotency
 * 2. Arena opponents endpoint exists with NPC fallback
 * 3. No monetization in PvP match flow
 * 4. Server-side deterministic resolution
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const SERVER_FILE = path.resolve('../backend/server.py');
const ARENA_FILE = path.resolve('./app/(tabs)/arena.tsx');
const API_FILE = path.resolve('./lib/api.ts');

// Check server.py for PvP endpoints
function checkBackendPvP() {
  if (!fs.existsSync(SERVER_FILE)) {
    ERRORS.push('PHASE_3_59_01: server.py not found');
    return;
  }
  
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Check for /api/arena/opponents endpoint
  if (!content.includes('/arena/opponents/')) {
    ERRORS.push('PHASE_3_59_02: Missing /api/arena/opponents endpoint');
  }
  
  // Check for NPC fallback
  if (!content.includes('isNpc') || !content.includes('npc_')) {
    ERRORS.push('PHASE_3_59_03: Missing NPC fallback in arena opponents');
  }
  
  // Check for /api/pvp/match endpoint
  if (!content.includes('/pvp/match')) {
    ERRORS.push('PHASE_3_59_04: Missing /api/pvp/match endpoint');
  }
  
  // Check for sourceId idempotency
  if (!content.includes('source_id')) {
    ERRORS.push('PHASE_3_59_05: Missing sourceId for idempotency in PvP match');
  }
  
  // Check for server-side combat resolution
  if (content.includes('/pvp/match')) {
    const startIdx = content.indexOf('/pvp/match');
    const pvpMatchSection = content.substring(startIdx, startIdx + 6000);
    
    if (!pvpMatchSection.includes('victory')) {
      ERRORS.push('PHASE_3_59_06: PvP match missing server-side victory determination');
    }
    
    // No monetization in PvP
    if (pvpMatchSection.includes('purchase') || pvpMatchSection.includes('buy_')) {
      ERRORS.push('PHASE_3_59_07: Monetization detected in PvP match endpoint');
    }
  }
}

// Check frontend arena.tsx
function checkFrontendArena() {
  if (!fs.existsSync(ARENA_FILE)) {
    ERRORS.push('PHASE_3_59_10: arena.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(ARENA_FILE, 'utf8');
  
  // Check for new PvP match API usage
  if (!content.includes('executePvPMatch')) {
    WARNINGS.push('PHASE_3_59_11: Arena not using new executePvPMatch API');
  }
  
  // Check for sourceId generation
  if (!content.includes('makeSourceId') && !content.includes('generateSourceId')) {
    WARNINGS.push('PHASE_3_59_12: Arena not generating sourceId for idempotency');
  }
  
  // Check for battle presentation modal
  if (!content.includes('BattlePresentationModal')) {
    WARNINGS.push('PHASE_3_59_13: Arena not using BattlePresentationModal');
  }
}

// Check API file
function checkAPI() {
  if (!fs.existsSync(API_FILE)) {
    ERRORS.push('PHASE_3_59_20: api.ts not found');
    return;
  }
  
  const content = fs.readFileSync(API_FILE, 'utf8');
  
  // Check for executePvPMatch function
  if (!content.includes('executePvPMatch')) {
    ERRORS.push('PHASE_3_59_21: Missing executePvPMatch function in api.ts');
  }
  
  // Check for source_id in PvP call
  if (content.includes('executePvPMatch') && !content.includes('source_id')) {
    ERRORS.push('PHASE_3_59_22: executePvPMatch missing source_id parameter');
  }
}

// Run checks
checkBackendPvP();
checkFrontendArena();
checkAPI();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 3.59: PvP Match Execution - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 3.59 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 3.59 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
