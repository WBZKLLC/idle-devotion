# PvE/PvP AUDIT PACK

Last Updated: January 2025
Status: **ACTIVE AUDIT** — Video-blind, doc-first methodology

---

## 1. SCOPE

### PvE Modes (SHIPPED)

| Mode | Status | Location | Description |
|------|--------|----------|-------------|
| **Campaign** | ✅ Shipped | `/app/frontend/app/campaign.tsx` | 12 Chapters × 20 Stages + Boss = 252 total stages |
| **Dungeons** | ✅ Shipped | `/app/frontend/app/dungeons.tsx` | 5 resource types (EXP, Gold, Skill, Equipment, Enhancement) |
| **Abyss** | ✅ Shipped | `/app/backend/routers/battle.py` | Endless boss tower with increasing difficulty |

### PvP Modes (SHIPPED)

| Mode | Status | Location | Description |
|------|--------|----------|-------------|
| **Arena** | ✅ Shipped | `/app/frontend/app/(tabs)/arena.tsx` | 1v1 async PvP with ELO-based matchmaking |
| **Guild Wars** | ⏳ Roadmap | Not implemented | Planned for Phase 5.x |

---

## 2. LOOP MAP (PvE)

### Campaign Flow

```
[Entry]                  [Combat]                [Rewards]              [Upgrades]              [Repeat]
   │                         │                       │                      │                     │
   ▼                         ▼                       ▼                      ▼                     ▼
Select Chapter ──────► Battle Stage ──────► First Clear Rewards ──────► Level Heroes ──────► Unlock Next
       │                     │                       │                      │                     │
       └─── Stamina ─────────┤               Gold/Gems/Shards              └── Skill ─────────────┘
            Check            │                       │                      Upgrade
                             │                       │
                   Auto-Battle Toggle          3-Star Bonus
                             │                       │
                        Win/Lose                   Sweep
                                                (cleared stages)
```

### Identified Friction Points

| Point | Severity | Description |
|-------|----------|-------------|
| **Stamina Wall** | Medium | 6-15 stamina per stage; natural regen 1/5min = 12/hr = 288/day |
| **Power Spikes** | High | Mini-bosses (every 5 stages) and chapter bosses have 1.5-2.5x power jumps |
| **No Skip Animation** | Low | Battles auto-complete but no visual skip option visible |
| **Dialog Interrupts** | Medium | Story dialogue requires tap-through; no "skip all" option documented |

### Missing Dopamine Beats

| Beat | Current State | Recommendation |
|------|---------------|----------------|
| **Victory Fanfare** | Needs video note | Check if victory screen has satisfying animation/sound |
| **Star Collection** | Basic UI | Could add star animation flying to counter |
| **Reward Reveal** | Single screen | Consider sequential reveal with anticipation |
| **Boss Intro** | Dialogue box | Could add boss entrance cinematic |
| **Chapter Complete** | Needs video note | Check if there's a celebration moment |

---

## 3. LOOP MAP (PvP — Arena)

### Arena Flow

```
[Entry]                [Matchup]              [Resolution]           [Rewards/Rank]         [Repeat]
   │                       │                       │                      │                     │
   ▼                       ▼                       ▼                      │                     │
Arena Tab ──────► View 3 Opponents ──────► Instant Battle ──────► Rating ±15-25 ──────► Refresh List
       │                   │                       │                      │                     │
       └─ Ticket ──────────┤               Victory/Defeat              Win Streak              ▲
          Check            │                       │                   Bonuses                 │
          (5 max)          │                       │                      │                    │
                    Power Display               ELO Calc                  └─ Gold/Arena Coins ─┘
                           │                       │
                    "FIGHT" button          Update Leaderboard
```

### PvP Pain Points

| Point | Severity | Description |
|-------|----------|-------------|
| **Instant Resolution** | High | No battle animation = no tension, no counterplay feeling |
| **Mock Opponents** | Medium | System generates NPCs when player pool is thin |
| **No Draft/Normalization** | Medium | Power-based matchmaking but no stat normalization |
| **Ticket Pressure** | Low | 5 tickets, 30min regen = generous, no dark pattern |

---

## 4. FEEDBACK & CLARITY SCORECARD

