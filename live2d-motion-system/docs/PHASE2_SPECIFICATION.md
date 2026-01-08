# Phase 2: Live2D Motion System Specification

## Overview

This document defines the **engine-agnostic JSON motion schema** for the Live2D-native animation system. All character motion is defined as declarative JSON profiles that can be consumed by any Live2D-compatible runtime (Unity, Unreal, etc.).

**Key Constraints:**
- ✅ JSON is the single source of truth for all motion
- ✅ All parameters are Live2D-native (no custom interpolation)
- ✅ Rating-safe clamps are mandatory and enforced at runtime
- ❌ No animation logic in Expo (UI + state signaling only)
- ❌ No CSS/JS/Animated motion for characters
- ❌ No physics simulation

---

## Schema Version: 2.0.0

### File Locations

```
/app/live2d-motion-system/
├── schemas/
│   ├── motion-profile.schema.v2.json    # Core motion profile schema
│   └── state-mapping.schema.json        # State-to-profile mapping schema
├── mappings/
│   └── default-state-mapping.json       # Default state configuration
├── profiles/v2/
│   ├── idle_default.json                # Default idle breathing
│   ├── combat_ready.json                # Combat stance
│   ├── banner_reveal.json               # Standard banner reveal
│   ├── banner_reveal_ur.json            # Premium UR reveal
│   └── summon_anticipation.json         # Pre-reveal tension
└── docs/
    ├── ARCHITECTURE.md                  # System architecture
    └── PHASE2_SPECIFICATION.md          # This document
```

---

## 1. Motion Profile Schema

### 1.1 Core Structure

```json
{
  "id": "string",              // Unique identifier (snake_case)
  "schemaVersion": "2.0.0",    // Schema version (const)
  "state": "enum",             // Motion state category
  "priority": 0-100,           // Profile selection priority
  "duration": 0.1-60.0,        // Cycle duration (seconds)
  "loop": boolean,             // Whether to loop
  "loopCount": integer,        // Loop iterations (0 = infinite)
  "globalModifiers": {},       // Global intensity/speed multipliers
  "blending": {},              // Transition configuration
  "parameters": {},            // Live2D parameter definitions
  "ratingClamps": {},          // MANDATORY safety limits
  "conditions": {},            // Optional activation conditions
  "metadata": {}               // Optional tooling metadata
}
```

### 1.2 Motion States

| State | Description | Loop | Duration Range |
|-------|-------------|------|----------------|
| `idle` | Default standing/breathing | Yes | 3-5s |
| `combat` | Battle-ready stance | Yes | 2-3s |
| `banner` | Summon reveal presentation | No | 5-10s |
| `summon` | Pre-reveal anticipation | Yes | 2-4s |
| `victory` | Win celebration | No | 3-5s |
| `defeat` | Loss reaction | No | 2-4s |
| `dialogue` | Conversation/story | Yes | 2-4s |
| `special` | Custom/event-specific | Varies | Varies |

### 1.3 Global Modifiers

```json
"globalModifiers": {
  "intensity": 1.0,    // 0.0 (no motion) to 2.0 (double amplitude)
  "speed": 1.0         // 0.1 (10% speed) to 3.0 (3x speed)
}
```

These are applied as multipliers to ALL parameter values at runtime.

### 1.4 Blending Configuration

```json
"blending": {
  "blendInDuration": 0.5,       // Seconds to blend from previous profile
  "blendOutDuration": 0.5,      // Seconds to blend to next profile
  "blendCurve": "ease_in_out"   // Easing for transitions
}
```

**Blend Curves:**
- `linear` - Constant rate
- `ease_in` - Slow start, fast end
- `ease_out` - Fast start, slow end
- `ease_in_out` - Slow start and end
- `smooth_step` - Hermite interpolation

---

## 2. Live2D Parameter Naming Conventions

### 2.1 Standard Live2D Parameters

All parameters use **official Live2D Cubism naming conventions** for compatibility:

#### Head Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamAngleX` | Head rotation left(-)/right(+) | -30 to 30 |
| `ParamAngleY` | Head tilt up(-)/down(+) | -30 to 30 |
| `ParamAngleZ` | Head tilt side | -30 to 30 |

#### Body Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamBodyAngleX` | Body rotation left/right | -10 to 10 |
| `ParamBodyAngleY` | Body lean forward/back | -10 to 10 |
| `ParamBodyAngleZ` | Body tilt side | -10 to 10 |
| `ParamBreath` | Breathing expansion | 0 to 1 |
| `ParamShoulderY` | Shoulder raise | -1 to 1 |

