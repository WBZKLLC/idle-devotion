# VIP SYSTEM DUMP (AUTHORITATIVE)

Generated: 2025-01

---

## 1. VIP TIERS AND NAMES

| Tier | Name | Unlock (USD Spent) |
|------|------|-------------------|
| VIP 0 | Free | $0 |
| VIP 1 | Bronze | $10 |
| VIP 2 | Bronze+ | $25 |
| VIP 3 | Silver | $50 |
| VIP 4 | Silver+ | $100 |
| VIP 5 | Gold | $250 |
| VIP 6 | Gold+ | $500 |
| VIP 7 | Platinum | $1,000 |
| VIP 8 | Platinum+ | $2,000 |
| VIP 9 | Diamond | $3,500 |
| VIP 10 | Diamond+ | $5,000 |
| VIP 11 | Ruby | $7,500 |
| VIP 12 | Ruby+ | $10,000 |
| VIP 13 | Divine | $15,000 |
| VIP 14 | Divine+ | $20,000 |
| VIP 15 | Celestial | $25,000 |

---

## 2. VIP BENEFITS BY TIER (JSON)

```json
{
  "tiers": [
    {
      "tier": 0,
      "name": "Free",
      "unlockCriteria": { "spend": 0 },
      "benefits": {
        "idle": {
          "capHours": 8,
          "rates": { "goldPerHr": 250, "staminaPerHr": 5, "coinsPerHr": 125 },
          "rateMultiplier": 0.05,
          "claimRules": "Manual claim only"
        },
        "daily": { "extraClaims": 0, "streakProtection": false, "calendarBoost": 1.0 },
        "gacha": { "pityAdjustments": 0, "bonusPullCurrency": 0, "bannerAccess": "standard", "dupeShardBonus": 0 },
        "bond": { "tributeCostDiscount": 0, "tributeDailyLimitBonus": 0, "affinityGainBonus": 0 },
        "mail": { "extraReceiptSlots": 0, "claimMultipliers": 1.0 },
        "shop": { "discountPercent": 0, "freeDailyPack": false, "bundleUnlocks": [] },
        "avatarFrame": "default",
        "chatBubbles": []
      }
    },
    {
      "tier": 1,
      "name": "Bronze",
      "unlockCriteria": { "spend": 10 },
      "benefits": {
        "idle": {
          "capHours": 10,
          "rates": { "goldPerHr": 250, "staminaPerHr": 5, "coinsPerHr": 125 },
          "rateMultiplier": 0.05,
          "claimRules": "Manual + Instant Collect (2hr)"
        },
        "daily": { "extraClaims": 0, "streakProtection": false, "calendarBoost": 1.0 },
        "gacha": { "pityAdjustments": 0, "bonusPullCurrency": 0, "bannerAccess": "standard", "dupeShardBonus": 0 },
        "bond": { "tributeCostDiscount": 0, "tributeDailyLimitBonus": 0, "affinityGainBonus": 0 },
        "mail": { "extraReceiptSlots": 0, "claimMultipliers": 1.0 },
        "shop": { "discountPercent": 0, "freeDailyPack": false, "bundleUnlocks": [] },
        "avatarFrame": "bronze",
        "chatBubbles": []
      }
    },
    {
      "tier": 7,
      "name": "Platinum",
      "unlockCriteria": { "spend": 1000 },
      "benefits": {
        "idle": {
          "capHours": 22,
          "rates": { "goldPerHr": 250, "staminaPerHr": 5, "coinsPerHr": 125 },
          "rateMultiplier": 0.15,
          "claimRules": "Manual + Instant Collect (2hr)"
        },
        "daily": { "extraClaims": 0, "streakProtection": false, "calendarBoost": 1.0 },
        "gacha": { "pityAdjustments": 0, "bonusPullCurrency": 0, "bannerAccess": "standard+premium", "dupeShardBonus": 0 },
        "bond": { "tributeCostDiscount": 0, "tributeDailyLimitBonus": 0, "affinityGainBonus": 0 },
        "mail": { "extraReceiptSlots": 0, "claimMultipliers": 1.0 },
        "shop": { "discountPercent": 0, "freeDailyPack": false, "bundleUnlocks": [] },
        "avatarFrame": "gold",
        "chatBubbles": []
      }
    },
    {
      "tier": 9,
      "name": "Diamond",
      "unlockCriteria": { "spend": 3500 },
      "benefits": {
        "idle": {
          "capHours": 30,
          "rates": { "goldPerHr": 250, "staminaPerHr": 5, "coinsPerHr": 125 },
          "rateMultiplier": 0.25,
          "claimRules": "Manual + Instant Collect (2hr)"
        },
        "daily": { "extraClaims": 0, "streakProtection": false, "calendarBoost": 1.0 },
        "gacha": { "pityAdjustments": 0, "bonusPullCurrency": 0, "bannerAccess": "all", "dupeShardBonus": 0 },
        "bond": { "tributeCostDiscount": 0, "tributeDailyLimitBonus": 0, "affinityGainBonus": 0 },
        "mail": { "extraReceiptSlots": 0, "claimMultipliers": 1.0 },
        "shop": { "discountPercent": 0, "freeDailyPack": false, "bundleUnlocks": [] },
        "avatarFrame": "diamond",
        "chatBubbles": ["vip_emerald"]
      }
    },
    {
      "tier": 15,
      "name": "Celestial",
      "unlockCriteria": { "spend": 25000 },
      "benefits": {
        "idle": {
          "capHours": 168,
          "rates": { "goldPerHr": 250, "staminaPerHr": 5, "coinsPerHr": 125 },
          "rateMultiplier": 0.55,
          "claimRules": "Manual + Instant Collect (2hr)"
        },
        "daily": { "extraClaims": 0, "streakProtection": false, "calendarBoost": 1.0 },
        "gacha": { "pityAdjustments": 0, "bonusPullCurrency": 0, "bannerAccess": "all+exclusive", "dupeShardBonus": 0 },
        "bond": { "tributeCostDiscount": 0, "tributeDailyLimitBonus": 0, "affinityGainBonus": 0 },
        "mail": { "extraReceiptSlots": 0, "claimMultipliers": 1.0 },
        "shop": { "discountPercent": 0, "freeDailyPack": false, "bundleUnlocks": [] },
        "avatarFrame": "divine",
        "chatBubbles": ["vip_emerald", "vip_skyblue"]
      }
    }
  ]
}
```

