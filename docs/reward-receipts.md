# Reward Receipts Contract

Defines the canonical receipt shape for all reward-granting operations.

---

## Canonical Receipt Shape

All reward endpoints MUST return this structure:

```typescript
interface RewardReceipt {
  source: RewardSource;     // Origin system identifier
  sourceId: string;         // Unique ID for idempotency (REQUIRED)
  items: RewardItem[];      // Rewards granted (empty if already claimed)
  balances: Balances;       // User balances AFTER grant
  alreadyClaimed?: boolean; // True if duplicate claim
  message?: string;         // Human-readable status
}

interface RewardItem {
  type: string;             // gold, gems, coins, stamina, etc.
  amount: number;
  hero_id?: string;         // For hero-specific rewards
  item_id?: string;         // For specific items
}

interface Balances {
  gold: number;
  coins: number;
  gems: number;
  divine_gems: number;
  crystals: number;
  stamina: number;
  divine_essence: number;
  soul_dust: number;
  skill_essence: number;
  enhancement_stones: number;
  hero_shards: number;
  rune_essence: number;
}
```

---

## Source Values (LOCKED)

| Source | Description | Example sourceId |
|--------|-------------|------------------|
| `bond_tribute` | Hero affinity tribute | `tribute_abc123` |
| `mail_reward_claim` | Mail reward claim | `mail_reward_xyz` |
| `mail_gift_claim` | Mail gift claim | `mail_gift_xyz` |
| `mail_receipt_claim` | Queued receipt claim | `receipt_xyz` |
| `daily_login_claim` | Daily login reward | `daily_2024-01-15` |
| `idle_claim` | Idle rewards | `idle_user123_ts` |
| `admin_grant` | Admin-granted reward | `admin_grant_xyz` |

---

## Idempotency Behavior

1. **First claim:** Returns receipt with `items` populated, `alreadyClaimed: false`
2. **Duplicate claim:** Returns receipt with `items: []`, `alreadyClaimed: true`
3. **Both return 200 OK** (not an error)

### Implementation Pattern

```python
async def claim_reward(reward_id):
    reward = await db.rewards.find_one({"id": reward_id})
    
    if reward.get("claimed"):
        return grant_rewards_canonical(
            source="mail_reward_claim",
            source_id=reward_id,
            rewards=[],
            already_claimed=True
        )
    
    # Atomic update
    result = await db.rewards.update_one(
        {"id": reward_id, "claimed": False},
        {"$set": {"claimed": True}}
    )
    
    if result.modified_count == 0:
        # Race condition - another claim won
        return grant_rewards_canonical(..., already_claimed=True)
    
    return grant_rewards_canonical(
        source="mail_reward_claim",
        source_id=reward_id,
        rewards=reward["rewards"],
        already_claimed=False
    )
```

---

## Telemetry Events

| Event | When | Data |
|-------|------|------|
| `reward_receipt_received` | Receipt parsed | source, sourceId, itemCount |
| `reward_claim_success` | New claim | source, sourceId, itemCount |
| `reward_claim_already_claimed` | Duplicate | source, sourceId |
| `reward_claim_error` | Failure | source, sourceId, error |

---

## Frontend Usage

```typescript
import { isValidReceipt, formatReceiptItems } from '../lib/types/receipt';

const receipt = await claimMailReward(username, rewardId);

if (isValidReceipt(receipt)) {
  if (receipt.alreadyClaimed) {
    toast.info('Already claimed.');
  } else {
    toast.success(`Claimed: ${formatReceiptItems(receipt)}`);
    // Update store balances from receipt.balances
  }
}
```

---

## Guards

- `guard-receipt-shape.mjs` validates:
  - `source` field present
  - `sourceId` field present and non-empty
  - `items` is array
  - `balances` is object
