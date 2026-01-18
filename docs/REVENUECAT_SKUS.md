# REVENUECAT SKU MATRIX (IMPLEMENTATION READY)

Last Updated: January 2025
Status: AUTHORITATIVE

---

## 1. SKU CATEGORIES

### Category 1: Consumables (One-Time Purchase)
### Category 2: Subscriptions (Recurring)
### Category 3: Non-Consumables (One-Time, Permanent)

---

## 2. CONSUMABLE SKUs

### Gems Packs

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `gems_pack_100` | Gem Pouch | $0.99 | 100 gems | 1 | `iap_purchase` |
| `gems_pack_550` | Gem Sack | $4.99 | 550 gems | 5 | `iap_purchase` |
| `gems_pack_1200` | Gem Chest | $9.99 | 1,200 gems | 10 | `iap_purchase` |
| `gems_pack_2500` | Gem Vault | $19.99 | 2,500 gems | 20 | `iap_purchase` |
| `gems_pack_6500` | Gem Treasury | $49.99 | 6,500 gems | 50 | `iap_purchase` |
| `gems_pack_14000` | Gem Hoard | $99.99 | 14,000 gems | 100 | `iap_purchase` |

### Crystal Packs

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `crystals_pack_100` | Crystal Fragment | $0.99 | 100 crystals | 1 | `iap_purchase` |
| `crystals_pack_500` | Crystal Shard | $4.99 | 500 crystals | 5 | `iap_purchase` |
| `crystals_pack_1200` | Crystal Core | $9.99 | 1,200 crystals | 10 | `iap_purchase` |
| `crystals_pack_3000` | Crystal Heart | $24.99 | 3,000 crystals | 25 | `iap_purchase` |

### Divine Essence Packs

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `divine_pack_10` | Divine Spark | $4.99 | 10 divine essence | 5 | `iap_purchase` |
| `divine_pack_30` | Divine Flame | $12.99 | 30 divine essence | 13 | `iap_purchase` |
| `divine_pack_100` | Divine Inferno | $39.99 | 100 divine essence | 40 | `iap_purchase` |

### Utility Packs

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `stamina_refill` | Stamina Elixir | $0.99 | 120 stamina | 1 | `iap_purchase` |
| `gold_pack_50k` | Gold Pouch | $1.99 | 50,000 gold | 2 | `iap_purchase` |
| `gold_pack_200k` | Gold Chest | $4.99 | 200,000 gold | 5 | `iap_purchase` |
| `event_tickets_5` | Event Pass | $2.99 | 5 event tickets | 3 | `iap_purchase` |
| `event_tickets_15` | Event Bundle | $7.99 | 15 event tickets | 8 | `iap_purchase` |

---

## 3. SUBSCRIPTION SKUs

### Monthly Passes

| product_id | Name | Price USD | Duration | Grants | VIP XP | Receipt Source |
|------------|------|-----------|----------|--------|--------|----------------|
| `vip_pass_monthly` | VIP Monthly | $4.99 | 30 days | Daily: 50 gems, 10k gold | 5/mo | `subscription` |
| `battle_blessing` | Battle Blessing | $9.99 | 30 days | +50% EXP, +25% gold drops | 10/mo | `subscription` |
| `premium_pass` | Premium Pass | $14.99 | 30 days | VIP Monthly + Battle Blessing | 15/mo | `subscription` |

### Annual Passes

| product_id | Name | Price USD | Duration | Grants | VIP XP | Receipt Source |
|------------|------|-----------|----------|--------|--------|----------------|
| `vip_pass_annual` | VIP Annual | $39.99 | 365 days | Daily: 60 gems, 15k gold | 40 | `subscription` |
| `premium_annual` | Premium Annual | $99.99 | 365 days | All benefits + exclusive frame | 100 | `subscription` |

---

## 4. NON-CONSUMABLE SKUs (One-Time)

### Starter Packs (First Purchase Only)

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `starter_pack` | Starter Pack | $0.99 | 300 gems, 1 SR hero, 50k gold | 1 | `iap_purchase` |
| `growth_pack_1` | Growth Pack I | $4.99 | 1000 gems, 100 shards, 200k gold | 5 | `iap_purchase` |
| `growth_pack_2` | Growth Pack II | $9.99 | 2500 gems, SSR selector, 500k gold | 10 | `iap_purchase` |
| `growth_pack_3` | Growth Pack III | $24.99 | 6000 gems, SSR+ selector, 50 divine | 25 | `iap_purchase` |

