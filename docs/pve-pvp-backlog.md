# PvE/PvP BACKLOG

Last Updated: January 2025
Source: `/app/docs/pve-pvp-audit.md`
Status: **PRIORITIZED** — Ready for sprint planning

---

## PRIORITY LEGEND

| Priority | Meaning | Criteria |
|----------|---------|----------|
| **P0** | Critical | Core engagement; blocks retention |
| **P1** | High | Important for feel; noticeable gap |
| **P2** | Medium | Polish; nice to have |

---

## P0 — CRITICAL

### P0-1: Battle Visualization System

| Field | Value |
|-------|-------|
| **Title** | Add animated battle sequence for PvE/PvP |
| **Area** | Shared |
| **Player Problem** | Battles resolve instantly with no visual feedback; players can't see the impact of their hero builds |
| **Spec** | - 5-10 second animated battle sequence<br>- Show damage numbers per hit<br>- Show skill activations with visual effects<br>- Show HP bars depleting<br>- Include skip button for veterans<br>- Auto-skip setting in options |
| **Telemetry Events** | `battle_animation_viewed`, `battle_animation_skipped`, `battle_duration_watched`, `skip_button_usage` |
| **Acceptance Criteria** | - Animation plays on stage completion<br>- Damage numbers are readable on all devices<br>- Skip button ends animation early<br>- Performance: 60fps on iPhone 12 equivalent<br>- Telemetry fires on view start and end |

### P0-2: Victory Celebration Screen

| Field | Value |
|-------|-------|
| **Title** | Create satisfying victory screen with confetti and sound |
| **Area** | Shared |
| **Player Problem** | Winning feels flat; no emotional spike on success |
| **Spec** | - Confetti particle effect<br>- Victory sound effect (triumphant)<br>- Character celebration pose (if available)<br>- Stars animate flying to counter<br>- "First Clear!" badge if applicable<br>- Continue button with satisfying press feedback |
| **Telemetry Events** | `victory_screen_shown`, `victory_screen_duration`, `first_clear_shown`, `continue_button_pressed` |
| **Acceptance Criteria** | - Confetti plays on victory<br>- Sound plays (respecting mute setting)<br>- Stars animate with delay between each<br>- First Clear badge shows only once per stage<br>- Screen duration logged |

### P0-3: Defeat Feedback System

| Field | Value |
|-------|-------|
| **Title** | Show helpful feedback on defeat |
| **Area** | Shared |
| **Player Problem** | Defeat shows "DEFEAT" with no guidance; players don't know how to improve |
| **Spec** | - Show power gap percentage ("Enemy was 30% stronger")<br>- Show recommended hero type ("Try using magic heroes")<br>- Show "Almost!" indicator if within 10% power<br>- Suggest upgrades ("Level your DPS to 50")<br>- Retry button prominent<br>- "Get Stronger" button → relevant upgrade screen |
| **Telemetry Events** | `defeat_screen_shown`, `defeat_reason_displayed`, `defeat_tip_type`, `retry_tapped`, `get_stronger_tapped`, `upgrade_suggestion_followed` |
| **Acceptance Criteria** | - Power gap shown as percentage<br>- At least one actionable tip shown<br>- "Almost!" shows only when margin < 10%<br>- "Get Stronger" navigates to hero upgrade<br>- All interactions logged |

### P0-4: Daily Login Reward System

| Field | Value |
|-------|-------|
| **Title** | Implement daily login rewards with streak bonuses |
| **Area** | Shared |
| **Player Problem** | No clear daily return trigger; unclear if daily rewards exist |
| **Spec** | - Show daily reward modal on first login of day<br>- 7-day streak calendar<br>- Escalating rewards per day<br>- Streak broken if miss a day<br>- "Streak Saver" purchasable item (optional monetization)<br>- Monthly calendar for premium tier (optional) |
| **Telemetry Events** | `daily_login_shown`, `daily_login_claimed`, `login_streak_length`, `streak_broken`, `streak_saver_used`, `streak_saver_purchased` |
| **Acceptance Criteria** | - Modal shows once per day<br>- Rewards claimable with tap<br>- Streak counter persists<br>- Streak resets on miss<br>- Backend stores claim timestamp<br>- Telemetry fires on claim |

---

## P1 — HIGH PRIORITY

### P1-1: Boss Intro Cinematics

| Field | Value |
|-------|-------|
| **Title** | Add dramatic boss introduction sequence |
| **Area** | PvE |
| **Player Problem** | Chapter bosses feel like regular stages; no sense of milestone |
| **Spec** | - 3-5 second boss intro animation<br>- Boss name reveal with title<br>- Mechanic hint text (e.g., "Beware the Rallying Cry!")<br>- Dramatic pose/entrance<br>- Skip button<br>- Only plays on first attempt |
| **Telemetry Events** | `boss_intro_shown`, `boss_intro_watched_full`, `boss_intro_skipped`, `boss_intro_skip_timestamp` |
| **Acceptance Criteria** | - Intro plays before boss battle<br>- Name and title readable<br>- Hint provides useful information<br>- Skip ends animation immediately<br>- Only shows on first attempt per boss |

