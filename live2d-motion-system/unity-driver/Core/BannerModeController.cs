// =============================================================================
// Live2D Banner Mode Controller
// Specialized controller for summon/banner reveal sequences
// =============================================================================

using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Events;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// Controller for banner/summon reveal sequences
    /// Orchestrates the anticipation -> reveal flow
    /// </summary>
    public class BannerModeController : MonoBehaviour
    {
        [Header("Dependencies")]
        [SerializeField] private MotionStateController stateController;
        [SerializeField] private MotionProfileLoader profileLoader;

        [Header("Sequence Timing")]
        [Tooltip("Duration of anticipation phase before reveal")]
        public float anticipationDuration = 2f;

        [Tooltip("Delay after reveal starts before completion event")]
        public float revealCompletionDelay = 6f;

        [Tooltip("Auto-return to idle after sequence")]
        public bool autoReturnToIdle = true;

        [Tooltip("Delay before returning to idle")]
        public float idleReturnDelay = 2f;

        [Header("Events")]
        public UnityEvent OnAnticipationStart;
        public UnityEvent OnRevealStart;
        public UnityEvent OnRevealComplete;
        public UnityEvent OnSequenceComplete;

        [Header("State")]
        [SerializeField] private bool isSequenceActive = false;
        [SerializeField] private BannerPhase currentPhase = BannerPhase.None;

        /// <summary>
        /// Current banner sequence phase
        /// </summary>
        public enum BannerPhase
        {
            None,
            Anticipation,
            Reveal,
            Complete
        }

        /// <summary>
        /// Whether a banner sequence is currently active
        /// </summary>
        public bool IsSequenceActive => isSequenceActive;

        /// <summary>
        /// Current phase of the banner sequence
        /// </summary>
        public BannerPhase CurrentPhase => currentPhase;

        private void Awake()
        {
            if (stateController == null)
            {
                stateController = GetComponent<MotionStateController>();
            }

            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<MotionProfileLoader>();
            }
        }

        /// <summary>
        /// Play the full banner reveal sequence
        /// </summary>
        public void PlayBannerSequence()
        {
            if (isSequenceActive)
            {
                Debug.LogWarning("[BannerModeController] Sequence already active");
                return;
            }

            StartCoroutine(BannerSequenceCoroutine());
        }

        /// <summary>
        /// Play banner sequence with specific profile for reveal
        /// </summary>
        public void PlayBannerSequence(string revealProfileId)
        {
            if (isSequenceActive)
            {
                Debug.LogWarning("[BannerModeController] Sequence already active");
                return;
            }

            StartCoroutine(BannerSequenceCoroutine(revealProfileId));
        }

        /// <summary>
        /// Skip directly to reveal (skip anticipation)
        /// </summary>
        public void SkipToReveal()
        {
            if (!isSequenceActive || currentPhase != BannerPhase.Anticipation)
            {
                return;
            }

            StopAllCoroutines();
            StartCoroutine(RevealPhaseCoroutine(null));
        }

        /// <summary>
        /// Cancel the current sequence
        /// </summary>
        public void CancelSequence()
        {
            if (!isSequenceActive) return;

            StopAllCoroutines();
            isSequenceActive = false;
            currentPhase = BannerPhase.None;
            stateController?.ResetToIdle();
        }

        /// <summary>
        /// Main banner sequence coroutine
        /// </summary>
        private IEnumerator BannerSequenceCoroutine(string specificRevealProfile = null)
        {
            isSequenceActive = true;

            // Phase 1: Anticipation
            currentPhase = BannerPhase.Anticipation;
            stateController?.SetState(MotionState.Summon);
            OnAnticipationStart?.Invoke();

            Debug.Log("[BannerModeController] Anticipation phase started");
            yield return new WaitForSeconds(anticipationDuration);

            // Phase 2: Reveal
            yield return RevealPhaseCoroutine(specificRevealProfile);

            // Phase 3: Complete
            currentPhase = BannerPhase.Complete;
            OnSequenceComplete?.Invoke();

            Debug.Log("[BannerModeController] Sequence complete");

            // Return to idle if configured
            if (autoReturnToIdle)
            {
                yield return new WaitForSeconds(idleReturnDelay);
                stateController?.ResetToIdle();
            }

            isSequenceActive = false;
            currentPhase = BannerPhase.None;
        }

        /// <summary>
        /// Reveal phase coroutine
        /// </summary>
        private IEnumerator RevealPhaseCoroutine(string specificProfile)
        {
            currentPhase = BannerPhase.Reveal;

            if (!string.IsNullOrEmpty(specificProfile))
            {
                stateController?.SetProfileOverride(specificProfile);
            }
            else
            {
                stateController?.SetState(MotionState.Banner);
            }

            OnRevealStart?.Invoke();
            Debug.Log("[BannerModeController] Reveal phase started");

            yield return new WaitForSeconds(revealCompletionDelay);

            OnRevealComplete?.Invoke();
            Debug.Log("[BannerModeController] Reveal complete");
        }

        /// <summary>
        /// Enter banner mode immediately (no anticipation)
        /// </summary>
        public void EnterBannerMode()
        {
            stateController?.SetState(MotionState.Banner);
        }

        /// <summary>
        /// Enter banner mode with specific profile
        /// </summary>
        public void EnterBannerMode(string profileId)
        {
            stateController?.SetProfileOverride(profileId);
        }

        /// <summary>
        /// Exit banner mode
        /// </summary>
        public void ExitBannerMode()
        {
            CancelSequence();
            stateController?.ResetToIdle();
        }
    }
}
