// =============================================================================
// BridgeInitializer.cs
// Phase 6: Initializes the Expo-Unity bridge at startup
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// SECURITY: Implements S-1 token delivery via SESSION_READY message
// =============================================================================

using UnityEngine;
using Live2DMotion.Core;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Initializes the bridge components and wires them to the Core motion system.
    /// This is the main entry point for the Unity side of the integration.
    /// 
    /// SECURITY:
    /// - S-1: Sends SESSION_READY with token to Expo at initialization
    /// - F16: Expo cannot send commands until token is received
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
        [SerializeField] private float sessionReadyDelay = 0.5f; // Delay to ensure Expo is ready

        private void Start()
        {
            InitializeBridge();
        }

        private void InitializeBridge()
        {
            LogDebug("Initializing Expo-Unity Bridge...");

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
                LogDebug("ExpoMessageReceiver wired to Core components");
            }
            else
            {
                LogError("ExpoMessageReceiver not assigned!");
                return;
            }

            if (messageSender == null)
            {
                LogError("ExpoMessageSender not assigned!");
                return;
            }

            // Subscribe to state changes from the controller
            // This sends confirmations back to Expo
            stateController.OnStateChanged += (state, profileId) =>
            {
                messageSender.SendStateChanged(state.ToString().ToLower(), profileId);
            };
            LogDebug("State change notifications wired to ExpoMessageSender");

            // Subscribe to blend complete from parameter driver
            parameterDriver.OnBlendComplete += () =>
            {
                messageSender.SendBlendComplete();
            };
            LogDebug("Blend complete notifications wired to ExpoMessageSender");

            // Auto-start in idle if configured
            if (autoStartInIdle)
            {
                stateController.SetState(MotionState.Idle);
                LogDebug("Auto-started in Idle state");
            }

            LogDebug("Expo-Unity Bridge initialized successfully!");

            // S-1/F16: Send SESSION_READY with token to Expo
            // Delay slightly to ensure Expo bridge is ready to receive
            Invoke(nameof(SendSessionReady), sessionReadyDelay);
        }

        /// <summary>
        /// S-1/F16: Send SESSION_READY message with token to Expo
        /// This MUST be received by Expo before any commands can be sent
        /// </summary>
        private void SendSessionReady()
        {
            if (messageReceiver == null || messageSender == null)
            {
                LogError("Cannot send SESSION_READY: components not available");
                return;
            }

            string token = messageReceiver.GetSessionToken();
            
            if (string.IsNullOrEmpty(token))
            {
                LogError("Cannot send SESSION_READY: no session token available");
                return;
            }

            messageSender.SendSessionReady(token);
            LogDebug($"SESSION_READY sent with token: {token.Substring(0, 8)}...");
        }

        /// <summary>
        /// S-5: Debug-only logging
        /// </summary>
        [System.Diagnostics.Conditional("DEBUG")]
        private void LogDebug(string message)
        {
            Debug.Log($"[BridgeInitializer] {message}");
        }

        private void LogError(string message)
        {
            Debug.LogError($"[BridgeInitializer] {message}");
        }
    }
}
