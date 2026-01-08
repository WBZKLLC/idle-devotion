// =============================================================================
// ExpoMessageReceiver.cs
// Phase 6: Receives JSON messages from Expo and routes to MotionStateController
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// =============================================================================

using System;
using UnityEngine;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Receives messages from Expo/React Native via the Unity bridge.
    /// Routes commands to the MotionStateController.
    /// 
    /// RESPONSIBILITIES:
    /// - Parse incoming JSON messages from Expo
    /// - Validate message format
    /// - Forward to appropriate controller methods
    /// - Log all received commands for debugging
    /// 
    /// PROHIBITED:
    /// - Animation logic (handled by Core/MotionParameterDriver)
    /// - Profile loading (handled by Core/MotionProfileLoader)
    /// - Parameter manipulation (handled by Core/MotionParameterDriver)
    /// </summary>
    public class ExpoMessageReceiver : MonoBehaviour
    {
        [Header("References")]
        [Tooltip("Reference to the MotionStateController from Phase 3")]
        public Live2DMotion.Core.MotionStateController stateController;

        [Tooltip("Reference to the MotionParameterDriver from Phase 3")]
        public Live2DMotion.Core.MotionParameterDriver parameterDriver;

        [Header("Debug")]
        [SerializeField] private bool logAllMessages = true;

        // Singleton for easy access from native bridge
        public static ExpoMessageReceiver Instance { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        /// <summary>
        /// Called by the native bridge when a message arrives from Expo.
        /// This is the ONLY entry point for Expo commands.
        /// </summary>
        /// <param name="jsonMessage">JSON string from Expo dispatcher</param>
        public void OnExpoMessage(string jsonMessage)
        {
            if (logAllMessages)
            {
                Debug.Log($"[ExpoMessageReceiver] Received: {jsonMessage}");
            }

            try
            {
                // Parse the message
                var message = JsonUtility.FromJson<ExpoMessage>(jsonMessage);

                if (message == null)
                {
                    SendError("Failed to parse message: null result");
                    return;
                }

                // Route based on message type
                switch (message.type)
                {
                    case "SET_STATE":
                        HandleSetState(message);
                        break;

                    case "SET_INTENSITY":
                        HandleSetIntensity(message);
                        break;

                    case "SET_SPEED":
                        HandleSetSpeed(message);
                        break;

                    case "STOP_MOTION":
                        HandleStopMotion();
                        break;

                    case "RESET_TO_IDLE":
                        HandleResetToIdle();
                        break;

                    default:
                        SendError($"Unknown message type: {message.type}");
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[ExpoMessageReceiver] Error processing message: {e.Message}");
                SendError($"Exception: {e.Message}");
            }
        }

        private void HandleSetState(ExpoMessage message)
        {
            if (string.IsNullOrEmpty(message.state))
            {
                SendError("SET_STATE missing state field");
                return;
            }

            if (stateController == null)
            {
                SendError("MotionStateController not assigned");
                return;
            }

            // Parse state string to enum
            if (!Enum.TryParse<Live2DMotion.Core.MotionState>(message.state, true, out var motionState))
            {
                SendError($"Invalid state: {message.state}");
                return;
            }

            // Call the Phase 3 controller (DO NOT MODIFY Core/*.cs)
            stateController.SetState(
                motionState,
                message.heroId,
                message.heroClass,
                message.rarity
            );

            Debug.Log($"[ExpoMessageReceiver] State set to: {motionState}");
        }

        private void HandleSetIntensity(ExpoMessage message)
        {
            if (parameterDriver == null)
            {
                SendError("MotionParameterDriver not assigned");
                return;
            }

            // Clamp value to valid range
            float intensity = Mathf.Clamp(message.value, 0f, 2f);
            parameterDriver.SetGlobalIntensity(intensity);

            Debug.Log($"[ExpoMessageReceiver] Intensity set to: {intensity}");
        }

        private void HandleSetSpeed(ExpoMessage message)
        {
            if (parameterDriver == null)
            {
                SendError("MotionParameterDriver not assigned");
                return;
            }

            // Clamp value to valid range
            float speed = Mathf.Clamp(message.value, 0.1f, 3f);
            parameterDriver.SetGlobalSpeed(speed);

            Debug.Log($"[ExpoMessageReceiver] Speed set to: {speed}");
        }

        private void HandleStopMotion()
        {
            if (parameterDriver == null)
            {
                SendError("MotionParameterDriver not assigned");
                return;
            }

            parameterDriver.StopMotion();
            Debug.Log("[ExpoMessageReceiver] Motion stopped");
        }

        private void HandleResetToIdle()
        {
            if (stateController == null)
            {
                SendError("MotionStateController not assigned");
                return;
            }

            stateController.SetState(Live2DMotion.Core.MotionState.Idle);
            Debug.Log("[ExpoMessageReceiver] Reset to Idle");
        }

        private void SendError(string errorMessage)
        {
            Debug.LogError($"[ExpoMessageReceiver] Error: {errorMessage}");
            ExpoMessageSender.Instance?.SendError(errorMessage);
        }
    }

    /// <summary>
    /// Message structure matching Expo dispatcher format.
    /// Uses JsonUtility-compatible structure.
    /// </summary>
    [Serializable]
    public class ExpoMessage
    {
        public string type;
        public string state;
        public string heroId;
        public string heroClass;
        public string rarity;
        public float value;
    }
}
