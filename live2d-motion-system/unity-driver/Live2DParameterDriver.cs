using System;
using System.Collections.Generic;
using UnityEngine;
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;

namespace DivineHeros.Live2D
{
    /// <summary>
    /// Core Live2D parameter driver.
    /// Applies JSON motion profiles to Live2D model parameters.
    /// Contains NO baked animation curves - all motion is profile-driven.
    /// </summary>
    [RequireComponent(typeof(CubismModel))]
    public class Live2DParameterDriver : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Live2DMotionProfileLoader profileLoader;

        [Header("Runtime Settings")]
        [SerializeField] private float globalIntensityMultiplier = 1.0f;
        [SerializeField] private float globalSpeedMultiplier = 1.0f;
        [SerializeField] private bool enforceRatingClamps = true;

        // Live2D Model Reference
        private CubismModel _model;
        private Dictionary<string, CubismParameter> _parameterCache = new Dictionary<string, CubismParameter>();

        // Current State
        private Live2DMotionProfile _currentProfile;
        private Live2DMotionProfile _previousProfile;
        private float _profileTime = 0f;
        private float _blendProgress = 1f;
        private bool _isBlending = false;

        // Parameter state tracking
        private Dictionary<string, float> _currentValues = new Dictionary<string, float>();
        private Dictionary<string, float> _previousValues = new Dictionary<string, float>();

        // Events
        public event Action<Live2DMotionProfile> OnProfileChanged;
        public event Action OnMotionCycleComplete;

        // Public Properties
        public Live2DMotionProfile CurrentProfile => _currentProfile;
        public MotionState CurrentState => _currentProfile != null ? ParseState(_currentProfile.state) : MotionState.Idle;
        public float GlobalIntensity { get => globalIntensityMultiplier; set => globalIntensityMultiplier = Mathf.Clamp(value, 0f, 2f); }
        public float GlobalSpeed { get => globalSpeedMultiplier; set => globalSpeedMultiplier = Mathf.Clamp(value, 0.1f, 3f); }

        private void Awake()
        {
            _model = GetComponent<CubismModel>();
            CacheParameters();
        }

        private void Start()
        {
            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<Live2DMotionProfileLoader>();
            }