| Dimension | Score (0-5) | Evidence | Video Note Needed? |
|-----------|-------------|----------|--------------------|
| **Readability** | 3 | UI shows power numbers; battle outcome unclear | YES — Check battle log visibility |
| **Agency** | 2 | Auto-battle dominant; no tactical decisions mid-fight | YES — Check manual vs auto impact |
| **Payoff** | 3 | Rewards display exists; victory celebration unclear | YES — Check win animations |
| **Failure Messaging** | 2 | "Defeat" shown; no tips on why or how to improve | YES — Check loss screen |
| **Reward Cadence** | 4 | First clear + sweep + daily dungeons = regular drops | NO — Code confirms cadence |
| **Progress Visibility** | 4 | Chapter progress bars, pity counters, star counts | NO — Code confirms |
| **Return Triggers** | 3 | Stamina regen, daily dungeons; unclear daily login bonus | YES — Check daily rewards flow |

**Overall Score: 21/35 (60%)** — Needs improvement in agency and failure feedback.

---

## 5. ECONOMY/PROGRESS TOUCHPOINTS

### Currency Entry Points

| Currency | Entry Points | Rate |
|----------|--------------|------|
| **Gold** | Campaign, Dungeons, Arena, Idle | High — Core progression |
| **Gems/Crystals** | Campaign boss, Milestones, Shop | Medium — Gacha pull fuel |
| **Soul Dust** | EXP Dungeon | Medium — Hero leveling |
| **Skill Essence** | Skill Dungeon | Medium — Skill upgrades |
| **Enhancement Stones** | Enhancement Dungeon | Medium — Gear power |
| **Arena Coins** | Arena battles | Low — Arena shop only |

### Currency Exit Points

| Currency | Exit Points | Rate |
|----------|-------------|------|
| **Gold** | Hero level, Skill level, Gear enhance | Very High |
| **Gems** | Gacha summons, Stamina refresh | Medium |
| **Soul Dust** | Hero EXP | Medium |
| **All Shards** | Hero promotion | Medium |

### Bottleneck Analysis

| Bottleneck | Severity | Description |
|------------|----------|-------------|
| **Gold Sink** | High | Hero leveling + gear enhancement both consume gold heavily |
| **Stamina** | Medium | PvE gated; idle system provides partial bypass |
| **Hero Shards** | High | Promotion requires specific shards; gacha RNG |
| **Equipment Drops** | Medium | Equipment dungeon has low drop rates |

### "Dead-End" Feelings

- **Chapter Power Wall**: Chapter 6+ requires ~45,000 power; natural F2P progression ~3 months
- **Hero Promotion Shard Drought**: Specific hero shards hard to target outside gacha
- **Equipment Set Completion**: Random drops make set bonuses luck-dependent

---

## 6. DELTA VS [REDACTED] (Video-Derived Analysis)

> Note: [redacted] refers to industry reference titles observed for comparison.
> **SOURCE: Video analysis of Reference_PVE_01.mp4, Reference_PVE_02.mp4, Reference_PVP_01.mp4, Reference_PVP_02.mp4**

### Comparison Framework (Video-Validated)

| Category | Reference A Approach | Idle Devotion Approach | Gap |
|----------|---------------------|------------------------|-----|
| **Battle Presentation** | Full animated sequences with skill cuts, character poses, dramatic intros | Instant resolution, power comparison only | **CRITICAL** |
| **Damage Numbers** | Large, vibrant, color-coded (red/green), critical hit indicators, massive numbers (156M+) | Not shown during battle | **CRITICAL** |
| **Skill Cut-Ins** | Full-screen cinematic animations ("Light of Creation", "Supreme Glory") with character portraits | None | **HIGH** |
| **Particle Effects** | Abundant: sparks, glows, explosions, energy bursts, magical circles | Basic gradients | **HIGH** |
| **Screen Shake** | Subtle shakes on impactful skills | None | **MEDIUM** |
| **Victory Screen** | "VICTORY" banner with wings, crown, celebratory graphics, clear context | Simple result text | **HIGH** |
| **Reward Reveal** | Sequential reveal with icons, coin animations, "Reward Record" section | All-at-once display | **MEDIUM** |
| **Buff/Debuff Display** | Clear visual icons, text overlays ("CRIT DMG Taken DOWN", "ATK UP") | Minimal indicators | **HIGH** |
| **PvP Matchmaking** | Bracket tournaments, opponent power display, visible rewards, attempt limits | Simple opponent list | **MEDIUM** |
| **PvP Stakes** | Tournament progression, daily ranking rewards, countdown timers | Rating-only | **MEDIUM** |

### Video-Observed Reference Features (Detailed)

