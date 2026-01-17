# Hero Stage Language Contract

Phase 3.26 — Canonical reference for hero presentation tiers.

This document is the human-readable mirror of `lib/hero/motion.ts` and stage config.

---

## Tier Table (0–5)

| Tier | Affinity | Camera Mode | Motion | Parallax Planes | Safe Zones |
|------|----------|-------------|--------|-----------------|------------|
| 0 | 0 | Distant | None | None | Default |
| 1 | 1 | Distant | None | None | Default |
| 2 | 2 | Standard | Breath | Shelf I | Default |
| 3 | 3 | Standard | Breath + Micro-sway | Shelf I + Veil | Default |
| 4 | 4 | Intimate | Breath + Sway + Bob | Shelf II + Halo | Face/Body aware |
| 5 | 5+ | Intimate | Full presence | Shelf II + Halo + Rim | Face/Body aware |

---

## Camera Mode Definitions

### Distant (Tier 0–1)
- Scale: 0.88
- TranslateY: -20
- Use: Gallery view, hero selection, initial presentation
- Tone: Observational, respectful distance

### Standard (Tier 2–3)
- Scale: 1.0
- TranslateY: 0
- Use: Default viewing, hero detail
- Tone: Present, engaged

### Intimate (Tier 4–5)
- Scale: 1.08
- TranslateY: +24
- Use: High affinity, private view
- Tone: Close, personal (tasteful, not explicit)
- **Locked until Tier 4**

---

## Motion Parameters (from MOTION_PARAMS)

| Tier | breathingScale | swayX | swayY | bobY | rotateZ |
|------|----------------|-------|-------|------|---------|
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | 0.006 | 0 | 0 | 0.8 | 0 |
| 3 | 0.010 | 1.2 | 0.6 | 1.4 | 0.002 |
| 4 | 0.013 | 1.8 | 1.0 | 2.0 | 0.003 |
| 5 | 0.016 | 2.4 | 1.4 | 2.6 | 0.004 |

### Motion Labels
- **None**: Static presentation
- **Breath**: Subtle scale oscillation (breathing effect)
- **Micro-sway**: Minimal horizontal movement
- **Sway + Bob**: Horizontal + vertical subtle motion
- **Full presence**: All motion channels active

---

## Parallax Planes (from PARALLAX_PLANES)

### Shelf
- Depth: mid
- Purpose: Subtle depth behind hero
- Opacity: 0.08–0.14 depending on tier

### Veil
- Depth: foreground
- Purpose: Atmospheric foreground haze
- Opacity: 0.04–0.08
- Blur: 2px

### Halo
- Depth: far
- Purpose: Background glow/rim lighting
- Opacity: 0.08–0.10

### Rim
- Depth: near
- Purpose: Subtle edge highlight (Tier 5 only)
- Opacity: 0.05

---

## UI Safe Zone Rules

### Default (Tier 0–3)
- Top HUD: Fixed position
- Bottom actions: Fixed position
- No special hero-face avoidance

### Face/Body Aware (Tier 4–5)
- Respect `safeZones.face` region for Selene-class heroes
- Avoid overlapping face region with UI chrome
- Bottom actions may adjust if hero pose requires

---

## Microcopy Tone Rules

### General
- Sanctuary restrained: calm, understated, not exclamatory
- No explicit/suggestive language
- Use present tense for current state, future tense for unlocks

### Examples
✅ "Distant framing."
✅ "Intimate framing unlocked."
✅ "Breath animation unlocked."
✅ "Next unlock at Affinity 4."

❌ "HOT NEW UNLOCK!"
❌ "Get closer to her..."
❌ "Unlock sexy poses!"

---

## Implementation Notes

### Single Source of Truth
All tier thresholds, motion params, and parallax configs are defined in:
```
lib/hero/motion.ts
```

UI components MUST read from:
- `TIER_THRESHOLDS`
- `getTierInfo(tier)`
- `getTierTable()`
- `deriveHeroStageConfig()`

UI components MUST NOT hardcode tier numbers or thresholds.

### Reduce Motion
When accessibility Reduce Motion is enabled:
- All motion disabled
- Parallax opacity reduced or disabled
- Camera mode still applies

### Guard Enforcement
The `guard-hero-motion.mjs` script validates:
- No forbidden APIs (setTimeout, RAF)
- Uses centralized config derivation
- Reduce Motion check present