#### Eye Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamEyeLOpen` | Left eye open | 0 (closed) to 1 (open) |
| `ParamEyeROpen` | Right eye open | 0 to 1 |
| `ParamEyeBallX` | Gaze horizontal | -1 to 1 |
| `ParamEyeBallY` | Gaze vertical | -1 to 1 |

#### Eyebrow Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamBrowLY` | Left brow height | -1 to 1 |
| `ParamBrowRY` | Right brow height | -1 to 1 |
| `ParamBrowLX` | Left brow angle | -1 to 1 |
| `ParamBrowRX` | Right brow angle | -1 to 1 |
| `ParamBrowLAngle` | Left brow rotation | -1 to 1 |
| `ParamBrowRAngle` | Right brow rotation | -1 to 1 |
| `ParamBrowLForm` | Left brow shape | -1 to 1 |
| `ParamBrowRForm` | Right brow shape | -1 to 1 |

#### Mouth Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamMouthOpenY` | Mouth open amount | 0 to 1 |
| `ParamMouthForm` | Smile(+)/frown(-) | -1 to 1 |
| `ParamCheek` | Cheek blush | 0 to 1 |

#### Hair Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamHairFront` | Front hair sway | -1 to 1 |
| `ParamHairSide` | Side hair movement | -1 to 1 |
| `ParamHairBack` | Back hair flow | -1 to 1 |
| `ParamHairFluffy` | Fluffy hair motion | -1 to 1 |

#### Arm Parameters
| Parameter | Description | Range |
|-----------|-------------|-------|
| `ParamArmLA` | Left arm angle | 0 to 1 |
| `ParamArmRA` | Right arm angle | 0 to 1 |
| `ParamArmLB` | Left arm secondary | 0 to 1 |
| `ParamArmRB` | Right arm secondary | 0 to 1 |
| `ParamHandL` | Left hand pose | 0 to 1 |
| `ParamHandR` | Right hand pose | 0 to 1 |

#### Body Soft Tissue (RATING-CLAMPED)
| Parameter | Description | Range | **Clamp** |
|-----------|-------------|-------|-----------|
| `ParamChestSoftX` | Upper torso horizontal sway | -1 to 1 | **±0.30** |
| `ParamChestSoftY` | Upper torso vertical motion | -1 to 1 | **±0.30** |
| `ParamAbdomenSoft` | Midsection soft motion | -1 to 1 | **±0.20** |
| `ParamPelvisShift` | Lower body sway | -1 to 1 | **±0.15** |

> **⚠️ DEPRECATED PARAMETER NAMES (DO NOT USE)**
> 
> The following parameter names are deprecated and must NOT be used:
> - ❌ `ParamBustX` → Use `ParamChestSoftX`
> - ❌ `ParamBustY` → Use `ParamChestSoftY`
> - ❌ `ParamBaseX` → Use `ParamBodyAngleX` (for rotation) or remove
> - ❌ `ParamBaseY` → Use `ParamBodyAngleY` (for rotation) or remove
>
> These names violate Live2D-neutral naming conventions and platform safety goals.
> Backward compatibility aliases may be documented but are NOT defaults.

---

## 3. Parameter Motion Definition

### 3.1 Motion Properties

```json
"ParamBreath": {
  "enabled": true,          // Toggle this parameter
  "amplitude": 0.3,         // Peak deviation (-1.0 to 1.0)
  "frequency": 0.25,        // Hz (cycles per second)
  "phase": 0,               // Phase offset (0 to 2π radians)
  "waveform": "sine",       // Oscillation shape
  "easing": "linear",       // Easing function
  "baseValue": 0.0,         // Center/rest value
  "minClamp": -0.5,         // Output minimum
  "maxClamp": 0.5,          // Output maximum
  "randomize": {            // Optional variance
    "amplitudeVariance": 0.01,
    "frequencyVariance": 0.02,
    "seed": 0
  }
}
```

### 3.2 Waveform Types

| Waveform | Description | Use Case | **Recommended** |
|----------|-------------|----------|-----------------|
| `sine` | Smooth oscillation | Natural breathing, sway | ✅ **YES** |
| `cosine` | Phase-shifted sine | Paired motion | ✅ **YES** |
| `perlin` | Smooth noise | Natural randomness (low freq only) | ✅ **YES** |
| `triangle` | Linear ramp up/down | Mechanical motion | ⚠️ Use sparingly |
| `sawtooth` | Linear ramp + reset | Asymmetric motion | ⛔ **NON-RECOMMENDED** |
| `square` | Binary on/off | Blinking only | ⛔ **NON-RECOMMENDED** |