#### PvE Reference Features:
1. **Skill Cut-In Animations**: Full-screen reveals with character names: "Light of Creation", "Luminous Glories", "Celestial Domain", "Supreme Glory", "Infinity Blessing", "Abyss Sonata", "Divinity Eye", "Divine Retribution", "Star Gaze"
2. **Damage Number Magnitude**: Numbers in tens/hundreds of millions (e.g., "-68658185", "-2132514720", "+38409732", "-156129616")
3. **Status Effect Text**: "CRIT DMG Taken DOWN", "Increased P.DMG", "DEF reduced", "Combustion", "Heartburn", "Cleansed"
4. **Round Counter**: Clear "Round" indicator on left side of screen
5. **Character Portraits**: Active character highlighted with energy effects
6. **Victory Banner**: Prominent "VICTORY" with angelic wings and crown, stage context shown
7. **Reward Record**: Clean display with coin icon + amount, potion icon + count

#### PvP Reference Features:
1. **Tournament Brackets**: Visual bracket showing Quarter-final, Semi-final, Final progression
2. **Opponent Display**: Avatar, name, power score (e.g., "2735863795"), potential rewards
3. **Attempt System**: "Attempts: 4" visible - resource management for PvP
4. **Countdown Timer**: "022:26:11" creating urgency
5. **Ranking Rewards**: Daily rewards at 21:00, incentivizing consistent play
6. **Match Rules Button**: Transparency on competitive mechanics
7. **Ranking Quiz**: Knowledge-based engagement feature

### Key Structural Gaps (Video-Validated)

| Gap | Reference Evidence | Idle Devotion Current | Priority |
|-----|-------------------|----------------------|----------|
| **No Battle Animation** | 15-30 second sequences with skill activations | Instant result | P0 |
| **No Skill Cut-Ins** | "Light of Creation" cinematic reveals | None | P0 |
| **No Damage Numbers** | Millions displayed prominently | Hidden | P0 |
| **No Victory Fanfare** | Wings + crown + context banner | Text only | P0 |
| **No Buff/Debuff Text** | "ATK UP", "CRIT DMG DOWN" overlays | Minimal | P1 |
| **No Tournament Mode** | Bracket-based competition | Rating-only arena | P2 |
| **No Countdown Urgency** | Timed events with visible countdown | None | P2 |
| **No Attempt System** | "Attempts: 4" visible | Tickets (similar) | OK |

---

## 7. TOP 10 FIXES (Ranked)

### #1: Add Battle Visualization (PvE/PvP)

| Attribute | Value |
|-----------|-------|
| **Problem** | Battles resolve instantly with no visual feedback |
| **Why it matters** | Players can't feel the impact of their hero builds or decisions |
| **Proposed change** | Add 5-10 second animated battle sequence with damage numbers, skill activations, and HP bars |
| **Effort** | L (Large) — Requires animation system, art assets |
| **Impact** | 10 — Core engagement driver |
| **Risk** | Medium — Animation performance on low-end devices |
| **Telemetry** | `battle_watched_vs_skipped`, `battle_duration_viewed`, `engagement_after_animation` |

### #2: Victory/Defeat Celebration Screens

| Attribute | Value |
|-----------|-------|
| **Problem** | Win/loss feels flat; no emotional spike |
| **Why it matters** | Dopamine delivery is the core loop reinforcement |
| **Proposed change** | Victory: confetti, sound, character pose, star animation. Defeat: tips, retry button, close-call indicator |
| **Effort** | M (Medium) — UI + animation + audio |
| **Impact** | 8 — High emotional value, moderate effort |
| **Risk** | Low |
| **Telemetry** | `victory_screen_duration`, `retry_after_defeat_rate`, `defeat_tip_interaction` |

### #3: Add Skip Dialogue Option

| Attribute | Value |
|-----------|-------|
| **Problem** | Story dialogue interrupts flow; veterans want to skip |
| **Why it matters** | Repeat players and sweepers get frustrated |
| **Proposed change** | "Skip All" button in dialogue; auto-skip toggle in settings |
| **Effort** | S (Small) — UI + flag |
| **Impact** | 6 — Quality of life |
| **Risk** | Low |
| **Telemetry** | `dialogue_skipped_rate`, `skip_all_usage`, `story_completion_with_skip` |

### #4: Loss Feedback System