### P1-2: PvP Battle Summary

| Field | Value |
|-------|-------|
| **Title** | Show post-battle summary for arena matches |
| **Area** | PvP |
| **Player Problem** | Arena battles are instant; no understanding of why you won/lost |
| **Spec** | - Post-battle summary panel<br>- Show key hero contributions ("Your [Hero] dealt 45% of damage")<br>- Show counter/advantage indicators<br>- Show "close call" if margin < 5%<br>- Expandable for full battle log<br>- Share button (optional) |
| **Telemetry Events** | `pvp_summary_shown`, `pvp_summary_expanded`, `pvp_summary_duration`, `pvp_share_tapped` |
| **Acceptance Criteria** | - Summary shows after arena battle<br>- Hero contributions are calculated and displayed<br>- Close call indicator works<br>- Expand shows detailed log<br>- All interactions logged |

### P1-3: Skip Dialogue Option

| Field | Value |
|-------|-------|
| **Title** | Add "Skip All" button and auto-skip setting for dialogues |
| **Area** | PvE |
| **Player Problem** | Story dialogue interrupts flow; veterans want to skip |
| **Spec** | - "Skip All" button in dialogue UI<br>- Auto-skip toggle in Settings<br>- First-time warning when enabling auto-skip<br>- Dialogue log accessible for lore lovers<br>- Skip counter for analytics |
| **Telemetry Events** | `dialogue_shown`, `dialogue_skipped`, `skip_all_tapped`, `auto_skip_enabled`, `dialogue_log_viewed` |
| **Acceptance Criteria** | - Skip All ends current dialogue sequence<br>- Auto-skip setting persists<br>- Warning shows on first enable<br>- Dialogue log stores all seen dialogues<br>- Skip rate tracked |

### P1-4: Reward Reveal Sequence

| Field | Value |
|-------|-------|
| **Title** | Animate rewards appearing sequentially with sound |
| **Area** | Shared |
| **Player Problem** | Rewards appear all at once; no anticipation or excitement |
| **Spec** | - Rewards reveal one by one (0.3s delay)<br>- Order: gold → materials → equipment → gems<br>- Sound per item type<br>- Counter animates up<br>- "Tap to skip" accelerates reveal<br>- Rare items have special fanfare |
| **Telemetry Events** | `reward_reveal_started`, `reward_reveal_completed`, `reward_reveal_skipped`, `rare_reward_shown` |
| **Acceptance Criteria** | - Rewards animate in sequence<br>- Sound plays (respecting mute)<br>- Tap accelerates to instant<br>- Rare items (equipment, gems) have distinct effect<br>- Duration logged |

### P1-5: Campaign Power Wall Detection

| Field | Value |
|-------|-------|
| **Title** | Track where players hit power walls and surface recommendations |
| **Area** | PvE |
| **Player Problem** | Players get stuck at difficulty spikes with no guidance |
| **Spec** | - Track consecutive failures on same stage<br>- After 3 failures, show "Get Stronger" prompt<br>- Suggest specific actions (dungeon runs, hero upgrades)<br>- Track wall locations across player base<br>- Use data to tune difficulty curve |
| **Telemetry Events** | `power_wall_hit`, `power_wall_stage`, `power_wall_prompt_shown`, `power_wall_suggestion_followed`, `power_wall_cleared` |
| **Acceptance Criteria** | - 3+ failures triggers prompt<br>- Prompt shows actionable suggestions<br>- Suggestions link to relevant screens<br>- Wall data aggregated for analysis<br>- Player can dismiss prompt |

---

## P2 — MEDIUM PRIORITY

### P2-1: Star Collection Animation

| Field | Value |
|-------|-------|
| **Title** | Animate stars flying to chapter progress counter |
| **Area** | PvE |
| **Player Problem** | Stars awarded but visually static; collection feels underwhelming |
| **Spec** | - Stars animate from stage position to header counter<br>- 0.2s delay between each star<br>- Counter increments on arrival<br>- Sound per star<br>- Sparkle trail effect |
| **Telemetry Events** | `star_animation_played`, `star_count_updated` |
| **Acceptance Criteria** | - Animation plays on stage clear with stars<br>- Counter updates in sync with arrival<br>- Sound plays<br>- Looks good on all screen sizes |

### P2-2: Arena Stat Normalization

