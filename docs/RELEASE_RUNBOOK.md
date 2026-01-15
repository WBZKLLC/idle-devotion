# Release Runbook - Divine Heroes Deployment Guide

This document provides step-by-step deployment instructions, rollback procedures, and monitoring guidance.

---

## 📋 Pre-Deployment Checklist

Before deploying, verify:

- [ ] All 13+ guards pass: `cd frontend && npm run guard`
- [ ] Backend starts successfully with `SERVER_DEV_MODE=false` + test secrets
- [ ] Frontend builds without errors: `expo build:web` or EAS build
- [ ] `RELEASE_SWITCHES.md` reviewed and all required env vars documented
- [ ] RevenueCat dashboard configured:
  - [ ] Products created (Premium, Cinematics Pack, etc.)
  - [ ] Webhook URL configured
  - [ ] API keys generated

---

## 🚀 Deployment Order

**Always deploy in this order:**

### 1. Database Migrations (if any)
```bash
# If schema changes are needed, run migrations FIRST
# Example: Adding indexes
python -c "from server import *; print('Indexes created at startup')"
```

### 2. Backend Deployment
```bash
# Set environment variables
export SERVER_DEV_MODE=false
export REVENUECAT_SECRET_KEY=sk_your_key
export REVENUECAT_WEBHOOK_SECRET=whsec_your_secret
export JWT_SECRET_KEY=your_stable_64_char_hex
export MONGO_URL=mongodb://your-production-url

# Deploy backend
# (Your deployment method here - Docker, K8s, etc.)

# Verify startup logs show:
# "🔒 SERVER_DEV_MODE=FALSE (simulated purchases DISABLED)"
# "✅ Production configuration validated: all required secrets present"
```

### 3. Frontend/App Build
```bash
# Set environment variables
export EXPO_PUBLIC_ENV=production
export EXPO_PUBLIC_BACKEND_URL=https://your-domain.com/api
export EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
export EXPO_PUBLIC_ANALYTICS_ENABLED=true
export EXPO_PUBLIC_REVENUECAT_API_KEY=your_public_key

# Build
eas build --platform all --profile production

# Or for web
expo build:web
```

### 4. App Store Submission
- Submit to App Store Connect / Google Play Console
- Enable staged rollout (10% → 50% → 100%)

---

## 🧪 Smoke Test Checklist

After deployment, verify these critical flows:

### Authentication
- [ ] New user registration works
- [ ] Login with existing user works
- [ ] 401 on expired/invalid token
- [ ] Force logout on 401 triggers correctly

### Entitlements
- [ ] `GET /api/entitlements/snapshot` returns valid data
- [ ] `server_time` and `ttl_seconds` present in response
- [ ] Entitlements refresh on app resume (background → foreground)

### Premium Gates
- [ ] Non-entitled user hitting premium gate → routes to paywall
- [ ] `paywall_opened` telemetry fires (if analytics enabled)
- [ ] Paywall shows correct products from RevenueCat

### Purchase Verification
- [ ] `POST /api/purchases/verify` with invalid receipt → returns error (not 500)
- [ ] Server logs show verification attempt
- [ ] With valid RevenueCat receipt → grants entitlement

### Webhooks (RevenueCat Sandbox)
- [ ] Trigger test webhook from RevenueCat dashboard
- [ ] Server logs show webhook received
- [ ] Signature validation passes (or fails appropriately for invalid signature)

### Health Check
```bash
# Basic health
curl https://your-domain.com/api/health

# Entitlements (requires auth)
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/entitlements/snapshot
```

---

## 🔄 Rollback Procedures

### Scenario 1: Backend Deployment Failed

**Symptoms:** 500 errors, startup failures, missing routes

**Actions:**
1. Revert to previous backend version immediately
2. Check logs for specific error
3. If database migration caused issue, restore from backup
4. Do NOT proceed with frontend deployment

### Scenario 2: RevenueCat Webhook Failing

**Symptoms:** Purchases succeed but entitlements not granted, webhook errors in logs

