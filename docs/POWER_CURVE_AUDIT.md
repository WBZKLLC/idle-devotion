# POWER CURVE AUDIT (COMPLETE NUMERICAL ANALYSIS)

Generated: January 2025
Status: AUTHORITATIVE — Based on actual backend tables

---

## 1. SOURCE DATA (FROM BACKEND)

### BASE_STATS_BY_RARITY

| Rarity | HP | ATK | DEF | Power Index |
|--------|-----|-----|-----|-------------|
| N | 500 | 50 | 30 | 580 |
| R | 750 | 75 | 45 | 870 |
| SR | 1,000 | 100 | 60 | 1,160 |
| SSR | 1,500 | 150 | 90 | 1,740 |
| SSR+ | 2,000 | 200 | 120 | 2,320 |
| UR | 2,500 | 250 | 150 | 2,900 |
| UR+ | 3,000 | 300 | 180 | 3,480 |

*Power Index = HP + ATK + DEF*

### STAR_TABLE (Multipliers)

| Star | statMultiplier | shardCost | Cumulative |
|------|----------------|-----------|------------|
| 1★ | 1.00 | 0 | 0 |
| 2★ | 1.15 | 20 | 20 |
| 3★ | 1.35 | 40 | 60 |
| 4★ | 1.60 | 80 | 140 |
| 5★ | 1.90 | 160 | 300 |
| 6★ | 2.25 | 320 | 620 |

### AFFINITY_MULTIPLIERS (Actual Backend Values)

| Tier | Name | Multiplier | Affinity Required |
|------|------|------------|-------------------|
| 0 | Stranger | 1.00 | 0 |
| 1 | Acquaintance | 1.05 | 100 |
| 2 | Companion | 1.10 | 500 |
| 3 | Trusted | 1.15 | 1,500 |
| 4 | Devoted | 1.20 | 4,000 |
| 5 | Soulbound | 1.30 | 10,000 |

---

## 2. POWER PROXY INDEX (PPI) TABLE

**Formula:** `PPI = starMultiplier × affinityMultiplier`

This is the baseStat-agnostic multiplier. Higher = stronger.

| Star \ Affinity | T0 | T1 | T2 | T3 | T4 | T5 |
|-----------------|------|------|------|------|------|------|
| 1★ | 1.000 | 1.050 | 1.100 | 1.150 | 1.200 | 1.300 |
| 2★ | 1.150 | 1.208 | 1.265 | 1.323 | 1.380 | 1.495 |
| 3★ | 1.350 | 1.418 | 1.485 | 1.553 | 1.620 | 1.755 |
| 4★ | 1.600 | 1.680 | 1.760 | 1.840 | 1.920 | 2.080 |
| 5★ | 1.900 | 1.995 | 2.090 | 2.185 | 2.280 | 2.470 |
| 6★ | 2.250 | 2.363 | 2.475 | 2.588 | 2.700 | **2.925** |

### Key Observations

- **Max vs Min:** 6★ T5 vs 1★ T0 = **2.925× power spread**
- **Star Impact:** 1★→6★ at T0 = 2.25× (dominant axis)
- **Affinity Impact:** T0→T5 at 1★ = 1.30× (secondary axis)
- **Star dominates affinity** by design (4.2:1 ratio)

---

## 3. ABSOLUTE STAT BANDS (COMPUTED)

### UR+ Hero (Base: HP 3000, ATK 300, DEF 180)

| Star | Affinity | HP | ATK | DEF | DPS Proxy |
|------|----------|------|-----|-----|----------|
| 1★ | T0 | 3,000 | 300 | 180 | 300 |
| 1★ | T5 | 3,900 | 390 | 234 | 390 |
| 3★ | T0 | 4,050 | 405 | 243 | 405 |
| 3★ | T3 | 4,658 | 466 | 279 | 466 |
| 6★ | T0 | 6,750 | 675 | 405 | 675 |
| 6★ | T5 | **8,775** | **878** | **527** | **878** |

### SSR Hero (Base: HP 1500, ATK 150, DEF 90)

