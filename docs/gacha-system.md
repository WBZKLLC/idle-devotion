# Gacha/Summon System Documentation (Phase 3.33)

## Overview

The Gacha System is a core monetization and player retention feature that allows players to spend in-game currency to summon heroes. It implements:

- **Server-side RNG** - All randomization happens on the backend (NO client-side RNG)
- **Pity System** - Guarantees high-rarity heroes after X pulls without one
- **Canonical Receipts** - All summons return standardized receipt format
- **Duplicate Handling** - Duplicates automatically convert to hero shards

## Banners

### Standard Banner (Coin Summon)
- **Currency**: Coins
- **Cost**: 1,000 (single), 9,000 (x10)
- **Rates**: SR 90.8%, SSR 8%, SSR+ 1.2%
- **Pity**: SSR+ guaranteed at 50 pulls

### Premium Banner (Crystal Summon)
- **Currency**: Crystals
- **Cost**: 300 (single), 2,700 (x10)
- **Rates**: SR 85%, SSR 12%, UR 2%, SSR+ 1%
- **Pity**: UR guaranteed at 50 pulls

### Divine Banner (Divine Essence)
- **Currency**: Divine Essence
- **Cost**: 1 (single), 10 (x10)
- **Rates**: UR+ 0.8%, UR 2.7%, Crystal rewards 3.7%, Filler 93%
- **Pity**: UR+ guaranteed at 40 pulls
- **Special**: Includes filler rewards (crystals, gold, shards)

## API Endpoints

### GET /api/gacha/banners
Returns all available banners and user pity state.

**Response**:
```json
{
  "banners": [
    {
      "id": "standard",
      "name": "Coin Summon",
      "currency": "coins",
      "cost_single": 1000,
      "cost_multi": 9000,
      "rates": {"SR": 0.908, "SSR": 0.08, "SSR+": 0.012},
      "pity": 50,
      "guaranteed": "SSR+"
    }
  ],
  "pity": {
    "standard": {"current": 23, "threshold": 50, "guaranteed": "SSR+"}
  }
}
```

### GET /api/gacha/pity
Returns user's pity counters for all banners (requires auth).

### POST /api/gacha/summon
Performs a gacha summon. Returns canonical receipt.

**Request**:
```json
{
  "banner_id": "standard",
  "count": 1,
  "source_id": "summon_1234567890_0001"
}
```

**Response** (GachaReceipt):
```json
{
  "source": "summon_single",
  "sourceId": "summon_1234567890_0001",
  "bannerId": "standard",
  "pullCount": 1,
  "results": [
    {
      "rarity": "SSR",
      "heroDataId": "hero_aria_ssr",
      "heroName": "Aria",
      "outcome": "new",
      "imageUrl": "...",
      "element": "Fire"
    }
  ],
  "pityBefore": 23,
  "pityAfter": 24,
  "pityTriggered": false,
  "currencySpent": {"type": "coins", "amount": 1000},
  "balances": {"coins": 50000, "gems": 1200, ...},
  "items": [{"type": "hero_unlock", "amount": 1, "hero_id": "hero_aria_ssr"}],
  "alreadyClaimed": false
}
```

## Receipt Sources

The gacha system uses these canonical receipt sources:

- `summon_single` - Single pull (1x)
- `summon_multi` - Multi pull (10x)
- `pity_reward` - Reserved for pity-specific rewards

## Telemetry Events

| Event | When Emitted | Props |
|-------|--------------|-------|
| GACHA_VIEWED | Screen opened | - |
| GACHA_BANNER_SELECTED | Banner tab changed | bannerId |
| GACHA_SUMMON_SUBMITTED | Before API call | bannerId, count |
| GACHA_SUMMON_SUCCESS | After successful summon | bannerId, heroCount, fillerCount, pityTriggered |
| GACHA_SUMMON_ERROR | On summon failure | bannerId, error |
| GACHA_PITY_INCREMENTED | When pity counter increased | bannerId, pityBefore, pityAfter |
| GACHA_PITY_TRIGGERED | When pity activates | bannerId, pityBefore |

## Guard Enforcement

The guard script (`guard-phase-3-33.mjs`) enforces:

1. **No client-side RNG** - `Math.random()` forbidden in summon files
2. **Required API functions** - `getGachaBanners`, `summon`, `getPityStatus`
3. **Required telemetry** - All gacha events must be defined
4. **Receipt sources** - `summon_single`, `summon_multi`, `pity_reward` must exist
5. **No direct balance mutations** - Only use receipt.balances

## Duplicate Handling

When a player pulls a duplicate hero:
- They don't receive the hero again
- Instead, they receive hero-specific shards
- Shards scale by rarity: SR=10, SSR=20, SSR+=30, UR=50, UR+=100
- Shards are used for hero star promotion

## Idempotency

Summon requests include an optional `source_id` for idempotency:
- If the same `source_id` is submitted twice, the second request returns the original receipt
- The receipt includes `alreadyClaimed: true` to indicate a duplicate request
- This prevents double-spending due to network issues

## Files

- Backend: `/app/backend/server.py` (endpoints at ~line 5958)
- Frontend API: `/app/frontend/lib/api/gacha.ts`
- Frontend Screen: `/app/frontend/app/(tabs)/summon-hub.tsx`
- Receipt Types: `/app/frontend/lib/types/receipt.ts`
- Telemetry: `/app/frontend/lib/telemetry/events.ts`
- Guard: `/app/frontend/scripts/guard-phase-3-33.mjs`
