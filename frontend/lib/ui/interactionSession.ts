// /app/frontend/lib/ui/interactionSession.ts
// Phase 3.22.10: Global interaction event bus
// Allows any part of the app to notify "user did something" —
// used to cancel pending desire accents (signature revert, glance timer).
//
// Minimal, zero-dependency event bus.

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to user interaction events.
 * Returns an unsubscribe function.
 */
export function subscribeInteraction(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Emit a user interaction event.
 * Call this from tab changes, button presses, etc.
 */
export function emitInteraction(): void {
  listeners.forEach((fn) => fn());
}
