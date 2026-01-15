# Release Candidate Validation Matrix

This document provides a **repeatable, check-the-box** validation process for release candidates.

---

## A) Configuration Matrix

| Environment | `SERVER_DEV_MODE` | `EXPO_PUBLIC_ENV` | Expected Behavior |
|-------------|------------------:|-------------------|-------------------|
| **Local Dev** | `true` | `development` | Simulated purchases OK, warnings OK, throws on config errors |
| **Staging** | `false` | `staging` | Simulated purchases blocked, RC secrets required, logs config errors |
| **Production** | `false` | `production` | Fail-fast if secrets missing, HTTPS backend required, logs config errors |

### Environment Variable Checklist

#### Backend (Required for `SERVER_DEV_MODE=false`)
| Variable | Status | Notes |
|----------|--------|-------|
| `SERVER_DEV_MODE` | ☐ Set to `false` | |
| `REVENUECAT_SECRET_KEY` | ☐ Set | From RevenueCat Dashboard |
| `REVENUECAT_WEBHOOK_SECRET` | ☐ Set | From RevenueCat Dashboard |
| `JWT_SECRET_KEY` | ☐ Set (recommended) | Stable across restarts |
| `MONGO_URL` | ☐ Set | Production MongoDB |

#### Frontend (Required for `EXPO_PUBLIC_ENV=production`)
| Variable | Status | Notes |
|----------|--------|-------|
| `EXPO_PUBLIC_ENV` | ☐ Set to `production` | |
| `EXPO_PUBLIC_BACKEND_URL` | ☐ Set with `https://` | |
| `EXPO_PUBLIC_SENTRY_DSN` | ☐ Set (recommended) | |
| `EXPO_PUBLIC_ANALYTICS_ENABLED` | ☐ Set to `true` (recommended) | |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | ☐ Set | Public API key |

---

## B) Backend Smoke Tests

Run these tests against the deployed backend. Use `scripts/rc/smoke-backend.sh` for automation.

### Health Check
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Health endpoint | `GET /api/health` | `200 OK`, JSON with `status: "healthy"` | ☐ |

### Authentication
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Login success | `POST /api/auth/login` | `200 OK`, JWT token returned | ☐ |
| Login invalid | `POST /api/auth/login` (bad creds) | `401 Unauthorized` | ☐ |
| Token verify | `GET /api/auth/verify` (with token) | `200 OK`, user data | ☐ |

### Entitlements
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Snapshot structure | `GET /api/entitlements/snapshot` | `200 OK` | ☐ |
| Has `server_time` | Response body | ISO8601 timestamp present | ☐ |
| Has `ttl_seconds` | Response body | Integer present (default 300) | ☐ |
| Has `version` | Response body | Integer present | ☐ |
| Has `entitlements` | Response body | Object with entitlement keys | ☐ |

### Premium Gates
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Cinematic access (no entitlement) | `GET /api/hero/{id}/cinematic/access` | `403 Forbidden` | ☐ |
| Battle pass claim (no premium) | `POST /api/battle-pass/claim` (premium) | `403 Forbidden` | ☐ |

### Purchase Verification
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Verify (no secret configured) | `POST /api/purchases/verify` | `503 Service Unavailable` | ☐ |
| Verify (with secret, invalid receipt) | `POST /api/purchases/verify` | `400 Bad Request` | ☐ |

### Webhook
| Test | Endpoint | Expected | Status |
|------|----------|----------|--------|
| Webhook (invalid signature) | `POST /api/webhooks/revenuecat` | `401 Unauthorized` | ☐ |
| Webhook (valid signature, test event) | `POST /api/webhooks/revenuecat` | `200 OK` | ☐ |

---

## C) Frontend Smoke Tests

Run these tests on a device or simulator. See `scripts/rc/smoke-frontend.md` for detailed tap paths.

### App Boot
| Test | Expected | Status |
|------|----------|--------|
| App launches without crash | Splash → Home | ☐ |
| Config validation logs | `[config] ✅ Configuration validated (production mode)` | ☐ |
| No blocking alerts on startup | No alerts unless config error | ☐ |

### Authentication Flow
| Test | Expected | Status |
|------|----------|--------|
| New user registration | Success, navigates to home | ☐ |
| Login with existing user | Success, navigates to home | ☐ |
| Logout | Clears state, returns to login | ☐ |

### App Resume Reconciliation
| Test | Expected | Status |
|------|----------|--------|
| Background → Foreground | No blocking alerts, silent refresh | ☐ |
| Entitlements refresh (if stale) | Background network call only | ☐ |

### Paywall Navigation
| Test | Trigger | Expected | Status |
|------|---------|----------|--------|
| Cinematic denial | Tap locked cinematic | Routes to `/paid-features?source=cinematic_gate` | ☐ |
| Battle pass premium CTA | Tap premium reward (unentitled) | Routes to `/paid-features?source=battle_pass` | ☐ |
| Profile premium CTA | Tap "Premium Features" button | Routes to `/paid-features?source=profile` | ☐ |
| Store quick link | Tap Store on home | Routes to `/store?source=store` | ☐ |

### Purchase Button States
| State | Expected UI | Status |
|-------|-------------|--------|
| Idle | Shows price, tappable | ☐ |
| Processing | Shows spinner, disabled | ☐ |
| Verifying | Shows "Verifying...", disabled | ☐ |
| Success | Shows "Owned" or checkmark | ☐ |
| Failed | Shows error, retry available | ☐ |

---

## D) Monetization Observability Checks

### Telemetry Events
| Event | When Fired | Expected Props | Status |
|-------|------------|----------------|--------|
| `paywall_opened` | `goToPaywall()` | source, productKey?, heroId?, isHub | ☐ |
| `store_opened` | `goToStore()` | source | ☐ |
| `premium_gate_denied` | Gate denial | requiredKey, source, heroId? | ☐ |
| `premium_gate_allowed` | Gate allow (10% sampled) | requiredKey, source, sampled | ☐ |
| `purchase_attempt` | Purchase flow start | productKey | ☐ |
| `purchase_success` | Purchase verified | productKey | ☐ |
| `purchase_failure` | Purchase failed | productKey, error | ☐ |

### Dedupe & Sampling
| Check | Expected | Status |
|-------|----------|--------|
| Rapid paywall opens (double-tap) | Only 1 event within 1.5s | ☐ |
| Rapid store opens (double-tap) | Only 1 event within 1.5s | ☐ |
| Gate allowed sampling | ~10% of allows logged | ☐ |

### No PII in Telemetry
| Check | Expected | Status |
|-------|----------|--------|
| No username in props | Verified via code review | ☐ |
| No email in props | Verified via code review | ☐ |
| No tokens in props | Verified via code review | ☐ |

---

## E) RC Sign-Off

### Pre-Release Checklist
| Item | Status | Signed By |
|------|--------|-----------|
| All guards pass (`npm run guard`) | ☐ | |
| Backend smoke tests pass | ☐ | |
| Frontend smoke tests pass | ☐ | |
| Telemetry verified | ☐ | |
| Documentation reviewed | ☐ | |
| Rollback plan understood | ☐ | |

### Sign-Off
| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product | | | |

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2025-01-15 | 1.0 | Initial release (Phase 3.17) |
