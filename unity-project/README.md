# Unity Project for Live2D Motion System

This Unity project contains the Live2D character animation runtime for the mobile app.

## Project Structure

```
Assets/
├── Scripts/
│   ├── Bridge/           # Phase 6 - Expo communication
│   │   ├── ExpoMessageReceiver.cs
│   │   ├── ExpoMessageSender.cs
│   │   └── BridgeInitializer.cs
│   ├── Integration/      # react-native-unity integration
│   │   └── ReactNativeUnityBridge.cs
│   └── Core/             # Phase 3 - Motion driver (COPY FROM live2d-motion-system)
├── Resources/
│   └── Live2D/
│       └── MotionProfiles/v2/   # JSON profiles (COPY FROM live2d-motion-system)
└── Scenes/
    └── Main.unity
```

## Setup Instructions

See `SETUP_GUIDE.md` for complete setup instructions.

## Important Notes

### Core Scripts (Phase 3 - LOCKED)

The scripts in `Scripts/Core/` are copied from `/app/live2d-motion-system/unity-driver/Core/`.
**DO NOT MODIFY** these files. They are the Phase 3 implementation and are considered locked.

If you need changes to the motion driver:
1. Create new scripts in `Scripts/Bridge/` or `Scripts/Integration/`
2. Wrap or extend functionality without modifying Core

### Bridge Scripts (Phase 6)

The scripts in `Scripts/Bridge/` handle communication with Expo/React Native:
- `ExpoMessageReceiver.cs` - Receives commands from Expo
- `ExpoMessageSender.cs` - Sends status back to Expo
- `BridgeInitializer.cs` - Wires everything together at startup

### Integration Scripts

`Scripts/Integration/ReactNativeUnityBridge.cs` is the entry point for `react-native-unity`.
It must be attached to a GameObject named exactly "ReactNativeUnity".

## Build Settings

For Android export:
- Scripting Backend: IL2CPP
- Target Architecture: ARM64 (ARMv7 optional)
- Minimum API Level: 24 (Android 7.0)
- Export as: Gradle Project ("Export Project" checked)

## Dependencies

- Unity 2021.3 LTS or newer
- Live2D Cubism SDK for Unity
