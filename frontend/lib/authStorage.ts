// /app/frontend/lib/authStorage.ts
// Canonical auth persistence - single source of truth for token storage

import { storageGet, storageRemove, storageSet } from './storage';

export const AUTH_TOKEN_KEY = '@idledevotion/auth/token';
export const AUTH_USERNAME_KEY = '@idledevotion/auth/username';

export async function saveAuthData(username: string, token: string) {
  await storageSet(AUTH_USERNAME_KEY, username);
  await storageSet(AUTH_TOKEN_KEY, token);
  if (__DEV__) console.log('[authStorage] Saved auth data for:', username);
}

export async function loadAuthToken(): Promise<string | null> {
  const token = await storageGet(AUTH_TOKEN_KEY);
  if (__DEV__) console.log('[authStorage] Loaded token:', token ? '(exists)' : '(null)');
  return token;
}

export async function loadAuthUsername(): Promise<string | null> {
  return storageGet(AUTH_USERNAME_KEY);
}

export async function clearAuthData() {
  await storageRemove(AUTH_USERNAME_KEY);
  await storageRemove(AUTH_TOKEN_KEY);
  if (__DEV__) console.log('[authStorage] Cleared auth data');
}
