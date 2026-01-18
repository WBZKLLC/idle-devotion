# STAR + AFFINITY VALUE MATRIX

Last Updated: January 2025
Status: LOCKED

---

## 1. STARS VS AFFINITY COMPARISON

### Multiplier Comparison:

| Progression | Min Mult | Max Mult | Range | Investment |
|-------------|----------|----------|-------|------------|
| Stars (1→6) | 1.00 | 2.25 | +125% | Shards (620 total) |
| Affinity (0→5) | 1.00 | 1.30 | +30% | Time + Tributes |

### Combined Maximum:
```
2.25 × 1.30 = 2.925× base stats
```

---

## 2. VALUE PER INVESTMENT

### Stars - Shard Efficiency:

| Star | Cost | Total Cost | Mult Gain | Efficiency |
|------|------|------------|-----------|------------|
| 2★ | 20 | 20 | +0.15 | 0.0075/shard |
| 3★ | 40 | 60 | +0.20 | 0.0050/shard |
| 4★ | 80 | 140 | +0.25 | 0.0031/shard |
| 5★ | 160 | 300 | +0.30 | 0.0019/shard |
| 6★ | 320 | 620 | +0.35 | 0.0011/shard |

**Insight**: Early stars are most efficient. Late stars are aspirational.

### Affinity - Time Efficiency:

| Tier | Affinity | Days (est) | Mult Gain | Efficiency |
|------|----------|------------|-----------|------------|
| 1 | 100 | 3 | +0.05 | 0.0005/affinity |
| 2 | 500 | 10 | +0.05 | 0.0001/affinity |
| 3 | 1500 | 25 | +0.05 | 0.00003/affinity |
| 4 | 4000 | 50 | +0.05 | 0.00001/affinity |
| 5 | 10000 | 100+ | +0.10 | 0.00001/affinity |

**Insight**: Affinity is slow but steady. Rewards engagement.

---

## 3. ACQUISITION RATE ANALYSIS

### Shard Income Sources:

| Source | Shards/Day (F2P) | Shards/Day (VIP7) |
|--------|------------------|-------------------|
| Gacha Dupes | 5-10 | 15-25 |
| Events | 2-5 | 5-10 |
| Shop (free) | 1-2 | 3-5 |
| Idle Rewards | 0 | 0 |
| **Total** | **8-17** | **23-40** |

### Time to Max Stars (Single Hero):

| Player | Shards/Day | Days to 6★ |
|--------|------------|------------|
| F2P | 12 avg | ~52 days |
| VIP 3 | 20 avg | ~31 days |
| VIP 7 | 30 avg | ~21 days |
| Whale | 100+ | <7 days |

---

## 4. AFFINITY GAIN SOURCES

| Source | Affinity/Day (F2P) | Affinity/Day (VIP10) |
|--------|--------------------|-----------------------|
| Bond Tributes | 30-50 | 60-100 |
| Story Interactions | 10-20 | 10-20 |
| Gifts (from friends) | 5-15 | 10-25 |
| Events | 10-30 | 20-50 |
| **Total** | **55-115** | **100-195** |

### Time to Max Affinity (Single Hero):

| Player | Affinity/Day | Days to Tier 5 |
|--------|--------------|----------------|
| F2P | 85 avg | ~118 days |
| VIP 7 | 120 avg | ~83 days |
| VIP 10+ | 150 avg | ~67 days |

---

## 5. BALANCE VALIDATION

### ✅ Stars Don't Outpace Affinity:
- Max star achievable in ~52 days (F2P)
- Max affinity achievable in ~118 days (F2P)
- Stars complete first → natural progression

### ✅ Affinity Doesn't Outscale Stars:
- Stars: +125% max
- Affinity: +30% max
- Ratio: 4.2:1 in favor of stars

### ✅ Early Game Feels Good:
- 3★ in ~5 days (F2P)
- Tier 2 affinity in ~6 days
- Both feel achievable

### ⚠️ Late Game Consideration:
- 6★ + Tier 5 requires ~120 days focus
- Consider "favorite hero" bonuses?

---

## 6. RECOMMENDATIONS

### Shard Income:
- Current pace is **healthy**
- Consider +20% during events
- Add "shard selector" as milestone rewards

### Affinity Gain:
- Consider VIP bonus to tribute efficiency
- Add "affinity boost" consumable
- Event heroes should gain affinity faster (first 2 weeks)

---

## 7. GUARD ENFORCEMENT

**guard-star-table.mjs** must verify:
- ❌ No shard cost changes without STAR_TABLE update
- ❌ No affinity threshold changes without doc update
- ❌ No new shard sources without income analysis

---

**END OF STAR + AFFINITY MATRIX**
