# Live2D Motion System - Integration Checklist

This checklist guides integration of the Live2D motion system into your project.

---

## Pre-Integration Requirements

### ☐ 1. Live2D Cubism SDK
- [ ] Unity project has Live2D Cubism SDK imported
- [ ] Cubism model (.moc3) prepared and imported
- [ ] Model has required parameters (ParamBreath, ParamBodyAngleX, etc.)

### ☐ 2. Project Structure
- [ ] `/Resources/Live2D/MotionProfiles/v2/` directory created in Unity
- [ ] JSON profile files copied to Resources folder
- [ ] Profile files are TextAsset readable

### ☐ 3. Validation
- [ ] Run `node tools/validate-profiles.js` from `/app/live2d-motion-system/`
- [ ] All profiles pass validation (exit code 0)
- [ ] No deprecated parameters used
- [ ] No disallowed waveforms in Idle/Banner profiles

---

## Unity Setup

### ☐ 4. Import Driver Scripts
- [ ] Copy `/unity-driver/Core/*.cs` to `Assets/Scripts/Live2D/Motion/`
- [ ] Create assembly definition (optional but recommended)
- [ ] Verify no compilation errors

### ☐ 5. Scene Setup

**Step 5.1: Profile Loader**
- [ ] Create empty GameObject "MotionSystem"
- [ ] Add `MotionProfileLoader` component
- [ ] Set `profilesResourcePath` = "Live2D/MotionProfiles/v2"

**Step 5.2: Character Setup**
- [ ] Select Live2D model GameObject
- [ ] Add `MotionParameterDriver` component
- [ ] Add `MotionStateController` component
- [ ] Link `profileLoader` reference in both components

**Step 5.3: Banner Controller (Optional)**
- [ ] Add `BannerModeController` for summon sequences
- [ ] Configure timing parameters
- [ ] Connect Unity Events if needed

### ☐ 6. Test Unity Setup
- [ ] Enter Play mode
- [ ] Check console: "Loaded X motion profiles"
- [ ] Character should start in Idle state
- [ ] No errors in console

---

## Expo Setup

### ☐ 7. Import Dispatcher
- [ ] Verify `/frontend/types/motionTypes.ts` exists
- [ ] Verify `/frontend/constants/motionStates.ts` exists
- [ ] Verify `/frontend/services/motionStateDispatcher.ts` exists
- [ ] Verify `/frontend/hooks/useMotionState.ts` exists

### ☐ 8. Unity Bridge Setup
When Unity-React Native bridge is available:
- [ ] Call `motionStateDispatcher.initialize(bridge)` with Unity bridge
- [ ] Bridge must have `postMessage(json: string)` method

### ☐ 9. Test Expo Setup
- [ ] Import hook in test component
- [ ] Verify `useMotionState()` returns expected methods
- [ ] Check TypeScript has no errors

---

## Integration Verification

### ☐ 10. State Dispatch Test
```typescript
const { setState, status } = useMotionState();

// Test state change
setState('combat');
console.log(status.currentState); // Should update after Unity confirms
```

### ☐ 11. Profile Resolution Test
- [ ] Send state with hero metadata
- [ ] Verify correct profile selected in Unity
- [ ] Check console logs show profile ID

### ☐ 12. Rating Clamp Verification
- [ ] Enable `debugMode` on `MotionParameterDriver`
- [ ] Play with high intensity
- [ ] Verify clamp warnings appear for soft tissue params
- [ ] Confirm values stay within bounds

### ☐ 13. Transition Test
- [ ] Change state from Idle to Combat
- [ ] Verify smooth blend (no popping)
- [ ] Check blend duration matches profile config

---

## Common Issues and Solutions

### Issue: "No profiles found"
**Cause:** Profiles not in Resources folder or wrong path
**Solution:**
1. Check path is `Assets/Resources/Live2D/MotionProfiles/v2/`
2. Files must be `.json` extension
3. Verify `profilesResourcePath` setting

### Issue: "Parameter not found on model"
**Cause:** Profile uses parameter not in Cubism model
**Solution:**
1. Check model has required parameters
2. Use debugMode to see which params are missing
3. Update model or profile as needed

### Issue: "Invalid schema version"
**Cause:** Profile using old schema format
**Solution:**
1. Ensure `schemaVersion` is "2.0.0"
2. Run validation script to check all profiles

### Issue: "State not changing"
**Cause:** Unity bridge not connected
**Solution:**
1. Verify `motionStateDispatcher.initialize()` called
2. Check bridge `postMessage` works
3. Add logging to Unity `OnExpoCommand`

### Issue: "Animation looks jerky"
**Cause:** Blend duration too short or wrong curve
**Solution:**
1. Increase `blendInDuration` in profile
2. Try different `blendCurve` (ease_in_out recommended)

### Issue: "Rating clamp violations"
**Cause:** Profile amplitudes exceed clamp limits
**Solution:**
1. This is expected - clamps are enforcing safety
2. Reduce amplitude in profile if motion is too subtle
3. Clamps are mandatory - do not remove them

---

## Final Verification Checklist

- [ ] All profiles validated (exit code 0)
- [ ] Unity loads profiles without errors
- [ ] Character animates in Idle state
- [ ] State changes work from Expo
- [ ] Transitions blend smoothly
- [ ] Rating clamps are enforced
- [ ] No animation code in Expo
- [ ] JSON remains source of truth

---

## Support

- Architecture: See `FINAL_ARCHITECTURE.md`
- Usage Examples: See `USAGE_EXAMPLES.md`
- Schema Reference: See `PHASE2_SPECIFICATION.md`
- Unity Driver: See `PHASE3_IMPLEMENTATION.md`
