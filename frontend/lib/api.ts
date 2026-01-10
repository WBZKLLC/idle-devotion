// /app/frontend/lib/api.ts
// SINGLE SOURCE OF TRUTH for all backend API calls
// Screens should import from here to prevent endpoint string drift

import axios from 'axios';

const RAW = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_BASE = RAW
  ? `${RAW.replace(/\/$/, '')}/api`
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
  currencyType: string // 'gems' | 'coins' | 'crystals' | 'divine_essence'
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

// ─────────────────────────────────────────────────────────────
// TEAM BUILDER
// ─────────────────────────────────────────────────────────────

export async function getTeamsFull(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/team/${encodeURIComponent(u)}/full`);
  return res.data;
}

export async function updateTeamSlots(teamId: string, username: string, slotsData: any) {
  const u = requireUsername(username);
  const res = await api.put(
    `/team/${encodeURIComponent(teamId)}/slots`,
    slotsData,
    { params: { username: u } }
  );
  return res.data;
}

export async function createTeamFull(username: string, teamName: string, slotsData: any) {
  const u = requireUsername(username);
  const res = await api.post(
    `/team/create-full`,
    slotsData,
    { params: { username: u, team_name: teamName } }
  );
  return res.data;
}

export async function setActiveTeam(teamId: string, username: string) {
  const u = requireUsername(username);
  const res = await api.put(
    `/team/${encodeURIComponent(teamId)}/set-active`,
    null,
    { params: { username: u } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// IDLE REWARDS (index.tsx)
// ─────────────────────────────────────────────────────────────

export async function getIdleStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/idle/status/${encodeURIComponent(u)}`);
  return res.data;
}

export async function instantCollectIdle(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/idle/instant-collect/${encodeURIComponent(u)}`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// HERO UPGRADE (hero-upgrade.tsx)
// ─────────────────────────────────────────────────────────────

export async function getHeroDetails(heroId: string, username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/hero/${encodeURIComponent(heroId)}/details`, {
    params: { username: u }
  });
  return res.data;
}

export async function levelUpHero(heroId: string, username: string, levels: number = 1) {
  const u = requireUsername(username);
  const res = await api.post(`/hero/${encodeURIComponent(heroId)}/level-up`, null, {
    params: { username: u, levels }
  });
  return res.data;
}

export async function awakenHero(heroId: string, username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/hero/${encodeURIComponent(heroId)}/awaken`, null, {
    params: { username: u }
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// HERO MANAGER (hero-manager.tsx)
// ─────────────────────────────────────────────────────────────

export async function getTeamsByMode(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/team/${encodeURIComponent(u)}/by-mode`);
  return res.data;
}

export async function getTeamsList(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/team/${encodeURIComponent(u)}`);
  return res.data;
}

export async function saveModeTeam(username: string, mode: string, heroIds: string[]) {
  const u = requireUsername(username);
  const res = await api.post(
    `/team/save-mode-team`,
    { hero_ids: heroIds },
    { params: { username: u, mode } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// ARENA (arena.tsx)
// ─────────────────────────────────────────────────────────────

export async function getArenaRecord(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/arena/record/${encodeURIComponent(u)}`);
  return res.data;
}

export async function getArenaOpponents(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/arena/opponents/${encodeURIComponent(u)}`);
  return res.data;
}

export async function startArenaBattle(
  username: string,
  opponentUsername: string
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/arena/battle/${encodeURIComponent(u)}`,
    { opponent: opponentUsername }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD (leaderboard.tsx)
// ─────────────────────────────────────────────────────────────

export async function getLeaderboard(type: string, limit: number = 50) {
  const res = await api.get(`/leaderboard/${encodeURIComponent(type)}`, {
    params: { limit },
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// ABYSS (abyss.tsx)
// ─────────────────────────────────────────────────────────────

export async function getAbyssStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/abyss/${encodeURIComponent(u)}/status`);
  return res.data;
}

export async function getAbyssLeaderboard(serverId: string, limit: number = 50) {
  const res = await api.get(`/abyss/leaderboard/${encodeURIComponent(serverId)}`, {
    params: { limit },
  });
  return res.data;
}

export async function getAbyssRecords(username: string, level: number) {
  const u = requireUsername(username);
  const res = await api.get(
    `/abyss/${encodeURIComponent(u)}/records`,
    { params: { level } }
  );
  return res.data;
}

export async function attackAbyss(username: string, level?: number) {
  const u = requireUsername(username);
  const res = await api.post(
    `/abyss/${encodeURIComponent(u)}/attack`,
    null,
    { params: level ? { level } : {} }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// EQUIPMENT / RUNES (equipment.tsx)
// ─────────────────────────────────────────────────────────────

export async function getUserEquipment(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/equipment/${encodeURIComponent(u)}`);
  return res.data;
}

export async function getUserRunes(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/equipment/${encodeURIComponent(u)}/runes`);
  return res.data;
}

export async function getEquipmentHeroes(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/heroes`);
  return Array.isArray(res.data) ? res.data : (res.data?.heroes ?? res.data ?? []);
}

export async function enhanceEquipment(
  username: string,
  equipmentId: string,
  materials: Array<{ id: string; qty: number }>
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/equipment/${encodeURIComponent(u)}/enhance`,
    { equipment_id: equipmentId, materials }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// CAMPAIGN / STORY (campaign.tsx)
// ─────────────────────────────────────────────────────────────

export async function getCampaignChapters(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/campaign/chapters`, {
    params: { username: u },
  });
  return res.data;
}

