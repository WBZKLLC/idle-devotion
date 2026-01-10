// /app/frontend/lib/api.ts
// SINGLE SOURCE OF TRUTH for all backend API calls
// Screens should import from here to prevent endpoint string drift

import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : '/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

export function requireUsername(username?: string) {
  if (!username) throw new Error('Missing username');
  return username;
}

// ─────────────────────────────────────────────────────────────
// USER HEROES
// ─────────────────────────────────────────────────────────────

export async function fetchUserHeroes(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/heroes`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// STAR PROMOTION (canonical endpoint)
// POST /api/hero/{user_hero_id}/promote-star?username=...
// ─────────────────────────────────────────────────────────────

export async function promoteHeroStar(userHeroId: string, username: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/hero/${encodeURIComponent(userHeroId)}/promote-star`,
    null,
    { params: { username: u } }
  );
  return res.data as {
    success: boolean;
    new_stars: number;
    shards_used: number;
    remaining_shards: number;
  };
}

// ─────────────────────────────────────────────────────────────
// HERO PROGRESSION (read model for hero-progression screen)
// GET /api/hero/{username}/hero/{heroId}/progression
// NOTE: Falls back gracefully if endpoint doesn't exist
// ─────────────────────────────────────────────────────────────

export async function getHeroProgression(username: string, heroId: string) {
  const u = requireUsername(username);
  const res = await api.get(`/hero/${encodeURIComponent(u)}/hero/${encodeURIComponent(heroId)}/progression`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// SINGLE HERO FETCH (fallback when hero not in store cache)
// NOTE: Temporary implementation - fetches full list and filters.
// Replace with GET /user/{username}/heroes/{userHeroId} once backend exists.
// Screens call getUserHeroById() and never hit list endpoints directly.
// ─────────────────────────────────────────────────────────────

export async function getUserHeroById(username: string, userHeroId: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/heroes`);
  const list = Array.isArray(res.data) ? res.data : (res.data?.heroes ?? res.data ?? []);
  const found = list.find((h: any) => String(h?.id) === String(userHeroId));
  if (!found) throw new Error('Hero not found');
  return found;
}

// ─────────────────────────────────────────────────────────────
// FULL HERO LIST (centralized; screens must not call axios/fetch directly)
// Rule: screens import getUserHeroes()/getUserHeroById() — never hit /user/:username/heroes directly.
// ─────────────────────────────────────────────────────────────

export async function getUserHeroes(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/heroes`);
  return Array.isArray(res.data) ? res.data : (res.data?.heroes ?? res.data ?? []);
}

// RULE: All hero endpoints live here.
// Screens should not build URLs manually (prevents drift).

// ─────────────────────────────────────────────────────────────
// USER AUTH / PROFILE
// ─────────────────────────────────────────────────────────────

export async function fetchUser(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// GACHA / SUMMON
// POST /api/gacha/pull?username=...
// ─────────────────────────────────────────────────────────────

export async function pullGacha(
  username: string,
  pullType: 'single' | 'multi',
  currencyType: 'gems' | 'coins'
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/gacha/pull`,
    { pull_type: pullType, currency_type: currencyType },
    { params: { username: u } }
  );
  return res.data;
}

// Legacy alias for backwards compatibility
export async function performSummon(username: string, summonType: 'single' | 'multi') {
  return pullGacha(username, summonType, 'gems');
}

// ─────────────────────────────────────────────────────────────
// HERO UPGRADE
// POST /api/user/{username}/heroes/{heroInstanceId}/upgrade
// ─────────────────────────────────────────────────────────────

export async function upgradeHero(username: string, heroInstanceId: string) {
  const u = requireUsername(username);
  const res = await api.post(`/user/${encodeURIComponent(u)}/heroes/${encodeURIComponent(heroInstanceId)}/upgrade`);
  return res.data;
}

// Add more hero endpoints here ONLY.
// Screens should import from lib/api.ts so route strings never drift again.

// ─────────────────────────────────────────────────────────────
// SELENE BANNER (limited-time gacha)
// ─────────────────────────────────────────────────────────────

export async function getSeleneBannerStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/selene-banner/status/${encodeURIComponent(u)}`);
  return res.data;
}

export async function pullSeleneBanner(username: string, multi: boolean) {
  const u = requireUsername(username);
  const res = await api.post(
    `/selene-banner/pull/${encodeURIComponent(u)}`,
    null,
    { params: { multi } }
  );
  return res.data;
}
