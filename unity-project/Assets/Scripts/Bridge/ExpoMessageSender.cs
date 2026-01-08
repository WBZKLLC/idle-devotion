// =============================================================================
// ExpoMessageSender.cs
// Phase 6: Sends status messages from Unity back to Expo
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// SECURITY: Implements S-4, S-5, S-6 security controls
// =============================================================================

using System;
using UnityEngine;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Sends status messages from Unity to Expo/React Native.
    /// 
    /// SECURITY CONTROLS:
    /// - S-4: Sanitized error responses (no stack traces)
    /// - S-5: Debug-only verbose logging
    /// - S-6: Singleton lifecycle safety
    /// </summary>
    public class ExpoMessageSender : MonoBehaviour
    {
        // Singleton for easy access
        public static ExpoMessageSender Instance { get; private set; }

        // Native bridge callback - set by react-native-unity or custom native module
        private static Action<string> _nativeCallback;

        // S-6: Track initialization state
        private bool _isInitialized = false;

        private void Awake()
        {
            // S-6: Prevent duplicate registration
            if (Instance != null && Instance != this)
            {
                LogDebug("Duplicate ExpoMessageSender detected, destroying");
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            _isInitialized = true;
        }

        private void OnDestroy()
        {
            // S-6: Clean up singleton reference and callback
            if (Instance == this)
            {
                Instance = null;
                _nativeCallback = null;
                _isInitialized = false;
            }
        }

        /// <summary>
        /// Register the native callback for sending messages to Expo.
        /// Called during bridge initialization.
        /// S-6: Idempotent - safe to call multiple times
        /// </summary>
        public static void RegisterNativeCallback(Action<string> callback)
        {
            _nativeCallback = callback;
            LogDebugStatic("Native callback registered");
        }

        /// <summary>
        /// S-6: Unregister the callback (for cleanup)
        /// </summary>
        public static void UnregisterNativeCallback()
        {
            _nativeCallback = null;
            LogDebugStatic("Native callback unregistered");
        }

        /// <summary>
        /// S-1/F16: Send SESSION_READY with token to Expo at initialization
        /// This MUST be received by Expo before any commands are accepted
        /// </summary>
        public void SendSessionReady(string sessionToken)
        {
            var message = new SessionReadyMessage
            {
                type = "SESSION_READY",
                sessionToken = sessionToken
            };

            SendToExpo(JsonUtility.ToJson(message));
            LogDebug($"SESSION_READY sent");
        }

        /// <summary>
        /// S-1: Send handshake confirmation with session token
        /// </summary>
        public void SendHandshakeConfirmed()
        {
            var message = new HandshakeConfirmedMessage
            {
                type = "HANDSHAKE_CONFIRMED"
            };

            SendToExpo(JsonUtility.ToJson(message));
        }

        /// <summary>
        /// Send state change confirmation to Expo.
        /// Called by MotionStateController after successful state transition.
        /// </summary>
        public void SendStateChanged(string state, string profileId)
        {
            // S-4: Sanitize inputs (no null values in output)
            var message = new StateChangedMessage
            {
                type = "STATE_CHANGED",
                state = state ?? "unknown",
                profileId = profileId ?? "unknown"
            };

            SendToExpo(JsonUtility.ToJson(message));
        }

        /// <summary>
        /// Send blend complete notification to Expo.
        /// Called by MotionParameterDriver when transition finishes.
        /// </summary>
        public void SendBlendComplete()
        {
            var message = new BlendCompleteMessage
            {
                type = "BLEND_COMPLETE"
            };

            SendToExpo(JsonUtility.ToJson(message));
        }

        /// <summary>
        /// S-4: Send sanitized error message to Expo (no internal details)
        /// </summary>
        public void SendErrorSanitized(string errorCode, string userMessage)
        {
            // S-4: Only send safe error codes and messages, never stack traces
            var message = new ErrorMessage
            {
                type = "ERROR",
                code = errorCode ?? "UNKNOWN",
                message = userMessage ?? "An error occurred"
            };

            SendToExpo(JsonUtility.ToJson(message));
        }

        /// <summary>
        /// Legacy method - redirects to sanitized version
        /// </summary>
        public void SendError(string errorMessage)
        {
            // S-4: Sanitize the error message before sending
            SendErrorSanitized("ERROR", SanitizeErrorMessage(errorMessage));
        }

        /// <summary>
        /// S-4: Remove potentially sensitive information from error messages
        /// </summary>
        private string SanitizeErrorMessage(string rawMessage)
        {
            if (string.IsNullOrEmpty(rawMessage))
            {
                return "An error occurred";
            }

            // Remove file paths
            string sanitized = System.Text.RegularExpressions.Regex.Replace(
                rawMessage, 
                @"[A-Za-z]:\\[^\s]+|/[^\s]+\.cs", 
                "[path]"
            );

            // Remove line numbers
            sanitized = System.Text.RegularExpressions.Regex.Replace(
                sanitized, 
                @"line \d+|:\d+", 
                ""
            );

            // Truncate if too long
            if (sanitized.Length > 200)
            {
                sanitized = sanitized.Substring(0, 197) + "...";
            }

            return sanitized;
        }

        private void SendToExpo(string jsonMessage)
        {
            // S-5: Debug-only payload logging
            LogDebug($"Sending: {jsonMessage}");

            if (_nativeCallback != null)
            {
                try
                {
                    _nativeCallback(jsonMessage);
                }
                catch (Exception e)
                {
                    // S-4: Don't expose exception details
                    LogError($"Failed to send via callback: {e.Message}");
                }
            }
            else
            {
                // Fallback: Use Unity's SendMessage for react-native-unity compatibility
                try
                {
                    #if UNITY_ANDROID || UNITY_IOS
                    SendMessageToReactNative(jsonMessage);
                    #endif
                }
                catch (Exception e)
                {
                    // S-4: Don't expose exception details  
                    LogDebug($"Fallback send failed: {e.Message}");
                }
            }
        }

        /// <summary>
        /// Platform-specific message sending to React Native.
        /// </summary>
        private void SendMessageToReactNative(string message)
        {
            #if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                {
                    var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                    var reactBridge = activity.Call<AndroidJavaObject>("getReactBridge");
                    if (reactBridge != null)
                    {
                        reactBridge.Call("sendMessageToReact", message);
                    }
                }
            }
            catch (Exception e)
            {
                LogDebug($"Android bridge error: {e.Message}");
            }
            #elif UNITY_IOS && !UNITY_EDITOR
            try
            {
                NativeBridge_SendToReact(message);
            }
            catch (Exception e)
            {
                LogDebug($"iOS bridge error: {e.Message}");
            }
            #endif
        }

        #if UNITY_IOS && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void NativeBridge_SendToReact(string message);
        #endif

        /// <summary>
        /// S-5: Debug-only logging (instance)
        /// </summary>
        [System.Diagnostics.Conditional("DEBUG")]
        private void LogDebug(string message)
        {
            Debug.Log($"[ExpoMessageSender] {message}");
        }

        /// <summary>
        /// S-5: Debug-only logging (static)
        /// </summary>
        [System.Diagnostics.Conditional("DEBUG")]
        private static void LogDebugStatic(string message)
        {
            Debug.Log($"[ExpoMessageSender] {message}");
        }

        /// <summary>
        /// S-5: Error logging (always enabled but sanitized in release)
        /// </summary>
        private void LogError(string message)
        {
            #if DEBUG
            Debug.LogError($"[ExpoMessageSender] {message}");
            #else
            Debug.LogError("[ExpoMessageSender] Send operation failed");
            #endif
        }
    }

    // Message structures for Unity → Expo communication
    [Serializable]
    public class HandshakeConfirmedMessage
    {
        public string type;
    }

    [Serializable]
    public class StateChangedMessage
    {
        public string type;
        public string state;
        public string profileId;
    }

    [Serializable]
    public class BlendCompleteMessage
    {
        public string type;
    }

    [Serializable]
    public class ErrorMessage
    {
        public string type;
        public string code;    // S-4: Error code for programmatic handling
        public string message; // S-4: User-safe message
    }
}
