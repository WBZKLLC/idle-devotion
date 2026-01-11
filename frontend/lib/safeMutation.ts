// /app/frontend/lib/safeMutation.ts
// SAFE MUTATION WRAPPER
// Enforces consistent loading/success/failure patterns for all state mutations
// Prevents optimistic updates and ensures server-authoritative state

import { Alert } from 'react-native';
import { isErrorHandledGlobally } from './api';

/**
 * Structured result type for safeMutation
 * Preserves server error details while providing consistent interface
 */
export type MutationResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: any; detail?: string };

/**
 * Options for safeMutation
 */
interface SafeMutationOptions<T> {
  /** Called on successful mutation with the result */
  onSuccess?: (result: T) => void | Promise<void>;
  
  /** Called on error with the caught exception */
  onError?: (error: any) => void;
  
  /** 
   * If true, fetches user state after mutation (default: true)
   * Pass the fetchUser function from gameStore
   */
  refreshUser?: boolean;
  
  /** The fetchUser function to call if refreshUser is true */
  fetchUserFn?: () => Promise<void>;
  
  /** 
   * Show error alert if not already handled globally (default: false)
   * The global interceptor handles most errors, so this is rarely needed
   */
  showErrorAlert?: boolean;
  
  /** Custom error message for alert (overrides server detail) */
  errorMessage?: string;
  
  /**
   * If true, rethrow the error after handling (default: false)
   * Use this when the caller needs to handle the error further
   */
  rethrow?: boolean;
}

/**
 * Extract error detail from various error formats
 */
function getErrorDetail(error: any): string {
  return error?.response?.data?.detail 
    || error?.message 
    || 'Something went wrong';
}

/**
 * Safe mutation wrapper that enforces consistent patterns:
 * 1. Always awaits the server response
 * 2. Optionally refreshes user state after success
 * 3. Returns structured result { ok, data } or { ok, error, detail }
 * 4. Never assumes success - state only updates after server confirms
 * 5. Respects global error handling - won't duplicate alerts
 * 
 * @param actionName - Name of the action for logging
 * @param fn - The async mutation function to execute
 * @param opts - Options for customizing behavior
 * @returns Structured result with ok/data or ok/error/detail
 * 
 * @example
 * ```tsx
 * const result = await safeMutation(
 *   'pullGacha',
 *   () => apiPullGacha(username, 'single', 'coins'),
 *   { 
 *     refreshUser: true, 
 *     fetchUserFn: fetchUser,
 *     onSuccess: (data) => setHeroes(data.heroes)
 *   }
 * );
 * 
 * if (result.ok) {
 *   // Use result.data
 * } else {
 *   // result.error and result.detail available
 * }
 * ```
 */
export async function safeMutation<T>(
  actionName: string,
  fn: () => Promise<T>,
  opts: SafeMutationOptions<T> = {}
): Promise<MutationResult<T>> {
  const {
    onSuccess,
    onError,
    refreshUser = true,
    fetchUserFn,
    showErrorAlert = false,
    errorMessage,
    rethrow = false,
  } = opts;

  try {
    console.log(`[safeMutation] Starting: ${actionName}`);
    
    // Execute the mutation - ALWAYS await server response
    const data = await fn();
    
    console.log(`[safeMutation] Success: ${actionName}`);
    
    // Refresh user state from server (authoritative source)
    if (refreshUser && fetchUserFn) {
      try {
        await fetchUserFn();
      } catch (refreshError) {
        console.error(`[safeMutation] Failed to refresh user after ${actionName}:`, refreshError);
        // Don't fail the mutation if refresh fails - the mutation succeeded
      }
    }
    
    // Call success callback
    if (onSuccess) {
      await onSuccess(data);
    }
    
    return { ok: true, data };
    
  } catch (error: any) {
    const detail = getErrorDetail(error);
    console.error(`[safeMutation] Failed: ${actionName}`, error);
    
    // Call error callback
    if (onError) {
      onError(error);
    }
    
    // Only show alert if:
    // 1. showErrorAlert is true
    // 2. Error was NOT already handled by global interceptor
    if (showErrorAlert && !isErrorHandledGlobally(error)) {
      Alert.alert('Error', errorMessage || detail);
    }
    
    // Optionally rethrow for callers that need to handle further
    if (rethrow) {
      throw error;
    }
    
    return { ok: false, error, detail };
  }
}

/**
 * Helper to check if a mutation result succeeded
 * Useful for TypeScript narrowing
 */
export function isMutationSuccess<T>(result: MutationResult<T>): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Hook-friendly version that creates a bound executor
 * 
 * @example
 * ```tsx
 * const execute = createMutationExecutor(fetchUser);
 * const result = await execute('pullGacha', () => pullGacha('single', 'coins'));
 * ```
 */
export function createMutationExecutor(fetchUserFn?: () => Promise<void>) {
  return async function executeMutation<T>(
    actionName: string,
    fn: () => Promise<T>,
    opts: Omit<SafeMutationOptions<T>, 'fetchUserFn'> = {}
  ): Promise<MutationResult<T>> {
    return safeMutation(actionName, fn, {
      ...opts,
      fetchUserFn,
    });
  };
}

/**
 * NO-OP optimistic update prevention
 * Use this to wrap any attempted optimistic updates during refactoring
 * 
 * @deprecated Remove once all optimistic updates are eliminated
 */
export function preventOptimisticUpdate(
  actionName: string,
  _setter: () => void
): void {
  console.warn(
    `[BLOCKED] Optimistic update attempted for "${actionName}". ` +
    `State should only update after server confirms. Use safeMutation instead.`
  );
  // Do NOT call the setter - this is intentional
}
