#!/usr/bin/env node
// /app/frontend/scripts/guard-phase-3-23-closure.mjs
// Phase 3.23 Closure Guard
//
// Verifies Phase 3.23 (Social + Mail + Friends) requirements are locked:
// 1. Mail/Friends screens exist with proper tabs
// 2. Backend derives identity from auth token (not URL param)
// 3. Debounce + cancellation on search
// 4. Idempotent accept/decline
// 5. Desire Engine cleanup (no leaking timers)
//
// "Social systems are stable, secure, and sanctuary-styled."

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const BACKEND_ROOT = path.join(ROOT, '..', 'backend');

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
// 1. Mail/Friends Screens Exist
// =============================================================================
function checkScreensExist() {
  console.log('\n--- Phase 3.23.3-4: Social Screens ---');
  
  const mailPath = path.join(ROOT, 'app', 'mail.tsx');
  const friendsPath = path.join(ROOT, 'app', 'friends.tsx');
  
  if (fs.existsSync(mailPath)) {
    const mailContent = fs.readFileSync(mailPath, 'utf-8');
    
    // Check for tabs
    if (mailContent.includes('Rewards') && mailContent.includes('Messages') && mailContent.includes('Gifts')) {
      success('Mail screen has Rewards/Messages/Gifts tabs');
    } else {
      warn('Mail screen may be missing expected tabs');
    }
    
    // Check for receipt consumption (Phase 3.24)
    if (mailContent.includes('RewardReceipt') || mailContent.includes('formatReceiptItems')) {
      success('Mail screen uses canonical receipt type');
    } else {
      warn('Mail screen may not use canonical receipt type');
    }
  } else {
    error('Mail screen (app/mail.tsx) not found');
  }
  
  if (fs.existsSync(friendsPath)) {
    const friendsContent = fs.readFileSync(friendsPath, 'utf-8');
    
    // Check for tabs
    if (friendsContent.includes('Requests') && friendsContent.includes('Friends') && friendsContent.includes('Search')) {
      success('Friends screen has Requests/Friends/Search tabs');
    } else {
      warn('Friends screen may be missing expected tabs');
    }
    
    // Check for debounce
    if (friendsContent.includes('debounce') || friendsContent.includes('setTimeout') && friendsContent.includes('search')) {
      success('Friends search has debounce');
    } else {
      warn('Friends search may not have debounce');
    }
  } else {
    error('Friends screen (app/friends.tsx) not found');
  }
}

// =============================================================================
// 2. Backend Auth-Token Identity
// =============================================================================
function checkBackendAuthIdentity() {
  console.log('\n--- Phase 3.23.2: Auth-Token Identity ---');
  
  const serverPath = path.join(BACKEND_ROOT, 'server.py');
  if (!fs.existsSync(serverPath)) {
    warn('server.py not found, skipping backend auth checks');
    return;
  }
  
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  // Check mail endpoints use auth
  const mailEndpoints = [
    'get_mail_summary',
    'get_mail_rewards',
    'get_mail_messages',
    'get_mail_gifts',
    'claim_mail_reward',
    'claim_mail_gift',
  ];
  
  let authCount = 0;
  for (const endpoint of mailEndpoints) {
    const fnStart = content.indexOf(`async def ${endpoint}`);
    if (fnStart !== -1) {
      const fnContent = content.substring(fnStart, fnStart + 500);
      if (fnContent.includes('authenticate_request') || fnContent.includes('credentials')) {
        authCount++;
      }
    }
  }
  
  if (authCount >= 4) {
    success(`Mail endpoints use auth token (${authCount}/${mailEndpoints.length})`);
  } else {
    error(`Only ${authCount}/${mailEndpoints.length} mail endpoints use auth token`);
  }
  
  // Check friends endpoints use auth
  const friendsEndpoints = [
    'get_friends_summary',
    'get_friend_requests',
    'get_friends_list',
    'accept_friend_request',
    'decline_friend_request',
  ];
  
  let friendsAuthCount = 0;
  for (const endpoint of friendsEndpoints) {
    const fnStart = content.indexOf(`async def ${endpoint}`);
    if (fnStart !== -1) {
      const fnContent = content.substring(fnStart, fnStart + 500);
      if (fnContent.includes('authenticate_request') || fnContent.includes('credentials')) {
        friendsAuthCount++;
      }
    }
  }
  
  if (friendsAuthCount >= 3) {
    success(`Friends endpoints use auth token (${friendsAuthCount}/${friendsEndpoints.length})`);
  } else {
    warn(`Only ${friendsAuthCount}/${friendsEndpoints.length} friends endpoints use auth token`);
  }
  
  // Check legacy routes ignore username param
  if (content.includes('Legacy route') && content.includes('ignores username')) {
    success('Legacy routes document that username param is ignored');
  } else {
    warn('Verify legacy routes ignore username param');
  }
}

