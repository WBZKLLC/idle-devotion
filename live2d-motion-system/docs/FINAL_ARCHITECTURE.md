# Live2D Motion System - Final Architecture

**Version:** 1.0.0  
**Last Updated:** 2025-01-08  
**Status:** LOCKED - Implementation Complete

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Responsibilities](#2-component-responsibilities)
3. [Data Flow](#3-data-flow)
4. [Message Protocol Reference](#4-message-protocol-reference)
5. [Constraint Summary](#5-constraint-summary)
6. [Failure Condition Registry](#6-failure-condition-registry)
7. [File Reference](#7-file-reference)
8. [Change Log](#8-change-log)

---

## 1. System Overview

The Live2D Motion System is a **JSON-driven, engine-agnostic animation architecture** that separates motion data from application code. All character animation is defined in declarative JSON profiles and executed by a Live2D-compatible runtime (Unity).

### Core Principles

| Principle | Description |
|-----------|-------------|
| **JSON is Source of Truth** | All motion parameters, timing, and behavior are defined in JSON profiles |
| **Engine Boundary Separation** | Expo dispatches state signals; Unity executes animation |
| **Rating-Safe by Default** | Mandatory parameter clamps enforced at runtime |
| **No Fallback Animation** | When Unity is unavailable, characters are static |
| **Validation at Build Time** | Profile validation occurs before deployment, not at runtime |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIVE2D MOTION SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐     Build Time      ┌────────────────────────────┐  │
│  │   JSON PROFILES    │◄───────────────────│   VALIDATION TOOLING       │  │
│  │                    │   validate-profiles │                            │  │
│  │  - idle_default    │                     │   - Schema validation      │  │
│  │  - combat_ready    │                     │   - Waveform safety        │  │
│  │  - banner_reveal   │                     │   - Parameter compliance   │  │
│  │  - ...             │                     │   - Rating clamp check     │  │
│  └─────────┬──────────┘                     └────────────────────────────┘  │
│            │                                                                 │
│            │ Runtime Load                                                    │
│            ▼                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      UNITY LIVE2D DRIVER                               │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │ ProfileLoader   │  │ WaveformSolver  │  │ ParameterDriver     │   │  │
│  │  │                 │  │                 │  │                     │   │  │
│  │  │ - Load JSON     │  │ - Sine/Cosine   │  │ - Apply to Live2D   │   │  │
│  │  │ - Validate      │  │ - Perlin noise  │  │ - Blend transitions │   │  │
│  │  │ - Index by state│  │ - Easing funcs  │  │ - ENFORCE CLAMPS    │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                             │  │
│  │  │ StateController │  │ BannerController│                             │  │
│  │  │                 │  │                 │                             │  │
│  │  │ - Receive cmds  │  │ - Summon seqs   │                             │  │
│  │  │ - Resolve profs │  │ - Reveal timing │                             │  │
│  │  └─────────────────┘  └─────────────────┘                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              ▲                                               │
│                              │ State Commands                                │
│                              │                                               │
│  ┌───────────────────────────┴───────────────────────────────────────────┐  │
│  │                      EXPO STATE DISPATCHER                             │  │
│  │                                                                        │  │
│  │  - setState(state, metadata)     - NO animation logic                 │  │
│  │  - setIntensity(value)           - NO interpolation                   │  │
│  │  - setSpeed(value)               - NO easing                          │  │
│  │  - stopMotion()                  - NO profile knowledge               │  │
│  │  - resetToIdle()                 - State signals ONLY                 │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

### 2.1 JSON Profiles (Source of Truth)

**Location:** `/app/live2d-motion-system/profiles/v2/`

| Responsibility | Details |
|----------------|----------|
| Define all motion parameters | Amplitude, frequency, phase, waveform, easing |
| Specify state behavior | Idle, combat, banner, summon, victory, defeat |
| Set rating-safe clamps | Mandatory limits for sensitive parameters |
| Control blending | Transition duration and curves |

**Prohibited:**
- Runtime modification
- State-specific logic (handled by Unity)
- Animation code

### 2.2 Unity Live2D Driver

**Location:** `/app/live2d-motion-system/unity-driver/Core/`

| Responsibility | Details |
|----------------|----------|
| Load JSON profiles | From Resources at startup |
| Validate schema version | Reject if not "2.0.0" |
| Resolve state → profile | Based on hero metadata |
| Calculate waveforms | Sine, cosine, perlin, etc. |
| Apply easing functions | Linear, ease-in/out, elastic, bounce |
| Enforce rating clamps | MANDATORY every frame |
| Blend transitions | Smooth profile switching |
| Apply to Live2D | Set CubismParameter values |

**Prohibited:**
- Hardcoded animation values
- AnimationClips or Timelines
- Editor-authored motion data
- Modifying profile data at runtime

### 2.3 Expo State Dispatcher

**Location:** `/app/frontend/services/motionStateDispatcher.ts`

| Responsibility | Details |
|----------------|----------|
| Dispatch state commands | SET_STATE, SET_INTENSITY, SET_SPEED, etc. |
| Validate state values | Reject invalid states before dispatch |
| Track dispatcher status | Connected, current state, last error |
| Forward hero metadata | For Unity's profile resolution |

**Prohibited:**
- Animation logic
- Interpolation
- Easing functions
- Profile loading or parsing
- Profile resolution
- Live2D parameter manipulation
- Timing/duration specification

### 2.4 Validation Tooling

**Location:** `/app/live2d-motion-system/tools/`

| Responsibility | Details |
|----------------|----------|
| Validate profiles at build time | Before deployment |
| Check schema compliance | Version, required fields |
| Enforce waveform safety | Reject Square/Sawtooth for Idle/Banner |
| Detect deprecated parameters | ParamBustX, ParamBustY, etc. |
| Verify rating clamps | Must be present |

**Prohibited:**
- Modifying profiles
- Runtime execution
- Integration with Unity or Expo

---

## 3. Data Flow

### 3.1 State Command Flow (Expo → Unity)

```
1. User Action (e.g., tap "Battle")
        │
        ▼
2. React Component calls hook
   const { enterCombat } = useMotionState();
   enterCombat({ heroId: "hero_123" });
        │
        ▼
3. Dispatcher sends JSON message
   { type: "SET_STATE", state: "combat", heroId: "hero_123" }
        │
        ▼
4. Unity StateController receives
   SetState(MotionState.Combat)
        │
        ▼
5. ProfileLoader resolves
   ResolveProfile(Combat, heroId, heroClass, rarity)
        │
        ▼
6. ParameterDriver applies
   - Clears transient offsets
   - Loads new profile
   - Starts blend transition
        │
        ▼
7. Live2D model animates
   ParamBreath, ParamBodyAngleX, etc.
```

### 3.2 Profile Loading Flow

```
1. Unity Start()
        │
        ▼
2. MotionProfileLoader.LoadAllProfiles()
        │
        ▼
3. For each JSON file:
   a. Parse JSON
   b. Validate schema version == "2.0.0"
   c. Validate waveforms for state safety
   d. Validate rating clamps present
   e. Index by ID and state
        │
        ▼
4. Profiles ready for state resolution
```

### 3.3 Parameter Calculation Flow (Per Frame)

```
1. LateUpdate()
        │
        ▼
2. For each parameter in profile:
        │
        ▼
3. Get transient offsets (from driver, NOT profile)
        │
        ▼
4. Calculate:
   phase = (time × frequency × globalSpeed × 2π) + phaseOffset
   waveValue = waveform(phase)  // sine, cosine, perlin, etc.
   waveValue = applyEasing(waveValue)
   value = baseValue + (waveValue × amplitude × globalIntensity)
        │
        ▼
5. If blending: lerp(previousValue, value, blendProgress)
        │
        ▼
6. Apply rating clamp (MANDATORY)
   value = clamp(value, ratingClamps[param].min, ratingClamps[param].max)
        │
        ▼
7. Set Live2D parameter
   cubismModel.Parameters[param].Value = value
```

---

## 4. Message Protocol Reference

### 4.1 Expo → Unity (Commands)

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `SET_STATE` | `state`, `heroId?`, `heroClass?`, `rarity?` | Change motion state |
| `SET_INTENSITY` | `value` (0.0-2.0) | Override global intensity |
| `SET_SPEED` | `value` (0.1-3.0) | Override global speed |
| `STOP_MOTION` | (none) | Stop all motion |
| `RESET_TO_IDLE` | (none) | Return to idle state |

### 4.2 Unity → Expo (Status)

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `STATE_CHANGED` | `state`, `profileId` | Confirm state change |
| `BLEND_COMPLETE` | (none) | Transition finished |
| `ERROR` | `message` | Error notification |

### 4.3 Valid States

| State | Description | Loop |
|-------|-------------|------|
| `idle` | Default standing/breathing | Yes |
| `combat` | Battle-ready stance | Yes |
| `banner` | Summon reveal | No |
| `summon` | Pre-reveal anticipation | Yes |
| `victory` | Win celebration | No |
| `defeat` | Loss reaction | No |
| `dialogue` | Conversation | Yes |
| `special` | Custom/event | Varies |

---

## 5. Constraint Summary

### 5.1 Architectural Constraints

| Constraint | Enforcement |
|------------|-------------|
| JSON is single source of truth | Unity loads from JSON only |
| No animation in Expo | Code audit, failure conditions |
| No hardcoded animation in Unity | All values from profiles |
| Rating clamps mandatory | Schema validation + runtime enforcement |
| Transient offsets cleared on state change | Driver implementation |
| Waveform safety for Idle/Banner | Validation rejects Square/Sawtooth |

### 5.2 Parameter Naming Constraints

**Approved Parameters (Soft Tissue):**
- ✅ `ParamChestSoftX` (±0.30 clamp)
- ✅ `ParamChestSoftY` (±0.30 clamp)
- ✅ `ParamAbdomenSoft` (±0.20 clamp)
- ✅ `ParamPelvisShift` (±0.15 clamp)

**Deprecated Parameters (REJECTED):**
- ❌ `ParamBustX`
- ❌ `ParamBustY`
- ❌ `ParamBaseX`
- ❌ `ParamBaseY`

### 5.3 Waveform Constraints

| Waveform | Idle | Banner | Combat | Other |
|----------|------|--------|--------|-------|
| `sine` | ✅ | ✅ | ✅ | ✅ |
| `cosine` | ✅ | ✅ | ✅ | ✅ |
| `perlin` | ✅ (≤0.3Hz) | ✅ (≤0.2Hz) | ✅ | ✅ |
| `triangle` | ⚠️ | ⚠️ | ✅ | ✅ |
| `sawtooth` | ❌ REJECT | ❌ REJECT | ⚠️ | ⚠️ |
| `square` | ❌ REJECT | ❌ REJECT | ⚠️ | ⚠️ |

---

## 6. Failure Condition Registry

All phases must evaluate these conditions. **ANY failure = phase invalid.**

### 6.1 Global Failure Conditions

| ID | Condition | Always Applies |
|----|-----------|----------------|
| G1 | Animation logic exists outside JSON profiles | ✅ |
| G2 | JSON is not single source of truth | ✅ |
| G3 | Motion values hardcoded in Unity/Expo | ✅ |
| G4 | Unity AnimationClips used for characters | ✅ |
| G5 | CSS/JS/Animated/Lottie/Rive in Expo | ✅ |
| G6 | Expo interpolates or eases values | ✅ |
| G7 | Expo touches Live2D parameters | ✅ |
| G8 | Runtime ignores JSON motion behavior | ✅ |
| G9 | Schema validation bypassed | ✅ |
| G10 | Rating clamps are advisory (not enforced) | ✅ |
| G11 | Deprecated parameters used | ✅ |
| G12 | Runtime offsets mutate profile data | ✅ |
| G13 | Phase marked complete with failures | ✅ |

### 6.2 Hard Rules

| Rule | Enforcement |
|------|-------------|
| NON-RECOMMENDED waveforms enforced at runtime | Profile load fails or auto-corrects |
| Runtime offsets must not mutate profile data | Offsets are transient, cleared on state change |
| Any failure = automatic phase invalidation | Self-correct before continuing |

---

## 7. File Reference

### 7.1 JSON Schemas & Profiles

```
/app/live2d-motion-system/
├── schemas/
│   ├── motion-profile.schema.v2.json   # Core profile schema
│   └── state-mapping.schema.json       # State mapping schema
├── mappings/
│   └── default-state-mapping.json      # Default state config
└── profiles/v2/
    ├── idle_default.json               # Default idle
    ├── combat_ready.json               # Combat stance
    ├── banner_reveal.json              # Standard reveal
    ├── banner_reveal_ur.json           # Premium reveal
    └── summon_anticipation.json        # Pre-reveal
```

### 7.2 Unity Driver

```
/app/live2d-motion-system/unity-driver/Core/
├── MotionProfile.cs           # Data structures
├── MotionProfileLoader.cs     # JSON loading
├── WaveformSolver.cs          # Calculations
├── MotionParameterDriver.cs   # Core driver
├── MotionStateController.cs   # State management
├── BannerModeController.cs    # Summon sequences
└── AssemblyInfo.cs            # Assembly notes
```

### 7.3 Expo Dispatcher

```
/app/frontend/
├── types/
│   └── motionTypes.ts         # TypeScript types
├── constants/
│   └── motionStates.ts        # State constants
├── services/
│   └── motionStateDispatcher.ts  # Dispatcher service
└── hooks/
    └── useMotionState.ts      # React hooks
```

### 7.4 Documentation & Tooling

```
/app/live2d-motion-system/
├── docs/
│   ├── FINAL_ARCHITECTURE.md    # This document
│   ├── PHASE2_SPECIFICATION.md  # Schema spec
│   ├── PHASE3_IMPLEMENTATION.md # Unity driver
│   ├── INTEGRATION_CHECKLIST.md # Setup guide
│   └── USAGE_EXAMPLES.md        # Code examples
└── tools/
    └── validate-profiles.js     # Validation script
```

---

## 8. Change Log

| Phase | Date | Changes |
|-------|------|----------|
| Phase 1 | 2025-01-08 | Removed all CSS-based character animations from Expo |
| Phase 2 | 2025-01-08 | Designed JSON motion schema v2.0 with Live2D-native parameters |
| Phase 2.1 | 2025-01-08 | Corrected parameter names (ParamChestSoftX, etc.) and waveform safety |
| Phase 3 | 2025-01-08 | Implemented Unity Live2D driver with rating clamp enforcement |
| Phase 3.1 | 2025-01-08 | Added waveform validation at load time, transient offset management |
| Phase 4 | 2025-01-08 | Implemented Expo state dispatcher (state signals only) |
| Phase 5 | 2025-01-08 | Consolidated documentation, created validation tooling |

---

## Document Status

**This document represents the FINAL architecture.**

- ✅ All phases complete and validated
- ✅ All failure conditions passed
- ✅ Implementation locked
- ✅ Ready for integration

**For questions or issues, refer to:**
- Integration guide: `INTEGRATION_CHECKLIST.md`
- Usage examples: `USAGE_EXAMPLES.md`
- Validation: Run `node tools/validate-profiles.js`
