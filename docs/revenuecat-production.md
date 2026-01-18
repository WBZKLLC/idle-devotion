# RevenueCat Production Integration

## Overview

Phase 4.1 implements full RevenueCat integration for production IAP.

## Architecture

### Server-Side Flow

1. **Webhook Handler** (`/api/webhooks/revenuecat`)
   - Verifies signature using `REVENUECAT_WEBHOOK_SECRET`
   - Handles events: `initial_purchase`, `renewal`, `cancellation`, `product_change`, `expiration`, `refund`
   - Updates user entitlements
   - Idempotent by `event_id`

2. **Verify Endpoint** (`/api/purchases/verify`)
   - Accepts platform receipt or RevenueCat token
   - Verifies server-side via RevenueCat API
   - Returns canonical receipt
   - Idempotent by `sourceId`

### Environment Variables

```
REVENUECAT_API_KEY=your_api_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
```

### Entitlement Mapping

| RevenueCat Entitlement | Our Entitlement Key |
|------------------------|--------------------|
| premium_monthly        | VIP_MONTHLY        |
| premium_yearly         | VIP_ANNUAL         |
| no_ads                 | NO_ADS             |
| starter_pack           | STARTER_PACK       |

## Security

- Webhook signature verification required in production
- DEV mode allows unsigned webhooks (SERVER_DEV_MODE=true)
- All balance mutations go through canonical receipts
- No client-side balance updates

## Testing

1. Use RevenueCat sandbox for testing
2. DEV redeem endpoint available in dev mode only
3. Monitor webhook events in RevenueCat dashboard
