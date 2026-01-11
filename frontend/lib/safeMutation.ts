// /app/frontend/lib/safeMutation.ts
// SAFE MUTATION WRAPPER
// Enforces consistent loading/success/failure patterns for all state mutations
// Prevents optimistic updates and ensures server-authoritative state

import { Alert } from 'react-native';

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
  
  /** Show default error alert (default: false - interceptor handles it) */
  showErrorAlert?: boolean;
  
  /** Custom error message for alert */
  errorMessage?: string;
}

/**
 * Safe mutation wrapper that enforces consistent patterns:
 * 1. Always awaits the server response
 * 2. Optionally refreshes user state after success
 * 3. Handles errors with shared messaging
 * 4. Never assumes success - state only updates after server confirms
 * 
 * @param actionName - Name of the action for logging
 * @param fn - The async mutation function to execute
 * @param opts - Options for customizing behavior
 * @returns The result of the mutation, or undefined if it failed
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
 * ```
 */
export async function safeMutation<T>(
  actionName: string,
  fn: () => Promise<T>,
  opts: SafeMutationOptions<T> = {}
): Promise<T | undefined> {
  const {
    onSuccess,
    onError,
    refreshUser = true,
    fetchUserFn,
    showErrorAlert = false,
    errorMessage,
  } = opts;

  try {
    console.log(`[safeMutation] Starting: ${actionName}`);
    
    // Execute the mutation - ALWAYS await server response
    const result = await fn();
    
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
      await onSuccess(result);
    }
    
    return result;
    
  } catch (error: any) {
    console.error(`[safeMutation] Failed: ${actionName}`, error);
    
    // Call error callback
    if (onError) {
      onError(error);
    }
    
    // Show error alert if requested (usually the interceptor handles this)
    if (showErrorAlert) {
      const message = errorMessage || error?.response?.data?.detail || error?.message || 'Something went wrong';
      Alert.alert('Error', message);
    }
    
    // Don't re-throw - return undefined to indicate failure
    // This allows screens to check: if (result) { ... }
    return undefined;
  }
}

/**
 * Hook-friendly version that returns loading state
 * Use this when you need loading indicators in components
 * 
 * @example
 * ```tsx
 * const { execute, isLoading } = useSafeMutation();
 * 
 * const handlePull = async () => {
 *   const result = await execute('pullGacha', () => pullGacha('single', 'coins'));
 *   if (result) setHeroes(result.heroes);
 * };
 * ```
 */
export function createMutationExecutor(fetchUserFn?: () => Promise<void>) {
  return async function executeMutation<T>(
    actionName: string,
    fn: () => Promise<T>,
    opts: Omit<SafeMutationOptions<T>, 'fetchUserFn'> = {}
  ): Promise<T | undefined> {
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