| Attribute | Value |
|-----------|-------|
| **Problem** | Defeat screen shows "DEFEAT" with no guidance |
| **Why it matters** | Players don't know how to improve; churn risk |
| **Proposed change** | Show: power gap %, recommended hero type, suggested upgrades, "almost won" indicator if close |
| **Effort** | M — Logic + UI |
| **Impact** | 7 — Retention driver |
| **Risk** | Low |
| **Telemetry** | `defeat_reason_viewed`, `suggested_upgrade_followed`, `retry_after_tip` |

### #5: Boss Intro Cinematics

| Attribute | Value |
|-----------|-------|
| **Problem** | Chapter bosses feel like regular stages |
| **Why it matters** | Boss fights are progression milestones; should feel special |
| **Proposed change** | 3-5 second boss intro: name reveal, mechanic hint, dramatic pose |
| **Effort** | M — Art + animation |
| **Impact** | 6 — Emotional milestone |
| **Risk** | Low |
| **Telemetry** | `boss_intro_watched`, `boss_intro_skipped`, `engagement_post_boss_intro` |

### #6: PvP Battle Replay/Summary

| Attribute | Value |
|-----------|-------|
| **Problem** | Arena battles are instant; no understanding of why you won/lost |
| **Why it matters** | Players can't learn from matches; feels like dice roll |
| **Proposed change** | Post-battle summary: "Your [Hero] dealt X damage", "Enemy [Hero] was countered", key moments |
| **Effort** | M — Battle log system + UI |
| **Impact** | 7 — PvP engagement |
| **Risk** | Medium — Need to balance information vs simplicity |
| **Telemetry** | `battle_summary_expanded`, `battle_summary_time_spent`, `pvp_engagement_after_summary` |

### #7: Reward Reveal Sequence

| Attribute | Value |
|-----------|-------|
| **Problem** | Rewards appear all at once; no anticipation |
| **Why it matters** | Reward reveal is a dopamine opportunity being wasted |
| **Proposed change** | Sequential reveal: gold → materials → equipment → gems (if any), with sound/animation |
| **Effort** | S — Animation sequence |
| **Impact** | 5 — Polish |
| **Risk** | Low |
| **Telemetry** | `reward_reveal_watched_full`, `reward_reveal_tapped_through`, `reward_reveal_duration` |

### #8: Campaign Star Collection Animation

| Attribute | Value |
|-----------|-------|
| **Problem** | Stars awarded but visually static |
| **Why it matters** | Stars are key progress metric; should feel earned |
| **Proposed change** | Animated stars flying to total counter; sound per star; sparkle effect |
| **Effort** | S — Animation |
| **Impact** | 4 — Polish |
| **Risk** | Low |
| **Telemetry** | `star_animation_completed`, `chapter_progress_viewed_after_star` |

### #9: Daily Login Reward Flow

| Attribute | Value |
|-----------|-------|
| **Problem** | Unclear if daily login rewards exist; not visible in code review |
| **Why it matters** | Daily return triggers are retention fundamentals |
| **Proposed change** | Dedicated daily reward screen on login; 7-day streak bonuses; monthly calendar |
| **Effort** | M — Backend + UI |
| **Impact** | 8 — Core retention |
| **Risk** | Low |
| **Telemetry** | `daily_login_claimed`, `login_streak_length`, `streak_broken_recovery` |

### #10: Arena Stat Normalization Option

| Attribute | Value |
|-----------|-------|
| **Problem** | Arena uses raw power; whales vs F2P imbalance potential |
| **Why it matters** | Ethical PvP requires skill > wallet |
| **Proposed change** | Add "Ranked" mode with stat normalization; "Open" mode keeps current system |
| **Effort** | L — Backend normalization logic + separate queue |
| **Impact** | 7 — Ethical + long-term health |
| **Risk** | Medium — Might reduce whale motivation |
| **Telemetry** | `ranked_vs_open_preference`, `normalized_win_rate_vs_power`, `pvp_spend_correlation` |

---

## 8. PHASE PROPOSAL

### Phase 4.1: Battle Feel Pass (Effort: Large)

**Definition of Done:**

- [ ] Battle visualization system renders 5-10 second animated sequence
- [ ] Victory screen includes confetti, sound, and character celebration
- [ ] Defeat screen shows power gap, tips, and "close call" indicator
- [ ] Stars animate flying to counter on 3-star clear
- [ ] Reward reveal is sequential with sound
- [ ] Telemetry events fire for all new interactions
- [ ] All guards pass
- [ ] Performance: Animation runs at 60fps on mid-tier devices