            // Load default idle profile
            if (profileLoader != null)
            {
                Live2DMotionProfile defaultProfile = profileLoader.GetDefaultProfileForState(MotionState.Idle);
                if (defaultProfile != null)
                {
                    SetProfile(defaultProfile, instant: true);
                }
            }
        }

        private void LateUpdate()
        {
            if (_currentProfile == null) return;

            // Update profile time
            float effectiveSpeed = _currentProfile.globalSpeed * globalSpeedMultiplier;
            _profileTime += Time.deltaTime * effectiveSpeed;

            // Handle looping
            if (_profileTime >= _currentProfile.duration)
            {
                if (_currentProfile.loop)
                {
                    _profileTime %= _currentProfile.duration;
                }
                else
                {
                    _profileTime = _currentProfile.duration;
                    OnMotionCycleComplete?.Invoke();
                }
            }

            // Update blend progress
            if (_isBlending && _currentProfile.blendInDuration > 0)
            {
                _blendProgress += Time.deltaTime / _currentProfile.blendInDuration;
                if (_blendProgress >= 1f)
                {
                    _blendProgress = 1f;
                    _isBlending = false;
                    _previousProfile = null;
                }
            }

            // Apply parameters
            ApplyMotionParameters();
        }

        /// <summary>
        /// Set the active motion profile.
        /// </summary>
        public void SetProfile(Live2DMotionProfile profile, bool instant = false)
        {
            if (profile == null)
            {
                Debug.LogWarning("[Live2D] Attempted to set null profile");
                return;
            }

            // Store current values for blending
            if (!instant && _currentProfile != null)
            {
                _previousProfile = _currentProfile;
                _previousValues = new Dictionary<string, float>(_currentValues);
                _blendProgress = 0f;
                _isBlending = true;
            }
            else
            {
                _blendProgress = 1f;
                _isBlending = false;
            }

            _currentProfile = profile;
            _profileTime = 0f;

            Debug.Log($"[Live2D] Profile changed to: {profile.id}");
            OnProfileChanged?.Invoke(profile);
        }

        /// <summary>
        /// Set profile by ID.
        /// </summary>
        public void SetProfileById(string profileId, bool instant = false)
        {
            if (profileLoader == null)
            {
                Debug.LogError("[Live2D] ProfileLoader not assigned");
                return;
            }

            Live2DMotionProfile profile = profileLoader.GetProfile(profileId);
            if (profile != null)
            {
                SetProfile(profile, instant);
            }
        }

        /// <summary>
        /// Set profile by motion state.
        /// </summary>
        public void SetState(MotionState state, bool instant = false)
        {
            if (profileLoader == null)
            {
                Debug.LogError("[Live2D] ProfileLoader not assigned");
                return;
            }

            Live2DMotionProfile profile = profileLoader.GetDefaultProfileForState(state);
            if (profile != null)
            {
                SetProfile(profile, instant);
            }
        }

        /// <summary>
        /// Cache Live2D parameter references.
        /// </summary>
        private void CacheParameters()
        {
            _parameterCache.Clear();

            if (_model == null || _model.Parameters == null) return;

            foreach (CubismParameter param in _model.Parameters)
            {
                _parameterCache[param.Id] = param;
            }

            Debug.Log($"[Live2D] Cached {_parameterCache.Count} parameters");
        }

        /// <summary>
        /// Apply motion parameters from the current profile.
        /// </summary>
        private void ApplyMotionParameters()
        {
            if (_currentProfile?.parameters == null) return;

            float effectiveIntensity = _currentProfile.globalIntensity * globalIntensityMultiplier;

            foreach (var kvp in _currentProfile.parameters)
            {
                string paramName = kvp.Key;
                ParameterMotion motion = kvp.Value;

                if (!motion.enabled) continue;
                if (!_parameterCache.TryGetValue(paramName, out CubismParameter param)) continue;

                // Calculate motion value
                float value = CalculateParameterValue(motion, effectiveIntensity);

                // Blend with previous value if transitioning
                if (_isBlending && _previousValues.TryGetValue(paramName, out float prevValue))
                {
                    value = Mathf.Lerp(prevValue, value, EaseValue(_blendProgress, EasingType.EaseInOut));
                }

                // Apply rating-safe clamps
                if (enforceRatingClamps && _currentProfile.ratingClamps != null)
                {
                    value = ApplyRatingClamp(paramName, value);
                }

                // Apply final clamps from motion definition
                value = Mathf.Clamp(value, motion.minClamp, motion.maxClamp);

                // Store and apply
                _currentValues[paramName] = value;
                param.Value = value;
            }
        }

        /// <summary>
        /// Calculate the current value for a parameter based on motion definition.
        /// </summary>
        private float CalculateParameterValue(ParameterMotion motion, float intensity)
        {
            float normalizedTime = _profileTime / _currentProfile.duration;
            float waveTime = normalizedTime * motion.speed * _currentProfile.globalSpeed * globalSpeedMultiplier;
            waveTime += motion.phase;

            // Get waveform value
            float waveValue = GetWaveformValue(ParseWaveform(motion.waveform), waveTime);

            // Apply easing
            float easedValue = EaseValue(waveValue * 0.5f + 0.5f, ParseEasing(motion.easing));
            easedValue = (easedValue - 0.5f) * 2f; // Back to -1 to 1 range

            // Apply amplitude and intensity
            float finalValue = motion.baseValue + (easedValue * motion.amplitude * intensity);

            return finalValue;
        }

        /// <summary>
        /// Get waveform value at a given time.
        /// </summary>
        private float GetWaveformValue(WaveformType waveform, float time)
        {
            float t = time * Mathf.PI * 2f;

            switch (waveform)
            {
                case WaveformType.Sine:
                    return Mathf.Sin(t);

                case WaveformType.Triangle:
                    return Mathf.PingPong(time * 2f, 1f) * 2f - 1f;

                case WaveformType.Square:
                    return Mathf.Sin(t) >= 0 ? 1f : -1f;

                case WaveformType.Sawtooth:
                    return (time % 1f) * 2f - 1f;

                case WaveformType.Noise:
                    return Mathf.PerlinNoise(time * 10f, 0f) * 2f - 1f;

                default:
                    return Mathf.Sin(t);
            }
        }

        /// <summary>
        /// Apply easing function.
        /// </summary>
        private float EaseValue(float t, EasingType easing)
        {
            t = Mathf.Clamp01(t);

            switch (easing)
            {
                case EasingType.Linear:
                    return t;

                case EasingType.Sine:
                    return Mathf.Sin(t * Mathf.PI * 0.5f);

                case EasingType.EaseIn:
                    return t * t;

                case EasingType.EaseOut:
                    return 1f - (1f - t) * (1f - t);

                case EasingType.EaseInOut:
                    return t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;

                case EasingType.Bounce:
                    return BounceEase(t);

                case EasingType.Elastic:
                    return ElasticEase(t);

                default:
                    return t;
            }
        }

        private float BounceEase(float t)
        {
            if (t < 1f / 2.75f) return 7.5625f * t * t;
            if (t < 2f / 2.75f) { t -= 1.5f / 2.75f; return 7.5625f * t * t + 0.75f; }
            if (t < 2.5f / 2.75f) { t -= 2.25f / 2.75f; return 7.5625f * t * t + 0.9375f; }
            t -= 2.625f / 2.75f;
            return 7.5625f * t * t + 0.984375f;
        }

        private float ElasticEase(float t)
        {
            if (t == 0f || t == 1f) return t;
            return -Mathf.Pow(2f, 10f * t - 10f) * Mathf.Sin((t * 10f - 10.75f) * ((2f * Mathf.PI) / 3f));
        }

        /// <summary>
        /// Apply rating-safe clamps to sensitive parameters.
        /// </summary>
        private float ApplyRatingClamp(string paramName, float value)
        {
            RatingClamps clamps = _currentProfile.ratingClamps;
            if (clamps == null) return value;

            switch (paramName)
            {
                case "ParamChestSoftX":
                    if (clamps.ParamChestSoftX != null)
                        return Mathf.Clamp(value, clamps.ParamChestSoftX.min, clamps.ParamChestSoftX.max);
                    break;
                case "ParamChestSoftY":
                    if (clamps.ParamChestSoftY != null)
                        return Mathf.Clamp(value, clamps.ParamChestSoftY.min, clamps.ParamChestSoftY.max);
                    break;
                case "ParamAbdomenSoft":
                    if (clamps.ParamAbdomenSoft != null)
                        return Mathf.Clamp(value, clamps.ParamAbdomenSoft.min, clamps.ParamAbdomenSoft.max);
                    break;
                case "ParamPelvisShift":
                    if (clamps.ParamPelvisShift != null)
                        return Mathf.Clamp(value, clamps.ParamPelvisShift.min, clamps.ParamPelvisShift.max);
                    break;
            }

            return value;
        }

        /// <summary>
        /// Parse state string to enum.
        /// </summary>
        private MotionState ParseState(string state)
        {
            if (Enum.TryParse<MotionState>(state, true, out MotionState result))
            {
                return result;
            }
            return MotionState.Idle;
        }

        /// <summary>
        /// Parse easing string to enum.
        /// </summary>
        private EasingType ParseEasing(string easing)
        {
            switch (easing?.ToLower())
            {
                case "linear": return EasingType.Linear;
                case "sine": return EasingType.Sine;
                case "ease_in": return EasingType.EaseIn;
                case "ease_out": return EasingType.EaseOut;
                case "ease_in_out": return EasingType.EaseInOut;
                case "bounce": return EasingType.Bounce;
                case "elastic": return EasingType.Elastic;
                default: return EasingType.Sine;
            }
        }

        /// <summary>
        /// Parse waveform string to enum.
        /// </summary>
        private WaveformType ParseWaveform(string waveform)
        {
            switch (waveform?.ToLower())
            {
                case "sine": return WaveformType.Sine;
                case "triangle": return WaveformType.Triangle;
                case "square": return WaveformType.Square;
                case "sawtooth": return WaveformType.Sawtooth;
                case "noise": return WaveformType.Noise;
                default: return WaveformType.Sine;
            }
        }
    }
}