// =============================================================================
// 3. Idempotent Accept/Decline
// =============================================================================
function checkIdempotency() {
  console.log('\n--- Phase 3.23.4: Idempotent Operations ---');
  
  const serverPath = path.join(BACKEND_ROOT, 'server.py');
  if (!fs.existsSync(serverPath)) {
    warn('server.py not found, skipping idempotency checks');
    return;
  }
  
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  // Check accept/decline endpoints check for already-processed state
  const acceptStart = content.indexOf('async def accept_friend_request');
  if (acceptStart !== -1) {
    const fnContent = content.substring(acceptStart, acceptStart + 1000);
    if (fnContent.includes('already') || fnContent.includes('status') || fnContent.includes('accepted')) {
      success('Accept friend request has idempotency check');
    } else {
      warn('Accept friend request may not be idempotent');
    }
  }
  
  // Check mail claims are idempotent
  if (content.includes('alreadyClaimed') || content.includes('already_claimed')) {
    success('Claim endpoints return alreadyClaimed flag');
  } else {
    warn('Claim endpoints may not indicate already-claimed state');
  }
}

// =============================================================================
// 4. Desire Engine Cleanup
// =============================================================================
function checkDesireEngineCleanup() {
  console.log('\n--- Phase 3.23.5: Desire Engine Cleanup ---');
  
  const homeIndexPath = path.join(ROOT, 'app', '(tabs)', 'index.tsx');
  if (!fs.existsSync(homeIndexPath)) {
    warn('Home index.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(homeIndexPath, 'utf-8');
  
  // Check for interval refs
  const hasTimerRef = content.includes('timerRef') || content.includes('intervalRef');
  const hasCooldownRef = content.includes('cooldownRef');
  
  // Check for cleanup in useEffect return
  const hasCleanup = content.includes('clearInterval(timerRef') || 
                     content.includes('clearInterval(cooldownRef') ||
                     content.includes('return () =>');
  
  if (hasTimerRef && hasCleanup) {
    success('Home timers have cleanup handlers');
  } else if (hasTimerRef && !hasCleanup) {
    error('Home has timers without proper cleanup');
  } else {
    success('No timer cleanup issues detected');
  }
  
  // Check IdleRewardsCard cleanup
  const idleCardPath = path.join(ROOT, 'components', 'home', 'IdleRewardsCard.tsx');
  if (fs.existsSync(idleCardPath)) {
    const idleContent = fs.readFileSync(idleCardPath, 'utf-8');
    
    if (idleContent.includes('setTimeout') && idleContent.includes('clearTimeout')) {
      success('IdleRewardsCard has timeout cleanup');
    } else if (idleContent.includes('setTimeout')) {
      warn('IdleRewardsCard may have uncleaned timeouts');
    }
  }
  
  // Check for duplicate subscriber prevention
  if (content.includes('isMounted') || content.includes('useRef') && content.includes('subscription')) {
    success('Subscription cleanup pattern detected');
  }
}

// =============================================================================
// 5. Chromatic Consistency (no scattered color literals)
// =============================================================================
function checkChromaticConsistency() {
  console.log('\n--- Phase 3.23.6-8: Chromatic Consistency ---');
  
  const filesToCheck = [
    'app/mail.tsx',
    'app/friends.tsx',
    'components/home/AtmosphereStack.tsx',
    'components/home/HomeSideRail.tsx',
  ];
  
  let scatteredColors = 0;
  
  for (const file of filesToCheck) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for raw hex colors outside of rgba (which are sometimes needed for gradients)
    const hexMatches = content.match(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g);
    if (hexMatches) {
      // Filter out ones that are used with COLORS (e.g., COLORS.navy.dark + 'E8')
      const scattered = hexMatches.filter(hex => {
        // Check if it's near a COLORS reference
        const idx = content.indexOf(hex);
        const context = content.substring(Math.max(0, idx - 50), idx);
        return !context.includes('COLORS.');
      });
      
      if (scattered.length > 0) {
        scatteredColors += scattered.length;
      }
    }
  }
  
  if (scatteredColors === 0) {
    success('No scattered color literals in key files');
  } else if (scatteredColors <= 5) {
    warn(`${scatteredColors} scattered color literals found (consider using COLORS tokens)`);
  } else {
    warn(`${scatteredColors} scattered color literals - consider refactoring to COLORS tokens`);
  }
  
  // Check AtmosphereStack doesn't drift on hero screen
  const heroPath = path.join(ROOT, 'app', 'hero', '[id].tsx');
  if (fs.existsSync(heroPath)) {
    const heroContent = fs.readFileSync(heroPath, 'utf-8');
    if (heroContent.includes('driftingFog={false}') || heroContent.includes('driftingFog: false')) {
      success('Hero screen disables drifting fog');
    } else if (heroContent.includes('AtmosphereStack')) {
      warn('Verify hero screen disables drifting fog');
    }
  }
}

// =============================================================================
// Run all checks
// =============================================================================
console.log('='.repeat(60));
console.log('Phase 3.23 Closure Guard');
console.log('='.repeat(60));

checkScreensExist();
checkBackendAuthIdentity();
checkIdempotency();
checkDesireEngineCleanup();
checkChromaticConsistency();

// Summary
console.log('\n' + '='.repeat(60));
if (exitCode === 0 && warnings === 0) {
  console.log(`${GREEN}Phase 3.23 closure checks PASSED!${RESET}`);
} else if (exitCode === 0) {
  console.log(`${YELLOW}Phase 3.23 passed with ${warnings} warning(s)${RESET}`);
} else {
  console.log(`${RED}Phase 3.23 closure guard FAILED${RESET}`);
}
console.log('='.repeat(60));

process.exit(exitCode);