**Actions:**
1. Check `REVENUECAT_WEBHOOK_SECRET` is correctly set
2. Verify webhook URL in RevenueCat dashboard matches deployed endpoint
3. Check server logs for signature validation errors
4. **Temporary mitigation:** Users can force-refresh entitlements:
   - Kill and reopen app
   - Background → foreground transition triggers refresh

### Scenario 3: Purchase Verification Failing

**Symptoms:** Purchases fail with "verification failed", users charged but no entitlement

**Actions:**
1. Check `REVENUECAT_SECRET_KEY` is correctly set
2. Verify RevenueCat project configuration
3. Check network connectivity to RevenueCat API
4. **Temporary mitigation (EMERGENCY ONLY):**
   ```bash
   # Only if users are being charged without getting entitlements
   # Set SERVER_DEV_MODE=true temporarily to grant via simulated flow
   # This is a LAST RESORT - fix the root cause ASAP
   ```

### Scenario 4: App Crashes on Startup

**Symptoms:** App crashes immediately, white screen

**Actions:**
1. Check Sentry for crash reports
2. Check `validateConfig()` errors - missing env vars?
3. If EAS build: roll back to previous build
4. If web: revert to previous deployment

---

## 🚨 Emergency: Disable Purchase Surfaces

If purchases are broken and users are being affected:

### Option A: Feature Flag (Recommended)
```bash
# Backend: Add/modify feature flag
# In your feature flags config or database:
PURCHASES_ENABLED=false

# Frontend checks this flag before showing purchase UI
```

### Option B: Server Gate (Quick)
```python
# In server.py, add at top of purchase endpoints:
@app.post("/api/purchases/verify")
async def verify_purchase(...):
    # EMERGENCY: Disable purchases
    raise HTTPException(
        status_code=503, 
        detail="Purchases temporarily unavailable. Please try again later."
    )
```

### Option C: Backend Env Var
```bash
# Add support for this in server.py:
PURCHASES_DISABLED=true

# Then in verify_purchase:
if os.environ.get("PURCHASES_DISABLED") == "true":
    raise HTTPException(503, "Purchases temporarily unavailable")
```

---

## 📊 Monitoring Signals

### Sentry - "Page Immediately" Errors
- Any crash in `_layout.tsx` or `SessionProvider`
- `RuntimeError` from `assert_production_config`
- Uncaught exceptions in purchase flow
- Auth token decode failures

### Telemetry - Monetization Health
| Signal | Healthy | Investigate |
|--------|---------|-------------|
| `paywall_opened` → `purchase_attempt` | > 10% | < 5% |
| `purchase_attempt` → `purchase_success` | > 70% | < 50% |
| `premium_gate_denied` rate | Stable | Sudden spike |
| `store_opened` rate | Stable | Sudden drop |

### Backend Logs - Key Markers
```bash
# Healthy startup
"🔒 SERVER_DEV_MODE=FALSE"
"✅ Production configuration validated"
"✅ Created unique index on username_canon"

# Webhook received
"Received webhook event_id=..."

# Purchase verification
"Verifying purchase for user=..."
"Purchase verified successfully"

# Errors to watch
"REVENUECAT_SECRET_KEY not configured"
"Webhook signature verification failed"
"Purchase verification failed"
```

### Health Endpoint
Add this endpoint if not present:
```python
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "server_dev_mode": SERVER_DEV_MODE,
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 📝 Post-Deployment Checklist

After successful deployment:

- [ ] Verify smoke tests pass
- [ ] Check Sentry for new errors (none expected)
- [ ] Monitor telemetry for 30 minutes
- [ ] Verify RevenueCat dashboard shows connection
- [ ] Test one real purchase in sandbox (if possible)
- [ ] Document any issues encountered

---

## 📞 Escalation Contacts

| Issue Type | Contact |
|------------|---------|
| Backend infrastructure | DevOps team |
| RevenueCat integration | RevenueCat support |
| App Store issues | App review team |
| Payment processing | RevenueCat + payment provider |

---

## 📝 Version History

| Date | Version | Change |
|------|---------|--------|
| 2025-01-15 | 1.0 | Initial release (Phase 3.16) |
