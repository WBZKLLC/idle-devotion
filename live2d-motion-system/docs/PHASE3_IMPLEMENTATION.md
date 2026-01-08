# Phase 3: Unity Live2D Driver Implementation

## Overview

This document describes the Unity C# driver implementation for the Live2D motion system. The driver consumes JSON motion profiles and applies them to Live2D Cubism models at runtime.

**Architecture Constraints (LOCKED):**
- ✅ JSON profiles are the SINGLE SOURCE OF TRUTH
- ✅ All motion is parameter-driven, no editor-authored animation
- ✅ Rating clamps are ENFORCED at runtime (not advisory)
- ❌ No hardcoded parameter animation in Unity
- ❌ No Unity AnimationClips for character motion

---

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unity Live2D Driver                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ MotionProfileLoader │    │ MotionStateController│            │
│  │                     │◄───│                     │            │
│  │ - Load JSON files   │    │ - Receive state     │◄── APP     │
│  │ - Validate schema   │    │   commands          │   (Expo)   │
│  │ - Index by state    │    │ - Hero data         │            │
│  │ - Resolve profiles  │    │ - State transitions │            │
│  └──────────┬──────────┘    └──────────┬──────────┘            │
│             │                          │                        │
│             │                          │                        │
│             ▼                          ▼                        │
│  ┌──────────────────────────────────────────────────┐          │
│  │           MotionParameterDriver                   │          │
│  │                                                   │          │
│  │  - Calculate waveforms (WaveformSolver)           │          │
│  │  - Apply easing functions                         │          │
│  │  - Blend between profiles                         │          │
│  │  - ENFORCE rating clamps                          │          │
│  │  - Output: Live2D parameter values                │          │
│  └──────────────────────┬───────────────────────────┘          │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────┐          │
│  │           Live2D Cubism Model                     │          │
│  │                                                   │          │
│  │  ParamBreath, ParamBodyAngleX, ParamChestSoftX... │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  ┌─────────────────────┐                                       │
│  │ BannerModeController│  (Optional: Summon sequences)         │
│  └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
/unity-driver/Core/
├── MotionProfile.cs          # Data structures (enums, classes)
├── MotionProfileLoader.cs    # JSON loading & validation
├── WaveformSolver.cs         # Waveform & easing calculations
├── MotionParameterDriver.cs  # Core parameter application
├── MotionStateController.cs  # State management (app interface)
├── BannerModeController.cs   # Summon sequence orchestration
└── AssemblyInfo.cs           # Assembly definition notes
```

---

## 1. MotionProfile.cs - Data Structures

### Enums

```csharp
public enum MotionState
{
    Idle, Combat, Banner, Summon, Victory, Defeat, Dialogue, Special
}

public enum WaveformType
{
    Sine,       // ✅ Recommended
    Cosine,     // ✅ Recommended
    Perlin,     // ✅ Recommended (low freq)
    Triangle,   // ⚠️ Use sparingly
    Sawtooth,   // ⛔ NON-RECOMMENDED
    Square      // ⛔ NON-RECOMMENDED
}

public enum EasingType
{
    Linear, EaseIn, EaseOut, EaseInOut,
    EaseInQuad, EaseOutQuad, EaseInCubic, EaseOutCubic,
    Elastic, Bounce
}
```

### Key Classes

- `MotionProfile` - Complete profile matching JSON schema v2.0
- `ParameterMotion` - Per-parameter motion definition
- `RatingClamps` - MANDATORY safety clamps
- `GlobalModifiers` - Intensity/speed multipliers
- `BlendingConfig` - Transition settings

---

## 2. MotionProfileLoader.cs - JSON Loading

### Responsibilities

1. Load JSON files from `Resources/Live2D/MotionProfiles/v2/`
2. Parse and validate against schema requirements
3. Index profiles by ID and state
4. Resolve best profile for state + hero conditions

### Key Methods

```csharp
// Load all profiles from resources
void LoadAllProfiles();

// Get profile by ID
MotionProfile GetProfileById(string id);

// Get default profile for state
MotionProfile GetDefaultProfileForState(MotionState state);

// Resolve with hero conditions
MotionProfile ResolveProfile(MotionState state, string heroId, string heroClass, string rarity);
```

### Validation

- Schema version must be "2.0.0"
- Duration: 0.1 - 60 seconds
- Global intensity: 0.0 - 2.0
- Global speed: 0.1 - 3.0
- Rating clamps: MANDATORY

---

## 3. WaveformSolver.cs - Calculation Engine

### Waveform Calculation

```csharp
// Calculate waveform value at phase
float CalculateWaveform(WaveformType waveform, float phase);

// Sine:     sin(phase)
// Cosine:   cos(phase)
// Triangle: Linear up/down
// Perlin:   Smooth noise (-1 to 1)
// Square:   Sign of sine (⛔ non-recommended)
// Sawtooth: Linear ramp (⛔ non-recommended)
```

### Easing Functions

```csharp
float ApplyEasing(EasingType easing, float value);

// Includes: Linear, EaseIn/Out, Quadratic, Cubic, Elastic, Bounce
```

### Complete Parameter Calculation

```csharp
float CalculateParameterValue(
    ParameterMotion motion,
    float time,
    float globalIntensity,
    float globalSpeed);

