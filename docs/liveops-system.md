# Live Ops System

## Overview

Phase 4.3 implements server-driven live operations for limited-time content.

## Configuration

All live ops are defined in `/app/backend/core/liveops.py`.

### Boost Types

- `idle_cap_multiplier` - Increases idle reward cap
- `event_rewards_multiplier` - Boosts event rewards
- `gacha_rate_up` - Increases gacha rates
- `stamina_regen_boost` - Faster stamina regeneration

### VIP Stacking

- Some boosts can stack with VIP status
- Hard cap prevents excessive multipliers (max 2.0x)

## Endpoints

- `GET /api/liveops/status` - Current active events and boosts
- Banner filtering happens server-side in gacha endpoints

## Frontend Display

- Banner strip on Home and Summon screens
- Shows event name and time remaining
- Uses safe time formatting (no timers/polling)
- Refresh on screen focus only

## Event Configuration Example

```python
LiveOpsEvent(
    event_id="summer_fest_2026",
    name="Summer Festival 2026",
    start_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
    end_at=datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc),
    boosts=[
        LiveOpsBoost(
            boost_type=BoostType.IDLE_CAP_MULTIPLIER,
            multiplier=1.5,
            vip_stackable=True,
            vip_bonus=0.25,
            max_total=2.0,
        ),
    ],
    banner_ids=["standard", "summer_special"],
)
```
