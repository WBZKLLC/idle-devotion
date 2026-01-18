# PvP Normalization Proposal

Last Updated: January 2025
Phase: 3.53 (Document-only, no code changes)
Status: **PROPOSAL DRAFT**

---

## 1. Problem Statement

### Current Power Spread

Based on video analysis, reference games show power scores like:
- Low: ~1,000,000,000 (1B)
- High: ~2,900,000,000 (2.9B)
- **Spread: ~2.925×**

In Idle Devotion, similar spread exists between:
- New F2P players: ~10,000 power
- Veteran whales: ~100,000+ power
- **Spread: 10×+**

### Why This Matters

1. **Match Quality** - 10× power gap = predetermined outcome
2. **Player Retention** - F2P players quit when always losing
3. **Skill Expression** - No room for tactical decisions
4. **Competitive Integrity** - Rankings reflect spending, not skill

---

## 2. Normalization Options

### Option A: Full Stat Normalization ("Ranked Mode")

| Aspect | Description |
|--------|-------------|
| **Concept** | All heroes scaled to common stat band |
| **Hero Abilities** | Preserved (unique skills work normally) |
| **Star Levels** | Ignored for stats, preserved for abilities |
| **Equipment** | Ignored for stats |
| **Result** | Pure team composition + synergy matters |

**Pros:**
- Most fair competitive experience
- Skill > wallet
- Attracts competitive players

**Cons:**
- Reduces incentive to upgrade heroes
- May upset whales
- Complex to implement

### Option B: Bracket-Based Matchmaking

| Aspect | Description |
|--------|-------------|
| **Concept** | Players sorted into power brackets |
| **Brackets** | 0-20k, 20k-50k, 50k-100k, 100k+ |
| **Matchmaking** | Only within same bracket |
| **Result** | Fair matches within cohort |

**Pros:**
- Simpler to implement
- Preserves upgrade incentive
- Natural progression through brackets

**Cons:**
- Top bracket still whale-dominated
- Bracket boundaries feel arbitrary
- Possible bracket manipulation

### Option C: Soft Normalization (Recommended)

| Aspect | Description |
|--------|-------------|
| **Concept** | Reduce power advantage to ±30% max |
| **Formula** | `effective_power = sqrt(actual_power) * base_factor` |
| **Result** | 10× gap becomes ~3× gap |
| **Upgrades** | Still matter, but diminishing returns |

**Pros:**
- Balances fairness and incentives
- Upgrades still meaningful
- Reduces but doesn't eliminate advantage

**Cons:**
- "Hidden" normalization may confuse players
- Needs clear communication
- Requires tuning

---

## 3. Recommended Implementation

### Phase 4.1: Dual Arena Modes

1. **Open Arena** (Current)
   - No normalization
   - Full power matters
   - For players who want to flex upgrades

2. **Ranked Arena** (New)
   - Soft normalization (Option C)
   - Seasonal resets
   - Exclusive cosmetic rewards
   - Competitive leaderboard

### Implementation Steps

```
Phase 4.1.1: Add arena mode selector UI
Phase 4.1.2: Implement soft normalization formula
Phase 4.1.3: Create separate leaderboards
Phase 4.1.4: Add ranked-exclusive cosmetics
Phase 4.1.5: Implement season system
```

---

## 4. Normalization Formula (Proposed)

```typescript
// Soft normalization for Ranked Arena
function normalizeForRanked(actualPower: number): number {
  const BASE_POWER = 50000; // Target median power
  const COMPRESSION_FACTOR = 0.5; // How much to compress (0.5 = sqrt)
  
  // Apply diminishing returns
  const normalized = BASE_POWER * Math.pow(actualPower / BASE_POWER, COMPRESSION_FACTOR);
  
  // Cap the advantage
  const maxAdvantage = 1.5; // 50% max advantage
  const minNormalized = BASE_POWER / maxAdvantage;
  const maxNormalized = BASE_POWER * maxAdvantage;
  
  return Math.max(minNormalized, Math.min(maxNormalized, normalized));
}

// Example outcomes:
// 10,000 power  → 31,623 effective (3.16× boost)
// 50,000 power  → 50,000 effective (baseline)
// 100,000 power → 70,711 effective (0.71× reduction)
// 500,000 power → 75,000 effective (cap hit)
```

---

## 5. Communication Strategy

### In-Game Messaging

1. **Mode Selection Screen**
   - "Open Arena: Your full power matters"
   - "Ranked Arena: Skill-focused, power balanced"

2. **First Ranked Match**
   - Tutorial explaining normalization
   - "In Ranked, strategy matters more than stats!"

3. **Power Display**
   - Show both actual and effective power
   - "Your Power: 100,000 (Ranked: 70,711)"

---

## 6. Telemetry for Validation

| Event | Purpose |
|-------|--------|
| `RANKED_MATCH_PLAYED` | Track adoption |
| `RANKED_VS_OPEN_PREFERENCE` | Which mode players prefer |
| `RANKED_WIN_RATE_BY_ACTUAL_POWER` | Validate normalization working |
| `RANKED_CHURN_RATE` | Compare to Open arena |

---

## 7. Non-Implementation Notes

**This phase (3.53) does NOT implement any of the above.**

This document serves as:
1. A blueprint for future phases
2. A record of design decisions
3. A reference for guard scripts

Code changes will come in Phase 4.x after review.

---

**END OF PvP NORMALIZATION PROPOSAL**