> **⚠️ WAVEFORM SAFETY CONSTRAINTS**
>
> **`square` and `sawtooth` waveforms are NON-RECOMMENDED:**
> - Debug / stylized use only
> - NOT suitable for `idle` or `banner` states
> - May produce unnatural or rating-risk motion
>
> **Default waveforms for production profiles:**
> - `idle` state: `sine`, `cosine`, `perlin` (low frequency ≤0.3 Hz)
> - `banner` state: `sine`, `cosine`, `perlin` (low frequency ≤0.2 Hz)
> - `combat` state: `sine`, `cosine`, `triangle` (acceptable)
>
> **Perlin noise frequency limits:**
> - Idle/Banner: ≤0.3 Hz (slow, subtle variation)
> - Combat: ≤0.5 Hz (moderate variation)

### 3.3 Easing Functions

| Easing | Description |
|--------|-------------|
| `linear` | Constant rate |
| `ease_in` | Slow start |
| `ease_out` | Slow end |
| `ease_in_out` | Slow start and end |
| `ease_in_quad` | Quadratic acceleration |
| `ease_out_quad` | Quadratic deceleration |
| `ease_in_cubic` | Cubic acceleration |
| `ease_out_cubic` | Cubic deceleration |
| `elastic` | Springy overshoot |
| `bounce` | Bouncing finish |

---

## 4. Rating-Safe Clamps

### 4.1 Mandatory Clamps

**These clamps are NON-NEGOTIABLE and MUST be enforced by ALL runtimes:**

```json
"ratingClamps": {
  "ParamChestSoftX": { "min": -0.3, "max": 0.3 },
  "ParamChestSoftY": { "min": -0.3, "max": 0.3 },
  "ParamAbdomenSoft": { "min": -0.2, "max": 0.2 },
  "ParamPelvisShift": { "min": -0.15, "max": 0.15 }
}
```

### 4.2 Enforcement Rules

1. **Post-Calculation Application**: Clamps are applied AFTER all other calculations (amplitude × intensity × speed)
2. **Hard Limits**: No profile can override these values downward; they can only be more restrictive
3. **Runtime Validation**: Runtime must validate clamps exist and apply them regardless of profile contents
4. **Logging**: Out-of-bounds values should be logged for QA detection

### 4.3 Validation Pseudocode

```
function applyRatingClamps(parameterId, calculatedValue, ratingClamps):
    if parameterId in ratingClamps:
        clamp = ratingClamps[parameterId]
        return max(clamp.min, min(clamp.max, calculatedValue))
    return calculatedValue
```

---

## 5. State-to-Profile Mapping

### 5.1 Mapping Structure

```json
{
  "schemaVersion": "1.0.0",
  "defaultProfile": "idle_default",
  "transitionDefaults": {
    "blendDuration": 0.5,
    "blendCurve": "ease_in_out"
  },
  "stateMappings": {
    "idle": {
      "defaultProfile": "idle_default",
      "variants": [
        {
          "profileId": "idle_calm",
          "condition": { "heroClass": ["Mage", "Healer"] },
          "priority": 60
        }
      ],
      "transition": {
        "blendDuration": 0.8,
        "blendCurve": "ease_out"
      }
    }
  }
}
```

### 5.2 Profile Selection Algorithm

```
function selectProfile(state, heroData, mapping):
    stateMapping = mapping.stateMappings[state]
    if not stateMapping:
        return mapping.defaultProfile
    
    # Check variants in priority order
    candidates = []
    for variant in stateMapping.variants:
        if matchesCondition(heroData, variant.condition):
            candidates.append((variant.priority, variant.profileId))
    
    if candidates:
        candidates.sort(reverse=True)  # Highest priority first
        return candidates[0].profileId
    
    return stateMapping.defaultProfile
```

### 5.3 Condition Matching

```json
"condition": {
  "rarity": ["SSR", "UR"],      // Match if hero rarity in list
  "heroClass": ["Warrior"],     // Match if hero class in list
  "heroIds": ["hero_selene"]    // Match specific hero IDs
}
```

- Empty array = matches all
- Multiple conditions = AND logic

---

## 6. Runtime Consumption Guide

### 6.1 Loading Profiles

