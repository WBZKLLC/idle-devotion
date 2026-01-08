// =============================================================================
// Live2D Waveform Solver
// Calculates parameter values from waveform definitions
// =============================================================================

using UnityEngine;

namespace DivineHeros.Live2D.Motion
{
    /// <summary>
    /// Solves waveform calculations for motion parameters
    /// All motion is derived from JSON profiles - no hardcoded animation
    /// </summary>
    public static class WaveformSolver
    {
        private const float TWO_PI = Mathf.PI * 2f;

        // Perlin noise offset for each parameter instance
        private static float perlinOffset = 0f;

        /// <summary>
        /// Calculate waveform value at given time
        /// </summary>
        /// <param name="waveform">Waveform type</param>
        /// <param name="phase">Phase in radians (0 to 2π)</param>
        /// <returns>Value in range -1 to 1</returns>
        public static float CalculateWaveform(WaveformType waveform, float phase)
        {
            switch (waveform)
            {
                case WaveformType.Sine:
                    return Mathf.Sin(phase);

                case WaveformType.Cosine:
                    return Mathf.Cos(phase);

                case WaveformType.Triangle:
                    return CalculateTriangle(phase);

                case WaveformType.Sawtooth:
                    // ⛔ NON-RECOMMENDED: Debug/stylized use only
                    return CalculateSawtooth(phase);

                case WaveformType.Square:
                    // ⛔ NON-RECOMMENDED: Debug/stylized use only
                    return Mathf.Sign(Mathf.Sin(phase));

                case WaveformType.Perlin:
                    return CalculatePerlin(phase);

                default:
                    return Mathf.Sin(phase);
            }
        }

        /// <summary>
        /// Calculate triangle wave
        /// </summary>
        private static float CalculateTriangle(float phase)
        {
            // Normalize phase to 0-1
            float t = (phase % TWO_PI) / TWO_PI;
            if (t < 0) t += 1f;

            // Triangle wave: rises 0->1 in first half, falls 1->0 in second half
            if (t < 0.5f)
            {
                return (t * 4f) - 1f;  // -1 to 1
            }
            else
            {
                return 3f - (t * 4f);  // 1 to -1
            }
        }

        /// <summary>
        /// Calculate sawtooth wave
        /// NOTE: NON-RECOMMENDED - produces unnatural motion
        /// </summary>
        private static float CalculateSawtooth(float phase)
        {
            float t = (phase % TWO_PI) / TWO_PI;
            if (t < 0) t += 1f;
            return (t * 2f) - 1f;  // -1 to 1 linear ramp
        }

        /// <summary>
        /// Calculate Perlin noise value for natural variation
        /// Recommended for low frequency (≤0.3 Hz) subtle motion
        /// </summary>
        private static float CalculatePerlin(float phase)
        {
            // Use Perlin noise for smooth random variation
            // Scale phase to reasonable noise space
            float noiseX = phase * 0.5f + perlinOffset;
            float noiseY = perlinOffset * 0.5f;

            // Mathf.PerlinNoise returns 0-1, convert to -1 to 1
            float noise = Mathf.PerlinNoise(noiseX, noiseY);
            return (noise * 2f) - 1f;
        }

        /// <summary>
        /// Apply easing function to value
        /// </summary>
        /// <param name="easing">Easing type</param>
        /// <param name="value">Input value (typically -1 to 1)</param>
        /// <returns>Eased value</returns>
        public static float ApplyEasing(EasingType easing, float value)
        {
            // Normalize to 0-1 for easing, then back to -1 to 1
            float t = (value + 1f) * 0.5f;  // -1,1 -> 0,1
            float eased = ApplyEasingNormalized(easing, t);
            return (eased * 2f) - 1f;  // 0,1 -> -1,1
        }

        /// <summary>
        /// Apply easing to normalized 0-1 value
        /// </summary>
        private static float ApplyEasingNormalized(EasingType easing, float t)
        {
            t = Mathf.Clamp01(t);

            switch (easing)
            {
                case EasingType.Linear:
                    return t;

                case EasingType.EaseIn:
                    return t * t;

                case EasingType.EaseOut:
                    return 1f - (1f - t) * (1f - t);

                case EasingType.EaseInOut:
                    return t < 0.5f
                        ? 2f * t * t
                        : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;

                case EasingType.EaseInQuad:
                    return t * t;

                case EasingType.EaseOutQuad:
                    return 1f - (1f - t) * (1f - t);

                case EasingType.EaseInCubic:
                    return t * t * t;

                case EasingType.EaseOutCubic:
                    return 1f - Mathf.Pow(1f - t, 3f);

                case EasingType.Elastic:
                    return ElasticEaseOut(t);

                case EasingType.Bounce:
                    return BounceEaseOut(t);

                default:
                    return t;
            }
        }

