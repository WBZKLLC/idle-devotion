// /app/frontend/lib/config/validate.ts
// Startup config validation - catches misconfig early
// Phase 3.15: Enhanced with production build assertions

/**
 * Detect if this is likely a production/release build
 * Uses Expo's __DEV__ flag as primary indicator
 */
function isProductionBuild(): boolean {
  return !__DEV__;
}

/**
 * Validate critical configuration at startup
 * In dev: throws immediately on missing config
 * In prod: logs error but doesn't crash (graceful degradation)
 * 
 * Phase 3.15: Enhanced with production-specific validations
 */
export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = isProductionBuild();

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
    
    if (__DEV__) {
      // In dev, throw to make it obvious
      throw new Error(message);
    } else {
      // In prod, log but don't crash - app may still partially work
      console.error(message);
    }
  }

  // Success
  if (errors.length === 0) {
    console.log(`[config] ✅ Configuration validated (${isProd ? 'production' : 'development'} mode)`);
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
