# Phase Ledger

This document tracks all completed phases of development with their Definition of Done (DoD) checkboxes.

---

## Phase 3.58 — PvP UX Skeleton

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Arena screen has attempts display (tickets)
- [x] No paid gating/shop links in PvP screen
- [x] Telemetry events added (PVP_VIEWED, PVP_RULES_OPENED, PVP_OPPONENT_LIST_VIEWED)
- [x] Guard `guard-phase-3-58-pvp-ux-skeleton.mjs` created and passing
- [ ] Rules affordance (optional future enhancement)

---

## Phase 3.57 — PvP Normalization v0

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Backend normalization module exists (`/app/backend/core/pvp_normalization.py`)
- [x] Normalization modes: NONE, BRACKET, SOFT, FULL
- [x] Power brackets defined (Bronze → Diamond)
- [x] No monetization hooks in normalization code
- [x] Ethics guard still present
- [x] Guard `guard-phase-3-57-pvp-normalization.mjs` created and passing

### Files Created

- `/app/backend/core/pvp_normalization.py`

---

## Phase 3.56 — Campaign Difficulty Hook

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Backend difficulty table exists (`/app/backend/core/campaign_difficulty.py`)
- [x] Locked difficulty table (chapters 1-12)
- [x] No random scaling (deterministic)
- [x] Functions: `get_stage_enemy_power()`, `get_recommended_power()`, `get_power_band()`
- [x] Campaign screen shows recommended power
- [x] Telemetry event PVE_STAGE_VIEWED exists
- [x] Guard `guard-phase-3-56-difficulty-table.mjs` created and passing

### Files Created

- `/app/backend/core/campaign_difficulty.py`

---

## Phase 3.55 — Combat Readability v2

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Power ratio logic present in BattlePresentationModal
- [x] Deterministic combat tags (CRIT, GLANCING, etc.) based on power ratio
- [x] No RNG in battle presentation
- [x] Reduce Motion check present
- [x] Telemetry event PVE_BATTLE_KEY_MOMENT_SHOWN exists
- [x] Guard `guard-phase-3-55-readability-v2.mjs` created and passing

---

## Phase 3.54 — Skill Cut-In System v1

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] `SkillCutInOverlay.tsx` component created
- [x] No timers/RAF in cut-in component
- [x] Telemetry tracking (PVE_SKILL_CUTIN_SHOWN)
- [x] BattlePresentationModal has cut-in support (data shape)
- [x] Guard `guard-phase-3-54-skill-cutin.mjs` created and passing

### Files Created

- `/app/frontend/components/battle/SkillCutInOverlay.tsx`
- Updated `/app/frontend/components/battle/index.ts`

---

## Phase 3.53 — PvP Review Pack (Doc-Only)

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] `/app/docs/pvp-loop-review.md` exists with attempt limits, rank rewards, ethics
- [x] `/app/docs/pvp-normalization-proposal.md` exists with normalization formula
- [x] Ethics guard (`guard-pvp-ethics.mjs`) still present and wired
- [x] Guard `guard-phase-3-53-pvp-review.mjs` created and passing
- [x] No code changes to PvP gameplay (document-only phase)

---

## Phase 3.52 — PvE Celebration Layer

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Victory screen has celebration elements (VICTORY text, confetti)
- [x] First clear badge exists
- [x] Stars display exists in victory modal
- [x] Defeat CTA shows recommendations (limited count)
- [x] Rewards displayed from server data (no client recompute)
- [x] Continue CTA exists
- [x] Guard `guard-phase-3-52-pve-celebration.mjs` created and passing

---

## Phase 3.51 — PvE Clarity Layer

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] Damage display exists in BattlePresentationModal
- [x] No Math.random in presentation (deterministic)
- [x] Power gap display exists in VictoryDefeatModal
- [x] Recommendation system exists for defeat
- [x] Telemetry events exist (PVE_BATTLE_PRESENTATION_VIEWED, PVE_VICTORY_VIEWED, PVE_DEFEAT_VIEWED)
- [x] Guard `guard-phase-3-51-pve-clarity.mjs` created and passing

---

## Phase 3.50 — PvE Battle Presentation + Victory/Defeat + Timer Bugfix

**Status**: ✅ CLOSED
**Date**: January 2025

