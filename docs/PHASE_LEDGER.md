# Phase Ledger

Tracks phase goals, deliverables, and exit criteria.  
Each phase: Goal → Deliverables checklist → Exit checks → Notes.

---

## Phase 3.22 — Sanctuary Home

**Goal:** Transform the home screen from "dashboard" into "sanctuary" — a calm, atmospheric space that invites the player to stay.

### Deliverables
- [x] Full-bleed background (hero art or environment)
- [x] AtmosphereStack overlays (vignette, haze, mist, optional fog)
- [x] RitualDock ("relic base") at bottom for idle rewards
- [x] Collapsible HomeSideRail (Doors toggle only; Library icon opens DoorsSheet)
- [x] DoorsSheet contains grid/dashboard content
- [x] Tab bar "floor" styling consistent across platforms
- [x] Reduce Motion respected for all animated overlays

### Exit Checks
- [x] Home scene feels stable + predictable
- [x] No auto-collapse timers on rail
- [x] AtmosphereStack has `pointerEvents="none"`
- [x] Vignette opacity ≤ 0.35 (no "crush")
- [x] Guard: `guard-phase-3-22-closure.mjs` passes

### Notes
- Web preview has pointer event limitations; rail interaction best tested on device via Expo Go.
- Drifting fog disabled on Hero Stage (only used on Home).

---

## Phase 3.23 — Social + Mail + Friends

**Goal:** Implement fully functional Mail and Friends screens with secure, idempotent endpoints.

### Deliverables
- [x] Mail screen with Rewards/Messages/Gifts tabs
- [x] Friends screen with Requests/Friends/Search tabs
- [x] Backend: Auth-token derived identity (not URL params)
- [x] Backend: Idempotent claim/accept/decline endpoints
- [x] Badge refresh is event-driven (no polling loops)
- [x] Debounced player search with cancellation
- [x] Desire Engine cleanup (no leaking timers/subscriptions)
- [x] Chromatic Authority pass (warm ink + gold palette)

### Exit Checks
- [x] Mail claim flows trigger badge refresh
- [x] Friends accept/decline are idempotent
- [x] No setInterval in badges.ts
- [x] Backend logs `[REWARD_GRANTED]` on claims
- [x] Guard: `guard-phase-3-23-closure.mjs` passes

### Notes
- Backend endpoints retain `/{username}` in URL for backwards compat but ignore the param.
- Mail/Friends APIs return stub data until backend collections are populated.

---

## Phase 3.24 — Canonical Reward Receipts

**Goal:** Ensure ALL reward-granting endpoints return the same canonical receipt shape for consistency, idempotency, and telemetry.

### Deliverables

#### Backend
- [x] `grant_rewards_canonical()` helper in server.py
- [x] LOCKED receipt shape: `{ source, sourceId, items, balances, alreadyClaimed? }`
- [x] LOCKED source values: `bond_tribute | mail_reward_claim | mail_gift_claim | daily_login_claim | idle_claim | admin_grant`
- [x] Mail reward claim uses canonical receipt
- [x] Mail gift claim uses canonical receipt
- [x] Idle claim includes canonical fields (+ legacy fields for compat)
- [ ] Bond tribute endpoint returns canonical receipt (endpoint not yet implemented)
- [ ] Mail fallback queued receipts (deferred - no queue system yet)

#### Frontend
- [x] `RewardReceipt` type in `lib/types/receipt.ts`
- [x] `isValidReceipt()` type guard
- [x] `assertValidReceipt()` validator
- [x] Mail API returns `Promise<RewardReceipt>`
- [x] Mail screen uses `formatReceiptItems()` for toast
- [ ] Balances applied ONLY from receipt (partial - store sync needed)
- [x] Telemetry events with source + sourceId:
  - [x] `reward_receipt_received`
  - [x] `reward_claim_success`
  - [x] `reward_claim_already_claimed`
  - [x] `reward_claim_error`
  - [x] `mail_claim_submitted`

#### Guards
- [x] `guard-receipt-shape.mjs` validates receipt fields
- [x] Guard fails if `source` or `sourceId` missing

### Exit Checks
- [x] One receipt shape everywhere
- [x] One balance application path (from receipts)
- [x] Guards passing: `npm run guard:receipt-shape`
- [x] No UI-specific reward logic outside receipt consumption

### Notes
- Bond tribute endpoint deferred to Phase 3.26 (hero bonding system).
- Mail fallback queue deferred (no async reward queue yet).
- Telemetry events added but analytics backend not yet connected (logs in DEV).

---

## Phase 3.25 — Hero Stage Motion v1

**Goal:** Add tier-gated "alive" feeling to hero presentation without timers or RAF.

### Deliverables
- [x] MOTION_PARAMS table with locked values (single source of truth)
- [x] `resolveMotionTier(affinity)` function
- [x] `deriveHeroStageConfig()` centralized config
- [x] `useHeroIdleMotion()` Reanimated-only hook
- [x] Tier 0-1: Static (no motion)
- [x] Tier 2-5: Progressive breathing/sway/bob/rotation
- [x] Reduce Motion accessibility respected
- [x] Selene alias resolution (`char_selene_ssr`)
- [x] DEV logging via `logHeroStageConfig()`