### Limited Packs (Time-Gated)

| product_id | Name | Price USD | Grants | VIP XP | Receipt Source |
|------------|------|-----------|--------|--------|----------------|
| `level_up_pack` | Level Up Pack | $4.99 | Scaling rewards by level | Varies | `iap_purchase` |
| `vip_upgrade_pack` | VIP Upgrade Pack | $19.99 | 5 VIP levels worth of benefits | 20 | `iap_purchase` |
| `returning_hero_pack` | Returning Hero | $9.99 | 2000 gems, catch-up resources | 10 | `iap_purchase` |

---

## 5. BATTLE PASS SKUs

| product_id | Name | Price USD | Duration | Grants | VIP XP | Receipt Source |
|------------|------|-----------|----------|--------|--------|----------------|
| `battle_pass_standard` | Battle Pass | $9.99 | Season | Premium track | 10 | `battle_pass` |
| `battle_pass_premium` | Battle Pass+ | $19.99 | Season | Premium + 10 levels + skin | 20 | `battle_pass` |
| `battle_pass_levels_10` | BP Levels ×10 | $4.99 | Instant | +10 BP levels | 5 | `iap_purchase` |

---

## 6. BACKEND MAPPING

### Receipt Source Types:
```python
RECEIPT_SOURCES = {
    "iap_purchase": "Standard consumable purchase",
    "subscription": "Recurring subscription",
    "battle_pass": "Battle pass purchase",
    "gift": "Gift from another player",
    "admin_grant": "Admin compensation",
}
```

### Product Rewards Mapping:
```python
PRODUCT_REWARDS = {
    "gems_pack_100": {"type": "gems", "amount": 100, "vip_xp": 1},
    "gems_pack_550": {"type": "gems", "amount": 550, "vip_xp": 5},
    # ... etc
}
```

### VIP XP Accrual:
```python
def apply_purchase_vip_xp(user, product_id):
    vip_xp = PRODUCT_REWARDS[product_id].get("vip_xp", 0)
    # Convert to USD equivalent for VIP calculation
    user["total_spent"] += vip_xp  # $1 = 1 VIP XP
```

---

## 7. REVENUECAT WEBHOOK HANDLING

### Required Events:
- `INITIAL_PURCHASE` → Grant rewards, add VIP XP
- `RENEWAL` → Grant subscription daily rewards
- `CANCELLATION` → Mark subscription inactive
- `BILLING_ISSUE` → Send mail notification
- `PRODUCT_CHANGE` → Handle upgrade/downgrade

### Webhook Endpoint:
```
POST /api/webhooks/revenuecat
Headers: X-RevenueCat-Signature
```

### Idempotency:
- Use `transaction_id` as sourceId
- Duplicate webhooks return existing receipt

---

## 8. TELEMETRY EVENTS

| Event | When | Props |
|-------|------|-------|
| `IAP_INITIATED` | Purchase started | product_id, price |
| `IAP_SUCCESS` | Purchase completed | product_id, transaction_id |
| `IAP_FAILED` | Purchase failed | product_id, error_code |
| `IAP_RESTORED` | Purchases restored | product_ids |
| `SUBSCRIPTION_STARTED` | Sub activated | product_id |
| `SUBSCRIPTION_RENEWED` | Sub renewed | product_id |
| `SUBSCRIPTION_CANCELLED` | Sub cancelled | product_id |

---

## 9. SANDBOX → PRODUCTION CHECKLIST

### Before Launch:
- [ ] All product_ids match App Store / Play Store
- [ ] Prices match store listings
- [ ] Webhook signature validation enabled
- [ ] Sandbox testing complete
- [ ] Receipt validation working
- [ ] VIP XP grants correctly
- [ ] Canonical receipts emitted
- [ ] Telemetry events firing

### Post-Launch:
- [ ] Monitor webhook delivery rate
- [ ] Check for billing issues
- [ ] Verify subscription renewals
- [ ] Audit VIP XP accuracy

---

## 10. GUARD ENFORCEMENT

**guard-sku-integrity.mjs** must verify:
- ❌ No SKU without canonical receipt source
- ❌ No SKU without telemetry event
- ❌ No direct balance mutation (receipts only)
- ❌ No trust in client-side purchase success

---

**END OF REVENUECAT SKU MATRIX**
