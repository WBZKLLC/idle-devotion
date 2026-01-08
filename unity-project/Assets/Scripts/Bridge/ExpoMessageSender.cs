// =============================================================================
// ExpoMessageSender.cs
// Phase 6: Sends status messages from Unity back to Expo
// 
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// =============================================================================

using System;
using UnityEngine;

namespace Live2DMotion.Bridge
{
    /// <summary>
    /// Sends status messages from Unity to Expo/React Native.
    /// 
    /// RESPONSIBILITIES:
    /// - Send STATE_CHANGED confirmations
    /// - Send BLEND_COMPLETE notifications
    /// - Send ERROR messages
    /// 
    /// PROHIBITED:
    /// - Sending animation data to Expo
    /// - Sending parameter values to Expo
    /// - Sending profile contents to Expo
    /// </summary>
    public class ExpoMessageSender : MonoBehaviour
    {
        // Singleton for easy access
        public static ExpoMessageSender Instance { get; private set; }

        // Native bridge callback - set by react-native-unity or custom native module
        private static Action<string> _nativeCallback;

        [Header("Debug")]
        [SerializeField] private bool logAllMessages = true;

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
        /// Register the native callback for sending messages to Expo.
        /// Called during bridge initialization.
        /// </summary>
        public static void RegisterNativeCallback(Action<string> callback)
        {
            _nativeCallback = callback;
            Debug.Log("[ExpoMessageSender] Native callback registered");
        }

        /// <summary>
        /// Send state change confirmation to Expo.
        /// Called by MotionStateController after successful state transition.
        /// </summary>
        public void SendStateChanged(string state, string profileId)
        {
            var message = new StateChangedMessage
            {
                type = "STATE_CHANGED",
                state = state,
                profileId = profileId
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
        /// Send error message to Expo.
        /// </summary>
        public void SendError(string errorMessage)
        {
            var message = new ErrorMessage
            {
                type = "ERROR",
                message = errorMessage
            };

            SendToExpo(JsonUtility.ToJson(message));
        }

        private void SendToExpo(string jsonMessage)
        {
            if (logAllMessages)
            {
                Debug.Log($"[ExpoMessageSender] Sending: {jsonMessage}");
            }

            if (_nativeCallback != null)
            {
                try
                {
                    _nativeCallback(jsonMessage);
                }
                catch (Exception e)
                {
                    Debug.LogError($"[ExpoMessageSender] Failed to send: {e.Message}");
                }
            }
            else
            {
                // Fallback: Use Unity's SendMessage for react-native-unity compatibility
                // The native module listens for "N_SEND_MSG" messages
                try
                {
                    // This is the standard way react-native-unity receives messages
                    // It will be picked up by onUnityMessage callback in React Native
                    #if UNITY_ANDROID || UNITY_IOS
                    SendMessageToReactNative(jsonMessage);
                    #endif
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"[ExpoMessageSender] Fallback send failed: {e.Message}");
                }
            }
        }

        /// <summary>
        /// Platform-specific message sending to React Native.
        /// This method is called by react-native-unity to receive messages.
        /// </summary>
        private void SendMessageToReactNative(string message)
        {
            #if UNITY_ANDROID && !UNITY_EDITOR
            using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
            {
                var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                var reactBridge = activity.Call<AndroidJavaObject>("getReactBridge");
                if (reactBridge != null)
                {
                    reactBridge.Call("sendMessageToReact", message);
                }
            }
            #elif UNITY_IOS && !UNITY_EDITOR
            // iOS bridge implementation would go here
            // Typically uses a native plugin to call Objective-C/Swift
            NativeBridge_SendToReact(message);
            #endif
        }

        #if UNITY_IOS && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void NativeBridge_SendToReact(string message);
        #endif
    }

    // Message structures for Unity → Expo communication
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
        public string message;
    }
}
