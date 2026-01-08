// =============================================================================
// Live2D State Controller
// High-level state management - receives commands from app layer
// =============================================================================

using System;
using UnityEngine;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// State controller for Live2D motion
    /// Receives state commands from Expo (UI layer) and manages transitions
    /// Expo sends commands only - NO animation logic in app layer
    /// </summary>
    public class MotionStateController : MonoBehaviour
    {
        [Header("Dependencies")]
        [SerializeField] private MotionParameterDriver parameterDriver;
        [SerializeField] private MotionProfileLoader profileLoader;

        [Header("Hero Data")]
        [Tooltip("Hero identifier for profile conditions")]
        public string heroId;

        [Tooltip("Hero class for profile conditions")]
        public string heroClass;

        [Tooltip("Hero rarity for profile conditions")]
        public string heroRarity;

        [Header("State")]
        [SerializeField] private MotionState currentState = MotionState.Idle;
        [SerializeField] private string currentProfileId = "";

        // Events
        public event Action<MotionState> OnStateChanged;
        public event Action<MotionProfile> OnProfileChanged;

        /// <summary>
        /// Current motion state
        /// </summary>
        public MotionState CurrentState => currentState;

        /// <summary>
        /// Current profile ID
        /// </summary>
        public string CurrentProfileId => currentProfileId;

        private void Awake()
        {
            if (parameterDriver == null)
            {
                parameterDriver = GetComponent<MotionParameterDriver>();
            }

            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<MotionProfileLoader>();
            }
        }

        private void Start()
        {
            // Set initial state
            SetState(MotionState.Idle);
        }

        /// <summary>
        /// Set motion state (primary interface for app layer)
        /// This is what Expo calls - state command only, no animation logic
        /// </summary>
        /// <param name="state">Target motion state</param>
        public void SetState(MotionState state)
        {
            if (currentState == state) return;

            MotionState previousState = currentState;
            currentState = state;

            // Resolve and apply profile
            if (parameterDriver != null)
            {
                parameterDriver.SetProfile(state, heroId, heroClass, heroRarity);

                if (parameterDriver.CurrentProfile != null)
                {
                    currentProfileId = parameterDriver.CurrentProfile.id;
                    OnProfileChanged?.Invoke(parameterDriver.CurrentProfile);
                }
            }

            Debug.Log($"[MotionStateController] State changed: {previousState} -> {state}");
            OnStateChanged?.Invoke(state);
        }

        /// <summary>
        /// Set motion state by string (for external calls)
        /// </summary>
        public void SetState(string stateName)
        {
            if (Enum.TryParse<MotionState>(stateName, true, out MotionState state))
            {
                SetState(state);
            }
            else
            {
                Debug.LogWarning($"[MotionStateController] Unknown state: {stateName}");
            }
        }

        /// <summary>
        /// Override with specific profile ID
        /// </summary>
        public void SetProfileOverride(string profileId)
        {
            if (parameterDriver != null && profileLoader != null)
            {
                MotionProfile profile = profileLoader.GetProfileById(profileId);
                if (profile != null)
                {
                    parameterDriver.SetProfile(profile);
                    currentProfileId = profile.id;
                    currentState = profile.state;
                    OnProfileChanged?.Invoke(profile);
                }
                else
                {
                    Debug.LogWarning($"[MotionStateController] Profile not found: {profileId}");
                }
            }
        }

        /// <summary>
        /// Set global intensity override
        /// </summary>
        public void SetIntensity(float intensity)
        {
            if (parameterDriver != null)
            {
                parameterDriver.intensityOverride = Mathf.Clamp(intensity, 0f, 2f);
            }
        }

        /// <summary>
        /// Set global speed override
        /// </summary>
        public void SetSpeed(float speed)
        {
            if (parameterDriver != null)
            {
                parameterDriver.speedOverride = Mathf.Clamp(speed, 0f, 3f);
            }
        }

        /// <summary>
        /// Update hero data (affects profile selection)
        /// </summary>
        public void SetHeroData(string id, string heroClassValue, string rarityValue)
        {
            heroId = id;
            heroClass = heroClassValue;
            heroRarity = rarityValue;

            // Re-resolve current state with new hero data
            SetState(currentState);
        }

        /// <summary>
        /// Reset to idle
        /// </summary>
        public void ResetToIdle()
        {
            SetState(MotionState.Idle);
        }

        /// <summary>
        /// Stop all motion
        /// </summary>
        public void StopMotion()
        {
            if (parameterDriver != null)
            {
                parameterDriver.StopMotion();
            }
            currentProfileId = "";
        }

        #region State Shortcuts

        /// <summary>Enter idle state</summary>
        public void EnterIdle() => SetState(MotionState.Idle);

        /// <summary>Enter combat state</summary>
        public void EnterCombat() => SetState(MotionState.Combat);

        /// <summary>Enter banner reveal state</summary>
        public void EnterBanner() => SetState(MotionState.Banner);

        /// <summary>Enter summon anticipation state</summary>
        public void EnterSummon() => SetState(MotionState.Summon);

        /// <summary>Enter victory state</summary>
        public void EnterVictory() => SetState(MotionState.Victory);

        /// <summary>Enter defeat state</summary>
        public void EnterDefeat() => SetState(MotionState.Defeat);

        /// <summary>Enter dialogue state</summary>
        public void EnterDialogue() => SetState(MotionState.Dialogue);

        #endregion
    }
}
