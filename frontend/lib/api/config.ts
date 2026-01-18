/**
 * Centralized API Configuration
 * 
 * Single source of truth for API base URL across all platforms.
 * Web preview, device, and tunnel all use this.
 */

import { Platform } from 'react-native';
import { loadAuthToken } from '../authStorage';

/**
 * Get the API base URL based on platform and environment.
 * 
 * Priority:
 * 1. EXPO_PUBLIC_BACKEND_URL (if set)
 * 2. EXPO_PUBLIC_API_URL (legacy fallback)
 * 3. Platform-specific defaults
 */
function getApiBaseUrl(): string {
  // Check environment variables - normalize trailing slashes
  const RAW = process.env.EXPO_PUBLIC_BACKEND_URL 
    ?? process.env.EXPO_PUBLIC_API_URL 
    ?? '';
  
  // Use explicitly set URLs first (trimmed of trailing slashes)
  if (RAW) {
    return RAW.replace(/\/+$/, '');
  }
  
  // Platform-specific defaults when no env var is set
  if (Platform.OS === 'web') {
    // Web preview: use relative paths (assumes proxy is configured)
    // If no proxy, this will fail - but that's expected
    return '';
  }
  
  // Native device: default to localhost:8001 (won't work on real device without tunnel)
  // In production, EXPO_PUBLIC_BACKEND_URL should always be set
  return 'http://localhost:8001';
}

/**
 * The API base URL - use this everywhere instead of hardcoding.
 * 
 * Usage:
 *   import { API_BASE } from '@/lib/api/config';
 *   fetch(`${API_BASE}/api/endpoint`, { ... });
 */
export const API_BASE = getApiBaseUrl();

/**
 * Construct a full API URL.
 * 
 * @param path - The API path (e.g., '/api/daily/status')
 * @returns Full URL with base
 */
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

/**
 * Get auth headers for API requests.
 * 
 * @param token - JWT token
 * @returns Headers object with Authorization
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Log the API base URL in development for debugging
if (__DEV__) {
  console.log('[API Config] Base URL:', API_BASE || '(relative paths)');
  console.log('[API Config] Platform:', Platform.OS);
  
  // WARN if API_BASE is empty - likely means env var not picked up
  if (!API_BASE) {
    console.warn(
      '[API Config] ⚠️ API_BASE is empty! ' +
      'Set EXPO_PUBLIC_BACKEND_URL in .env for web preview to work. ' +
      'Falling back to relative paths (will 404 if no proxy configured).'
    );
  }
}
