# Frontend Smoke Test - Tap Path Checklist

This document provides a manual "tap path" checklist for frontend RC validation.

---

## Pre-Test Setup

- [ ] Build app with `EXPO_PUBLIC_ENV=production`
- [ ] Install on device/simulator
- [ ] Ensure backend is running with test credentials available

---

## Test Path 1: New User Registration

1. [ ] Launch app (fresh install or cleared data)
2. [ ] Tap "Create Account" or equivalent
3. [ ] Enter test username: `RCTest_<timestamp>`
4. [ ] Enter test password: `TestPass123!`
5. [ ] Tap "Register"
6. [ ] **Expected**: Navigates to home screen
7. [ ] **Verify**: User data loads (resources, heroes)

---

## Test Path 2: Login with Existing User

1. [ ] Launch app
2. [ ] Enter existing test credentials
3. [ ] Tap "Login"
4. [ ] **Expected**: Navigates to home screen
5. [ ] **Verify**: Previous user data loads

---

## Test Path 3: App Resume Reconciliation

1. [ ] Login to app
2. [ ] Press Home button (background app)
3. [ ] Wait 5 seconds
4. [ ] Return to app
5. [ ] **Expected**: No blocking alerts
6. [ ] **Expected**: App resumes smoothly
7. [ ] **Verify**: Console log shows `[useAppResumeReconcile] App resumed from background`

---

## Test Path 4: Cinematic Gate Denial

1. [ ] Navigate to Heroes screen
2. [ ] Find a 5+ star hero
3. [ ] Tap the cinematic play button (🎬)
4. [ ] **Expected**: Routes to `/paid-features?source=cinematic_gate`
5. [ ] **Verify**: Paywall shows "Premium Cinematics Pack" product
6. [ ] Tap "Cancel" or back button
7. [ ] **Expected**: Returns to hero screen

---

## Test Path 5: Battle Pass Premium CTA

1. [ ] Navigate to Battle Pass screen
2. [ ] Find a premium reward (locked)
3. [ ] Tap on premium reward
4. [ ] **Expected**: Alert shows "Premium Pass Required"
5. [ ] Tap "View Premium"
6. [ ] **Expected**: Routes to `/paid-features?source=battle_pass`
7. [ ] Tap back
8. [ ] **Expected**: Returns to Battle Pass

---

## Test Path 6: Profile Premium CTA

1. [ ] Navigate to Profile screen
2. [ ] Find "Premium Features" button
3. [ ] Tap button
4. [ ] **Expected**: Routes to `/paid-features?source=profile`
5. [ ] **Verify**: Paywall shows all available products
6. [ ] Tap back
7. [ ] **Expected**: Returns to Profile

---

## Test Path 7: Store Quick Link

1. [ ] Navigate to Home screen
2. [ ] Find "Store" quick link
3. [ ] Tap button
4. [ ] **Expected**: Routes to `/store?source=store`
5. [ ] **Verify**: Store shows available products
6. [ ] Tap back
7. [ ] **Expected**: Returns to Home

---

## Test Path 8: Purchase Button States

> Note: This test requires RevenueCat sandbox or simulated purchase flow

1. [ ] Navigate to Paywall
2. [ ] Find a product
3. [ ] **Verify Idle State**: Shows price, button is tappable
4. [ ] Tap "Buy" button
5. [ ] **Verify Processing State**: Shows spinner, button disabled
6. [ ] (If sandbox) Complete purchase flow
7. [ ] **Verify Verifying State**: Shows "Verifying..."
8. [ ] (If successful) **Verify Success State**: Shows "Owned" or checkmark
9. [ ] (If failed) **Verify Failed State**: Shows error, retry available

---

## Test Path 9: Logout Flow

1. [ ] Navigate to Profile
2. [ ] Tap "Logout" button
3. [ ] Confirm logout
4. [ ] **Expected**: Returns to login screen
5. [ ] **Verify**: User data cleared (login shows empty fields)

---

## Test Path 10: Telemetry Verification

> Note: Requires `EXPO_PUBLIC_ANALYTICS_ENABLED=true` or dev mode console logs

1. [ ] Perform Test Path 4 (Cinematic Gate)
2. [ ] **Verify Console**: `[track] paywall_opened {source: "cinematic_gate"}`
3. [ ] **Verify Console**: `[track] premium_gate_denied {requiredKey: "PREMIUM_CINEMATICS_PACK"}`

4. [ ] Perform Test Path 7 (Store Quick Link)
5. [ ] **Verify Console**: `[track] store_opened {source: "store"}`

6. [ ] Rapidly tap Store button 3 times
7. [ ] **Verify Console**: Only 1-2 `store_opened` events (dedupe working)

---

## Sign-Off

| Test Path | Pass/Fail | Tester | Notes |
|-----------|-----------|--------|-------|
| 1. New User Registration | | | |
| 2. Login with Existing User | | | |
| 3. App Resume Reconciliation | | | |
| 4. Cinematic Gate Denial | | | |
| 5. Battle Pass Premium CTA | | | |
| 6. Profile Premium CTA | | | |
| 7. Store Quick Link | | | |
| 8. Purchase Button States | | | |
| 9. Logout Flow | | | |
| 10. Telemetry Verification | | | |

---

## Known Issues / Notes

_Document any issues encountered during testing:_

1. 
2. 
3. 

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2025-01-15 | 1.0 | Initial release (Phase 3.17) |
