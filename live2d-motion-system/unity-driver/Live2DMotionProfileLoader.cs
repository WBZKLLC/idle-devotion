using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace DivineHeros.Live2D
{
    /// <summary>
    /// Loads and caches JSON motion profiles.
    /// Engine-agnostic data loading - no animation logic here.
    /// </summary>
    public class Live2DMotionProfileLoader : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private string profilesPath = "Live2D/MotionProfiles";
        [SerializeField] private bool loadOnAwake = true;
        [SerializeField] private bool enableHotReload = false;

        // Profile cache
        private Dictionary<string, Live2DMotionProfile> _profileCache = new Dictionary<string, Live2DMotionProfile>();
        private Dictionary<MotionState, List<Live2DMotionProfile>> _profilesByState = new Dictionary<MotionState, List<Live2DMotionProfile>>();

        // Events
        public event Action<string> OnProfileLoaded;
        public event Action<string, Exception> OnProfileLoadError;
        public event Action OnAllProfilesLoaded;

        private void Awake()
        {
            if (loadOnAwake)
            {
                LoadAllProfiles();
            }
        }

        /// <summary>
        /// Load all motion profiles from the configured path.
        /// </summary>
        public void LoadAllProfiles()
        {
            _profileCache.Clear();
            _profilesByState.Clear();

            // Initialize state lists
            foreach (MotionState state in Enum.GetValues(typeof(MotionState)))
            {
                _profilesByState[state] = new List<Live2DMotionProfile>();
            }

            // Load from Resources
            TextAsset[] jsonAssets = Resources.LoadAll<TextAsset>(profilesPath);
            
            foreach (TextAsset asset in jsonAssets)
            {
                try
                {
                    LoadProfileFromJson(asset.text, asset.name);
                }
                catch (Exception e)
                {
                    Debug.LogError($"[Live2D] Failed to load profile {asset.name}: {e.Message}");
                    OnProfileLoadError?.Invoke(asset.name, e);
                }
            }

            Debug.Log($"[Live2D] Loaded {_profileCache.Count} motion profiles");
            OnAllProfilesLoaded?.Invoke();
        }

        /// <summary>
        /// Load a single profile from JSON string.
        /// </summary>
        public Live2DMotionProfile LoadProfileFromJson(string json, string sourceName = "unknown")
        {
            Live2DMotionProfile profile = JsonUtility.FromJson<Live2DMotionProfile>(json);
            
            if (profile == null || string.IsNullOrEmpty(profile.id))
            {
                throw new Exception($"Invalid profile structure in {sourceName}");
            }

            // Validate version
            if (profile.version != "1.0.0")
            {
                Debug.LogWarning($"[Live2D] Profile {profile.id} has unknown version {profile.version}");
            }

            // Cache by ID
            _profileCache[profile.id] = profile;

            // Index by state
            if (Enum.TryParse<MotionState>(profile.state, true, out MotionState state))
            {
                _profilesByState[state].Add(profile);
            }

            Debug.Log($"[Live2D] Loaded profile: {profile.id} (state: {profile.state})");
            OnProfileLoaded?.Invoke(profile.id);

            return profile;
        }

        /// <summary>
        /// Load a profile from external file path (for hot reload).
        /// </summary>
        public Live2DMotionProfile LoadProfileFromFile(string filePath)
        {
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Profile file not found: {filePath}");
            }

            string json = File.ReadAllText(filePath);
            return LoadProfileFromJson(json, Path.GetFileName(filePath));
        }

        /// <summary>
        /// Get a profile by ID.
        /// </summary>
        public Live2DMotionProfile GetProfile(string profileId)
        {
            if (_profileCache.TryGetValue(profileId, out Live2DMotionProfile profile))
            {
                return profile;
            }

            Debug.LogWarning($"[Live2D] Profile not found: {profileId}");
            return null;
        }

        /// <summary>
        /// Get the default profile for a motion state.
        /// </summary>
        public Live2DMotionProfile GetDefaultProfileForState(MotionState state)
        {
            if (_profilesByState.TryGetValue(state, out List<Live2DMotionProfile> profiles) && profiles.Count > 0)
            {
                return profiles[0];
            }

            Debug.LogWarning($"[Live2D] No profiles found for state: {state}");
            return null;
        }

        /// <summary>
        /// Get all profiles for a motion state.
        /// </summary>
        public List<Live2DMotionProfile> GetProfilesForState(MotionState state)
        {
            if (_profilesByState.TryGetValue(state, out List<Live2DMotionProfile> profiles))
            {
                return new List<Live2DMotionProfile>(profiles);
            }

            return new List<Live2DMotionProfile>();
        }

        /// <summary>
        /// Check if a profile exists.
        /// </summary>
        public bool HasProfile(string profileId)
        {
            return _profileCache.ContainsKey(profileId);
        }

        /// <summary>
        /// Get all loaded profile IDs.
        /// </summary>
        public IEnumerable<string> GetAllProfileIds()
        {
            return _profileCache.Keys;
        }
    }
}