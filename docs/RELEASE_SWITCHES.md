# Release Switches - Production Configuration Checklist

This document is the **canonical reference** for all configuration switches that MUST be set correctly before deploying to production.

---

## 🚨 CRITICAL: Server Configuration

### `SERVER_DEV_MODE`
| Value | Behavior |
|-------|----------|
| `true` | Simulated purchases ENABLED. **NEVER use in production.** |
| `false` | Simulated purchases DISABLED. Requires payment verification secrets. |

**Production requirement:** `SERVER_DEV_MODE=false`

### `REVENUECAT_SECRET_KEY`
- **Required when:** `SERVER_DEV_MODE=false`
- **Source:** RevenueCat Dashboard → API Keys → Secret API key
- **Usage:** Server-side verification of IAP receipts

### `REVENUECAT_WEBHOOK_SECRET`
- **Required when:** `SERVER_DEV_MODE=false`
- **Source:** RevenueCat Dashboard → Integrations → Webhooks → Authorization Header
- **Usage:** Validates webhook authenticity (prevents spoofed events)

### `JWT_SECRET_KEY`
- **Required:** Always (auto-generated if missing, but should be stable in prod)
- **Recommendation:** Set a stable 64-character hex string in production
- **Example:** `openssl rand -hex 32`

---

## 🚨 CRITICAL: Frontend Configuration

### `EXPO_PUBLIC_BACKEND_URL`
- **Required:** Always
- **Dev value:** `http://localhost:8001/api` or `https://<tunnel>.exp.direct/api`
- **Prod value:** `https://your-production-domain.com/api`
- **Note:** Must use `https://` in production for security

### `EXPO_PUBLIC_REVENUECAT_API_KEY`
- **Required:** For in-app purchases
- **Source:** RevenueCat Dashboard → API Keys → Public API key (for your platform)
- **Note:** This is the PUBLIC key, safe to embed in client builds

---

## ⚠️ RECOMMENDED: Monitoring & Analytics

### `EXPO_PUBLIC_SENTRY_DSN`
- **Required:** Strongly recommended for production
- **Source:** Sentry Dashboard → Settings → Client Keys (DSN)
- **Purpose:** Crash reporting and error monitoring

### `EXPO_PUBLIC_ANALYTICS_ENABLED`
- **Values:** `true` or `false`
- **Purpose:** Enable/disable analytics event tracking
- **Note:** Set `true` for production to track premium funnels

---

## 📋 Pre-Release Checklist

Before deploying to production, verify:

### Backend (.env)
```bash
# REQUIRED
SERVER_DEV_MODE=false
REVENUECAT_SECRET_KEY=sk_your_secret_key
REVENUECAT_WEBHOOK_SECRET=whsec_your_webhook_secret
JWT_SECRET_KEY=your_stable_64_char_hex_string
MONGO_URL=mongodb://your-production-mongo-url

# OPTIONAL but recommended
SUPER_ADMIN_BOOTSTRAP_TOKEN=  # Remove after ADAM is created
```

### Frontend (.env)
```bash
# REQUIRED
EXPO_PUBLIC_BACKEND_URL=https://your-production-domain.com/api

# RECOMMENDED
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
EXPO_PUBLIC_ANALYTICS_ENABLED=true
EXPO_PUBLIC_REVENUECAT_API_KEY=your_public_api_key
```

---

## 🔒 Security Notes

1. **Never commit secrets to git** - Use environment variables or secret management
2. **Server validates at startup** - If `SERVER_DEV_MODE=false`, missing secrets = fail-fast
3. **Frontend validates at startup** - Logs warnings but doesn't crash (graceful degradation)
4. **Guards enforce discipline** - Run `npm run guard` before each release

---

## 🧪 Testing Production Configuration Locally

To test production config locally:

```bash
# Backend
export SERVER_DEV_MODE=false
export REVENUECAT_SECRET_KEY=test_secret_key
export REVENUECAT_WEBHOOK_SECRET=test_webhook_secret
uvicorn server:app --reload

# Frontend  
# Build with production flag (simulates release build)
expo build:web
```

The server will **refuse to start** if required secrets are missing when `SERVER_DEV_MODE=false`.

---

## 📝 Version History

| Date | Change |
|------|--------|
| 2025-01-15 | Initial release (Phase 3.15) |
