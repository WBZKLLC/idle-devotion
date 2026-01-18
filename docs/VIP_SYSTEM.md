# VIP SYSTEM DESIGN (EXPANDED)

Last Updated: January 2025
Status: LOCKED — Extensions only, no stat buffs

---

## 1. DESIGN PHILOSOPHY

VIP SHOULD:
- ✅ Remove friction
- ✅ Extend time horizon
- ✅ Increase comfort, not raw dominance

VIP MUST NOT:
- ❌ Provide flat stat boosts
- ❌ Create PvP-only dominance
- ❌ Gate core content

---

## 2. VIP TIER STRUCTURE (16 TIERS)

| Tier | Name | USD Spent | Primary Benefit |
|------|------|-----------|------------------|
| 0 | Free | $0 | Base experience |
| 1 | Bronze | $10 | Instant Collect |
| 2 | Bronze+ | $25 | Extended idle cap |
| 3 | Silver | $50 | +2hr idle cap |
| 4 | Silver+ | $100 | Idle cap > 24h |
| 5 | Gold | $250 | Extra daily rewards |
| 6 | Gold+ | $500 | +1 idle claim/day |
| 7 | Platinum | $1,000 | Streak protection |
| 8 | Platinum+ | $2,000 | +1 pity buffer |
| 9 | Diamond | $3,500 | Shard bonus +5% |
| 10 | Diamond+ | $5,000 | Tribute discount |
| 11 | Ruby | $7,500 | Free daily pack |
| 12 | Ruby+ | $10,000 | Event ticket bonus |
| 13 | Divine | $15,000 | PvE sweep unlock |
| 14 | Divine+ | $20,000 | PvP retry protection |
| 15 | Celestial | $25,000 | All benefits + cosmetics |

---

## 3. BENEFIT MATRIX (COMPLETE)

### IDLE BENEFITS

| VIP | Cap Hours | Rate Mult | Instant Collect | Extra Claims/Day |
|-----|-----------|-----------|-----------------|------------------|
| 0 | 8 | 5% | ❌ | 0 |
| 1 | 10 | 5% | ✅ | 0 |
| 2 | 12 | 5% | ✅ | 0 |
| 3 | 14 | 5% | ✅ | 0 |
| 4 | 16 | 5% | ✅ | 0 |
| 5 | 18 | 5% | ✅ | 0 |
| 6 | 20 | 5% | ✅ | 1 |
| 7 | 22 | 15% | ✅ | 1 |
| 8 | 24 | 20% | ✅ | 1 |
| 9 | 30 | 25% | ✅ | 2 |
| 10 | 36 | 30% | ✅ | 2 |
| 11 | 48 | 35% | ✅ | 2 |
| 12 | 60 | 40% | ✅ | 3 |
| 13 | 72 | 45% | ✅ | 3 |
| 14 | 96 | 50% | ✅ | 3 |
| 15 | 168 | 55% | ✅ | Unlimited |

### DAILY LOGIN BENEFITS

| VIP | Extra Claims | Streak Protection | Calendar Boost |
|-----|--------------|-------------------|----------------|
| 0-6 | 0 | ❌ | 1.0× |
| 7 | 0 | ✅ (1 miss/week) | 1.0× |
| 8-9 | 0 | ✅ (2 miss/week) | 1.1× |
| 10-12 | 1 | ✅ (3 miss/week) | 1.15× |
| 13-15 | 2 | ✅ (unlimited) | 1.25× |

### GACHA BENEFITS

| VIP | Pity Buffer | Dupe Shard Bonus | Banner Access |
|-----|-------------|------------------|---------------|
| 0-7 | 0 | +0% | Standard |
| 8 | +1 | +0% | Standard + Premium |
| 9 | +1 | +5% | All |
| 10 | +2 | +10% | All |
| 11-12 | +2 | +10% | All + Early Access |
| 13-15 | +3 | +15% | All + Exclusive |

### BOND/TRIBUTE BENEFITS

| VIP | Tribute Cost | Daily Limit Bonus | Affinity Bonus |
|-----|--------------|-------------------|----------------|
| 0-9 | 100% | +0 | +0% |
| 10 | 90% | +1 | +5% |
| 11 | 85% | +2 | +10% |
| 12 | 80% | +3 | +10% |
| 13-14 | 75% | +5 | +15% |
| 15 | 70% | Unlimited | +20% |

### SHOP BENEFITS

| VIP | Discount | Free Daily Pack | Bundle Unlocks |
|-----|----------|-----------------|----------------|
| 0-10 | 0% | ❌ | None |
| 11 | 5% | ✅ (Basic) | Growth Pack |
| 12 | 5% | ✅ (Standard) | Premium Pack |
| 13 | 10% | ✅ (Premium) | All Packs |
| 14-15 | 10% | ✅ (Deluxe) | All + Exclusive |

### PVE/PVP BENEFITS

| VIP | PvE Sweep | Event Tickets | PvP Retries |
|-----|-----------|---------------|-------------|
| 0-12 | ❌ | +0 | 0 |
| 13 | ✅ | +2 | 0 |
| 14 | ✅ | +3 | 1/day |
| 15 | ✅ | +5 | 3/day |

---

## 4. COSMETIC BENEFITS

### Avatar Frames:
| VIP | Frame |
|-----|-------|
| 0 | Default |
| 1-2 | Bronze |
| 3-4 | Silver |
| 5-6 | Gold |
| 7-8 | Platinum |
| 9-10 | Diamond |
| 11-12 | Ruby |
| 13-14 | Divine |
| 15 | Celestial (Animated) |

### Chat Bubbles:
| VIP | Bubbles Available |
|-----|-------------------|
| 0-6 | Default only |
| 7-8 | VIP Bronze |
| 9-10 | VIP Emerald |
| 11-12 | VIP Sapphire |
| 13-15 | All + Exclusive |

---

## 5. WHAT VIP DOES NOT PROVIDE

- ❌ Flat stat increases (+ATK, +HP)
- ❌ Exclusive heroes (only early access)
- ❌ PvP matchmaking advantages
- ❌ Guaranteed wins
- ❌ Unlimited resources
- ❌ Skip story/campaign content

---

## 6. IMPLEMENTATION STATUS

| Feature | Status | Backend | Frontend |
|---------|--------|---------|----------|
| Idle Cap | ✅ Done | `get_vip_idle_hours()` | Idle screen |
| Idle Rate | ✅ Done | `get_vip_idle_rate_multiplier()` | Idle screen |
| Instant Collect | ✅ Done | `/api/idle/instant-collect` | Idle screen |
| Avatar Frames | ✅ Done | `get_avatar_frame()` | Profile |
| Chat Bubbles | ✅ Done | VIP check | Chat |
| Extra Claims | ⏳ TODO | Need endpoint | - |
| Streak Protection | ⏳ TODO | Need daily logic | - |
| Pity Buffer | ⏳ TODO | Need gacha update | - |
| Shard Bonus | ⏳ TODO | Need summon update | - |
| Tribute Discount | ⏳ TODO | Need bond update | - |
| Free Daily Pack | ⏳ TODO | Need shop update | - |
| PvE Sweep | ⏳ TODO | Need campaign update | - |
| PvP Retries | ⏳ TODO | Need arena update | - |

---

## 7. GUARD ENFORCEMENT

**guard-vip-benefits.mjs** must verify:
- ❌ No VIP stat buffs (ATK, HP, DEF multipliers)
- ❌ No VIP-exclusive heroes (early access OK)
- ❌ No PvP matchmaking manipulation
- ✅ All VIP benefits are economy/comfort only

---

**END OF VIP SYSTEM DOCUMENT**
