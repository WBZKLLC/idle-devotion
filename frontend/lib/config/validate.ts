// /app/frontend/lib/config/validate.ts
// Startup config validation - catches misconfig early

/**
 * Validate critical configuration at startup
 * In dev: throws immediately on missing config
 * In prod: logs error but doesn't crash
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Required: Backend URL
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backend) {
    errors.push('Missing EXPO_PUBLIC_BACKEND_URL');
  } else if (!backend.startsWith('http://') && !backend.startsWith('https://')) {
    errors.push('EXPO_PUBLIC_BACKEND_URL must start with http:// or https://');
  }

  // Warning: Sentry DSN (not required but recommended for prod)
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!sentryDsn && !__DEV__) {
    console.warn('[config] No EXPO_PUBLIC_SENTRY_DSN - crash reporting disabled in production');
  }

  // Report errors
  if (errors.length > 0) {
    const message = `[config] Configuration errors:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    
    if (__DEV__) {
      // In dev, throw to make it obvious
      throw new Error(message);
    } else {
      // In prod, log but don't crash - app may still partially work
      console.error(message);
    }
  }
}

/**
 * Get validated backend URL
 */
export function getBackendUrl(): string {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_BACKEND_URL is not configured');
  }
  return url.replace(/\/$/, ''); // Remove trailing slash
}
