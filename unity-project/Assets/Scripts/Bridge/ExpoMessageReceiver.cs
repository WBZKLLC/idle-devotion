// =============================================================================
// ExpoMessageReceiver.cs
// Phase 6: Receives JSON messages from Expo and routes to MotionStateController
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// SECURITY: Implements S-1 to S-6 security controls
// =============================================================================

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Receives messages from Expo/React Native via the Unity bridge.
    /// Routes commands to the MotionStateController.
    /// 
    /// SECURITY CONTROLS:
    /// - S-1: Session token validation
    /// - S-2: Strict schema validation
    /// - S-3: Rate limiting (10 msg/sec)
    /// - S-4: Sanitized error responses
    /// - S-5: Debug-only logging
    /// - S-6: Singleton lifecycle safety
    /// </summary>
    public class ExpoMessageReceiver : MonoBehaviour
    {
        [Header("References")]
        [Tooltip("Reference to the MotionStateController from Phase 3")]
        public Live2DMotion.Core.MotionStateController stateController;

        [Tooltip("Reference to the MotionParameterDriver from Phase 3")]
        public Live2DMotion.Core.MotionParameterDriver parameterDriver;

        [Header("Security Settings")]
        [Tooltip("Maximum message size in bytes (S-1)")]
        [SerializeField] private int maxMessageSize = 4096;

        [Tooltip("Maximum messages per second (S-3)")]
        [SerializeField] private float maxMessagesPerSecond = 10f;

        [Tooltip("Require session token for messages (S-1)")]
        [SerializeField] private bool requireSessionToken = true;

        // Singleton for easy access from native bridge
        public static ExpoMessageReceiver Instance { get; private set; }

        // S-1: Session token for authentication
        private string _sessionToken = null;
        private bool _isSessionEstablished = false;

        // S-3: Rate limiting
        private Queue<float> _messageTimestamps = new Queue<float>();
        private float _rateLimitWindow = 1f; // 1 second window

        // S-2: Valid message types (strict whitelist)
        private static readonly HashSet<string> ValidMessageTypes = new HashSet<string>
        {
            "SET_STATE",
            "SET_INTENSITY",
            "SET_SPEED",
            "STOP_MOTION",
            "RESET_TO_IDLE",
            "HANDSHAKE" // S-1: For session establishment
        };

        // S-2: Valid states (strict whitelist)
        private static readonly HashSet<string> ValidStates = new HashSet<string>
        {
            "idle", "combat", "banner", "summon", 
            "victory", "defeat", "dialogue", "special"
        };

        // S-6: Track initialization state
        private bool _isInitialized = false;

        private void Awake()
        {
            // S-6: Prevent duplicate registration
            if (Instance != null && Instance != this)
            {
                LogDebug("Duplicate ExpoMessageReceiver detected, destroying");
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            _isInitialized = true;

            // S-1: Generate session token on startup
            _sessionToken = GenerateSessionToken();
            LogDebug($"Session token generated: {_sessionToken.Substring(0, 8)}...");
        }

        private void OnDestroy()
        {
            // S-6: Clean up singleton reference
            if (Instance == this)
            {
                Instance = null;
                _isInitialized = false;
            }
        }

        /// <summary>
        /// S-1: Generate a random session token for handshake
        /// </summary>
        private string GenerateSessionToken()
        {
            var bytes = new byte[32];
            var rng = new System.Security.Cryptography.RNGCryptoServiceProvider();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        /// <summary>
        /// S-1: Get the session token for Expo to use in handshake
        /// Called by BridgeInitializer to send token to Expo
        /// </summary>
        public string GetSessionToken()
        {
            return _sessionToken;
        }

        /// <summary>
        /// Called by the native bridge when a message arrives from Expo.
        /// This is the ONLY entry point for Expo commands.
        /// </summary>
        /// <param name="jsonMessage">JSON string from Expo dispatcher</param>
        public void OnExpoMessage(string jsonMessage)
        {
            // S-1: Check message size limit
            if (jsonMessage == null || jsonMessage.Length > maxMessageSize)
            {
                SendErrorSanitized("MSG_TOO_LARGE", "Message exceeds size limit");
                LogDebug($"Rejected: message size {jsonMessage?.Length ?? 0} > {maxMessageSize}");
                return;
            }

            // S-3: Rate limiting check
            if (!CheckRateLimit())
            {
                SendErrorSanitized("RATE_LIMITED", "Too many requests");
                LogDebug("Rejected: rate limit exceeded");
                return;
            }

            // S-5: Debug-only payload logging
            LogDebug($"Received: {jsonMessage}");

            try
            {
                // S-2: Parse JSON with try/catch
                var message = JsonUtility.FromJson<ExpoMessage>(jsonMessage);

                if (message == null)
                {
                    SendErrorSanitized("PARSE_ERROR", "Invalid message format");
                    return;
                }

                // S-2: Validate message type is in whitelist
                if (string.IsNullOrEmpty(message.type) || !ValidMessageTypes.Contains(message.type))
                {
                    SendErrorSanitized("INVALID_TYPE", "Unknown message type");
                    LogDebug($"Rejected: unknown type '{message.type}'");
                    return;
                }

                // S-1: Handle handshake for session establishment
                if (message.type == "HANDSHAKE")
                {
                    HandleHandshake(message);
                    return;
                }

                // S-1: Require valid session for all other messages
                if (requireSessionToken && !_isSessionEstablished)
                {
                    SendErrorSanitized("NO_SESSION", "Session not established");
                    LogDebug("Rejected: no session established");
                    return;
                }

                // S-1: Validate session token if provided
                if (requireSessionToken && !string.IsNullOrEmpty(message.sessionToken))
                {
                    if (message.sessionToken != _sessionToken)
                    {
                        SendErrorSanitized("INVALID_TOKEN", "Session token mismatch");
                        LogDebug("Rejected: invalid session token");
                        return;
                    }
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
                }
            }
            catch (Exception e)
            {
                // S-4: Never expose internal exception details
                LogError($"Exception processing message: {e.Message}");
                SendErrorSanitized("INTERNAL_ERROR", "Message processing failed");
            }
        }

        /// <summary>
        /// S-1: Handle session handshake
        /// </summary>
        private void HandleHandshake(ExpoMessage message)
        {
            if (message.sessionToken == _sessionToken)
            {
                _isSessionEstablished = true;
                LogDebug("Session established successfully");
                
                // Send confirmation back to Expo
                ExpoMessageSender.Instance?.SendHandshakeConfirmed();
            }
            else
            {
                SendErrorSanitized("HANDSHAKE_FAILED", "Invalid handshake token");
                LogDebug("Handshake failed: token mismatch");
            }
        }

        /// <summary>
        /// S-3: Check if message is within rate limit
        /// </summary>
        private bool CheckRateLimit()
        {
            float currentTime = Time.unscaledTime;

            // Remove timestamps outside the window
            while (_messageTimestamps.Count > 0 && 
                   currentTime - _messageTimestamps.Peek() > _rateLimitWindow)
            {
                _messageTimestamps.Dequeue();
            }

            // Check if under limit
            if (_messageTimestamps.Count >= maxMessagesPerSecond)
            {
                return false;
            }

            // Record this message
            _messageTimestamps.Enqueue(currentTime);
            return true;
        }

        private void HandleSetState(ExpoMessage message)
        {
            // S-2: Validate state is in whitelist
            if (string.IsNullOrEmpty(message.state))
            {
                SendErrorSanitized("MISSING_STATE", "State field required");
                return;
            }

            string stateLower = message.state.ToLowerInvariant();
            if (!ValidStates.Contains(stateLower))
            {
                SendErrorSanitized("INVALID_STATE", "State not recognized");
                LogDebug($"Rejected: invalid state '{message.state}'");
                return;
            }

            if (stateController == null)
            {
                SendErrorSanitized("NOT_READY", "Controller not available");
                return;
            }

            // Parse state string to enum
            if (!Enum.TryParse<Live2DMotion.Core.MotionState>(message.state, true, out var motionState))
            {
                SendErrorSanitized("INVALID_STATE", "State not recognized");
                return;
            }

            // Call the Phase 3 controller (DO NOT MODIFY Core/*.cs)
            stateController.SetState(
                motionState,
                message.heroId,
                message.heroClass,
                message.rarity
            );

            LogDebug($"State set to: {motionState}");
        }

        private void HandleSetIntensity(ExpoMessage message)
        {
            if (parameterDriver == null)
            {
                SendErrorSanitized("NOT_READY", "Driver not available");
                return;
            }

            // S-2: Validate numeric bounds (0.0 - 2.0)
            if (message.value < 0f || message.value > 2f)
            {
                LogDebug($"Intensity {message.value} clamped to valid range");
            }
            
            float intensity = Mathf.Clamp(message.value, 0f, 2f);
            parameterDriver.SetGlobalIntensity(intensity);

            LogDebug($"Intensity set to: {intensity}");
        }

        private void HandleSetSpeed(ExpoMessage message)
        {
            if (parameterDriver == null)
            {
                SendErrorSanitized("NOT_READY", "Driver not available");
                return;
            }

            // S-2: Validate numeric bounds (0.1 - 3.0)
            if (message.value < 0.1f || message.value > 3f)
            {
                LogDebug($"Speed {message.value} clamped to valid range");
            }

            float speed = Mathf.Clamp(message.value, 0.1f, 3f);
            parameterDriver.SetGlobalSpeed(speed);

            LogDebug($"Speed set to: {speed}");
        }

        private void HandleStopMotion()
        {
            if (parameterDriver == null)
            {
                SendErrorSanitized("NOT_READY", "Driver not available");
                return;
            }

            parameterDriver.StopMotion();
            LogDebug("Motion stopped");
        }

        private void HandleResetToIdle()
        {
            if (stateController == null)
            {
                SendErrorSanitized("NOT_READY", "Controller not available");
                return;
            }

            stateController.SetState(Live2DMotion.Core.MotionState.Idle);
            LogDebug("Reset to Idle");
        }

        /// <summary>
        /// S-4: Send sanitized error (no internal details)
        /// </summary>
        private void SendErrorSanitized(string errorCode, string userMessage)
        {
            ExpoMessageSender.Instance?.SendErrorSanitized(errorCode, userMessage);
        }

        /// <summary>
        /// S-5: Debug-only logging
        /// </summary>
        [System.Diagnostics.Conditional("DEBUG")]
        private void LogDebug(string message)
        {
            Debug.Log($"[ExpoMessageReceiver] {message}");
        }

        /// <summary>
        /// S-5: Error logging (always enabled but sanitized)
        /// </summary>
        private void LogError(string message)
        {
            #if DEBUG
            Debug.LogError($"[ExpoMessageReceiver] {message}");
            #else
            Debug.LogError("[ExpoMessageReceiver] An error occurred");
            #endif
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
        public string sessionToken; // S-1: For authentication
    }
}