export async function getCampaignChapterDetail(
  username: string,
  chapterId: string
) {
  const u = requireUsername(username);
  const res = await api.get(
    `/campaign/chapter/${encodeURIComponent(chapterId)}`,
    { params: { username: u } }
  );
  return res.data;
}

export async function startCampaignBattle(
  username: string,
  stageId: string,
  teamId?: string
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/campaign/battle`,
    { stage_id: stageId, team_id: teamId },
    { params: { username: u } }
  );
  return res.data;
}

export async function completeCampaignStage(
  username: string,
  chapterId: number,
  stageNum: number,
  stars: number = 3
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/campaign/stage/${chapterId}/${stageNum}/complete`,
    { stars },
    { params: { username: u } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// DUNGEONS / STAGES (dungeons.tsx)
// ─────────────────────────────────────────────────────────────

export async function getStagesInfo() {
  const res = await api.get(`/stages/info`);
  return res.data;
}

export async function getDungeonProgress(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/stages/${encodeURIComponent(u)}/progress`);
  return res.data;
}

export async function getStamina(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/economy/${encodeURIComponent(u)}/stamina`);
  return res.data;
}

export async function startDungeonStage(
  username: string,
  stageId: string,
  teamId?: string
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/stages/${encodeURIComponent(stageId)}/start`,
    { team_id: teamId },
    { params: { username: u } }
  );
  return res.data;
}

export async function sweepDungeonStage(
  username: string,
  stageId: string,
  times: number = 1
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/stages/${encodeURIComponent(stageId)}/sweep`,
    null,
    { params: { username: u, times } }
  );
  return res.data;
}

export async function battleDungeonStage(
  username: string,
  stageType: string,
  stageId: number
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/stages/${encodeURIComponent(u)}/${stageType}/${stageId}`,
    { stage_id: stageId }
  );
  return res.data;
}

export async function sweepDungeonStageByType(
  username: string,
  stageType: string,
  stageId: number,
  count: number = 1
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/stages/${encodeURIComponent(u)}/sweep/${stageType}/${stageId}`,
    { stage_id: stageId, count }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// COMBAT (combat.tsx)
// ─────────────────────────────────────────────────────────────

export async function startDetailedCombat(username: string, enemyName: string, enemyPower: number) {
  const u = requireUsername(username);
  const res = await api.post(`/combat/detailed`, null, {
    params: { username: u, enemy_name: enemyName, enemy_power: enemyPower }
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// STORE / MONETIZATION (store.tsx)
// ─────────────────────────────────────────────────────────────

export async function getCrystalPackages() {
  const res = await api.get(`/store/crystal-packages`);
  return res.data;
}

export async function getDivinePackages(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/store/divine-packages`, {
    params: { username: u },
  });
  return res.data;
}

export async function getVipInfo(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/vip/info/${encodeURIComponent(u)}`);
  return res.data;
}

export async function purchasePackage(
  username: string,
  packageId: string,
  paymentMethod?: string
) {
  const u = requireUsername(username);
  const res = await api.post(
    `/store/purchase`,
    { package_id: packageId, payment_method: paymentMethod },
    { params: { username: u } }
  );
  return res.data;
}

export async function purchaseCrystals(username: string, packageId: string) {
  const u = requireUsername(username);
  const res = await api.post(`/store/purchase-crystals`, null, {
    params: { username: u, package_id: packageId }
  });
  return res.data;
}

export async function purchaseDivine(username: string, packageId: string) {
  const u = requireUsername(username);
  const res = await api.post(`/store/purchase-divine`, null, {
    params: { username: u, package_id: packageId }
  });
  return res.data;
}
