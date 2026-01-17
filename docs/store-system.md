# Store System Contract

Defines the store/economy architecture and purchase intent flow.

---

## Store Catalog

### API Endpoint
```
GET /api/store/catalog
Response: { catalog: StoreItem[] }
```

### Item Shape
```typescript
interface StoreItem {
  sku: string;         // Unique product identifier
  name: string;        // Display name
  desc?: string;       // Optional description
  priceText: string;   // Formatted price ("$0.99")
  currency: string;    // ISO currency code
  tag?: string;        // Optional badge ("BEST VALUE")
}
```

### Current Catalog
| SKU | Name | Price | Tag |
|-----|------|-------|-----|
| gem_pack_small | Gem Pack (Small) | $0.99 | STARTER |
| gem_pack_medium | Gem Pack (Medium) | $4.99 | POPULAR |
| gem_pack_large | Gem Pack (Large) | $9.99 | BEST VALUE |
| gold_pack | Gold Chest | $1.99 | - |
| stamina_pack | Stamina Refill | $0.99 | - |

---

## Purchase Intent Flow

### 1. Create Intent
```
POST /api/store/purchase-intent?sku={sku}
Response: {
  intentId: string,
  sku: string,
  price: number,       // cents
  priceText: string,
  currency: string,
  createdAt: string
}
```

### 2. Process Payment (External)
In production, the intent would be fulfilled by:
- RevenueCat webhook
- App Store / Play Store verification

### 3. DEV-Only: Redeem Intent
```
POST /api/store/redeem-intent?intent_id={intentId}
Response: RewardReceipt (canonical)
```

**Only available when `SERVER_DEV_MODE=TRUE`**

---

## Canonical Receipt Source

| Source | Description | Example sourceId |
|--------|-------------|------------------|
| `store_redeem` | DEV-only intent redemption | `intent_abc123` |

---

## Telemetry Events

| Event | Trigger | Data |
|-------|---------|------|
| `store_viewed` | Shop screen opened | { itemCount } |
| `store_item_selected` | Item tapped | { sku } |
| `store_purchase_intent_created` | Intent created | { intentId, sku } |
| `store_redeem_submitted` | DEV redeem tapped | { intentId } |
| `store_redeem_success` | Redeem completed | { intentId, itemCount } |
| `store_redeem_already_claimed` | Duplicate redeem | { intentId } |
| `store_redeem_error` | Redeem failed | { intentId, error } |

---

## Intent Lifecycle

1. **Created** → `status: pending`, 24hr expiration
2. **Redeemed** → `status: redeemed`, rewards granted
3. **Expired** → Returns 410 Gone on redeem attempt

---

## Security Notes

- All endpoints require auth-token
- Intent is user-scoped (cannot redeem another user's intent)
- Redeem is idempotent (duplicate calls return `alreadyClaimed: true`)
- DEV redeem blocked when `SERVER_DEV_MODE` is not `TRUE`

---

## Guards

- `guard-phase-3-30.mjs` validates:
  - Shop screen exists
  - No billing library imports
  - Store API functions exist
  - Canonical receipt for redeem
