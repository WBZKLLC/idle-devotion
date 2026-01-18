#!/usr/bin/env node
/**
 * Phase 4.2: PvP Depth Guard
 * 
 * Enforces:
 * 1. No shop navigation from PvP
 * 2. No VIP stat buffs or paid advantage
 * 3. Rewards are cosmetics/currency only
 * 4. Season and daily claim endpoints exist
 */

import fs from 'fs';
import path from 'path';

const ERRORS = [];
const WARNINGS = [];

// Files to check
const SERVER_FILE = path.resolve('../backend/server.py');
const PVP_SEASONS_FILE = path.resolve('../backend/core/pvp_seasons.py');
const ARENA_FILE = path.resolve('./app/(tabs)/arena.tsx');

// Check backend PvP endpoints
function checkBackend() {
  if (!fs.existsSync(SERVER_FILE)) {
    ERRORS.push('PHASE_4_2_01: server.py not found');
    return;
  }
  
  const content = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Check for season endpoint
  if (!content.includes('/pvp/season')) {
    ERRORS.push('PHASE_4_2_02: Missing /pvp/season endpoint');
  }
  
  // Check for rewards preview endpoint
  if (!content.includes('/pvp/rewards/preview')) {
    ERRORS.push('PHASE_4_2_03: Missing /pvp/rewards/preview endpoint');
  }
  
  // Check for daily claim endpoint
  if (!content.includes('/pvp/daily/claim')) {
    ERRORS.push('PHASE_4_2_04: Missing /pvp/daily/claim endpoint');
  }
  
  // Check for season claim endpoint
  if (!content.includes('/pvp/season/claim')) {
    ERRORS.push('PHASE_4_2_05: Missing /pvp/season/claim endpoint');
  }
}

// Check pvp_seasons.py for ethics compliance
function checkPvpSeasons() {
  if (!fs.existsSync(PVP_SEASONS_FILE)) {
    ERRORS.push('PHASE_4_2_10: pvp_seasons.py not found');
    return;
  }
  
  const content = fs.readFileSync(PVP_SEASONS_FILE, 'utf8');
  
  // Check no stat boosts in rewards
  const forbiddenRewards = ['attack', 'defense', 'hp_boost', 'atk_buff', 'def_buff', 'power_boost'];
  for (const forbidden of forbiddenRewards) {
    if (content.toLowerCase().includes(forbidden) && content.includes('rewards')) {
      ERRORS.push(`PHASE_4_2_11: PvP rewards may include stat boosts: ${forbidden}`);
    }
  }
  
  // Check rewards are currency/cosmetics
  const validRewards = ['pvp_medals', 'gold', 'crystals', 'title', 'frame'];
  const hasValidRewards = validRewards.some(r => content.includes(r));
  if (!hasValidRewards) {
    WARNINGS.push('PHASE_4_2_12: PvP rewards may not include expected currency/cosmetics');
  }
}

// Check arena.tsx for no shop links
function checkArena() {
  if (!fs.existsSync(ARENA_FILE)) {
    ERRORS.push('PHASE_4_2_20: arena.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(ARENA_FILE, 'utf8');
  
  // Check no shop navigation
  const shopPatterns = [
    "router.push('/shop'",
    "router.push('shop'",
    'href="/shop"',
    'to="/shop"',
    "navigate('shop'",
  ];
  
  for (const pattern of shopPatterns) {
    if (content.includes(pattern)) {
      ERRORS.push(`PHASE_4_2_21: Arena contains shop navigation: ${pattern}`);
    }
  }
  
  // Check for VIP stat advantages
  const vipStatPatterns = ['vip_power', 'vip_attack', 'vip_damage', 'vip_boost'];
  for (const pattern of vipStatPatterns) {
    if (content.toLowerCase().includes(pattern)) {
      ERRORS.push(`PHASE_4_2_22: Arena may have VIP stat advantage: ${pattern}`);
    }
  }
}

// Run checks
checkBackend();
checkPvpSeasons();
checkArena();

// Report results
if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ Phase 4.2: PvP Depth - All checks passed');
  process.exit(0);
} else {
  if (WARNINGS.length > 0) {
    console.log('⚠️ Phase 4.2 Warnings:');
    WARNINGS.forEach(w => console.log(`  - ${w}`));
  }
  if (ERRORS.length > 0) {
    console.log('❌ Phase 4.2 Errors:');
    ERRORS.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}
