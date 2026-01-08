using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.Timeline;

namespace DivineHeros.Live2D
{
    /// <summary>
    /// Specialized controller for Banner/Summon presentation sequences.
    /// Handles timing, camera work, and dramatic reveals.
    /// </summary>
    public class Live2DBannerModeController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Live2DStateController stateController;
        [SerializeField] private Live2DMotionProfileLoader profileLoader;

        [Header("Banner Sequence Profiles")]
        [SerializeField] private string anticipationProfileId = "summon_anticipation";
        [SerializeField] private string revealProfileId = "banner_reveal";
        [SerializeField] private string celebrationProfileId = "idle_default";

        [Header("Timing")]
        [SerializeField] private float anticipationDuration = 2.0f;
        [SerializeField] private float revealDuration = 3.0f;
        [SerializeField] private float holdDuration = 2.0f;

        [Header("Visual Effects")]
        [SerializeField] private float zoomIntensity = 1.2f;
        [SerializeField] private AnimationCurve zoomCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Header("Events")]
        public UnityEvent OnSequenceStarted;
        public UnityEvent OnAnticipationPhase;
        public UnityEvent OnRevealPhase;
        public UnityEvent OnCelebrationPhase;
        public UnityEvent OnSequenceComplete;

        // State
        private bool _isPlaying = false;
        private Coroutine _sequenceCoroutine;

        public bool IsPlaying => _isPlaying;

        private void Awake()
        {
            if (stateController == null)
            {
                stateController = GetComponent<Live2DStateController>();
            }
            if (profileLoader == null)
            {
                profileLoader = FindObjectOfType<Live2DMotionProfileLoader>();
            }
        }

        /// <summary>
        /// Play the full banner reveal sequence.
        /// </summary>
        public void PlayBannerSequence()
        {
            if (_isPlaying)
            {
                Debug.LogWarning("[Live2D Banner] Sequence already playing");
                return;
            }

            _sequenceCoroutine = StartCoroutine(BannerSequenceCoroutine());
        }

        /// <summary>
        /// Play banner sequence with custom profile IDs.
        /// </summary>
        public void PlayBannerSequence(string anticipation, string reveal, string celebration)
        {
            anticipationProfileId = anticipation;
            revealProfileId = reveal;
            celebrationProfileId = celebration;
            PlayBannerSequence();
        }

        /// <summary>
        /// Stop the banner sequence immediately.
        /// </summary>
        public void StopBannerSequence()
        {
            if (_sequenceCoroutine != null)
            {
                StopCoroutine(_sequenceCoroutine);
                _sequenceCoroutine = null;
            }

            _isPlaying = false;
            
            if (stateController != null)
            {
                stateController.ExitBannerMode();
            }
        }

        /// <summary>
        /// Main banner sequence coroutine.
        /// </summary>
        private IEnumerator BannerSequenceCoroutine()
        {
            _isPlaying = true;
            OnSequenceStarted?.Invoke();

            Debug.Log("[Live2D Banner] Starting banner sequence");

            // Enter banner mode
            if (stateController != null)
            {
                stateController.EnterBannerMode();
            }

            // Phase 1: Anticipation
            yield return StartCoroutine(AnticipationPhase());

            // Phase 2: Reveal
            yield return StartCoroutine(RevealPhase());

            // Phase 3: Celebration/Hold
            yield return StartCoroutine(CelebrationPhase());

            // Exit banner mode
            if (stateController != null)
            {
                stateController.ExitBannerMode();
            }

            _isPlaying = false;
            OnSequenceComplete?.Invoke();

            Debug.Log("[Live2D Banner] Banner sequence complete");
        }

        /// <summary>
        /// Anticipation phase - building tension.
        /// </summary>
        private IEnumerator AnticipationPhase()
        {
            Debug.Log("[Live2D Banner] Entering anticipation phase");
            OnAnticipationPhase?.Invoke();

            // Set anticipation profile
            if (stateController != null && !string.IsNullOrEmpty(anticipationProfileId))
            {
                stateController.SetProfileById(anticipationProfileId);
            }

            // Gradually increase intensity during anticipation
            float elapsed = 0f;
            float startIntensity = 1.0f;
            float targetIntensity = 1.3f;

            while (elapsed < anticipationDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / anticipationDuration;
                float intensity = Mathf.Lerp(startIntensity, targetIntensity, zoomCurve.Evaluate(t));
                
                if (stateController != null)
                {
                    stateController.SetGlobalIntensity(intensity);
                }

                yield return null;
            }
        }

        /// <summary>
        /// Reveal phase - dramatic presentation.
        /// </summary>
        private IEnumerator RevealPhase()
        {
            Debug.Log("[Live2D Banner] Entering reveal phase");
            OnRevealPhase?.Invoke();

            // Set reveal profile
            if (stateController != null && !string.IsNullOrEmpty(revealProfileId))
            {
                stateController.SetProfileById(revealProfileId);
            }

            // Apply zoom intensity
            if (stateController != null)
            {
                stateController.SetGlobalIntensity(zoomIntensity);
            }

            // Wait for reveal duration
            yield return new WaitForSeconds(revealDuration);
        }

        /// <summary>
        /// Celebration phase - settling motion.
        /// </summary>
        private IEnumerator CelebrationPhase()
        {
            Debug.Log("[Live2D Banner] Entering celebration phase");
            OnCelebrationPhase?.Invoke();

            // Set celebration profile
            if (stateController != null && !string.IsNullOrEmpty(celebrationProfileId))
            {
                stateController.SetProfileById(celebrationProfileId);
            }

            // Gradually return to normal intensity
            float elapsed = 0f;
            float startIntensity = zoomIntensity;
            float targetIntensity = 1.0f;

            while (elapsed < holdDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / holdDuration;
                float intensity = Mathf.Lerp(startIntensity, targetIntensity, zoomCurve.Evaluate(t));
                
                if (stateController != null)
                {
                    stateController.SetGlobalIntensity(intensity);
                }

                yield return null;
            }
        }

        /// <summary>
        /// Skip to reveal (for impatient users).
        /// </summary>
        public void SkipToReveal()
        {
            if (!_isPlaying) return;

            StopCoroutine(_sequenceCoroutine);
            _sequenceCoroutine = StartCoroutine(SkipToRevealCoroutine());
        }

        private IEnumerator SkipToRevealCoroutine()
        {
            // Jump directly to reveal
            yield return StartCoroutine(RevealPhase());
            yield return StartCoroutine(CelebrationPhase());

            if (stateController != null)
            {
                stateController.ExitBannerMode();
            }

            _isPlaying = false;
            OnSequenceComplete?.Invoke();
        }
    }
}