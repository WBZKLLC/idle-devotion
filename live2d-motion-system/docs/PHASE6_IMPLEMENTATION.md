# Phase 6: Expo ↔ Unity Transport Integration

**Status:** SCAFFOLDING COMPLETE - AWAITING ON-DEVICE VERIFICATION

---

## Dependency Information (S-7 Auditability)

### React Native Unity Package

| Field | Value |
|-------|-------|
| **Package Name** | `@azesmway/react-native-unity` |
| **Pinned Version** | `1.0.7` |
| **npm Registry** | https://www.npmjs.com/package/@azesmway/react-native-unity |
| **GitHub Repository** | https://github.com/azesmway/react-native-unity |
| **Release Tag** | `v1.0.7` (February 2024) |
| **Commit Hash** | See package-lock.json after install |
| **License** | MIT |
| **New Architecture Support** | Yes (Fabric/TurboModules) |

### Fallback Plan Trigger Conditions

The fallback to a custom native module (Option B) is triggered if ANY of the following occur:

1. **Package Incompatibility**: `@azesmway/react-native-unity` fails to build with Expo SDK 54 / RN 0.81
2. **Build Errors**: Gradle/CocoaPods dependency conflicts that cannot be resolved within 4 hours
3. **Runtime Crashes**: Unity view crashes on Android ARM64 devices
4. **Message Delivery Failure**: `postMessage` calls do not reach Unity after verified scene setup
5. **Package Abandonment**: No releases or commits for 12+ months after project start

### Fallback Implementation (Option B)

If triggered, implement a custom native module:
- **Android**: Kotlin module in `android/app/src/main/java/.../UnityBridgeModule.kt`
- **iOS**: Swift module in `ios/UnityBridgeModule.swift`
- **Interface**: Same `postMessage(gameObject, method, message)` signature

---

## Implementation Summary

### Created Files

#### Unity Project (`/app/unity-project/`)
| File | Purpose |
|------|---------|  
| `Assets/Scripts/Bridge/ExpoMessageReceiver.cs` | Receives JSON from Expo, routes to MotionStateController |
| `Assets/Scripts/Bridge/ExpoMessageSender.cs` | Sends status JSON back to Expo |
| `Assets/Scripts/Bridge/BridgeInitializer.cs` | Wires bridge to Core motion system |
| `Assets/Scripts/Integration/ReactNativeUnityBridge.cs` | Entry point for react-native-unity |
| `SETUP_GUIDE.md` | Step-by-step integration instructions |

#### Expo Project (`/app/frontend/`)
| File | Purpose |
|------|-------|
| `services/unityBridge.ts` | Connects motionStateDispatcher to Unity module |
| `components/UnityCharacterView.tsx` | React Native component wrapping Unity view |
| `eas.json` | EAS Build configuration for development client |

### Files NOT Modified (Phase 3 LOCKED)

