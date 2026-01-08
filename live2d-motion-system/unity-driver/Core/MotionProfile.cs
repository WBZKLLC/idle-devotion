// =============================================================================
// Live2D Motion Profile Data Structures
// JSON-to-C# mapping for motion profile schema v2.0
// =============================================================================

using System;
using System.Collections.Generic;
using UnityEngine;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// Motion state categories matching JSON schema
    /// </summary>
    public enum MotionState
    {
        Idle,
        Combat,
        Banner,
        Summon,
        Victory,
        Defeat,
        Dialogue,
        Special
    }

    /// <summary>
    /// Waveform types for parameter oscillation
    /// NOTE: Square and Sawtooth are NON-RECOMMENDED (debug/stylized use only)
    /// </summary>
    public enum WaveformType
    {
        Sine,       // ✅ Recommended - Natural breathing, sway
        Cosine,     // ✅ Recommended - Paired motion
        Perlin,     // ✅ Recommended - Natural randomness (low freq only)
        Triangle,   // ⚠️ Use sparingly - Mechanical motion
        Sawtooth,   // ⛔ NON-RECOMMENDED - Debug only
        Square      // ⛔ NON-RECOMMENDED - Debug only
    }

    /// <summary>
    /// Easing function types
    /// </summary>
    public enum EasingType
    {
        Linear,
        EaseIn,
        EaseOut,
        EaseInOut,
        EaseInQuad,
        EaseOutQuad,
        EaseInCubic,
        EaseOutCubic,
        Elastic,
        Bounce
    }

    /// <summary>
    /// Blend curve types for transitions
    /// </summary>
    public enum BlendCurve
    {
        Linear,
        EaseIn,
        EaseOut,
        EaseInOut,
        SmoothStep
    }

    /// <summary>
    /// Clamp range for rating-safe limits
    /// </summary>
    [Serializable]
    public struct ClampRange
    {
        public float min;
        public float max;

        public float Clamp(float value)
        {
            return Mathf.Clamp(value, min, max);
        }
    }

    /// <summary>
    /// Randomization settings for natural variation
    /// </summary>
    [Serializable]
    public class RandomizeSettings
    {
        public float amplitudeVariance = 0f;
        public float frequencyVariance = 0f;
        public int seed = 0;
    }

    /// <summary>
    /// Motion definition for a single Live2D parameter
    /// </summary>
    [Serializable]
    public class ParameterMotion
    {
        public bool enabled = true;
        public float amplitude = 0f;
        public float frequency = 0.5f;  // Hz (cycles per second)
        public float phase = 0f;         // Radians (0 to 2π)
        public WaveformType waveform = WaveformType.Sine;
        public EasingType easing = EasingType.Linear;
        public float baseValue = 0f;
        public float minClamp = -1f;
        public float maxClamp = 1f;
        public RandomizeSettings randomize;

        // Runtime state
        [NonSerialized] public float runtimeAmplitudeOffset = 0f;
        [NonSerialized] public float runtimeFrequencyOffset = 0f;
    }

    /// <summary>
    /// Global modifiers applied to all parameters
    /// </summary>
    [Serializable]
    public class GlobalModifiers
    {
        public float intensity = 1f;  // 0.0 to 2.0
        public float speed = 1f;      // 0.1 to 3.0
    }

    /// <summary>
    /// Transition blending configuration
    /// </summary>
    [Serializable]
    public class BlendingConfig
    {
        public float blendInDuration = 0.5f;
        public float blendOutDuration = 0.5f;
        public BlendCurve blendCurve = BlendCurve.EaseInOut;
    }

    /// <summary>
    /// Rating-safe clamps - MANDATORY enforcement
    /// </summary>
    [Serializable]
    public class RatingClamps
    {
        public ClampRange ParamChestSoftX = new ClampRange { min = -0.3f, max = 0.3f };
        public ClampRange ParamChestSoftY = new ClampRange { min = -0.3f, max = 0.3f };
        public ClampRange ParamAbdomenSoft = new ClampRange { min = -0.2f, max = 0.2f };
        public ClampRange ParamPelvisShift = new ClampRange { min = -0.15f, max = 0.15f };

        /// <summary>
        /// Get clamp range for a parameter, returns null if not rating-clamped
        /// </summary>
        public ClampRange? GetClamp(string parameterName)
        {
            switch (parameterName)
            {
                case "ParamChestSoftX": return ParamChestSoftX;
                case "ParamChestSoftY": return ParamChestSoftY;
                case "ParamAbdomenSoft": return ParamAbdomenSoft;
                case "ParamPelvisShift": return ParamPelvisShift;
                default: return null;
            }
        }
    }

    /// <summary>
    /// Conditions for profile activation
    /// </summary>
    [Serializable]
    public class ProfileConditions
    {
        public string[] rarity = new string[0];
        public string[] heroClass = new string[0];
        public string[] heroIds = new string[0];
    }

    /// <summary>
    /// Profile metadata
    /// </summary>
    [Serializable]
    public class ProfileMetadata
    {
        public string author;
        public string created;
        public string modified;
        public string description;
        public string[] tags;
    }

    /// <summary>
    /// Complete motion profile - maps directly to JSON schema v2.0
    /// </summary>
    [Serializable]
    public class MotionProfile
    {
        public string id;
        public string schemaVersion = "2.0.0";
        public MotionState state;
        public int priority = 50;
        public float duration = 4f;
        public bool loop = true;
        public int loopCount = 0;
        public GlobalModifiers globalModifiers = new GlobalModifiers();
        public BlendingConfig blending = new BlendingConfig();
        public Dictionary<string, ParameterMotion> parameters = new Dictionary<string, ParameterMotion>();
        public RatingClamps ratingClamps = new RatingClamps();
        public ProfileConditions conditions;
        public ProfileMetadata metadata;

        /// <summary>
        /// Validate profile against schema requirements
        /// </summary>
        public bool Validate(out string error)
        {
            if (string.IsNullOrEmpty(id))
            {
                error = "Profile ID is required";
                return false;
            }

            if (schemaVersion != "2.0.0")
            {
                error = $"Unsupported schema version: {schemaVersion}";
                return false;
            }

            if (duration < 0.1f || duration > 60f)
            {
                error = $"Duration must be between 0.1 and 60 seconds, got {duration}";
                return false;
            }

            if (globalModifiers.intensity < 0f || globalModifiers.intensity > 2f)
            {
                error = $"Global intensity must be between 0.0 and 2.0, got {globalModifiers.intensity}";
                return false;
            }

            if (globalModifiers.speed < 0.1f || globalModifiers.speed > 3f)
            {
                error = $"Global speed must be between 0.1 and 3.0, got {globalModifiers.speed}";
                return false;
            }

            // Validate rating clamps are present
            if (ratingClamps == null)
            {
                error = "Rating clamps are MANDATORY";
                return false;
            }

            error = null;
            return true;
        }
    }
}
