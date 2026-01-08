using System;
using System.Collections.Generic;
using UnityEngine;

namespace DivineHeros.Live2D
{
    /// <summary>
    /// Engine-agnostic motion profile data structure.
    /// Populated from JSON - contains no Unity-specific animation logic.
    /// </summary>
    [Serializable]
    public class Live2DMotionProfile
    {
        public string id;
        public string version;
        public string state;
        public float duration;
        public bool loop;
        public float globalIntensity;
        public float globalSpeed;
        public float blendInDuration;
        public float blendOutDuration;
        public Dictionary<string, ParameterMotion> parameters;
        public RatingClamps ratingClamps;
        public ProfileMetadata metadata;
    }

    [Serializable]
    public class ParameterMotion
    {
        public bool enabled = true;
        public float amplitude;
        public float speed;
        public float phase;
        public string easing;
        public string waveform;
        public float baseValue;
        public float minClamp;
        public float maxClamp;
    }

    [Serializable]
    public class RatingClamps
    {
        public ClampRange ParamChestSoftX;
        public ClampRange ParamChestSoftY;
        public ClampRange ParamAbdomenSoft;
        public ClampRange ParamPelvisShift;
    }

    [Serializable]
    public class ClampRange
    {
        public float min;
        public float max;
    }

    [Serializable]
    public class ProfileMetadata
    {
        public string author;
        public string created;
        public string description;
        public string[] tags;
    }

    /// <summary>
    /// Motion state enumeration matching JSON schema.
    /// </summary>
    public enum MotionState
    {
        Idle,
        Combat,
        Banner,
        Summon,
        Victory,
        Defeat
    }

    /// <summary>
    /// Easing function types.
    /// </summary>
    public enum EasingType
    {
        Linear,
        Sine,
        EaseIn,
        EaseOut,
        EaseInOut,
        Bounce,
        Elastic
    }

    /// <summary>
    /// Waveform types for oscillation.
    /// </summary>
    public enum WaveformType
    {
        Sine,
        Triangle,
        Square,
        Sawtooth,
        Noise
    }
}