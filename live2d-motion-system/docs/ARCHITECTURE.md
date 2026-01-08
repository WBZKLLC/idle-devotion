# Live2D Motion System Architecture

## Overview

This document describes the **Live2D-native, parameter-driven motion system** for DivineHeros. All character motion is defined in **engine-agnostic JSON profiles** and applied via **Live2D parameters** at runtime.

**Key Principles:**
- ✅ JSON profiles are the single source of truth
- ✅ All motion is parameter-driven, not physics-based
- ✅ Unity is a reference runtime only
- ✅ No CSS animations for character motion
- ✅ No baked animation curves in Unity
- ❌ No physics simulation
- ❌ No hybrid systems

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXPO (UI Shell)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Summon    │  │   Combat    │  │   Gallery   │                  │
│  │    Screen   │  │   Screen    │  │   Screen    │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          │                                           │
│                 ┌────────▼────────┐                                  │
│                 │  State Commands │  (idle, combat, banner)          │
│                 └────────┬────────┘                                  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    JSON MOTION PROFILES                              │
│                    (Single Source of Truth)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ idle_default │  │ combat_ready │  │banner_reveal │               │
│  │    .json     │  │    .json     │  │    .json     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UNITY (Live2D Runtime)                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Live2DMotionProfileLoader                       │    │
│  │  - Load JSON profiles from Resources                         │    │
│  │  - Index by state (idle, combat, banner)                     │    │
│  │  - Provide profiles to driver                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            │                                         │
│                            ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Live2DParameterDriver                           │    │
│  │  - Interpret JSON motion definitions                         │    │
│  │  - Calculate waveforms (sine, triangle, etc.)                │    │
│  │  - Apply easing functions                                    │    │
│  │  - Blend between profiles                                    │    │
│  │  - Enforce rating-safe clamps                                │    │
│  │  - Output: Live2D parameter values                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            │                                         │
│                            ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Live2D Cubism Model                             │    │
│  │  - ParamBodyAngleX, ParamBodyAngleY, ParamBodyAngleZ         │    │
│  │  - ParamBreath, ParamChestSoftX, ParamChestSoftY             │    │
│  │  - ParamAbdomenSoft, ParamPelvisShift                        │    │
│  │  - ParamEyeOpenL, ParamEyeOpenR, ParamMouthOpenY...          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## JSON Profile Schema

### Core Structure

```json
{
  "id": "idle_default",
  "version": "1.0.0",
  "state": "idle",
  "duration": 4.0,
  "loop": true,
  "globalIntensity": 1.0,
  "globalSpeed": 1.0,
  "blendInDuration": 0.5,
  "blendOutDuration": 0.5,
  "parameters": {
    "ParamBreath": {
      "enabled": true,
      "amplitude": 0.3,
      "speed": 0.8,
      "phase": 0,
      "easing": "sine",
      "waveform": "sine",
      "baseValue": 0.0,
      "minClamp": -0.5,
      "maxClamp": 0.5
    }
  },
  "ratingClamps": {
    "ParamChestSoftX": { "min": -0.3, "max": 0.3 },
    "ParamChestSoftY": { "min": -0.3, "max": 0.3 }
  }
}
```

### Parameter Motion Definition

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether this parameter is active |
| `amplitude` | float | Peak deviation from base value (-1.0 to 1.0) |
| `speed` | float | Oscillation speed multiplier (0.1 - 5.0) |
| `phase` | float | Phase offset in radians (0 - 2π) |
| `easing` | string | Easing function (linear, sine, ease_in, ease_out, ease_in_out, bounce, elastic) |
| `waveform` | string | Oscillation waveform (sine, triangle, square, sawtooth, noise) |
| `baseValue` | float | Center value for oscillation |
| `minClamp` | float | Hard minimum value |
| `maxClamp` | float | Hard maximum value |

---

## Approved Live2D Parameters

### Body Motion
| Parameter | Description |
|-----------|-------------|
| `ParamBodyAngleX` | Body tilt left/right |
| `ParamBodyAngleY` | Body lean forward/back |
| `ParamBodyAngleZ` | Body rotation |
| `ParamBreath` | Breathing motion |
| `ParamChestSoftX` | Upper torso horizontal sway |
| `ParamChestSoftY` | Upper torso vertical motion |
| `ParamAbdomenSoft` | Midsection motion |
| `ParamPelvisShift` | Lower body sway |

### Face
| Parameter | Description |
|-----------|-------------|
| `ParamEyeOpenL` | Left eye open/close |
| `ParamEyeOpenR` | Right eye open/close |
| `ParamEyeBallX` | Eye gaze horizontal |
| `ParamEyeBallY` | Eye gaze vertical |
| `ParamBrowLY` | Left eyebrow height |
| `ParamBrowRY` | Right eyebrow height |
| `ParamMouthOpenY` | Mouth open amount |
| `ParamMouthForm` | Smile/frown expression |

### Hair/Accessories
| Parameter | Description |
|-----------|-------------|
| `ParamHairFront` | Front hair sway |
| `ParamHairSide` | Side hair movement |
| `ParamHairBack` | Back hair flow |

### Arms
| Parameter | Description |
|-----------|-------------|
| `ParamArmLA` | Left arm position |
| `ParamArmRA` | Right arm position |