**Step 1: Load JSON files**
```
profiles = {}
for file in glob("profiles/v2/*.json"):
    profile = parseJSON(file)
    validateAgainstSchema(profile, "motion-profile.schema.v2.json")
    profiles[profile.id] = profile
```

**Step 2: Index by state**
```
stateIndex = {}
for profile in profiles.values():
    if profile.state not in stateIndex:
        stateIndex[profile.state] = []
    stateIndex[profile.state].append(profile)
```

### 6.2 Calculating Parameter Values

**Per-frame update:**
```
function updateParameter(param, time, globalModifiers):
    if not param.enabled:
        return param.baseValue
    
    # Calculate waveform
    phase = (time * param.frequency * 2 * PI) + param.phase
    waveValue = calculateWaveform(param.waveform, phase)
    
    # Apply easing
    waveValue = applyEasing(param.easing, waveValue)
    
    # Calculate final value
    amplitude = param.amplitude * globalModifiers.intensity
    value = param.baseValue + (waveValue * amplitude)
    
    # Apply randomization if specified
    if param.randomize:
        value += randomVariance(param.randomize)
    
    # Clamp to parameter limits
    value = clamp(value, param.minClamp, param.maxClamp)
    
    return value
```

### 6.3 Blending Between Profiles

```
function blendProfiles(fromProfile, toProfile, blendProgress):
    for paramId in union(fromProfile.parameters, toProfile.parameters):
        fromValue = calculateParameter(fromProfile, paramId, time)
        toValue = calculateParameter(toProfile, paramId, time)
        
        blendedValue = lerp(fromValue, toValue, blendProgress)
        setLive2DParameter(paramId, blendedValue)
```

### 6.4 Waveform Functions

```
function calculateWaveform(type, phase):
    switch type:
        case "sine":
            return sin(phase)
        case "cosine":
            return cos(phase)
        case "triangle":
            return (2 / PI) * asin(sin(phase))
        case "sawtooth":
            return 2 * ((phase / (2 * PI)) - floor(0.5 + phase / (2 * PI)))
        case "square":
            return sign(sin(phase))
        case "perlin":
            return perlinNoise(phase)
```

---

## 7. Expo Integration

### 7.1 State Commands (Expo → Runtime)

Expo sends state change commands. It does NOT contain animation logic.

**Commands:**
```typescript
// State change
{ type: "SET_STATE", state: "combat" }

// Profile override (optional)
{ type: "SET_PROFILE", profileId: "banner_reveal_ur" }

// Intensity adjustment (optional)
{ type: "SET_INTENSITY", value: 1.5 }

// Speed adjustment (optional)
{ type: "SET_SPEED", value: 0.8 }
```

### 7.2 State Change Flow

```
┌────────────┐     State Command     ┌────────────────┐
│   EXPO     │ ─────────────────────>│  UNITY/RUNTIME │
│  (UI Only) │                       │  (Live2D)      │
└────────────┘                       └────────────────┘
     │                                      │
     │  "SET_STATE: combat"                 │
     │                                      │
     └──────────────────────────────────────┤
                                            │
                                            ▼
                              ┌──────────────────────┐
                              │ Load state mapping   │
                              │ Select profile       │
                              │ Apply blending       │
                              │ Update parameters    │
                              └──────────────────────┘
```

---

## 8. Validation Checklist

### Pre-Integration Validation

- [ ] All profiles validate against `motion-profile.schema.v2.json`
- [ ] All profiles have `ratingClamps` with required parameters
- [ ] State mapping covers all states
- [ ] No duplicate profile IDs
- [ ] All referenced profiles exist

### Runtime Validation

- [ ] Rating clamps enforced on every frame
- [ ] Out-of-bounds values logged
- [ ] Blend transitions smooth (no popping)
- [ ] Profile loading errors handled gracefully
- [ ] Missing profiles fall back to default

### QA Validation

- [ ] Removing all profiles → characters are static
- [ ] Editing JSON → motion changes without code rebuild
- [ ] Rating clamps prevent excessive motion
- [ ] Blend duration feels natural

---

## 9. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-01-08 | Initial v2 schema with Live2D-native parameters |
| | | Added frequency (Hz) instead of speed multiplier |
| | | Added perlin waveform for natural variation |
| | | Added conditions for profile filtering |
| | | Mandatory ratingClamps validation |
| | | State mapping schema |

---

## 10. Contact

For questions about this specification:
- Schema: `/schemas/motion-profile.schema.v2.json`
- Profiles: `/profiles/v2/`
- Architecture: `/docs/ARCHITECTURE.md`