### Exit Checks
- [x] No setTimeout/setInterval/RAF in motion files
- [x] Hero screen uses `deriveHeroStageConfig`
- [x] `driftingFog={false}` on hero AtmosphereStack
- [x] Guard: `npm run guard:hero-motion` passes

### Notes
- Motion values locked per spec (breathingScale: 0.006/0.010/0.013/0.016).
- Camera intimacy offset at tier 4-5 (2%/4% scale boost).

---

## Phase 3.26 — Affinity Unlock Surface + Parallax Language + Mail Fallback Queue

**Goal:** Make "Affinity → unlocks" visible and understandable, add tiered parallax/camera language (static first), and ensure reward receipts are never lost via a mail fallback queue.

### Deliverables

#### A) Affinity Unlock Surface
- [x] `TIER_THRESHOLDS` table (single source of truth)
- [x] `getTierInfo(tier)` returns camera/motion/parallax labels
- [x] `getTierTable()` returns full tier ladder for UI
- [x] `getNextTierInfo(tier)` for "Next unlock at..." UI
- [x] Bond screen with tier ladder panel (`/app/frontend/app/hero-bond.tsx`)
- [x] Hero stage camera language microcopy (shows tier-based camera label)
- [x] Locked/unlocked intimacy badge (tier >= 4) in hero screen

#### B) Camera & Parallax Language
- [x] `docs/hero-stage-language.md` contract document
- [x] `PARALLAX_PLANES` table per tier
- [x] `deriveHeroStageConfig` returns `parallaxPlanes`, `cameraLabel`, `intimacyUnlocked`
- [x] `CameraMode` includes 'distant' (was only standard/intimate)
- [x] Hero stage renders static parallax planes with tier-based opacity/scale

#### C) Mail Fallback Queue
- [x] Backend: `queue_receipt_to_mail()` helper in server.py
- [x] Backend: `/api/mail/receipts` list endpoint
- [x] Backend: `/api/mail/receipts/{id}/claim` endpoint (idempotent)
- [x] Backend: Mail summary includes `receiptsAvailable` count
- [x] Frontend: Mail API `getMailReceipts()`, `claimMailReceipt()` in lib/api/mail.ts
- [x] Frontend: Mail UI Receipts tab (only visible when receipts available)

#### Telemetry Events
- [x] `BOND_VIEWED`
- [x] `BOND_TIER_LADDER_VIEWED`
- [x] `BOND_NEXT_UNLOCK_VIEWED`
- [x] `BOND_TIER_ADVANCED`
- [x] `MAIL_RECEIPTS_VIEWED`
- [x] `MAIL_RECEIPT_CLAIM_SUBMITTED`

### Exit Checks
- [x] Bond screen tier ladder uses centralized `getTierTable()` (no hardcoded thresholds)
- [x] Hero stage uses `deriveHeroStageConfig`
- [x] `driftingFog={false}` maintained
- [x] Mail receipt endpoints return canonical receipt shape
- [x] Mail UI exposes receipts (tab visible when receipts available)
- [x] Guard: `npm run guard` passes

### Notes
- Bond screen UI deferred pending hero-bond route creation.
- Mail fallback queue backend deferred pending endpoint implementation.
- Contract doc created at `docs/hero-stage-language.md`.

---

## Phase 3.27 — Hero Stage Intimacy v2 (Camera Drift)

**Goal:** Add tier-based camera drift to create subtle "creep" feeling at higher intimacy tiers without violating guard constraints.

### Deliverables

#### Motion System
- [x] `CAMERA_DRIFT_PARAMS` table with locked values (single source of truth)
- [x] `getCameraDriftParams(tier)` function
- [x] `useHeroCameraDrift()` Reanimated-only hook
- [x] Tier 0-1: No drift
- [x] Tier 2-3: Subtle drift (standard mode)
- [x] Tier 4-5: Intimate drift (inspect mode only)
- [x] Reduce Motion accessibility respected

#### Hero Screen Integration
- [x] `isInspectMode` state added
- [x] `handleInspectToggle` handler with telemetry
- [x] Camera drift style applied to hero container
- [x] Telemetry events emitting

#### Telemetry Events
- [x] `HERO_STAGE_VIEWED`
- [x] `HERO_STAGE_INSPECT_TOGGLED`
- [x] `HERO_STAGE_CAMERA_MODE_RESOLVED`

#### Guards
- [x] `guard-phase-3-27.mjs` created
- [x] Added to `npm run guard`
- [x] Enforces: no timers/RAF, tier gating, reduce motion support

### Exit Checks
- [x] No setTimeout/setInterval/RAF in motion files (comments excluded)
- [x] Camera drift is tier-gated
- [x] Intimate drift only in inspect mode
- [x] Reduce Motion branch present
- [x] Guard: `npm run guard:phase-3-27` passes

### Notes
- Camera drift values are very subtle (scale: 0.002-0.004, translate: 0.5-1.0px)
- Intimate tier (4-5) drift only activates when user enters inspect mode
- All motion uses Reanimated worklets only

---

## Upcoming Phases

### Phase 3.27 — Daily Login System (Planned)
- Daily login claim with canonical receipt
- Streak tracking
- Monthly reward calendar
