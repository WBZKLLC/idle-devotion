// =============================================================================
// ReactNativeUnityBridge.cs
// Phase 6: Integration layer for react-native-unity package
// 
// This script provides the entry points that react-native-unity calls.
// CONSTRAINT: This file is NEW - does NOT modify Phase 3 Core/*.cs files
// =============================================================================

using UnityEngine;
using Live2DMotion.Bridge;

namespace Live2DMotion.Integration
{
    /// <summary>
    /// Entry point for react-native-unity package integration.
    /// 
    /// The react-native-unity package calls methods on a GameObject named
    /// "ReactNativeUnity" using Unity's SendMessage API.
    /// 
    /// This script must be attached to a GameObject named "ReactNativeUnity"
    /// in the scene for the bridge to work.
    /// </summary>
    public class ReactNativeUnityBridge : MonoBehaviour
    {
        [Header("Debug")]
        [SerializeField] private bool logAllCalls = true;

        private void Awake()
        {
            // Ensure this GameObject has the correct name for react-native-unity
            if (gameObject.name != "ReactNativeUnity")
            {
                Debug.LogWarning(
                    $"[ReactNativeUnityBridge] GameObject should be named 'ReactNativeUnity' " +
                    $"for react-native-unity compatibility. Current name: {gameObject.name}"
                );
            }

            DontDestroyOnLoad(gameObject);
        }

        /// <summary>
        /// Called by react-native-unity when UnityModule.postMessage() is invoked.
        /// This is the standard entry point for the package.
        /// 
        /// Format: postMessage(gameObject, methodName, message)
        /// When gameObject is "ReactNativeUnity" and methodName is "ReceiveMessage",
        /// this method is called with the message string.
        /// </summary>
        /// <param name="message">JSON message from Expo</param>
        public void ReceiveMessage(string message)
        {
            if (logAllCalls)
            {
                Debug.Log($"[ReactNativeUnityBridge] ReceiveMessage: {message}");
            }

            // Forward to the ExpoMessageReceiver
            if (ExpoMessageReceiver.Instance != null)
            {
                ExpoMessageReceiver.Instance.OnExpoMessage(message);
            }
            else
            {
                Debug.LogError("[ReactNativeUnityBridge] ExpoMessageReceiver.Instance is null!");
            }
        }

        /// <summary>
        /// Alternative method name for compatibility with different bridge configurations.
        /// Some implementations use "N_RECV_MSG" as the method name.
        /// </summary>
        public void N_RECV_MSG(string message)
        {
            ReceiveMessage(message);
        }

        /// <summary>
        /// Called when the Unity view is ready.
        /// Useful for initialization that depends on the React Native side.
        /// </summary>
        public void OnUnityReady(string payload)
        {
            if (logAllCalls)
            {
                Debug.Log($"[ReactNativeUnityBridge] OnUnityReady: {payload}");
            }

            // Notify Expo that Unity is ready
            ExpoMessageSender.Instance?.SendStateChanged("idle", "unity_ready");
        }
    }
}
