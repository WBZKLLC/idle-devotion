// =============================================================================
// BridgeInitializer.cs
// Phase 6: Initializes the Expo-Unity bridge at startup
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// =============================================================================

using UnityEngine;
using Live2DMotion.Core;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Initializes the bridge components and wires them to the Core motion system.
    /// This is the main entry point for the Unity side of the integration.
    /// 
    /// SETUP:
    /// 1. Attach this script to a GameObject in your main scene
    /// 2. Assign references to the Core components
    /// 3. The bridge will auto-initialize on Start()
    /// </summary>
    public class BridgeInitializer : MonoBehaviour
    {
        [Header("Core Components (Phase 3 - DO NOT MODIFY)")]
        [Tooltip("Reference to MotionProfileLoader")]
        public MotionProfileLoader profileLoader;

        [Tooltip("Reference to MotionParameterDriver")]
        public MotionParameterDriver parameterDriver;

        [Tooltip("Reference to MotionStateController")]
        public MotionStateController stateController;

        [Header("Bridge Components (Phase 6)")]
        [Tooltip("Reference to ExpoMessageReceiver")]
        public ExpoMessageReceiver messageReceiver;

        [Tooltip("Reference to ExpoMessageSender")]
        public ExpoMessageSender messageSender;

        [Header("Settings")]
        [SerializeField] private bool autoStartInIdle = true;
        [SerializeField] private bool verboseLogging = true;

        private void Start()
        {
            InitializeBridge();
        }

        private void InitializeBridge()
        {
            Log("Initializing Expo-Unity Bridge...");

            // Validate Core components exist
            if (profileLoader == null)
            {
                LogError("MotionProfileLoader not assigned!");
                return;
            }

            if (parameterDriver == null)
            {
                LogError("MotionParameterDriver not assigned!");
                return;
            }

            if (stateController == null)
            {
                LogError("MotionStateController not assigned!");
                return;
            }

            // Wire up bridge components
            if (messageReceiver != null)
            {
                messageReceiver.stateController = stateController;
                messageReceiver.parameterDriver = parameterDriver;
                Log("ExpoMessageReceiver wired to Core components");
            }
            else
            {
                LogError("ExpoMessageReceiver not assigned!");
            }

            // Subscribe to state changes from the controller
            // This sends confirmations back to Expo
            if (stateController != null && messageSender != null)
            {
                stateController.OnStateChanged += (state, profileId) =>
                {
                    messageSender.SendStateChanged(state.ToString().ToLower(), profileId);
                };
                Log("State change notifications wired to ExpoMessageSender");
            }

            // Subscribe to blend complete from parameter driver
            if (parameterDriver != null && messageSender != null)
            {
                parameterDriver.OnBlendComplete += () =>
                {
                    messageSender.SendBlendComplete();
                };
                Log("Blend complete notifications wired to ExpoMessageSender");
            }

            // Auto-start in idle if configured
            if (autoStartInIdle && stateController != null)
            {
                stateController.SetState(MotionState.Idle);
                Log("Auto-started in Idle state");
            }

            Log("Expo-Unity Bridge initialized successfully!");
        }

        private void Log(string message)
        {
            if (verboseLogging)
            {
                Debug.Log($"[BridgeInitializer] {message}");
            }
        }

        private void LogError(string message)
        {
            Debug.LogError($"[BridgeInitializer] {message}");
        }
    }
}