### Definition of Done

- [x] `BattlePresentationModal.tsx` exists with turn-based presentation
- [x] `VictoryDefeatModal.tsx` exists with rewards display and defeat feedback
- [x] Campaign screen wired to use BattlePresentationModal
- [x] Dungeon screen wired to use BattlePresentationModal
- [x] Sweep bypasses presentation, shows VictoryDefeatModal directly
- [x] Reduce Motion compliant (AccessibilityInfo check present)
- [x] Rewards displayed in victory modals
- [x] NaN timer bug fixed (formatHMS utility in index.tsx)
- [x] Guards wired into `npm run guard`
- [x] `npm run guard` passes
- [x] `npx tsc --noEmit` passes

---

## Previous Phases

### Phase 3.47-3.49 — Economy Audit Pack

**Status**: ✅ COMPLETE

- [x] Power Curve Audit (`/app/docs/POWER_CURVE_AUDIT.md`)
- [x] VIP System Documentation (`/app/docs/VIP_SYSTEM.md`)
- [x] PvP Ethics Guard (`/app/frontend/scripts/guard-pvp-ethics.mjs`)
- [x] Star Table Guard (`/app/frontend/scripts/guard-star-table.mjs`)
- [x] All guards passing

---

## Guard Count Summary

| Phase | Guards Added |
|-------|-------------|
| 3.50 | `guard-phase-3-50-battle-presentation.mjs`, `guard-ui-time-format.mjs` |
| 3.51 | `guard-phase-3-51-pve-clarity.mjs` |
| 3.52 | `guard-phase-3-52-pve-celebration.mjs` |
| 3.53 | `guard-phase-3-53-pvp-review.mjs` |
| 3.54 | `guard-phase-3-54-skill-cutin.mjs` |
| 3.55 | `guard-phase-3-55-readability-v2.mjs` |
| 3.56 | `guard-phase-3-56-difficulty-table.mjs` |
| 3.57 | `guard-phase-3-57-pvp-normalization.mjs` |
| 3.58 | `guard-phase-3-58-pvp-ux-skeleton.mjs` |
| 3.59 | `guard-phase-3-59-pvp-match.mjs` |
| 3.60 | `guard-phase-3-60-skill-cutin-registry.mjs` |
| 3.61 | `guard-phase-3-61-difficulty-expansion.mjs` |

**Total Guards**: 58+ (all passing)

---

## Telemetry Events Added (Phases 3.50-3.61)

| Event | Phase |
|-------|-------|
| `PVE_BATTLE_PRESENTATION_VIEWED` | 3.50 |
| `PVE_BATTLE_PRESENTATION_SKIPPED` | 3.50 |
| `PVE_BATTLE_PRESENTATION_COMPLETED` | 3.50 |
| `PVE_BATTLE_RESULT_SHOWN` | 3.50 |
| `PVE_VICTORY_VIEWED` | 3.50 |
| `PVE_DEFEAT_VIEWED` | 3.50 |
| `PVE_DEFEAT_RECOMMENDATION_CLICKED` | 3.50 |
| `PVE_SKILL_CUTIN_SHOWN` | 3.54 |
| `PVE_BATTLE_KEY_MOMENT_SHOWN` | 3.55 |
| `PVE_STAGE_VIEWED` | 3.56 |
| `PVP_VIEWED` | 3.58 |
| `PVP_RULES_OPENED` | 3.58 |
| `PVP_OPPONENT_LIST_VIEWED` | 3.58 |
| `PVP_MATCH_PREVIEW` | 3.57 |
| `PVP_MATCH_EXECUTED` | 3.59 |

---

## Phase 3.59: PvP Match Execution (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Backend**: Added `/api/arena/opponents/{username}` endpoint with DEV NPC fallback
2. **Backend**: Added `/api/pvp/match` endpoint with server-side deterministic resolution
3. **Frontend**: Updated arena.tsx to use new API and battle presentation modals
4. **API**: Added `executePvPMatch()` function in lib/api.ts
5. **Guard**: Created `guard-phase-3-59-pvp-match.mjs`

**Key Features**:
- Server-authoritative combat resolution
- sourceId for idempotency (prevents double-spending)
- NPC fallback opponents when no real opponents exist
- No monetization in PvP flow
- Integrated with BattlePresentationModal and VictoryDefeatModal

