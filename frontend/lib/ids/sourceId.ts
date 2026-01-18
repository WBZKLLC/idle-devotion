// /app/frontend/lib/ids/sourceId.ts
// Phase 3.49: Robust sourceId generation for idempotent endpoints
//
// Prevents collisions from:
// - Multi-tap
// - Retry storms
// - Device clock weirdness
//
// Format: ${prefix}_${timestamp}_${random}

/**
 * Generate a cryptographically-strong random hex string.
 * Uses crypto.getRandomValues if available, falls back to Math.random.
 */
function getRandomHex(length: number = 8): string {
  // Try crypto.getRandomValues (available in most modern runtimes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }
  
  // Fallback to Math.random (still better than timestamp alone)
  // Note: This is NOT cryptographically secure, but sufficient for sourceId uniqueness
  return Math.random().toString(16).slice(2, 2 + length);
}

/**
 * Create a robust sourceId for idempotent API calls.
 * 
 * @param prefix - Action identifier (e.g., 'summon', 'promote', 'claim')
 * @returns Unique sourceId in format: prefix_timestamp_random
 * 
 * @example
 * makeSourceId('summon')  // 'summon_1705555555555_a3f2b8c1'
 * makeSourceId('promote') // 'promote_1705555555555_9d4e6f2a'
 */
export function makeSourceId(prefix: string): string {
  const timestamp = Date.now();
  const random = getRandomHex(8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validate that a sourceId has the expected format.
 * Useful for debugging and guards.
 * 
 * @param sourceId - The sourceId to validate
 * @returns true if format matches prefix_timestamp_random
 */
export function isValidSourceIdFormat(sourceId: string): boolean {
  // Format: prefix_timestamp_random
  const pattern = /^[a-z]+_\d{13}_[a-f0-9]{8}$/i;
  return pattern.test(sourceId);
}
