using System;
using UnityEngine;
using UnityEngine.Events;

namespace DivineHeros.Live2D
{
    /// <summary>
    /// High-level state controller for Live2D motion.
    /// Handles state transitions, Banner Mode, and external triggers.
    /// This is the bridge between game logic and Live2D motion.
    /// </summary>
    public class Live2DStateController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Live2DParameterDriver parameterDriver;
        [SerializeField] private Live2DMotionProfileLoader profileLoader;

        [Header("State Configuration")]
        [SerializeField] private MotionState defaultState = MotionState.Idle;
        [SerializeField] private bool autoReturnToIdle = true;
        [SerializeField] private float returnToIdleDelay = 3f;

        [Header("Banner Mode")]
        [SerializeField] private bool bannerModeActive = false;
        [SerializeField] private float bannerIntensityMultiplier = 1.5f;
        [SerializeField] private float bannerSpeedMultiplier = 0.6f;

        [Header("Events")]
        public UnityEvent<MotionState> OnStateChanged;
        public UnityEvent OnBannerModeEntered;
        public UnityEvent OnBannerModeExited;

        // State tracking
        private MotionState _currentState;
        private MotionState _previousState;
        private float _stateTimer = 0f;
        private bool _pendingIdleReturn = false;

        // Banner mode backup
        private float _preBannerIntensity;
        private float _preBannerSpeed;

        // Public Properties
        public MotionState CurrentState => _currentState;
        public bool IsBannerMode => bannerModeActive;

        private void Awake()
        {
            if (parameterDriver == null)
            {
                parameterDriver = GetComponent<Live2DParameterDriver>();
            }
            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<Live2DMotionProfileLoader>();
            }
        }

        private void Start()
        {
            // Set initial state
            SetState(defaultState, instant: true);
        }

        private void Update()
        {
            // Handle auto-return to idle
            if (_pendingIdleReturn && autoReturnToIdle)
            {
                _stateTimer += Time.deltaTime;
                if (_stateTimer >= returnToIdleDelay)
                {
                    SetState(MotionState.Idle);
                    _pendingIdleReturn = false;
                }
            }
        }

        /// <summary>
        /// Set the motion state.
        /// </summary>
        public void SetState(MotionState state, bool instant = false)
        {
            if (state == _currentState && !instant) return;

            _previousState = _currentState;
            _currentState = state;
            _stateTimer = 0f;

            // Determine if we should schedule return to idle
            _pendingIdleReturn = state != MotionState.Idle && state != MotionState.Combat;

            // Apply state to parameter driver
            if (parameterDriver != null)
            {
                parameterDriver.SetState(state, instant);
            }

            Debug.Log($"[Live2D State] Changed from {_previousState} to {_currentState}");
            OnStateChanged?.Invoke(_currentState);
        }

        /// <summary>
        /// Set state by string (for external calls like UI buttons).
        /// </summary>
        public void SetStateByString(string stateName)
        {
            if (Enum.TryParse<MotionState>(stateName, true, out MotionState state))
            {
                SetState(state);
            }
            else
            {
                Debug.LogWarning($"[Live2D State] Unknown state: {stateName}");
            }
        }

        /// <summary>
        /// Enter Banner Mode.
        /// Activates special summon/banner presentation motion.
        /// </summary>
        public void EnterBannerMode()
        {
            if (bannerModeActive) return;

            bannerModeActive = true;

            // Store current values
            if (parameterDriver != null)
            {
                _preBannerIntensity = parameterDriver.GlobalIntensity;
                _preBannerSpeed = parameterDriver.GlobalSpeed;

                // Apply banner mode settings
                parameterDriver.GlobalIntensity = bannerIntensityMultiplier;
                parameterDriver.GlobalSpeed = bannerSpeedMultiplier;
            }

            // Switch to banner state
            SetState(MotionState.Banner);

            Debug.Log("[Live2D State] Entered Banner Mode");
            OnBannerModeEntered?.Invoke();
        }

        /// <summary>
        /// Exit Banner Mode.
        /// Returns to previous state with normal settings.
        /// </summary>
        public void ExitBannerMode()
        {
            if (!bannerModeActive) return;

            bannerModeActive = false;

            // Restore previous values
            if (parameterDriver != null)
            {
                parameterDriver.GlobalIntensity = _preBannerIntensity;
                parameterDriver.GlobalSpeed = _preBannerSpeed;
            }

            // Return to previous state (usually Idle)
            SetState(_previousState != MotionState.Banner ? _previousState : MotionState.Idle);

            Debug.Log("[Live2D State] Exited Banner Mode");
            OnBannerModeExited?.Invoke();
        }

        /// <summary>
        /// Toggle Banner Mode.
        /// </summary>
        public void ToggleBannerMode()
        {
            if (bannerModeActive)
                ExitBannerMode();
            else
                EnterBannerMode();
        }

        /// <summary>
        /// Trigger combat state for a duration.
        /// </summary>
        public void TriggerCombat(float duration = -1f)
        {
            SetState(MotionState.Combat);

            if (duration > 0f)
            {
                returnToIdleDelay = duration;
                _pendingIdleReturn = true;
            }
        }

        /// <summary>
        /// Trigger victory state.
        /// </summary>
        public void TriggerVictory()
        {
            SetState(MotionState.Victory);
        }

        /// <summary>
        /// Trigger defeat state.
        /// </summary>
        public void TriggerDefeat()
        {
            SetState(MotionState.Defeat);
        }

        /// <summary>
        /// Force return to idle immediately.
        /// </summary>
        public void ForceIdle()
        {
            _pendingIdleReturn = false;
            SetState(MotionState.Idle);
        }

        /// <summary>
        /// Set a specific profile by ID.
        /// </summary>
        public void SetProfileById(string profileId, bool instant = false)
        {
            if (parameterDriver != null)
            {
                parameterDriver.SetProfileById(profileId, instant);
            }
        }

        /// <summary>
        /// Adjust global motion intensity.
        /// </summary>
        public void SetGlobalIntensity(float intensity)
        {
            if (parameterDriver != null)
            {
                parameterDriver.GlobalIntensity = intensity;
            }
        }

        /// <summary>
        /// Adjust global motion speed.
        /// </summary>
        public void SetGlobalSpeed(float speed)
        {
            if (parameterDriver != null)
            {
                parameterDriver.GlobalSpeed = speed;
            }
        }
    }
}