| Field | Value |
|-------|-------|
| **Title** | Add "Ranked" arena mode with stat normalization |
| **Area** | PvP |
| **Player Problem** | Arena uses raw power; whales vs F2P imbalance potential |
| **Spec** | - New "Ranked" tab alongside "Open"<br>- Ranked mode scales all heroes to common stat band<br>- Keep hero abilities/synergies intact<br>- Separate leaderboard for Ranked<br>- Seasonal resets for Ranked |
| **Telemetry Events** | `ranked_mode_entered`, `ranked_match_completed`, `ranked_vs_open_preference`, `normalized_win_rate` |
| **Acceptance Criteria** | - Ranked mode accessible in Arena<br>- Stats normalized to defined band<br>- Hero abilities unchanged<br>- Separate leaderboard exists<br>- Seasonal reset clears ratings |

### P2-3: Dungeon Sweep vs Manual Tracking

| Field | Value |
|-------|-------|
| **Title** | Track sweep usage vs manual dungeon runs |
| **Area** | PvE |
| **Player Problem** | Unknown if players prefer sweep or manual; need data for engagement decisions |
| **Spec** | - Track every dungeon entry type<br>- Compare sweep vs manual per dungeon type<br>- Track time spent in manual runs<br>- Surface in analytics dashboard |
| **Telemetry Events** | `dungeon_sweep_used`, `dungeon_manual_started`, `dungeon_manual_completed`, `dungeon_manual_duration` |
| **Acceptance Criteria** | - All dungeon entries logged<br>- Sweep count tracked<br>- Manual start/end tracked<br>- Duration calculated<br>- Data exportable for analysis |

### P2-4: Campaign Chapter Completion Celebration

| Field | Value |
|-------|-------|
| **Title** | Add special celebration when completing a chapter |
| **Area** | PvE |
| **Player Problem** | Completing a chapter (boss defeat) should feel like a major milestone |
| **Spec** | - Special "Chapter Complete!" screen<br>- Show chapter summary (stars, time, attempts)<br>- Preview next chapter unlock<br>- Special reward chest animation<br>- Achievement badge awarded<br>- Share button (optional) |
| **Telemetry Events** | `chapter_completed`, `chapter_completion_screen_shown`, `chapter_completion_shared`, `next_chapter_previewed` |
| **Acceptance Criteria** | - Screen shows on boss defeat<br>- Summary accurate<br>- Next chapter preview correct<br>- Achievement awarded<br>- Screen duration logged |

### P2-5: PvP Season Pass Integration

| Field | Value |
|-------|-------|
| **Title** | Add seasonal rewards track for arena participation |
| **Area** | PvP |
| **Player Problem** | Arena lacks long-term progression beyond rating |
| **Spec** | - Seasonal reward track (free + premium)<br>- Points earned from arena matches<br>- Escalating rewards (cosmetics, currency, exclusive items)<br>- Season length: 1 month<br>- Clear end-of-season rewards for rank thresholds |
| **Telemetry Events** | `season_pass_viewed`, `season_pass_tier_claimed`, `season_pass_purchased`, `season_end_rewards_claimed` |
| **Acceptance Criteria** | - Season pass accessible from Arena<br>- Points awarded per match<br>- Free and premium tracks work<br>- Season end distributes rewards<br>- All purchases logged |

---

## BACKLOG SUMMARY

| Priority | Count | Total Effort |
|----------|-------|-------------|
| P0 | 4 | L + M + M + M = XL |
| P1 | 5 | M + M + S + S + M = L |
| P2 | 5 | S + L + S + M + M = L |

**Recommended Sprint Plan:**

- **Sprint 1 (Phase 4.1):** P0-1 (Battle Viz), P0-2 (Victory), P0-3 (Defeat)
- **Sprint 2 (Phase 4.2):** P0-4 (Daily Login), P1-3 (Skip Dialogue), P1-4 (Reward Reveal)
- **Sprint 3 (Phase 4.3):** P1-1 (Boss Intro), P1-2 (PvP Summary), P1-5 (Power Wall)
- **Sprint 4 (Phase 5.1):** P2-2 (Normalization), P2-5 (Season Pass)
- **Sprint 5 (Phase 5.2):** P2-1 (Stars), P2-3 (Tracking), P2-4 (Chapter Celebration)

---

## DEPENDENCY GRAPH

```
P0-1 (Battle Viz) ─────► P0-2 (Victory) ─────► P1-4 (Reward Reveal)
         │                     │
         │                     ▼
         │               P0-3 (Defeat)
         │                     │
         ▼                     ▼
    P1-1 (Boss Intro)    P1-5 (Power Wall)
         │
         ▼
    P2-4 (Chapter Celebration)

P1-2 (PvP Summary) ─────► P2-2 (Normalization) ─────► P2-5 (Season Pass)

P0-4 (Daily Login) ──── Independent

P1-3 (Skip Dialogue) ── Independent

P2-1 (Star Animation) ── Independent

P2-3 (Sweep Tracking) ── Independent
```

---

**END OF PvE/PvP BACKLOG**
