# POWER CURVE DESIGN DOCUMENT (AUTHORITATIVE)

Last Updated: January 2025
Status: LOCKED — Changes require guard update

---

## 1. CORE FORMULA

```
finalStat = baseStat × starMultiplier × affinityMultiplier
```

### Components:
- **baseStat**: Fixed by hero rarity (N → UR+)
- **starMultiplier**: 1.0 → 2.25 (stars 1-6)
- **affinityMultiplier**: 1.0 → 1.30 (tiers 0-5)

### Maximum Multiplier:
```
Max = 2.25 × 1.30 = 2.925× base stats
```

---

## 2. BASE STATS BY RARITY

| Rarity | HP | ATK | DEF | Power Index |
|--------|-----|-----|-----|-------------|
| N | 500 | 50 | 30 | 580 |
| R | 750 | 75 | 45 | 870 |
| SR | 1000 | 100 | 60 | 1160 |
| SSR | 1500 | 150 | 90 | 1740 |
| SSR+ | 2000 | 200 | 120 | 2320 |
| UR | 2500 | 250 | 150 | 2900 |
| UR+ | 3000 | 300 | 180 | 3480 |

---

## 3. STAR MULTIPLIER TABLE (LOCKED)

| Star | Multiplier | Shard Cost | Cumulative Shards |
|------|------------|------------|-------------------|
| 1★ | 1.00 | 0 | 0 |
| 2★ | 1.15 | 20 | 20 |
| 3★ | 1.35 | 40 | 60 |
| 4★ | 1.60 | 80 | 140 |
| 5★ | 1.90 | 160 | 300 |
| 6★ | 2.25 | 320 | 620 |

### Design Intent:
- 1★→3★: **Fast dopamine** (60 shards total, ~1-2 weeks F2P)
- 4★: **Commitment gate** (140 cumulative, ~3-4 weeks)
- 5★→6★: **Aspirational** (300-620, months of focus)

---

## 4. AFFINITY MULTIPLIER TABLE (LOCKED)

| Tier | Name | Multiplier | Affinity Required |
|------|------|------------|-------------------|
| 0 | Stranger | 1.00 | 0 |
| 1 | Acquaintance | 1.05 | 100 |
| 2 | Companion | 1.10 | 500 |
| 3 | Trusted | 1.15 | 1500 |
| 4 | Devoted | 1.20 | 4000 |
| 5 | Soulbound | 1.30 | 10000 |

### Design Intent:
- Affinity is **horizontal progression** (intimacy, story)
- Stars are **vertical progression** (power)
- Affinity should NOT outscale stars

---

## 5. PLAYER POWER INDEX (PPI) SIMULATION

### Assumptions:
- Main hero: SSR (base power 1740)
- Team of 5 heroes

| Day | F2P | VIP 3 | VIP 7 | VIP 12 |
|-----|-----|-------|-------|--------|
| 1 | 8,700 | 8,700 | 8,700 | 8,700 |
| 7 | 12,000 | 14,000 | 16,000 | 18,000 |
| 30 | 25,000 | 35,000 | 50,000 | 70,000 |
| 90 | 60,000 | 100,000 | 160,000 | 250,000 |

### Power Growth Rate:
- F2P: ~2.3× per month
- VIP 7+: ~3.2× per month

---

## 6. ENEMY POWER INDEX (EPI) SCALING

### Campaign Chapters:
| Chapter | Enemy Power | Recommended PPI | F2P Days |
|---------|-------------|-----------------|----------|
| 1-3 | 5,000-15,000 | 8,000-18,000 | 1-7 |
| 4-6 | 15,000-35,000 | 20,000-40,000 | 7-21 |
| 7-10 | 35,000-80,000 | 45,000-90,000 | 21-45 |
| 11-15 | 80,000-180,000 | 100,000-200,000 | 45-90 |
| 16-20 | 180,000-400,000 | 220,000-450,000 | 90-180 |

### Time-to-Kill (TTK) Targets:
- Trash mobs: 2-5 seconds
- Elite mobs: 10-20 seconds
- Bosses: 30-90 seconds
- Raid bosses: 3-10 minutes

---

## 7. ZONE HEALTH CHECK

| Zone | Status | Issue | Recommendation |
|------|--------|-------|----------------|
| Day 1-7 | 🟢 GREEN | None | Fast progression, good dopamine |
| Day 7-14 | 🟢 GREEN | None | Stars feel impactful |
| Day 14-30 | 🟡 YELLOW | Potential wall at Chapter 7 | Ensure idle rewards bridge gap |
| Day 30-60 | 🟢 GREEN | None | 4★ grind feels meaningful |
| Day 60-90 | 🟡 YELLOW | VIP gap widens | Consider catch-up events |
| Day 90+ | 🔴 RED | F2P may feel stuck | Add aspirational F2P paths |

---

## 8. IDLE REWARD ACCELERATION

| VIP | Idle Rate | Cap Hours | 24h Gold | 24h Coins |
|-----|-----------|-----------|----------|----------|
| 0 | 5% | 8 | 100 | 50 |
| 3 | 5% | 14 | 175 | 87 |
| 7 | 15% | 22 | 825 | 412 |
| 12 | 40% | 60 | 6,000 | 3,000 |
| 15 | 55% | 168 | 23,100 | 11,550 |

### Acceleration Check:
- VIP 7 gets ~8× F2P idle income
- VIP 15 gets ~230× F2P idle income
- **RECOMMENDATION**: Consider F2P catch-up mechanics

---

## 9. RECOMMENDATIONS

### Flatten:
- [ ] Consider diminishing returns on idle rate at VIP 12+
- [ ] Add F2P milestone rewards (Day 30, 60, 90)

### Spike:
- [ ] Add event-based power spikes (limited heroes, gear)
- [ ] Seasonal catch-up banners

### Gate:
- [ ] Chapter 7 should be soft wall, not hard wall
- [ ] Consider "rental" heroes for stuck players

---

## 10. GUARD ENFORCEMENT

**guard-power-curve.mjs** must verify:
- ❌ No stat multiplier changes without doc update
- ❌ No base stat changes without simulation review
- ❌ No new multiplier sources without formula update

---

**END OF POWER CURVE DOCUMENT**
