// /app/frontend/lib/config/validate.ts
// Startup config validation - catches misconfig early
// Phase 3.15: Enhanced with production build assertions
// Phase 3.15 P0 Revision B: Explicit environment detection via EXPO_PUBLIC_ENV

/**
 * Environment modes for explicit control
 * EXPO_PUBLIC_ENV takes precedence over __DEV__ for production detection
 */
type EnvironmentMode = 'development' | 'staging' | 'production';

/**
 * Get the explicit environment mode
 * Priority:
 * 1. EXPO_PUBLIC_ENV if set (explicit control)
 * 2. __DEV__ as fallback (dev vs non-dev)
 */
function getEnvironmentMode(): EnvironmentMode {
  const explicitEnv = process.env.EXPO_PUBLIC_ENV?.toLowerCase();
  
  if (explicitEnv === 'production') return 'production';
  if (explicitEnv === 'staging') return 'staging';
  if (explicitEnv === 'development') return 'development';
  
  // Fallback to __DEV__ if no explicit env set
  return __DEV__ ? 'development' : 'production';
}

/**
 * Detect if this is a production environment
 * Uses explicit EXPO_PUBLIC_ENV if set, falls back to __DEV__
 */
function isProductionEnvironment(): boolean {
  return getEnvironmentMode() === 'production';
}

/**
 * Detect if this is a development environment
 */
function isDevelopmentEnvironment(): boolean {
  return getEnvironmentMode() === 'development';
}

/**
 * Validate critical configuration at startup
 * 
 * Behavior by environment:
 * - development: throws on errors (fail-fast for devs)
 * - staging: logs errors but doesn't crash
 * - production: logs errors but doesn't crash (graceful degradation)
 * 
 * Phase 3.15: Enhanced with production-specific validations
 * Phase 3.15 P0 Revision B: Uses EXPO_PUBLIC_ENV for explicit control
 */
export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const envMode = getEnvironmentMode();
  const isProd = isProductionEnvironment();

  // Log the environment mode for debugging
  console.log(`[config] Environment mode: ${envMode} (EXPO_PUBLIC_ENV=${process.env.EXPO_PUBLIC_ENV ?? 'not set'}, __DEV__=${__DEV__})`);

  // ==========================================================================
  // REQUIRED: Backend URL
  // ==========================================================================
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backend) {
    errors.push('Missing EXPO_PUBLIC_BACKEND_URL');
  } else if (!backend.startsWith('http://') && !backend.startsWith('https://')) {
    errors.push('EXPO_PUBLIC_BACKEND_URL must start with http:// or https://');
  } else if (isProd && !backend.startsWith('https://')) {
    // Phase 3.15: Production builds SHOULD use HTTPS
    warnings.push('EXPO_PUBLIC_BACKEND_URL should use https:// in production');
  }

  // ==========================================================================
  // RECOMMENDED: Sentry DSN (critical for prod crash reporting)
  // ==========================================================================
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!sentryDsn && isProd) {
    warnings.push('No EXPO_PUBLIC_SENTRY_DSN - crash reporting disabled in production');
  }

  // ==========================================================================
  // RECOMMENDED: Analytics (optional but useful for production)
  // ==========================================================================
  const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
  if (isProd && analyticsEnabled !== 'true') {
    // Just informational - analytics is optional
    console.log('[config] Analytics disabled in production (EXPO_PUBLIC_ANALYTICS_ENABLED !== "true")');
  }

  // ==========================================================================
  // INFO: RevenueCat (client-side SDK - only warn if missing)
  // ==========================================================================
  const revenueCatKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!revenueCatKey && isProd) {
    warnings.push('No EXPO_PUBLIC_REVENUECAT_API_KEY - RevenueCat SDK disabled');
  }

  // ==========================================================================
  // P0 Revision B: Warn if production build without explicit EXPO_PUBLIC_ENV
  // ==========================================================================
  if (!__DEV__ && !process.env.EXPO_PUBLIC_ENV) {
    warnings.push('Release build detected but EXPO_PUBLIC_ENV not set - assuming production (set explicitly for clarity)');
  }

  // ==========================================================================
  // Report warnings (logged but don't prevent startup)
  // ==========================================================================
  if (warnings.length > 0) {
    const warningMsg = `[config] Configuration warnings:\n${warnings.map(w => `  ⚠️ ${w}`).join('\n')}`;
    console.warn(warningMsg);
  }

  // ==========================================================================
  // Report errors (critical issues)
  // ==========================================================================
  if (errors.length > 0) {
    const message = `[config] Configuration errors:\n${errors.map(e => `  ❌ ${e}`).join('\n')}`;
    
    if (isDevelopmentEnvironment()) {
      // In dev, throw to make it obvious
      throw new Error(message);
    } else {
      // In staging/prod, log but don't crash - app may still partially work
      console.error(message);
    }
  }

  // Success
  if (errors.length === 0) {
    console.log(`[config] ✅ Configuration validated (${envMode} mode)`);
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

/**
 * Export environment helpers for use elsewhere
 */
export { getEnvironmentMode, isProductionEnvironment, isDevelopmentEnvironment };
