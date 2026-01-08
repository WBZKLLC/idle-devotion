# Phase 6: Unity Integration Setup Guide

This guide walks through setting up the Expo ↔ Unity bridge for Live2D animation.

## Prerequisites

- Unity 2021.3 LTS or newer
- Android Studio (for Android builds)
- EAS CLI (`npm install -g eas-cli`)
- Expo account (for EAS Build)

## Step 1: Prepare the Unity Project

### 1.1 Open Unity Project

1. Open Unity Hub
2. Click "Add" and select `/app/unity-project`
3. Open the project with Unity 2021.3+

### 1.2 Import Live2D Cubism SDK

1. Download Live2D Cubism SDK for Unity from live2d.com
2. Import the SDK package into the Unity project
3. Import your Live2D model (.moc3 files)

### 1.3 Copy Motion Profiles

```bash
# Copy the v2 profiles to Unity Resources
cp -r /app/live2d-motion-system/profiles/v2/*.json \
    /app/unity-project/Assets/Resources/Live2D/MotionProfiles/v2/
```

### 1.4 Copy Core Driver Scripts

```bash
# Copy Phase 3 driver scripts (DO NOT MODIFY)
cp -r /app/live2d-motion-system/unity-driver/Core/*.cs \
    /app/unity-project/Assets/Scripts/Core/
```

### 1.5 Scene Setup

1. Create a new scene or open the main scene
2. Create empty GameObjects:
   - "MotionSystem" - Add `MotionProfileLoader`, `MotionParameterDriver`, `MotionStateController`
   - "BridgeSystem" - Add `ExpoMessageReceiver`, `ExpoMessageSender`, `BridgeInitializer`
   - "ReactNativeUnity" - Add `ReactNativeUnityBridge` (name MUST be exact)
3. Wire up references in the Inspector:
   - `BridgeInitializer` → assign all component references
4. Add your Live2D model to the scene
5. Assign the Cubism model to `MotionParameterDriver`

### 1.6 Export Unity as Android Library

1. Go to **File → Build Settings**
2. Select **Android** platform
3. Click **Player Settings**:
   - Set **Scripting Backend** to **IL2CPP**
   - Enable **ARM64** architecture
   - Set **Minimum API Level** to **24** (Android 7.0)
4. Check **Export Project**
5. Click **Export** and save to `unity-export/android/`

## Step 2: Prepare Expo Project

### 2.1 Install Dependencies

```bash
cd /app/frontend

# Install react-native-unity
yarn add @azesmway/react-native-unity

# Generate native code
npx expo prebuild --clean
```

### 2.2 Integrate Unity Library

After `expo prebuild`, you'll have an `android/` folder:

1. Copy the exported `unityLibrary/` folder to `android/`
2. Edit `android/settings.gradle`:

```gradle
// Add at the end
include ':unityLibrary'
project(':unityLibrary').projectDir = new File(rootProject.projectDir, 'unityLibrary')
```

3. Edit `android/app/build.gradle`:

```gradle
dependencies {
    // ... existing dependencies
    implementation project(':unityLibrary')
}
```

### 2.3 Configure EAS Build

The `eas.json` file is already configured. Login to EAS:

```bash
eas login
```

## Step 3: Build Development Client

### 3.1 Build for Android

```bash
cd /app/frontend

# Build development APK
eas build --profile development --platform android
```

This will:
1. Upload your project to EAS
2. Build an APK with Unity embedded
3. Provide a download link when complete

### 3.2 Install on Device

1. Download the APK from the EAS build link
2. Install on your Android device:
   - Enable "Install from unknown sources" if needed
   - Open the APK file to install

## Step 4: Run and Test

### 4.1 Start Development Server

```bash
cd /app/frontend
npx expo start --dev-client
```

### 4.2 Connect Device

1. Open the installed development client app
2. Scan the QR code or enter the URL
3. The app should load with Unity embedded

### 4.3 Verify Bridge Connection

Open the device logs (shake device → "Show Debug Menu" → "Remote JS Debugging"):

```
[UnityBridge] Initialized successfully
[UnityBridge] Received from Unity: {"type":"STATE_CHANGED","state":"idle","profileId":"unity_ready"}
```

## Step 5: On-Device Verification Checklist

Complete these tests on a PHYSICAL Android device:

| Test | Expected Result | Pass/Fail |
|------|-----------------|----------|
| App launches | Unity view visible | |
| Character in Idle | Breathing animation plays | |
| Tap "Enter Combat" | Character transitions to combat stance | |
| Tap "Return to Idle" | Character transitions back to idle | |
| Send invalid state | Error message in logs | |
| Background/foreground app | Character still animating | |

## Troubleshooting

### "Unity module not available"

- You're running in Expo Go. Use the EAS development build instead.

### "ReactNativeUnity GameObject not found"

- Ensure the Unity scene has a GameObject named exactly "ReactNativeUnity"
- The `ReactNativeUnityBridge` script must be attached to it

### "MotionStateController not assigned"

- Open Unity and check that BridgeInitializer has all references wired

### Build fails with Gradle errors

- Check that `unityLibrary` is correctly included in settings.gradle
- Verify the Unity export used the correct settings (IL2CPP, ARM64)

### No messages received in Unity

- Check Unity console for errors
- Verify `ExpoMessageReceiver` is active in the scene
- Check that `ReceiveMessage` method is being called

## File Reference

### Unity Project
```
/app/unity-project/
├── Assets/
│   ├── Scripts/
│   │   ├── Bridge/           # Phase 6 bridge scripts
│   │   │   ├── ExpoMessageReceiver.cs
│   │   │   ├── ExpoMessageSender.cs
│   │   │   └── BridgeInitializer.cs
│   │   ├── Integration/      # react-native-unity integration
│   │   │   └── ReactNativeUnityBridge.cs
│   │   └── Core/             # Phase 3 driver (COPY, DO NOT MODIFY)
│   │       └── *.cs
│   └── Resources/
│       └── Live2D/
│           └── MotionProfiles/v2/  # Copied from live2d-motion-system
└── ProjectSettings/
```

### Expo Project
```
/app/frontend/
├── services/
│   ├── motionStateDispatcher.ts  # Phase 4 (unchanged)
│   └── unityBridge.ts            # Phase 6 bridge wrapper
├── components/
│   └── UnityCharacterView.tsx    # Phase 6 Unity view component
└── eas.json                      # EAS Build configuration
```