// Formula:
// phase = (time × frequency × globalSpeed × 2π) + phaseOffset
// waveValue = waveform(phase)
// waveValue = applyEasing(waveValue)
// value = baseValue + (waveValue × amplitude × globalIntensity)
// value = clamp(value, minClamp, maxClamp)
```

---

## 4. MotionParameterDriver.cs - Core Driver

### Responsibilities

1. Apply motion profiles to Live2D Cubism model
2. Handle profile transitions with blending
3. **ENFORCE rating clamps** (mandatory, not optional)
4. Cache parameter references for performance

### Update Loop (LateUpdate)

```csharp
void LateUpdate()
{
    // 1. Update time
    profileTime += deltaTime;
    
    // 2. Handle looping
    if (profile.loop) profileTime %= profile.duration;
    
    // 3. Update blend progress
    if (isBlending) blendProgress += deltaTime / blendDuration;
    
    // 4. Calculate and apply all parameters
    foreach (parameter in profile.parameters)
    {
        value = WaveformSolver.CalculateParameterValue(...);
        
        // Blend with previous profile if transitioning
        if (isBlending) value = Lerp(previousValue, value, blendFactor);
        
        // MANDATORY: Apply rating clamps
        value = ApplyRatingClamp(paramName, value);
        
        // Apply to Live2D
        SetParameter(paramName, value);
    }
}
```

### Rating Clamp Enforcement

```csharp
private float ApplyRatingClamp(string paramName, float value)
{
    ClampRange? clamp = ratingClamps.GetClamp(paramName);
    if (clamp.HasValue)
    {
        float clamped = Mathf.Clamp(value, clamp.min, clamp.max);
        
        // Log violations for QA
        if (clamped != value)
            Debug.LogWarning($"[RatingClamp] {paramName} clamped: {value} -> {clamped}");
        
        return clamped;
    }
    return value;
}
```

---

## 5. MotionStateController.cs - App Interface

### State Commands (from Expo)

```csharp
// Primary interface - what Expo calls
void SetState(MotionState state);
void SetState(string stateName);

// Profile override
void SetProfileOverride(string profileId);

// Intensity/speed adjustment
void SetIntensity(float intensity);
void SetSpeed(float speed);

// Hero data update
void SetHeroData(string id, string heroClass, string rarity);
```

### Expo Integration

Expo sends simple state commands:

```typescript
// From Expo (React Native)
unityBridge.send({ type: "SET_STATE", state: "combat" });
unityBridge.send({ type: "SET_STATE", state: "banner" });
unityBridge.send({ type: "SET_INTENSITY", value: 1.5 });
```

Unity receives and processes:

```csharp
// In Unity message handler
void OnExpoCommand(string json)
{
    var cmd = JsonUtility.FromJson<ExpoCommand>(json);
    
    switch (cmd.type)
    {
        case "SET_STATE":
            stateController.SetState(cmd.state);
            break;
        case "SET_INTENSITY":
            stateController.SetIntensity(cmd.value);
            break;
    }
}
```

---

## 6. BannerModeController.cs - Summon Sequences

### Sequence Phases

1. **Anticipation** - `MotionState.Summon` profile
2. **Reveal** - `MotionState.Banner` profile
3. **Complete** - Return to Idle (optional)

### Usage

```csharp
// Play full sequence
bannerController.PlayBannerSequence();

// Play with specific reveal profile (UR heroes)
bannerController.PlayBannerSequence("banner_reveal_ur");

// Events
bannerController.OnAnticipationStart.AddListener(() => { /* play buildup SFX */ });
bannerController.OnRevealStart.AddListener(() => { /* trigger VFX */ });
bannerController.OnRevealComplete.AddListener(() => { /* show UI */ });
```

---

## Setup Guide

### 1. Import to Unity Project

1. Copy `/unity-driver/Core/*.cs` to `Assets/Scripts/Live2D/Motion/`
2. Ensure Live2D Cubism SDK is imported
3. Create assembly definition (optional but recommended)

### 2. Setup Scene

1. Add `MotionProfileLoader` to a manager GameObject
2. Set `profilesResourcePath` = "Live2D/MotionProfiles/v2"
3. Add `MotionParameterDriver` to Live2D model GameObject
4. Add `MotionStateController` to same GameObject
5. Link references in Inspector

### 3. Add Motion Profiles

1. Create folder: `Assets/Resources/Live2D/MotionProfiles/v2/`
2. Copy JSON profiles to this folder
3. Profiles load automatically on Start

### 4. Test

```csharp
// Test state changes
stateController.SetState(MotionState.Combat);
stateController.SetState(MotionState.Banner);

// Test profile override
stateController.SetProfileOverride("banner_reveal_ur");

// Verify rating clamps
// Enable debugMode on MotionParameterDriver
// Check console for clamp violation warnings
```

---

## Validation Checklist

### Schema Compliance
- [ ] All profiles validate against v2.0.0 schema
- [ ] Rating clamps present in all profiles
- [ ] No deprecated parameter names (ParamBustX, etc.)

### Runtime Behavior
- [ ] Profiles load from Resources
- [ ] State changes trigger profile switches
- [ ] Blending transitions are smooth
- [ ] Rating clamps enforced (check debug logs)
- [ ] Perlin waveform produces natural variation

### Integration
- [ ] Expo state commands received
- [ ] Hero conditions affect profile selection
- [ ] Banner sequences play correctly

---

## Performance Notes

- Parameter cache avoids per-frame lookups
- Waveform calculations are O(1)
- Profile resolution is O(n) where n = profiles for state
- Blend calculations add ~20% overhead during transitions

---

## Troubleshooting

### No motion visible
1. Check profiles loaded: `profileLoader.ProfileCount > 0`
2. Check parameter names match Live2D model
3. Enable `debugMode` on MotionParameterDriver

### Jerky transitions
1. Increase `blendInDuration` in profile
2. Check `blendCurve` is not Linear

### Rating clamp warnings
1. This is expected behavior - clamps are working
2. Review profile amplitudes if too many warnings
3. Reduce amplitude or adjust baseValue

### Profile not found
1. Check file is in Resources folder
2. Check JSON is valid
3. Check `schemaVersion` = "2.0.0"
