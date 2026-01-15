# UX Premium Surfaces Specification

This document defines the **canonical behavior** for every premium entrypoint in the app.
All screens MUST use this specification—no custom premium copy/logic is allowed.

---

## 1) Premium Entrypoints Table

| Surface | Trigger | Destination | Product Key | Source Tag | Copy |
|---------|---------|-------------|-------------|------------|------|
| **Cinematic Lock** | Tap locked cinematic on hero detail | Paywall (specific) | `PREMIUM_CINEMATICS_PACK` | `cinematic_gate` | "Unlock Premium Cinematics" |
| **Battle Pass Premium** | Tap locked premium reward | Paywall (specific) | `PREMIUM_SUBSCRIPTION` | `battle_pass` | "Upgrade to Premium Pass" |
| **Profile Premium Button** | Tap "Premium Features" in profile | Paywall (hub) | *(none - show all)* | `profile` | "View Premium Options" |
| **Store Quick Link** | Tap Store on home | Store (hub) | *(none - show all)* | `store` | "Store" |
| **No Ads (future)** | Tap "Remove Ads" banner | Paywall (specific) | `NO_ADS` | `ads_banner` | "Remove Ads Forever" |
| **Starter Pack (future)** | Tap starter pack offer | Paywall (specific) | `STARTER_PACK` | `starter_offer` | "Claim Starter Pack" |

---

## 2) Copy Rules

### Button Labels (CTAs)
| Context | Label | Icon |
|---------|-------|------|
| Primary purchase CTA | "Unlock Now" | 🔓 or ★ |
| Secondary/browse CTA | "View Options" | → |
| Owned state | "Owned" | ✓ |
| Processing state | "Processing..." | ⏳ (spinner) |
| Restore purchases | "Restore Purchases" | ↻ |

### Denial Messages
| Entitlement | Alert Title | Alert Body |
|-------------|-------------|------------|
| `PREMIUM_CINEMATICS_PACK` | "Premium Cinematic" | "Unlock this cinematic with the Premium Cinematics Pack." |
| `PREMIUM` / `PREMIUM_SUBSCRIPTION` | "Premium Feature" | "This feature requires a premium subscription." |
| `NO_ADS` | "Ad-Free Experience" | "Remove all ads with a one-time purchase." |
| Generic | "Premium Feature" | "This feature requires a premium purchase." |

### Benefit Bullets (Concrete, Not Vague)
| Product | Benefit 1 | Benefit 2 | Benefit 3 |
|---------|-----------|-----------|-----------|
| Premium Cinematics Pack | "Unlock all hero cinematics" | "+5% stat bonus for owned heroes" | "Exclusive visual effects" |
| Premium Subscription | "Premium battle pass rewards" | "2x idle rewards" | "Exclusive monthly hero" |
| No Ads | "Remove all advertisements" | "Uninterrupted gameplay" | "One-time purchase" |
| Starter Pack | "500 Crystals" | "3 Premium Summons" | "1 Guaranteed 4★ Hero" |

---

## 3) Icon Rules

| State | Icon | Color |
|-------|------|-------|
| Locked (not owned) | 🔒 | Gold (`#FFD700`) |
| Premium indicator | ★ | Gold (`#FFD700`) |
| Owned/Unlocked | ✓ | Green (`#22C55E`) |
| Processing | Spinner | White |
| Subscription | ∞ | Purple (`#A855F7`) |
| One-time | 💎 | Blue (`#3B82F6`) |

---

## 4) Button Order Rules

### Paywall Screen
1. **Primary CTA** (top) - Main product purchase button
2. **Secondary options** (if hub) - Other products in cards
3. **Restore Purchases** (bottom) - Always visible
4. **Not Now** (bottom) - Always visible, never hidden

### Alert Dialogs
1. "Cancel" (left, secondary style)
2. "View Store" / "Unlock Now" (right, primary style)

---

## 5) Pricing Display Rules

| Type | Display Format | Example |
|------|----------------|---------|
| One-time purchase | "$X.XX · One-time" | "$4.99 · One-time" |
| Monthly subscription | "$X.XX/month" | "$2.99/month" |
| Annual subscription | "$X.XX/year (Save X%)" | "$24.99/year (Save 30%)" |
| Free (dev/granted) | "Free" | "Free" |

### Restore Purchases
- Always show "Restore Purchases" link on paywall
- On tap: attempt to restore from RevenueCat
- On success: show toast "Purchases restored"
- On failure: show toast "No purchases to restore"

---

## 6) "Why Am I Seeing This?" Panel

When user taps "Why am I seeing this?" on paywall:

| Source | Explanation |
|--------|-------------|
| `cinematic_gate` | "You tried to play a premium cinematic. This content is part of the Premium Cinematics Pack." |
| `battle_pass` | "You tried to claim a premium battle pass reward. Upgrade to unlock all premium rewards." |
| `profile` | "You're browsing premium options from your profile." |
| `store` | "You're browsing the in-game store." |
| `gating_alert` | "A premium feature was accessed. View available options below." |

---

## 7) Post-Purchase UX

### Immediate Feedback
1. Show success state in PurchaseButton ("Owned ✓")
2. Show "What Changed?" panel:
   - "✓ [Product Name] Unlocked"
   - List of concrete benefits now active
3. Auto-dismiss after 3 seconds OR tap to dismiss

### Silent Entitlement Refresh
- On app resume: silent refresh (no UI)
- If entitlement changed: show small toast "Premium unlocked" (green)
- If entitlement expired: show small toast "Subscription expired" (amber)

### Toast Component (Phase 3.18)
The design system includes a global `Toast` component for non-intrusive feedback:

| Import | Usage |
|--------|-------|
| `import { toast } from '../components/ui/Toast'` | Call from any component |

| Method | Example | Use Case |
|--------|---------|----------|
| `toast.success(msg)` | `toast.success('Purchase complete!')` | Success confirmation |
| `toast.info(msg)` | `toast.info('Processing...')` | Informational notice |
| `toast.warning(msg)` | `toast.warning('Subscription expires soon')` | Amber warning |
| `toast.error(msg)` | `toast.error('Payment failed')` | Error feedback |
| `toast.premium(msg)` | `toast.premium('Premium unlocked!')` | Purple premium feedback |

Options: `{ duration: 3000, action: { label: 'Undo', onPress: fn } }`

---

## 8) Forbidden Patterns

These patterns are **NOT ALLOWED** anywhere in the app:

| Pattern | Why Forbidden |
|---------|---------------|
| Custom premium copy in screens | Use canonical copy from this spec |
| Direct `router.push('/paid-features')` | Use `goToPaywall()` helper |
| Hiding "Not Now" / "Cancel" | Trapping users is unethical |
| Vague benefit bullets | Must be concrete and specific |
| "Buy Now" without price | Always show price upfront |
| Auto-dismiss paywall on deny | User controls navigation |
| Fullscreen modal without close | Always provide exit |

---

## 9) Accessibility Requirements

| Element | Requirement |
|---------|-------------|
| Price text | Minimum 16pt, high contrast |
| CTA buttons | Minimum 44x44 touch target |
| Lock icons | Include aria-label "Locked, premium required" |
| Success states | Green checkmark + text (not color alone) |

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2025-01-15 | 1.0 | Initial release (Phase 3.18) |