| File | Status |
|------|--------|
| `/app/live2d-motion-system/unity-driver/Core/MotionProfile.cs` | UNCHANGED |
| `/app/live2d-motion-system/unity-driver/Core/MotionProfileLoader.cs` | UNCHANGED |
| `/app/live2d-motion-system/unity-driver/Core/WaveformSolver.cs` | UNCHANGED |
| `/app/live2d-motion-system/unity-driver/Core/MotionParameterDriver.cs` | UNCHANGED |
| `/app/live2d-motion-system/unity-driver/Core/MotionStateController.cs` | UNCHANGED |
| `/app/live2d-motion-system/unity-driver/Core/BannerModeController.cs` | UNCHANGED |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           PHASE 6 BRIDGE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │     EXPO (React Native)       │   │         UNITY                    │  │
│  ├───────────────────────────────┤   ├───────────────────────────────┤  │
│  │                               │   │                               │  │
│  │  useMotionState() [Phase 4]  │   │  Core/*.cs [Phase 3 LOCKED]   │  │
│  │          │                    │   │          ▲                    │  │
│  │          ▼                    │   │          │                    │  │
│  │  motionStateDispatcher.ts    │   │  BridgeInitializer.cs         │  │
│  │          │                    │   │          │                    │  │
│  │          ▼                    │   │          ▼                    │  │
│  │  unityBridge.ts [Phase 6]    │   │  ExpoMessageReceiver.cs       │  │
│  │          │                    │   │          │                    │  │
│  │          │    JSON Message    │   │          │                    │  │
│  │          └──────────────────┼───────►┘                    │  │
│  │                               │   │                               │  │
│  │  UnityCharacterView.tsx      │   │  ReactNativeUnityBridge.cs    │  │
│  │          ▲                    │   │          │                    │  │
│  │          │    JSON Message    │   │          ▼                    │  │
│  │          └─────────────────────────◄┘  ExpoMessageSender.cs         │  │
│  │                               │   │                               │  │
│  └───────────────────────────────┘   └───────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Message Protocol

### Expo → Unity

Sent via `UnityModule.postMessage('ReactNativeUnity', 'ReceiveMessage', json)`

```json
// SET_STATE
{ "type": "SET_STATE", "state": "combat", "heroId": "hero_123" }

// SET_INTENSITY
{ "type": "SET_INTENSITY", "value": 1.5 }

// SET_SPEED  
{ "type": "SET_SPEED", "value": 0.8 }

// STOP_MOTION
{ "type": "STOP_MOTION" }

// RESET_TO_IDLE
{ "type": "RESET_TO_IDLE" }
```

### Unity → Expo

Sent via `ExpoMessageSender`, received in `onUnityMessage` callback

```json
// STATE_CHANGED
{ "type": "STATE_CHANGED", "state": "combat", "profileId": "combat_ready" }

// BLEND_COMPLETE
{ "type": "BLEND_COMPLETE" }

// ERROR
{ "type": "ERROR", "message": "Invalid state: foo" }
```

---

## Remaining Steps for Human

### 1. Unity Setup (Requires Unity Editor)
- Open Unity project in Unity 2021.3+
- Import Live2D Cubism SDK
- Copy Core/*.cs from `/app/live2d-motion-system/unity-driver/Core/`
- Copy profiles from `/app/live2d-motion-system/profiles/v2/`
- Set up scene with all components
- Export as Android Library

### 2. Expo Build (Requires EAS CLI)
- Run `npx expo prebuild --clean`
- Integrate Unity library into Android project
- Run `eas build --profile development --platform android`

### 3. On-Device Testing (MANDATORY)
- Install APK on physical Android device
- Run app and verify bridge connection
- Complete verification checklist
- Capture screenshot/video evidence

---

## On-Device Verification Script

Execute these tests on a PHYSICAL Android device:

```
Test 1: App Launch
  - Expected: Unity view visible, character in Idle state
  - Log: "[UnityBridge] Initialized successfully"

Test 2: Idle → Combat
  - Action: Trigger setState('combat')
  - Expected: Character transitions to combat stance
  - Log: "[ExpoMessageReceiver] State set to: Combat"
  - Log: "[UnityBridge] Received from Unity: {\"type\":\"STATE_CHANGED\"...}"

Test 3: Combat → Idle  
  - Action: Trigger resetToIdle()
  - Expected: Character transitions back to idle
  - Log: "[ExpoMessageReceiver] Reset to Idle"

Test 4: Invalid State
  - Action: Send { "type": "SET_STATE", "state": "invalid_state" }
  - Expected: Error message in logs
  - Log: "[ExpoMessageSender] Sending: {\"type\":\"ERROR\"...}"

Test 5: Background/Foreground
  - Action: Put app in background, bring back to foreground
  - Expected: Character still animating, no crash
```

---

## Evidence Required from Human

Phase 6 cannot be marked COMPLETE until the human provides:

1. **Screenshot or video** showing:
   - Expo UI with Unity character view
   - State transition visible (Idle → Combat → Idle)

2. **Console log excerpt** showing:
   - `[UnityBridge] Initialized successfully`
   - `[UnityBridge] Sent to Unity: {...}`
   - `[UnityBridge] Received from Unity: {...}`

3. **Confirmation** that testing was on:
   - Physical Android device (not emulator)
   - EAS development build (not Expo Go)

---

## Phase 6 Status

| Checkpoint | Status |
|------------|--------|
| Unity bridge scripts created | ✅ DONE |
| Expo bridge wrapper created | ✅ DONE |
| UnityCharacterView component created | ✅ DONE |
| EAS configuration created | ✅ DONE |
| Setup documentation created | ✅ DONE |
| Phase 3 Core/*.cs unchanged | ✅ VERIFIED |
| Unity project exported | ⏳ HUMAN ACTION REQUIRED |
| EAS build completed | ⏳ HUMAN ACTION REQUIRED |
| On-device verification | ⏳ HUMAN ACTION REQUIRED |

**Current Status:** Scaffolding complete. Awaiting human to complete Unity export, EAS build, and on-device testing.
