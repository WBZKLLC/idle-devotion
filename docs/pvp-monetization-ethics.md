# PVP MONETIZATION ETHICS (NON-NEGOTIABLE CONSTRAINTS)

Last Updated: January 2025
Status: **LOCKED** — Violations trigger guard failures

---

## 1. CORE PRINCIPLE

> **Monetization must never determine competitive outcomes.**

Players should win PvP through skill, strategy, and time investment — not wallet size.

---

## 2. NON-NEGOTIABLE RULES

### A) NEVER SELL DIRECT PVP POWER

| ❌ DISALLOWED | ✅ ALLOWED |
|--------------|----------|
| VIP combat stat buffs | Cosmetics |
| Paid-only PvP gear | Convenience (faster idle) |
| Paid-only heroes | Storage/inventory slots |
| Paid-only matchmaking advantages | Acceleration neutralized in ranked |
| Pay-to-skip skill requirements | Extra attempts (with caps) |

### B) USE PVP NORMALIZATION

Pick one or combine:

1. **Stat Normalization** - Everyone scaled to a band in ranked
2. **League Brackets** - By power score / roster depth
3. **Draft/Limited Formats** - Collection breadth > raw stats
4. **Seasonal Resets** - Prevent permanent whale dominance

### C) CAP "ATTEMPT PRESSURE"

If selling attempts/tickets:

- ✅ Daily cap + generous free attempts
- ✅ Clear countdowns
- ✅ Loss protection NOT paid-only
- ❌ Never use streak-loss fear to push spending
- ❌ Never sell unlimited attempts

### D) TRANSPARENT PROBABILITIES

For anything RNG-tied to PvP viability:

- ✅ Visible odds on all gacha/loot
- ✅ Visible pity counters
- ✅ Non-deceptive UX (no fake near-misses)
- ❌ Never hide rates
- ❌ Never manipulate displayed odds

### E) SPEND PROTECTION UX

Especially for high-VIP ladders:

- ✅ Spending summaries
- ✅ Optional hard caps / cooldown reminders
- ✅ Clear receipts (canonical receipt system)
- ✅ "Are you sure?" confirmations on large purchases
- ❌ Never use dark patterns to encourage overspending

### F) CONTENT ≠ COERCION

Since heroes have suggestive presentation:

- ✅ Intimacy unlocks are cosmetic/narrative/UI-only
- ✅ Adult content is a reward, not a spend lever
- ❌ Never tie intimacy to PvP advantage
- ❌ Never use "pay to unlock spicier content" that grants combat power

---

## 3. IMPLEMENTATION CHECKLIST

### Backend Constraints

```python
# FORBIDDEN PATTERNS:
# - vip_level affects ATK/HP/DEF
# - paid_hero has higher base stats
# - purchase unlocks PvP matchmaking boost
# - VIP gets guaranteed wins

# ALLOWED PATTERNS:
# - VIP affects idle cap/rate
# - VIP unlocks cosmetics
# - VIP gets convenience features
# - Paid heroes have same stats as earnable heroes
```

### Frontend Constraints

```typescript
// FORBIDDEN:
// - "Buy power" CTAs
// - "Pay to win" features
// - Hidden spend totals

// REQUIRED:
// - Clear odds display
// - Pity counter visibility
// - Spend summaries
// - Confirmation dialogs
```

---

## 4. GUARD ENFORCEMENT

### guard-pvp-ethics.mjs must verify:

1. ❌ No VIP stat buffs (ATK, HP, DEF multipliers)
2. ❌ No paid-only heroes with superior stats
3. ❌ No matchmaking manipulation by spend
4. ❌ No unlimited PvP attempts for sale
5. ✅ Pity counters visible in gacha UI
6. ✅ Odds displayed on all random rewards

### guard-vip-benefits.mjs enforces:

- No VIP combat stat buffs
- VIP benefits are economy/comfort only
- No VIP-exclusive heroes

---

## 5. ETHICAL MONETIZATION ALTERNATIVES

### What DOES work (ethically + profitably):

| Revenue Stream | Why It's Ethical |
|----------------|------------------|
| Cosmetics | No power advantage |
| Battle Pass | Time-gated, earnable |
| Convenience | Saves time, not skill |
| Collection breadth | More options, not raw power |
| Seasonal content | Fresh, not P2W |
| Guild features | Social, not individual power |

### Whale-Friendly Without P2W:

- Exclusive cosmetics (frames, skins, effects)
- Collection completion bonuses
- Guild leader perks (cosmetic)
- Leaderboard cosmetic rewards
- "Founder" badges and recognition

---

## 6. REGULATORY COMPLIANCE

### Loot Box Laws (Belgium, Netherlands, etc.)

- ✅ Display all odds
- ✅ Pity system prevents infinite spend
- ✅ No "pay for advantage" in competitive modes

### Age Rating Considerations

- Gacha = simulated gambling in some jurisdictions
- Adult content requires age gating
- Spending limits for minors (if applicable)

---

## 7. VIOLATION RESPONSE

### If a guard detects violation:

1. **Build fails** - Cannot deploy
2. **Alert sent** - Team notified
3. **Revert required** - Fix before merge

### If violation ships:

1. **Hotfix immediately**
2. **Compensate affected players**
3. **Post-mortem to prevent recurrence**

---

## 8. SIGN-OFF

This document represents a commitment to ethical game design.

**Monetize time savings, not competitive outcomes.**

---

**END OF PVP MONETIZATION ETHICS**
