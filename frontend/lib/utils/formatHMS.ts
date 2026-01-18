/**
 * Phase 3.50: Safe time formatting utility
 * 
 * Guards against NaN/undefined/null by returning a safe fallback.
 * Use this ANYWHERE you need to display HH:MM:SS or MM:SS format.
 */

/**
 * Format seconds into HH:MM:SS or MM:SS string
 * Returns "--:--:--" if input is invalid
 * 
 * @param seconds - Number of seconds (can be null/undefined/NaN)
 * @param showHours - Whether to include hours (default: true)
 * @returns Formatted time string
 */
export function formatHMS(
  seconds?: number | null,
  showHours: boolean = true
): string {
  // Guard against invalid input
  if (
    seconds === null ||
    seconds === undefined ||
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    Number.isNaN(seconds)
  ) {
    return showHours ? '--:--:--' : '--:--';
  }

  // Ensure non-negative
  const safeSeconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (showHours) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Format seconds into a human-readable duration string
 * e.g., "2h 30m" or "45m 30s"
 * Returns "--" if input is invalid
 */
export function formatDurationReadable(seconds?: number | null): string {
  if (
    seconds === null ||
    seconds === undefined ||
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    Number.isNaN(seconds)
  ) {
    return '--';
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}
