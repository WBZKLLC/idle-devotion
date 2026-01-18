# PvP Loop Review

Last Updated: January 2025
Phase: 3.53 (Document-only, no code changes)
Status: **REVIEW DRAFT**

---

## 1. Current PvP State

### Arena Mode (Shipped)

| Aspect | Current Implementation | Notes |
|--------|----------------------|-------|
| **Mode** | 1v1 Async Arena | Rating-based matchmaking |
| **Entry** | Arena Tickets | 5 max, 30min regen |
| **Resolution** | Instant (no animation) | Phase 3.50 can add presentation |
| **Rewards** | Arena Coins + Rating | Daily/weekly bonuses |
| **Matchmaking** | ELO-based | ±200 rating window |

### Current Attempt Limits

| Resource | Limit | Regen Rate | Notes |
|----------|-------|------------|-------|
| Arena Tickets | 5 max | 1 per 30min | Generous; not aggressive |
| Daily Attempts | Unlimited | Via tickets | No hard daily cap |
| Refresh List | Free | Instant | Can pick favorable matches |

---

## 2. Matchmaking Transparency Requirements

### Must Display (Non-Negotiable)

1. **Opponent Power Score** - Always visible before match
2. **Potential Rating Change** - "Win: +15, Lose: -10"
3. **Win Streak Indicator** - If on streak, show it
4. **Rank/Tier Badge** - Visual indicator of opponent tier

### Should Display (Recommended)

1. **Opponent Team Preview** - Hero portraits visible
2. **Power Gap Warning** - "Opponent is 30% stronger"
3. **Recent Win Rate** - Last 10 matches indicator

### Must NOT Display

1. **Whale Indicators** - No "VIP" or "Premium" badges in PvP context
2. **Spending History** - Never expose monetization status
3. **Real Names** - Username only

---

## 3. Rank Rewards Cadence

### Current State

| Tier | Rating Range | Daily Reward | Weekly Reward |
|------|-------------|--------------|---------------|
| Bronze | 0-999 | 50 Arena Coins | 500 Arena Coins |
| Silver | 1000-1499 | 100 Arena Coins | 1000 Arena Coins |
| Gold | 1500-1999 | 150 Arena Coins | 1500 Arena Coins |
| Platinum | 2000-2499 | 200 Arena Coins | 2000 Arena Coins |
| Diamond | 2500+ | 300 Arena Coins | 3000 Arena Coins |

### Recommended Improvements

1. **Season Reset** - Monthly soft reset (50% rating decay above 1500)
2. **Participation Rewards** - Small daily reward for any 3 matches
3. **Streak Bonuses** - +10% coins per win streak (cap at 5x)

---

## 4. Non-Negotiables (Ethics Compliance)

Copied from `/app/docs/pvp-monetization-ethics.md`:

### Hard Rules

1. **No Paid Stat Advantages** - VIP cannot give combat buffs in PvP
2. **No Paid Matchmaking** - Cannot pay to face weaker opponents
3. **No Loot Box Exclusive PvP Gear** - Arena shop must be earnable
4. **No Pay-to-Skip** - Cannot buy rating directly
5. **Tickets ≠ Power** - More tickets = more attempts, not stronger heroes

### Allowed Monetization

1. **Cosmetic Badges** - Purchasable rank frames (no stat effect)
2. **Extra Tickets** - Buy more daily attempts (cap at 10 extra)
3. **Arena Pass** - Seasonal premium track with cosmetics
4. **Instant Refresh** - Skip ticket cooldown (not exploitable)

---

## 5. Implementation Checklist (Future Phases)

- [ ] Add opponent power display to Arena screen
- [ ] Add rating change preview
- [ ] Implement season reset system
- [ ] Add participation rewards
- [ ] Create Arena Pass feature
- [ ] Add BattlePresentationModal to Arena (Phase 4.x)

---

## 6. Guard Enforcement

This document is enforced by:
- `guard-pvp-ethics.mjs` - Ensures no VIP combat buffs
- `guard-phase-3-53-pvp-review.mjs` - Ensures this doc exists

---

**END OF PvP LOOP REVIEW**
