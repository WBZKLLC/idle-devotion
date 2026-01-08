// =============================================================================
// Live2D Motion Profile Loader
// Loads and validates JSON motion profiles from Resources
// =============================================================================

using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// Loads and manages motion profiles from JSON files
    /// JSON is the SINGLE SOURCE OF TRUTH - no editor-authored motion data
    /// </summary>
    public class MotionProfileLoader : MonoBehaviour
    {
        [Header("Configuration")]
        [Tooltip("Resource path to motion profiles folder")]
        public string profilesResourcePath = "Live2D/MotionProfiles/v2";

        [Header("Runtime State")]
        [SerializeField] private int loadedProfileCount = 0;
        [SerializeField] private bool isInitialized = false;

        // Profile storage
        private Dictionary<string, MotionProfile> profilesById = new Dictionary<string, MotionProfile>();
        private Dictionary<MotionState, List<MotionProfile>> profilesByState = new Dictionary<MotionState, List<MotionProfile>>();

        // Events
        public event Action<int> OnProfilesLoaded;
        public event Action<string> OnLoadError;

        /// <summary>
        /// Whether profiles have been loaded
        /// </summary>
        public bool IsInitialized => isInitialized;

        /// <summary>
        /// Number of loaded profiles
        /// </summary>
        public int ProfileCount => loadedProfileCount;

        private void Awake()
        {
            InitializeStateIndex();
        }

        private void Start()
        {
            LoadAllProfiles();
        }

        private void InitializeStateIndex()
        {
            foreach (MotionState state in Enum.GetValues(typeof(MotionState)))
            {
                profilesByState[state] = new List<MotionProfile>();
            }
        }

        /// <summary>
        /// Load all motion profiles from Resources
        /// </summary>
        public void LoadAllProfiles()
        {
            profilesById.Clear();
            foreach (var list in profilesByState.Values)
            {
                list.Clear();
            }

            loadedProfileCount = 0;

            // Load all JSON files from resources
            TextAsset[] profileAssets = Resources.LoadAll<TextAsset>(profilesResourcePath);

            if (profileAssets == null || profileAssets.Length == 0)
            {
                Debug.LogWarning($"[MotionProfileLoader] No profiles found at Resources/{profilesResourcePath}");
                OnLoadError?.Invoke($"No profiles found at {profilesResourcePath}");
                return;
            }

            foreach (TextAsset asset in profileAssets)
            {
                try
                {
                    LoadProfileFromJson(asset.text, asset.name);
                }
                catch (Exception e)
                {
                    Debug.LogError($"[MotionProfileLoader] Failed to load profile '{asset.name}': {e.Message}");
                    OnLoadError?.Invoke($"Failed to load {asset.name}: {e.Message}");
                }
            }

            isInitialized = true;
            Debug.Log($"[MotionProfileLoader] Loaded {loadedProfileCount} motion profiles");
            OnProfilesLoaded?.Invoke(loadedProfileCount);
        }

        /// <summary>
        /// Load a single profile from JSON string
        /// </summary>
        public MotionProfile LoadProfileFromJson(string json, string sourceName = "unknown")
        {
            // Parse JSON to intermediate format
            var jsonProfile = JsonUtility.FromJson<JsonMotionProfile>(json);
            
            if (jsonProfile == null)
            {
                throw new Exception("Failed to parse JSON");
            }

            // Convert to runtime profile
            MotionProfile profile = ConvertFromJson(jsonProfile);

            // Validate
            if (!profile.Validate(out string error))
            {
                throw new Exception($"Validation failed: {error}");
            }

            // Register profile
            RegisterProfile(profile);

            return profile;
        }

        /// <summary>
        /// Register a profile in the lookup tables
        /// </summary>
        private void RegisterProfile(MotionProfile profile)
        {
            // Store by ID (overwrite if duplicate)
            if (profilesById.ContainsKey(profile.id))
            {
                Debug.LogWarning($"[MotionProfileLoader] Overwriting existing profile: {profile.id}");
            }
            profilesById[profile.id] = profile;

            // Store by state
            if (!profilesByState.ContainsKey(profile.state))
            {
                profilesByState[profile.state] = new List<MotionProfile>();
            }
            profilesByState[profile.state].Add(profile);

            // Sort by priority (descending)
            profilesByState[profile.state].Sort((a, b) => b.priority.CompareTo(a.priority));

            loadedProfileCount++;
        }

        /// <summary>
        /// Get profile by ID
        /// </summary>
        public MotionProfile GetProfileById(string id)
        {
            if (profilesById.TryGetValue(id, out MotionProfile profile))
            {
                return profile;
            }
            return null;
        }

        /// <summary>
        /// Get default profile for a state (highest priority)
        /// </summary>
        public MotionProfile GetDefaultProfileForState(MotionState state)
        {
            if (profilesByState.TryGetValue(state, out List<MotionProfile> profiles))
            {
                if (profiles.Count > 0)
                {
                    return profiles[0]; // Already sorted by priority
                }
            }
            return null;
        }

        /// <summary>
        /// Get all profiles for a state
        /// </summary>
        public List<MotionProfile> GetProfilesForState(MotionState state)
        {
            if (profilesByState.TryGetValue(state, out List<MotionProfile> profiles))
            {
                return new List<MotionProfile>(profiles);
            }
            return new List<MotionProfile>();
        }

        /// <summary>
        /// Resolve best profile for state + hero data
        /// </summary>
        public MotionProfile ResolveProfile(MotionState state, string heroId = null, string heroClass = null, string rarity = null)
        {
            var profiles = GetProfilesForState(state);

            foreach (var profile in profiles)
            {
                if (profile.conditions != null && MatchesConditions(profile.conditions, heroId, heroClass, rarity))
                {
                    return profile;
                }
            }

            // Return default (first in priority order)
            return profiles.Count > 0 ? profiles[0] : null;
        }

        /// <summary>
        /// Check if hero data matches profile conditions
        /// </summary>
        private bool MatchesConditions(ProfileConditions conditions, string heroId, string heroClass, string rarity)
        {
            // Empty arrays match all
            bool heroIdMatch = conditions.heroIds == null || conditions.heroIds.Length == 0 ||
                               (heroId != null && Array.IndexOf(conditions.heroIds, heroId) >= 0);

            bool classMatch = conditions.heroClass == null || conditions.heroClass.Length == 0 ||
                              (heroClass != null && Array.IndexOf(conditions.heroClass, heroClass) >= 0);

            bool rarityMatch = conditions.rarity == null || conditions.rarity.Length == 0 ||
                               (rarity != null && Array.IndexOf(conditions.rarity, rarity) >= 0);

            return heroIdMatch && classMatch && rarityMatch;
        }

        #region JSON Conversion

        /// <summary>
        /// Convert JSON intermediate format to runtime profile
        /// </summary>
        private MotionProfile ConvertFromJson(JsonMotionProfile json)
        {
            var profile = new MotionProfile
            {
                id = json.id,
                schemaVersion = json.schemaVersion,
                state = ParseMotionState(json.state),
                priority = json.priority,
                duration = json.duration,
                loop = json.loop,
                loopCount = json.loopCount
            };

            // Global modifiers
            if (json.globalModifiers != null)
            {
                profile.globalModifiers = new GlobalModifiers
                {
                    intensity = json.globalModifiers.intensity,
                    speed = json.globalModifiers.speed
                };
            }

            // Blending
            if (json.blending != null)
            {
                profile.blending = new BlendingConfig
                {
                    blendInDuration = json.blending.blendInDuration,
                    blendOutDuration = json.blending.blendOutDuration,
                    blendCurve = ParseBlendCurve(json.blending.blendCurve)
                };
            }

            // Parameters - parse from JSON object
            profile.parameters = ParseParameters(json.parameters);

            // Rating clamps
            if (json.ratingClamps != null)
            {
                profile.ratingClamps = ConvertRatingClamps(json.ratingClamps);
            }

            // Conditions
            if (json.conditions != null)
            {
                profile.conditions = json.conditions;
            }

            // Metadata
            profile.metadata = json.metadata;

            return profile;
        }

        private MotionState ParseMotionState(string state)
        {
            switch (state?.ToLower())
            {
                case "idle": return MotionState.Idle;
                case "combat": return MotionState.Combat;
                case "banner": return MotionState.Banner;
                case "summon": return MotionState.Summon;
                case "victory": return MotionState.Victory;
                case "defeat": return MotionState.Defeat;
                case "dialogue": return MotionState.Dialogue;
                case "special": return MotionState.Special;
                default: return MotionState.Idle;
            }
        }

        private BlendCurve ParseBlendCurve(string curve)
        {
            switch (curve?.ToLower())
            {
                case "linear": return BlendCurve.Linear;
                case "ease_in": return BlendCurve.EaseIn;
                case "ease_out": return BlendCurve.EaseOut;
                case "ease_in_out": return BlendCurve.EaseInOut;
                case "smooth_step": return BlendCurve.SmoothStep;
                default: return BlendCurve.EaseInOut;
            }
        }

        private WaveformType ParseWaveform(string waveform)
        {
            switch (waveform?.ToLower())
            {
                case "sine": return WaveformType.Sine;
                case "cosine": return WaveformType.Cosine;
                case "triangle": return WaveformType.Triangle;
                case "sawtooth": return WaveformType.Sawtooth;
                case "square": return WaveformType.Square;
                case "perlin": return WaveformType.Perlin;
                default: return WaveformType.Sine;
            }
        }

        private EasingType ParseEasing(string easing)
        {
            switch (easing?.ToLower())
            {
                case "linear": return EasingType.Linear;
                case "ease_in": return EasingType.EaseIn;
                case "ease_out": return EasingType.EaseOut;
                case "ease_in_out": return EasingType.EaseInOut;
                case "ease_in_quad": return EasingType.EaseInQuad;
                case "ease_out_quad": return EasingType.EaseOutQuad;
                case "ease_in_cubic": return EasingType.EaseInCubic;
                case "ease_out_cubic": return EasingType.EaseOutCubic;
                case "elastic": return EasingType.Elastic;
                case "bounce": return EasingType.Bounce;
                default: return EasingType.Linear;
            }
        }

        private Dictionary<string, ParameterMotion> ParseParameters(JsonParameters jsonParams)
        {
            var result = new Dictionary<string, ParameterMotion>();
            if (jsonParams == null) return result;

            // Use reflection to iterate all parameter fields
            var fields = typeof(JsonParameters).GetFields();
            foreach (var field in fields)
            {
                var jsonMotion = field.GetValue(jsonParams) as JsonParameterMotion;
                if (jsonMotion != null)
                {
                    result[field.Name] = ConvertParameterMotion(jsonMotion);
                }
            }

            return result;
        }

        private ParameterMotion ConvertParameterMotion(JsonParameterMotion json)
        {
            var motion = new ParameterMotion
            {
                enabled = json.enabled,
                amplitude = json.amplitude,
                frequency = json.frequency,
                phase = json.phase,
                waveform = ParseWaveform(json.waveform),
                easing = ParseEasing(json.easing),
                baseValue = json.baseValue,
                minClamp = json.minClamp,
                maxClamp = json.maxClamp
            };

            if (json.randomize != null)
            {
                motion.randomize = json.randomize;
            }

            return motion;
        }

        private RatingClamps ConvertRatingClamps(JsonRatingClamps json)
        {
            var clamps = new RatingClamps();

            if (json.ParamChestSoftX != null)
                clamps.ParamChestSoftX = new ClampRange { min = json.ParamChestSoftX.min, max = json.ParamChestSoftX.max };

            if (json.ParamChestSoftY != null)
                clamps.ParamChestSoftY = new ClampRange { min = json.ParamChestSoftY.min, max = json.ParamChestSoftY.max };

            if (json.ParamAbdomenSoft != null)
                clamps.ParamAbdomenSoft = new ClampRange { min = json.ParamAbdomenSoft.min, max = json.ParamAbdomenSoft.max };

            if (json.ParamPelvisShift != null)
                clamps.ParamPelvisShift = new ClampRange { min = json.ParamPelvisShift.min, max = json.ParamPelvisShift.max };

            return clamps;
        }

        #endregion
    }

    #region JSON Intermediate Classes

    /// <summary>
    /// JSON intermediate format for Unity's JsonUtility
    /// </summary>
    [Serializable]
    public class JsonMotionProfile
    {
        public string id;
        public string schemaVersion;
        public string state;
        public int priority;
        public float duration;
        public bool loop;
        public int loopCount;
        public JsonGlobalModifiers globalModifiers;
        public JsonBlendingConfig blending;
        public JsonParameters parameters;
        public JsonRatingClamps ratingClamps;
        public ProfileConditions conditions;
        public ProfileMetadata metadata;
    }

    [Serializable]
    public class JsonGlobalModifiers
    {
        public float intensity = 1f;
        public float speed = 1f;
    }

    [Serializable]
    public class JsonBlendingConfig
    {
        public float blendInDuration = 0.5f;
        public float blendOutDuration = 0.5f;
        public string blendCurve = "ease_in_out";
    }

    [Serializable]
    public class JsonParameterMotion
    {
        public bool enabled = true;
        public float amplitude = 0f;
        public float frequency = 0.5f;
        public float phase = 0f;
        public string waveform = "sine";
        public string easing = "linear";
        public float baseValue = 0f;
        public float minClamp = -1f;
        public float maxClamp = 1f;
        public RandomizeSettings randomize;
    }

    [Serializable]
    public class JsonParameters
    {
        // Head
        public JsonParameterMotion ParamAngleX;
        public JsonParameterMotion ParamAngleY;
        public JsonParameterMotion ParamAngleZ;

        // Body
        public JsonParameterMotion ParamBodyAngleX;
        public JsonParameterMotion ParamBodyAngleY;
        public JsonParameterMotion ParamBodyAngleZ;
        public JsonParameterMotion ParamBreath;
        public JsonParameterMotion ParamShoulderY;

        // Eyes
        public JsonParameterMotion ParamEyeLOpen;
        public JsonParameterMotion ParamEyeROpen;
        public JsonParameterMotion ParamEyeBallX;
        public JsonParameterMotion ParamEyeBallY;

        // Eyebrows
        public JsonParameterMotion ParamBrowLY;
        public JsonParameterMotion ParamBrowRY;
        public JsonParameterMotion ParamBrowLX;
        public JsonParameterMotion ParamBrowRX;
        public JsonParameterMotion ParamBrowLAngle;
        public JsonParameterMotion ParamBrowRAngle;
        public JsonParameterMotion ParamBrowLForm;
        public JsonParameterMotion ParamBrowRForm;

        // Mouth
        public JsonParameterMotion ParamMouthOpenY;
        public JsonParameterMotion ParamMouthForm;
        public JsonParameterMotion ParamCheek;

        // Hair
        public JsonParameterMotion ParamHairFront;
        public JsonParameterMotion ParamHairSide;
        public JsonParameterMotion ParamHairBack;
        public JsonParameterMotion ParamHairFluffy;

        // Arms
        public JsonParameterMotion ParamArmLA;
        public JsonParameterMotion ParamArmRA;
        public JsonParameterMotion ParamArmLB;
        public JsonParameterMotion ParamArmRB;
        public JsonParameterMotion ParamHandL;
        public JsonParameterMotion ParamHandR;

        // Soft tissue (RATING-CLAMPED)
        public JsonParameterMotion ParamChestSoftX;
        public JsonParameterMotion ParamChestSoftY;
        public JsonParameterMotion ParamAbdomenSoft;
        public JsonParameterMotion ParamPelvisShift;
    }

    [Serializable]
    public class JsonClampRange
    {
        public float min;
        public float max;
    }

    [Serializable]
    public class JsonRatingClamps
    {
        public JsonClampRange ParamChestSoftX;
        public JsonClampRange ParamChestSoftY;
        public JsonClampRange ParamAbdomenSoft;
        public JsonClampRange ParamPelvisShift;
    }

    #endregion
}