---

## 3. FORMULAS

### VIP Points Accrual
```python
# VIP is based on total USD spent (server-tracked)
# No separate "VIP points" system - direct spend conversion

def calculate_vip_level(total_spent: float) -> int:
    """Calculate VIP level based on total spent"""
    vip_level = 0
    for level in range(15, -1, -1):
        if total_spent >= VIP_TIERS[level]["spend"]:
            vip_level = level
            break
    return vip_level
```

### Idle Rate Multiplier
```python
def get_vip_idle_rate_multiplier(vip_level: int) -> float:
    """
    VIP 0-6: 5% (0.05)
    VIP 7: 15% (0.15)
    VIP 8+: +5% per level (0.20, 0.25, 0.30, etc.)
    """
    if vip_level < 7:
        return 0.05
    elif vip_level == 7:
        return 0.15
    else:
        additional_levels = vip_level - 7
        return 0.15 + (additional_levels * 0.05)
```

### Idle Cap Hours
```python
VIP_IDLE_HOURS = {
    0: 8, 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22,
    8: 24, 9: 30, 10: 36, 11: 48, 12: 60, 13: 72, 14: 96, 15: 168
}
```

### Resource Generation
```python
def calculate_idle_resources(hours_elapsed, vip_level, ...):
    """
    Formula: Base Rate × Hours × VIP Multiplier (capped at progression-based max)
    """
    potential = BASE_RATE * hours * vip_rate
    max_for_time = progression_cap * (hours / 24)
    return min(potential, max_for_time)
```

---

## 4. BACKEND ENFORCEMENT POINTS (SERVER-TRUTH)

| Endpoint | Enforcement |
|----------|-------------|
| `calculate_vip_level(total_spent)` | Server-only calculation from DB `total_spent` |
| `GET /api/vip/info/{username}` | Returns VIP data without revealing spend thresholds |
| `GET /api/vip/comparison/{username}` | Shows tier benefits, no monetary amounts |
| `GET /api/idle/status` | VIP level calculated server-side |
| `POST /api/idle/claim` | VIP cap/rate applied server-side |
| `POST /api/idle/instant-collect` | VIP 1+ check server-side |
| Frame/Bubble endpoints | VIP requirements checked server-side |

### Key Server-Truth Helpers:
```python
# /app/backend/server.py
calculate_vip_level(total_spent)  # Line 1810
get_idle_cap_hours(vip_level)     # Line 1819
get_avatar_frame(vip_level)       # Line 1845

# /app/backend/core/idle_resources.py
get_vip_idle_rate_multiplier(vip_level)  # Line 39
get_vip_idle_hours(vip_level)            # Line 299
calculate_idle_resources(...)             # Line 205
```