| Star | Affinity | HP | ATK | DEF | DPS Proxy |
|------|----------|------|-----|-----|----------|
| 1★ | T0 | 1,500 | 150 | 90 | 150 |
| 3★ | T3 | 2,329 | 233 | 140 | 233 |
| 6★ | T5 | **4,388** | **439** | **263** | **439** |

### SR Hero (Base: HP 1000, ATK 100, DEF 60)

| Star | Affinity | HP | ATK | DEF | DPS Proxy |
|------|----------|------|-----|-----|----------|
| 1★ | T0 | 1,000 | 100 | 60 | 100 |
| 6★ | T5 | **2,925** | **293** | **176** | **293** |

---

## 4. CAMPAIGN DIFFICULTY CURVE (RECOMMENDED)

### Enemy Stat Scaling by Chapter

| Chapter | Enemy HP | Enemy ATK | Recommended Hero | Min Stars |
|---------|----------|-----------|------------------|-----------|
| 1-3 | 800-2,400 | 80-240 | SR | 1★-2★ |
| 4-6 | 2,400-4,500 | 240-450 | SR/SSR | 2★-3★ |
| 7-9 | 4,500-7,500 | 450-750 | SSR | 3★-4★ |
| 10-12 | 7,500-12,000 | 750-1,200 | SSR+/UR | 4★-5★ |
| 13-15 | 12,000-20,000 | 1,200-2,000 | UR/UR+ | 5★-6★ |
| 16-20 | 20,000-35,000 | 2,000-3,500 | UR+ | 6★ T3+ |

### Time-to-Kill (TTK) Targets

| Mob Type | Recommended TTK |
|----------|----------------|
| Trash | 2-5 seconds |
| Elite | 10-20 seconds |
| Boss | 30-90 seconds |
| Raid Boss | 3-10 minutes |

---

## 5. SHARD ECONOMY CURVE

### Shard Cost Progression (Doubling After 40)

```
1★ → 2★: 20 shards
2★ → 3★: 40 shards (2×)
3★ → 4★: 80 shards (2×)
4★ → 5★: 160 shards (2×)
5★ → 6★: 320 shards (2×)
```

### Economy Knobs (Tunable)

1. **Shard Income Rate**
   - Gacha dupes: ~5-15 shards/day (F2P)
   - Events: ~10-30 shards/event
   - Shop packs: Variable

2. **Promotion Gating Cadence**
   - 1★→3★: ~1-2 weeks (fast dopamine)
   - 4★: ~3-4 weeks (commitment gate)
   - 5★→6★: ~2-3 months (aspirational)

---

## 6. SPIKE ANALYSIS (FLAGS)

### ⚠️ Potential Balance Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| 6★ T5 vs 1★ T0 | MEDIUM | 2.925× spread may feel unfair in PvP |
| UR+ vs SR at same stars | HIGH | 3× base stat gap compounds with stars |
| VIP idle advantage | LOW | 230× F2P at VIP 15 (documented, intended) |

### ✅ Balance Strengths

- Star dominates affinity (clear progression axis)
- Shard costs scale exponentially (prevents instant max)
- No VIP stat buffs (combat integrity preserved)

---

## 7. PVP IMPLICATIONS

### If PvP is added:

1. **Stat Normalization Required** - 2.925× spread is too large for raw stat checking
2. **League Brackets** - By power score or roster depth
3. **Draft/Limited Formats** - Collection breadth > raw stats

### Recommended PvP Modes

| Mode | Normalization | Notes |
|------|--------------|-------|
| Casual Arena | None | Whale playground |
| Ranked Arena | Stat caps | Competitive integrity |
| Guild War | Power brackets | Team coordination matters |
| Tournament | Full normalization | Pure skill |

---

## 8. GUARD ENFORCEMENT

**guard-power-curve.mjs** verifies:
- ✅ STAR_TABLE multipliers match doc
- ✅ BASE_STATS_BY_RARITY has all rarities
- ✅ AFFINITY_MULTIPLIERS range 1.0→1.30
- ✅ No hardcoded stat buffs outside tables

---

**END OF POWER CURVE AUDIT**