### Global Controls
| Parameter | Description |
|-----------|-------------|
| `ParamMotionIntensity` | Overall motion scale |
| `ParamMotionSpeed` | Overall motion speed |

---

## Motion States

| State | Description | Loop | Typical Duration |
|-------|-------------|------|------------------|
| `idle` | Default standing/breathing | Yes | 3-5 seconds |
| `combat` | Battle-ready stance | Yes | 2-3 seconds |
| `banner` | Summon reveal | No | 5-8 seconds |
| `summon` | Pre-reveal anticipation | Yes | 2-4 seconds |
| `victory` | Win celebration | No | 3-5 seconds |
| `defeat` | Loss reaction | No | 2-4 seconds |

---

## Unity Implementation

### Setup Steps

1. **Add Cubism SDK to project**
2. **Import Live2D model (.moc3, .model3.json)**
3. **Add components to model GameObject:**
   - `Live2DMotionProfileLoader`
   - `Live2DParameterDriver`
   - `Live2DStateController`
   - (Optional) `Live2DBannerModeController`

4. **Place JSON profiles in Resources/Live2D/MotionProfiles/**

### Runtime Flow

```csharp
// State controller receives command from game logic
stateController.SetState(MotionState.Combat);

// Profile loader provides the appropriate profile
var profile = profileLoader.GetDefaultProfileForState(MotionState.Combat);

// Parameter driver applies profile to Live2D model
parameterDriver.SetProfile(profile);

// Every LateUpdate, driver calculates and applies parameter values
// based on profile definitions (amplitude, speed, easing, etc.)
```

### Banner Mode Example

```csharp
// Enter banner presentation mode
stateController.EnterBannerMode();

// Or use the full sequence controller
bannerController.PlayBannerSequence();

// Subscribe to sequence events
bannerController.OnRevealPhase.AddListener(() => {
    // Play reveal sound effects
    // Trigger particle effects
});
```

---

## Expo Integration

Expo remains the UI shell. It sends state commands but contains **no animation logic**.

### State Commands (Expo → Unity)

```typescript
// Example: When entering summon screen
sendToUnity({ command: 'setState', state: 'banner' });

// Example: When combat starts
sendToUnity({ command: 'setState', state: 'combat' });

// Example: Return to idle
sendToUnity({ command: 'setState', state: 'idle' });
```

### Profile Overrides

```typescript
// Request specific profile
sendToUnity({ command: 'setProfile', profileId: 'banner_reveal' });

// Adjust intensity
sendToUnity({ command: 'setIntensity', value: 1.5 });
```

---

## Rating Safety

### Hard Clamps (Always Enforced)

```json
"ratingClamps": {
  "ParamChestSoftX": { "min": -0.3, "max": 0.3 },
  "ParamChestSoftY": { "min": -0.3, "max": 0.3 },
  "ParamAbdomenSoft": { "min": -0.2, "max": 0.2 },
  "ParamPelvisShift": { "min": -0.15, "max": 0.15 }
}
```

**These clamps are applied AFTER all other calculations**, ensuring no profile can exceed safe values.

---

## Validation Checklist

### ✅ Pass Criteria

- [ ] Removing JSON profiles → zero character motion
- [ ] Editing JSON amplitude → motion changes without code edits
- [ ] CSS contains no `@keyframes` for character motion
- [ ] Unity contains no animation clips for idle/banner motion
- [ ] All motion driven by Live2D parameters only
- [ ] Rating clamps enforced at runtime

### 🔍 Test Commands

```bash
# Verify no CSS keyframes for character motion
grep -r "@keyframes" ./frontend/styles/ | grep -v "ui-only"

# Verify no baked animation curves
grep -r "AnimationCurve" ./unity-driver/ # Should only find evaluation, not definition
```

---

## File Structure

```
/live2d-motion-system/
├── schemas/
│   └── motion-profile.schema.json    # JSON Schema definition
├── profiles/
│   ├── idle_default.json             # Default idle breathing
│   ├── combat_ready.json             # Combat stance
│   ├── banner_reveal.json            # Summon presentation
│   └── summon_anticipation.json      # Pre-reveal tension
├── unity-driver/
│   ├── Live2DMotionProfile.cs        # Data structures
│   ├── Live2DMotionProfileLoader.cs  # JSON loading
│   ├── Live2DParameterDriver.cs      # Core parameter mixer
│   ├── Live2DStateController.cs      # State management
│   └── Live2DBannerModeController.cs # Banner sequences
└── docs/
    └── ARCHITECTURE.md               # This document
```

---

## Migration Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Decommission Legacy | ⏳ Pending | Remove CSS animations |
| 2. Define Schema | ✅ Complete | JSON schema created |
| 3. Unity Driver | ✅ Complete | Reference implementation |
| 4. State Orchestration | ✅ Complete | State controller built |
| 5. AI Tuning | ⏳ Future | Body-type scaling |
| 6. Final Audit | ⏳ Pending | Validation testing |

---

## Contact

For questions about this system, refer to:
- JSON Schema: `/schemas/motion-profile.schema.json`
- Unity Reference: `/unity-driver/`
- Integration Guide: This document
