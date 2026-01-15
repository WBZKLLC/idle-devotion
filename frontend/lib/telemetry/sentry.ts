// /app/frontend/lib/telemetry/sentry.ts
// Crash reporting with Sentry - sanitized, no PII/tokens
import * as Sentry from 'sentry-expo';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) {
    if (__DEV__) console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: DSN,
    enableInExpoDevelopment: false,
    debug: __DEV__,
    environment: process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production'),
    // Sanitize sensitive data
    beforeSend(event) {
      // Remove any Authorization headers from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data?.headers) {
            const { Authorization, authorization, ...safeHeaders } = bc.data.headers;
            bc.data.headers = safeHeaders;
          }
          return bc;
        });
      }
      return event;
    },
    // Keep defaults conservative; add traces later if needed
  });

  if (__DEV__) console.log('[Sentry] Initialized');
}

// Attach user context once known (only username, no tokens)
export function sentrySetUser(user?: { username?: string }) {
  if (!DSN) return;
  
  if (!user?.username) {
    Sentry.Native.setUser(null);
    return;
  }
  
  Sentry.Native.setUser({ id: user.username });
}

// Manual error capture for non-crash errors
export function sentryCapture(error: Error, context?: Record<string, any>) {
  if (!DSN) return;
  
  try {
    Sentry.Native.captureException(error, { extra: context });
  } catch {}
}