---

## Phase 3.60: Skill Cut-In Registry (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Frontend**: Created `/lib/battle/skillCutins.ts` as single source of truth
2. **Guard**: Created `guard-phase-3-60-skill-cutin-registry.mjs`

**Key Features**:
- SKILL_CUTIN_REGISTRY: Central registry of all skill cut-ins
- getHeroCutIns(): Get cut-ins for a specific hero
- getCutInById(): Get cut-in by ID
- getRandomCutIn(): Get random cut-in (deterministic with seed)
- generateBattleCutIns(): Generate cut-ins for battle presentation
- DEFAULT_CUTIN: Fallback for heroes without registered cut-ins

---

## Phase 3.61: Campaign Difficulty Expansion (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Backend**: Expanded DIFFICULTY_TABLE from 12 to 25 chapters
2. **Backend**: Added `dump_difficulty_table()` function
3. **Backend**: Added DEV-only `/api/dev/difficulty/dump` endpoint
4. **Guard**: Created `guard-phase-3-61-difficulty-expansion.mjs`

**Key Features**:
- Chapters 1-25 with progressive difficulty
- DEV-only dump endpoint for tuning
- SERVER_DEV_MODE guard on dev endpoint

---

## Phase 4.0: Battle Feel / Content Injection (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Frontend**: Created `/lib/audio/sfx.ts` with safe no-op pattern
2. **Frontend**: Updated `skillCutins.ts` with assetUri field
3. **Frontend**: Added SFX triggers in BattlePresentationModal and VictoryDefeatModal
4. **Frontend**: Added placeholder assets directory `/assets/skill-cutins/`
5. **Telemetry**: Added SFX_* events for audio tracking
6. **Guard**: Created `guard-phase-4-0-feel.mjs`

**Key Features**:
- Safe SFX wrapper that never crashes (no-op if assets missing)
- Cut-in registry with assetUri support
- Reduce Motion compliance
- No timers/RAF introduced

---

## Phase 4.1: RevenueCat Production Wiring (STAGED)

**Status**: ⚠️ Staged (webhook signature verification needs REVENUECAT_WEBHOOK_SECRET)

**Changes**:
1. **Documentation**: Created `/docs/revenuecat-production.md`
2. **Telemetry**: Added IAP_* events for purchase tracking
3. **Guard**: Created `guard-phase-4-1-revenuecat.mjs`

**Staged Items**:
- Full webhook implementation needs REVENUECAT_WEBHOOK_SECRET
- Verify endpoint needs RevenueCat API key for server-side verification
- Shop.tsx purchase flow works with existing DEV redeem endpoint

---

## Phase 4.2: PvP Depth (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Backend**: Created `/core/pvp_seasons.py` with season model
2. **Backend**: Added `GET /api/pvp/season` endpoint
3. **Backend**: Added `GET /api/pvp/rewards/preview` endpoint
4. **Backend**: Added `POST /api/pvp/daily/claim` endpoint (idempotent)
5. **Backend**: Added `POST /api/pvp/season/claim` endpoint (idempotent)
6. **Documentation**: Created `/docs/pvp-seasons.md`
7. **Telemetry**: Added PVP_SEASON_* and PVP_DAILY_* events
8. **Guard**: Created `guard-phase-4-2-pvp-depth.mjs`

**Key Features**:
- Monthly seasons with rank bands (Bronze → Grandmaster)
- Daily and seasonal rewards (currency/cosmetics only)
- No stat boosts or shop links from PvP
- Idempotent claim endpoints with canonical receipts

---

## Phase 4.3: Live Ops Hooks (COMPLETED)

**Status**: ✅ Complete

**Changes**:
1. **Backend**: Created `/core/liveops.py` with event/boost configuration
2. **Backend**: Added `GET /api/liveops/status` endpoint
3. **Documentation**: Created `/docs/liveops-system.md`
4. **Telemetry**: Added LIVEOPS_* events
5. **Guard**: Created `guard-phase-4-3-liveops.mjs`

**Key Features**:
- Server-driven event configuration
- Boost types: idle_cap_multiplier, event_rewards_multiplier, gacha_rate_up, stamina_regen
- VIP stacking with hard caps
- Banner availability controlled server-side

---
