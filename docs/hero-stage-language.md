# Hero Stage Language Contract

Defines the visual and interaction language for hero presentation screens.

---

## Tier System (0-5)

Affinity level determines presentation tier:

| Tier | Affinity | Camera | Motion | Parallax Planes |
|------|----------|--------|--------|----------------|
| 0 | 0 | Distant | None | None |
| 1 | 1 | Distant | None | None |
| 2 | 2 | Standard | Breath | Shelf I |
| 3 | 3 | Standard | Breath + Micro-sway | Shelf I + Veil |
| 4 | 4 | Intimate | Breath + Sway + Bob | Shelf II + Halo |
| 5 | 5 | Intimate | Full presence | Shelf II + Halo + Rim |

---

## Camera Modes

- **Distant (tier 0-1):** Full body visible, neutral framing
- **Standard (tier 2-3):** Slightly closer, subtle engagement
- **Intimate (tier 4-5):** Face/upper body focus, "close" feeling

---

## Motion Rules (LOCKED)

### Animation Technology
- **ONLY** use `react-native-reanimated` worklets
- **NEVER** use `setTimeout`, `setInterval`, or `requestAnimationFrame`
- All motion via `useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`

### Reduce Motion
- Check `AccessibilityInfo.isReduceMotionEnabled()` on mount
- Listen to `reduceMotionChanged` events
- When enabled: `tier < 2` behavior (no motion)

### Motion Parameters (Single Source of Truth)

```typescript
MOTION_PARAMS = {
  0: { breathingScale: 0,     swayX: 0,   swayY: 0,   bobY: 0,   rotateZ: 0     },
  1: { breathingScale: 0,     swayX: 0,   swayY: 0,   bobY: 0,   rotateZ: 0     },
  2: { breathingScale: 0.006, swayX: 0,   swayY: 0,   bobY: 0.8, rotateZ: 0     },
  3: { breathingScale: 0.010, swayX: 1.2, swayY: 0.6, bobY: 1.4, rotateZ: 0.002 },
  4: { breathingScale: 0.013, swayX: 1.8, swayY: 1.0, bobY: 2.0, rotateZ: 0.003 },
  5: { breathingScale: 0.016, swayX: 2.4, swayY: 1.4, bobY: 2.6, rotateZ: 0.004 },
};
```

---

## Parallax Planes

Planes render behind hero art with tier-based opacity:

| Plane | Depth | Purpose |
|-------|-------|--------|
| shelf | mid | Ground/stage element |
| veil | foreground | Soft foreground overlay |
| halo | far | Backlight/glow effect |
| rim | near | Edge highlight |

---

## Safe Zones

UI chrome must not overlap hero focus areas:

- **Face zone:** Top 10-35% of hero container
- **Body zone:** 35-75% of hero container
- **Action zone:** Bottom 25% (UI buttons live here)

---

## Microcopy Tone

- Camera labels: "Distant", "Standard", "Intimate" (not technical)
- Motion labels: "None", "Breath", "Breath + Micro-sway", "Full presence"
- Unlock messages: "Recognition begins", "Breath animation unlocked", "Intimate framing unlocked"

---

## Guards

- `guard-hero-motion.mjs` enforces:
  - No timers/RAF in motion files
  - `deriveHeroStageConfig` usage
  - Reduce Motion branch present
  - Locked motion values match spec