### Phase 4.2: PvP Feel Pass (Effort: Medium)

**Definition of Done:**

- [ ] Arena battle summary shows key moments
- [ ] Boss intro cinematics play before chapter bosses
- [ ] Skip dialogue option available in settings
- [ ] Daily login reward system implemented
- [ ] Telemetry events fire for all new interactions
- [ ] All guards pass

### Phase 5.1: PvP Competitive Integrity (Effort: Large)

**Definition of Done:**

- [ ] Stat normalization implemented for "Ranked" arena mode
- [ ] Seasonal reset system for arena ratings
- [ ] Guild Wars basic framework
- [ ] Anti-whale measures documented and enforced
- [ ] Telemetry events fire for competitive analytics
- [ ] All guards pass, including `guard-pvp-ethics.mjs`

---

## 9. GUARDS WE MAY WANT

### Proposed Guards

| Guard Name | Purpose | Trigger |
|------------|---------|--------|
| `guard-battle-visualization.mjs` | Ensure battle endpoints return visualization data | Any `/battle/*` endpoint |
| `guard-defeat-feedback.mjs` | Ensure defeat responses include tips/reason | Defeat state in battle response |
| `guard-daily-login.mjs` | Ensure daily login system exists and is wired | Backend + frontend daily login |
| `guard-reward-sequence.mjs` | Ensure reward responses support sequential reveal | Receipt/reward shapes |
| `guard-pvp-normalization.mjs` | Ensure ranked PvP uses normalized stats | Arena ranked mode |

### Existing Guards (Already Enforced)

- `guard-pvp-ethics.mjs` — No VIP stat buffs, no paid-only advantages
- `guard-vip-benefits.mjs` — VIP is economy/comfort only
- `guard-receipt-shape.mjs` — Canonical reward receipts

---

## 10. TELEMETRY GAPS TO FILL

### Missing Events (Priority)

| Event | Purpose | Priority |
|-------|---------|----------|
| `battle_animation_viewed` | Did player watch or skip? | P0 |
| `victory_screen_duration` | How long on win screen? | P0 |
| `defeat_tip_interaction` | Did player read defeat tips? | P0 |
| `dialogue_skipped` | Story engagement vs skip rate | P1 |
| `boss_intro_watched` | Boss cinematic engagement | P1 |
| `reward_reveal_watched_full` | Anticipation experience | P1 |
| `pvp_battle_summary_expanded` | PvP engagement depth | P1 |
| `daily_login_claimed` | Retention metric | P0 |
| `login_streak_length` | Habit strength | P0 |
| `campaign_power_wall_hit` | Where do players get stuck? | P0 |
| `dungeon_sweep_vs_manual` | Engagement preference | P2 |

### Existing Telemetry (Confirmed in Code)

- `Events.GACHA_HISTORY_VIEWED` — Summon history engagement
- Hero promotion events
- VIP events
- Mail/gift claim events

---

## 11. VIDEO REFERENCE TABLE

**Note:** Videos cannot be parsed directly. See `/app/docs/pve-pvp-video-notes-template.md` for manual annotation template.

| Video File | Expected Content | Audit Questions |
|------------|------------------|----------------|
| `Idle_Devotion_Campaign.mp4` | Campaign gameplay | Battle animation? Star collection? Victory celebration? |
| `Idle_Devotion_Dungeon.mp4` | Dungeon gameplay | Resource drops? Sweep vs manual? |
| `Reference_PVE.mp4` | Reference PvE | Battle pacing? Skill cuts? Reward reveals? |
| `Reference_PVP_1.mp4` | Reference PvP | Match tension? Counterplay? |
| `Reference_PVP_2.mp4` | Reference PvP | Different mode? Tournament? |

---

## 12. SIGN-OFF

This audit was conducted **video-blind** using:

1. Backend code analysis (`/app/backend/core/campaign.py`, `/app/backend/routers/battle.py`)
2. Frontend code analysis (`/app/frontend/app/campaign.tsx`, `/app/frontend/app/dungeons.tsx`, `/app/frontend/app/(tabs)/arena.tsx`)
3. Existing documentation (`/app/docs/PVE_PVP_QUEUE.md`, `/app/docs/pvp-monetization-ethics.md`)

**Manual video notes required** to validate visual/audio feedback assumptions.

---

**END OF PvE/PvP AUDIT PACK**