        /// <summary>
        /// Elastic ease out
        /// </summary>
        private static float ElasticEaseOut(float t)
        {
            if (t == 0f) return 0f;
            if (t == 1f) return 1f;

            float p = 0.3f;
            float s = p / 4f;

            return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t - s) * TWO_PI / p) + 1f;
        }

        /// <summary>
        /// Bounce ease out
        /// </summary>
        private static float BounceEaseOut(float t)
        {
            if (t < 1f / 2.75f)
            {
                return 7.5625f * t * t;
            }
            else if (t < 2f / 2.75f)
            {
                t -= 1.5f / 2.75f;
                return 7.5625f * t * t + 0.75f;
            }
            else if (t < 2.5f / 2.75f)
            {
                t -= 2.25f / 2.75f;
                return 7.5625f * t * t + 0.9375f;
            }
            else
            {
                t -= 2.625f / 2.75f;
                return 7.5625f * t * t + 0.984375f;
            }
        }

        /// <summary>
        /// Apply blend curve for transitions
        /// </summary>
        /// <param name="curve">Blend curve type</param>
        /// <param name="t">Progress 0-1</param>
        /// <returns>Blended progress 0-1</returns>
        public static float ApplyBlendCurve(BlendCurve curve, float t)
        {
            t = Mathf.Clamp01(t);

            switch (curve)
            {
                case BlendCurve.Linear:
                    return t;

                case BlendCurve.EaseIn:
                    return t * t;

                case BlendCurve.EaseOut:
                    return 1f - (1f - t) * (1f - t);

                case BlendCurve.EaseInOut:
                    return t < 0.5f
                        ? 2f * t * t
                        : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;

                case BlendCurve.SmoothStep:
                    return t * t * (3f - 2f * t);  // Hermite interpolation

                default:
                    return t;
            }
        }

        /// <summary>
        /// Set Perlin noise offset for variation between instances
        /// </summary>
        public static void SetPerlinOffset(float offset)
        {
            perlinOffset = offset;
        }

        /// <summary>
        /// Calculate complete parameter value from motion definition
        /// HARD RULE: Offsets are passed in as TRANSIENT inputs, NOT read from motion
        /// </summary>
        /// <param name="motion">Parameter motion definition (IMMUTABLE)</param>
        /// <param name="time">Current time in seconds</param>
        /// <param name="globalIntensity">Global intensity multiplier</param>
        /// <param name="globalSpeed">Global speed multiplier</param>
        /// <param name="amplitudeOffset">TRANSIENT amplitude offset (from driver, not profile)</param>
        /// <param name="frequencyOffset">TRANSIENT frequency offset (from driver, not profile)</param>
        /// <returns>Final parameter value</returns>
        public static float CalculateParameterValue(
            ParameterMotion motion,
            float time,
            float globalIntensity = 1f,
            float globalSpeed = 1f,
            float amplitudeOffset = 0f,
            float frequencyOffset = 0f)
        {
            if (!motion.enabled)
            {
                return motion.baseValue;
            }

            // Apply TRANSIENT offsets (passed in, NOT stored on motion)
            float amplitude = motion.amplitude + amplitudeOffset;
            float frequency = motion.frequency + frequencyOffset;

            // Calculate phase
            float phase = (time * frequency * globalSpeed * TWO_PI) + motion.phase;

            // Calculate waveform value (-1 to 1)
            float waveValue = CalculateWaveform(motion.waveform, phase);

            // Apply easing
            waveValue = ApplyEasing(motion.easing, waveValue);

            // Calculate final value
            float scaledAmplitude = amplitude * globalIntensity;
            float value = motion.baseValue + (waveValue * scaledAmplitude);

            // Apply parameter clamps
            value = Mathf.Clamp(value, motion.minClamp, motion.maxClamp);

            return value;
        }

        // NOTE: InitializeRandomization has been REMOVED from WaveformSolver
        // Runtime offsets are now managed by MotionParameterDriver as TRANSIENT state
        // This ensures offsets NEVER mutate profile data (HARD RULE compliance)
    }
}
