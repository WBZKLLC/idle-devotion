// =============================================================================
// Live2D Parameter Driver
// Core component that applies motion profiles to Live2D Cubism model
// =============================================================================

using System.Collections.Generic;
using UnityEngine;
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// Drives Live2D parameters from JSON motion profiles
    /// All motion is JSON-driven - no editor-authored animation data
    /// HARD RULE: Runtime offsets are TRANSIENT and cleared on state change
    /// </summary>
    [RequireComponent(typeof(CubismModel))]
    public class MotionParameterDriver : MonoBehaviour
    {
        [Header("Dependencies")]
        [SerializeField] private MotionProfileLoader profileLoader;

        [Header("Configuration")]
        [Tooltip("Override global intensity (0 = use profile default)")]
        [Range(0f, 2f)]
        public float intensityOverride = 0f;

        [Tooltip("Override global speed (0 = use profile default)")]
        [Range(0f, 3f)]
        public float speedOverride = 0f;

        [Header("Debug")]
        [SerializeField] private bool debugMode = false;
        [SerializeField] private string currentProfileId = "";
        [SerializeField] private float currentTime = 0f;

        // Live2D references
        private CubismModel cubismModel;
        private Dictionary<string, CubismParameter> parameterCache = new Dictionary<string, CubismParameter>();

        // Current state
        private MotionProfile currentProfile;
        private MotionProfile previousProfile;
        private float profileTime = 0f;
        private float blendProgress = 1f;  // 1 = fully on current profile
        private bool isBlending = false;
        private float blendDuration = 0.5f;
        private BlendCurve blendCurve = BlendCurve.EaseInOut;

        // TRANSIENT runtime offsets - cleared on every state change
        // HARD RULE: These NEVER mutate profile data
        private Dictionary<string, RuntimeParameterOffsets> runtimeOffsets = new Dictionary<string, RuntimeParameterOffsets>();

        // Rating clamp logging
        private HashSet<string> loggedClampViolations = new HashSet<string>();

        /// <summary>
        /// Current active profile
        /// </summary>
        public MotionProfile CurrentProfile => currentProfile;

        /// <summary>
        /// Whether currently blending between profiles
        /// </summary>
        public bool IsBlending => isBlending;

        private void Awake()
        {
            cubismModel = GetComponent<CubismModel>();
            CacheParameters();

            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<MotionProfileLoader>();
            }
        }

        private void Start()
        {
            if (profileLoader != null && profileLoader.IsInitialized)
            {
                // Load default idle profile
                SetProfile(MotionState.Idle);
            }
            else if (profileLoader != null)
            {
                profileLoader.OnProfilesLoaded += OnProfilesLoaded;
            }
        }

        private void OnDestroy()
        {
            if (profileLoader != null)
            {
                profileLoader.OnProfilesLoaded -= OnProfilesLoaded;
            }
        }

        private void OnProfilesLoaded(int count)
        {
            // Load default idle profile
            SetProfile(MotionState.Idle);
        }

        /// <summary>
        /// Cache Live2D parameter references for performance
        /// </summary>
        private void CacheParameters()
        {
            parameterCache.Clear();

            if (cubismModel == null || cubismModel.Parameters == null) return;

            foreach (var param in cubismModel.Parameters)
            {
                if (param != null && !string.IsNullOrEmpty(param.Id))
                {
                    parameterCache[param.Id] = param;
                }
            }

            if (debugMode)
            {
                Debug.Log($"[MotionParameterDriver] Cached {parameterCache.Count} parameters");
            }
        }

        /// <summary>
        /// Set profile by state (resolves best profile)
        /// </summary>
        public void SetProfile(MotionState state, string heroId = null, string heroClass = null, string rarity = null)
        {
            if (profileLoader == null) return;

            MotionProfile profile = profileLoader.ResolveProfile(state, heroId, heroClass, rarity);
            if (profile != null)
            {
                SetProfile(profile);
            }
            else
            {
                Debug.LogWarning($"[MotionParameterDriver] No profile found for state: {state}");
            }
        }

        /// <summary>
        /// Set profile by ID
        /// </summary>
        public void SetProfileById(string profileId)
        {
            if (profileLoader == null) return;

            MotionProfile profile = profileLoader.GetProfileById(profileId);
            if (profile != null)
            {
                SetProfile(profile);
            }
            else
            {
                Debug.LogWarning($"[MotionParameterDriver] Profile not found: {profileId}");
            }
        }

        /// <summary>
        /// Set profile directly
        /// HARD RULE: Clears all transient runtime offsets on state change
        /// </summary>
        public void SetProfile(MotionProfile profile)
        {
            if (profile == null) return;

            // HARD RULE: Clear ALL transient runtime offsets on state change
            // Offsets must NEVER persist across profiles or mutate profile data
            ClearRuntimeOffsets();

            // Initialize new transient offsets for randomization (NOT stored on profile)
            InitializeRuntimeOffsets(profile);

            // Start blend transition
            if (currentProfile != null && currentProfile != profile)
            {
                previousProfile = currentProfile;
                blendProgress = 0f;
                isBlending = true;
                blendDuration = profile.blending.blendInDuration;
                blendCurve = profile.blending.blendCurve;
            }

            currentProfile = profile;
            currentProfileId = profile.id;
            profileTime = 0f;

            if (debugMode)
            {
                Debug.Log($"[MotionParameterDriver] Set profile: {profile.id} (state: {profile.state}). Runtime offsets cleared and reinitialized.");
            }
        }

        /// <summary>
        /// HARD RULE: Clear all transient runtime offsets
        /// Called on EVERY state change
        /// </summary>
        private void ClearRuntimeOffsets()
        {
            runtimeOffsets.Clear();

            if (debugMode)
            {
                Debug.Log("[MotionParameterDriver] Runtime offsets CLEARED (state change)");
            }
        }

        /// <summary>
        /// Initialize transient runtime offsets for randomization
        /// These are stored SEPARATELY from profile data
        /// </summary>
        private void InitializeRuntimeOffsets(MotionProfile profile)
        {
            foreach (var kvp in profile.parameters)
            {
                string paramName = kvp.Key;
                ParameterMotion motion = kvp.Value;

                RuntimeParameterOffsets offsets = RuntimeParameterOffsets.Zero;

                if (motion.randomize != null)
                {
                    System.Random rng = motion.randomize.seed > 0
                        ? new System.Random(motion.randomize.seed)
                        : new System.Random();

                    if (motion.randomize.amplitudeVariance > 0)
                    {
                        float variance = motion.randomize.amplitudeVariance;
                        offsets.amplitudeOffset = ((float)rng.NextDouble() * 2f - 1f) * variance;
                    }

                    if (motion.randomize.frequencyVariance > 0)
                    {
                        float variance = motion.randomize.frequencyVariance;
                        offsets.frequencyOffset = ((float)rng.NextDouble() * 2f - 1f) * variance;
                    }
                }

                runtimeOffsets[paramName] = offsets;
            }
        }

        /// <summary>
        /// Get runtime offsets for a parameter (transient, not profile data)
        /// </summary>
        private RuntimeParameterOffsets GetRuntimeOffsets(string paramName)
        {
            if (runtimeOffsets.TryGetValue(paramName, out RuntimeParameterOffsets offsets))
            {
                return offsets;
            }
            return RuntimeParameterOffsets.Zero;
        }

        /// <summary>
        /// Update is called in LateUpdate to apply after Cubism updates
        /// </summary>
        private void LateUpdate()
        {
            if (currentProfile == null) return;

            float deltaTime = Time.deltaTime;
            profileTime += deltaTime;
            currentTime = profileTime;

            // Update blend progress
            if (isBlending)
            {
                blendProgress += deltaTime / blendDuration;
                if (blendProgress >= 1f)
                {
                    blendProgress = 1f;
                    isBlending = false;
                    previousProfile = null;
                }
            }

            // Handle looping
            if (currentProfile.loop && currentProfile.duration > 0)
            {
                if (currentProfile.loopCount > 0)
                {
                    int currentLoop = Mathf.FloorToInt(profileTime / currentProfile.duration);
                    if (currentLoop >= currentProfile.loopCount)
                    {
                        // Stop at end
                        profileTime = currentProfile.duration * currentProfile.loopCount;
                    }
                    else
                    {
                        profileTime = profileTime % currentProfile.duration;
                    }
                }
                else
                {
                    // Infinite loop
                    profileTime = profileTime % currentProfile.duration;
                }
            }

            // Apply parameters
            ApplyProfileParameters();
        }

        /// <summary>
        /// Apply all profile parameters to Live2D model
        /// </summary>
        private void ApplyProfileParameters()
        {
            // Get global modifiers (with overrides)
            float globalIntensity = intensityOverride > 0 ? intensityOverride : currentProfile.globalModifiers.intensity;
            float globalSpeed = speedOverride > 0 ? speedOverride : currentProfile.globalModifiers.speed;

            // Calculate blend factor
            float blendFactor = isBlending ? WaveformSolver.ApplyBlendCurve(blendCurve, blendProgress) : 1f;

            // Apply each parameter
            foreach (var kvp in currentProfile.parameters)
            {
                string paramName = kvp.Key;
                ParameterMotion motion = kvp.Value;

                // Calculate current profile value
                float currentValue = WaveformSolver.CalculateParameterValue(
                    motion, profileTime, globalIntensity, globalSpeed);

                // Blend with previous profile if transitioning
                float finalValue = currentValue;
                if (isBlending && previousProfile != null && previousProfile.parameters.TryGetValue(paramName, out ParameterMotion prevMotion))
                {
                    float prevGlobalIntensity = previousProfile.globalModifiers.intensity;
                    float prevGlobalSpeed = previousProfile.globalModifiers.speed;

                    float previousValue = WaveformSolver.CalculateParameterValue(
                        prevMotion, profileTime, prevGlobalIntensity, prevGlobalSpeed);

                    finalValue = Mathf.Lerp(previousValue, currentValue, blendFactor);
                }

                // Apply rating-safe clamps (MANDATORY)
                finalValue = ApplyRatingClamp(paramName, finalValue);

                // Apply to Live2D parameter
                SetParameter(paramName, finalValue);
            }

            // Handle parameters that exist in previous profile but not current (during blend)
            if (isBlending && previousProfile != null)
            {
                foreach (var kvp in previousProfile.parameters)
                {
                    if (!currentProfile.parameters.ContainsKey(kvp.Key))
                    {
                        // Blend to base value
                        ParameterMotion prevMotion = kvp.Value;
                        float prevValue = WaveformSolver.CalculateParameterValue(
                            prevMotion, profileTime,
                            previousProfile.globalModifiers.intensity,
                            previousProfile.globalModifiers.speed);

                        float finalValue = Mathf.Lerp(prevValue, prevMotion.baseValue, blendFactor);
                        finalValue = ApplyRatingClamp(kvp.Key, finalValue);
                        SetParameter(kvp.Key, finalValue);
                    }
                }
            }
        }

        /// <summary>
        /// Apply rating-safe clamp to parameter value
        /// MANDATORY - enforced at runtime, not advisory
        /// </summary>
        private float ApplyRatingClamp(string paramName, float value)
        {
            if (currentProfile?.ratingClamps == null) return value;

            ClampRange? clampRange = currentProfile.ratingClamps.GetClamp(paramName);
            if (clampRange.HasValue)
            {
                float clamped = clampRange.Value.Clamp(value);

                // Log violations for QA detection
                if (debugMode && Mathf.Abs(clamped - value) > 0.001f)
                {
                    if (!loggedClampViolations.Contains(paramName))
                    {
                        Debug.LogWarning($"[RatingClamp] {paramName} value {value:F3} clamped to {clamped:F3}");
                        loggedClampViolations.Add(paramName);
                    }
                }

                return clamped;
            }

            return value;
        }

        /// <summary>
        /// Set a Live2D parameter value
        /// </summary>
        private void SetParameter(string paramName, float value)
        {
            if (parameterCache.TryGetValue(paramName, out CubismParameter param))
            {
                param.Value = value;
            }
            else if (debugMode)
            {
                // Only log once per parameter
                if (!loggedClampViolations.Contains("missing_" + paramName))
                {
                    Debug.LogWarning($"[MotionParameterDriver] Parameter not found on model: {paramName}");
                    loggedClampViolations.Add("missing_" + paramName);
                }
            }
        }

        /// <summary>
        /// Reset to idle state
        /// </summary>
        public void ResetToIdle()
        {
            SetProfile(MotionState.Idle);
        }

        /// <summary>
        /// Stop all motion (parameters at base values)
        /// </summary>
        public void StopMotion()
        {
            currentProfile = null;
            previousProfile = null;
            isBlending = false;
            currentProfileId = "";
        }
    }
}