---

## 5. TELEMETRY EVENTS

### Currently Defined
**NONE** - VIP telemetry not yet implemented in `/app/frontend/lib/telemetry/events.ts`

### Recommended to Add:
```typescript
// Phase 3.XX: VIP Telemetry
VIP_INFO_VIEWED: 'vip_info_viewed',
VIP_TIER_UP: 'vip_tier_up',
VIP_BENEFITS_VIEWED: 'vip_benefits_viewed',
VIP_INSTANT_COLLECT: 'vip_instant_collect',
```

---

## 6. SKUs REFERENCED

### Store Catalog (DEV/Soft Launch)
```json
[
  { "sku": "gem_pack_small", "price": "$0.99", "rewards": [{ "type": "gems", "amount": 100 }] },
  { "sku": "gem_pack_medium", "price": "$4.99", "rewards": [{ "type": "gems", "amount": 550 }] },
  { "sku": "gem_pack_large", "price": "$9.99", "rewards": [{ "type": "gems", "amount": 1400 }] },
  { "sku": "gold_pack", "price": "$1.99", "rewards": [{ "type": "gold", "amount": 10000 }] },
  { "sku": "stamina_pack", "price": "$0.99", "rewards": [{ "type": "stamina", "amount": 150 }] }
]
```

### Product Rewards (RevenueCat Integration Scaffold)
```json
{
  "battle_pass_standard": { "type": "battle_pass", "tier": "standard" },
  "battle_pass_premium": { "type": "battle_pass", "tier": "premium", "bonus_levels": 10, "crystals": 500 },
  "crystal_pack_100": { "type": "crystals", "amount": 100 },
  "crystal_pack_500": { "type": "crystals", "amount": 500 },
  "crystal_pack_1000": { "type": "crystals", "amount": 1000 },
  "divine_pack_starter": { "type": "divine_essence", "amount": 10 },
  "divine_pack_deluxe": { "type": "divine_essence", "amount": 50 }
}
```

---

## 7. FILE LIST + KEY LOCATIONS

### Backend

| File | Lines | Content |
|------|-------|---------|
| `/app/backend/server.py` | 1790-1858 | VIP_TIERS, calculate_vip_level(), get_avatar_frame() |
| `/app/backend/server.py` | 1860-1945 | VIP_PACKAGES configurations |
| `/app/backend/server.py` | 2822-2906 | FRAMES_AVAILABLE (VIP-gated frames) |
| `/app/backend/server.py` | 2951-3062 | Chat bubbles (VIP-gated) |
| `/app/backend/server.py` | 3651-3953 | Idle endpoints (VIP rate/cap applied) |
| `/app/backend/server.py` | 3956-4048 | VIP info/comparison endpoints |
| `/app/backend/server.py` | 5606-5655 | STORE_CATALOG |
| `/app/backend/server.py` | 11306-11314 | PRODUCT_REWARDS |
| `/app/backend/core/idle_resources.py` | 1-451 | Full idle resource system with VIP |

### Frontend

| File | Lines | Content |
|------|-------|---------|
| `/app/frontend/lib/api.ts` | 685-691 | adminSetVIP() |
| `/app/frontend/lib/api.ts` | 1189 | getVIPInfo() |
| `/app/frontend/lib/ui/copy.ts` | 77-78, 116 | VIP lock copy |

---

## 8. GAPS & RECOMMENDATIONS

### Missing VIP Benefits (Not Yet Implemented)
- ❌ Daily extra claims / streak protection
- ❌ Gacha pity adjustments / dupe shard bonus
- ❌ Bond tribute discounts / affinity bonuses
- ❌ Mail claim multipliers
- ❌ Shop discounts / free daily packs
- ❌ PvP/PvE ticket bonuses

### Missing Infrastructure
- ❌ VIP telemetry events
- ❌ VIP tier names (using generic "VIP N")
- ❌ VIP purchase tracking (only total_spent exists)
- ❌ VIP-specific bundles/offers

### Current Implementation Status
- ✅ Idle cap hours (VIP 0-15)
- ✅ Idle rate multiplier (5% → 55%)
- ✅ Avatar frames (VIP-gated)
- ✅ Chat bubbles (VIP-gated)
- ✅ Instant Collect (VIP 1+)
- ✅ Server-truth enforcement

---

**END OF VIP SYSTEM DUMP**
