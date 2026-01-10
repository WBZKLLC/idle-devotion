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
// ─────────────────────────────────────────────────────────────

// SINGLE HERO ENDPOINT SWITCH
// Flip to true only when backend supports: GET /user/{username}/heroes/{userHeroId}
export const SINGLE_HERO_ENDPOINT_AVAILABLE = false as const;

// Update this when backend endpoint is known.
// Expected route: GET /user/{username}/heroes/{userHeroId}
function singleHeroPath(username: string, userHeroId: string) {
  return `/user/${encodeURIComponent(username)}/heroes/${encodeURIComponent(userHeroId)}`;
}

export async function getUserHeroById(username: string, userHeroId: string) {
  const u = requireUsername(username);

  if (SINGLE_HERO_ENDPOINT_AVAILABLE) {
    if (__DEV__) console.log("[api] SINGLE_HERO_ENDPOINT_AVAILABLE=true (no list fallback permitted)");
    // Hard guardrail: no list fallback permitted once endpoint exists.
    try {
      const res = await api.get(singleHeroPath(u, userHeroId));
      return res.data;
    } catch (e: any) {
      // No fallback by design.
      throw new Error(
        `[api.getUserHeroById] Single-hero endpoint is enabled but request failed. ` +
        `Do NOT fallback to list fetch. Original error: ${e?.message ?? String(e)}`
      );
    }
  }

  // DEV warning: make "flag not flipped" obvious during testing
  if (__DEV__) {
    console.warn(
      `[api.getUserHeroById] Using list fallback. If the backend now supports single-hero fetch, ` +
      `flip SINGLE_HERO_ENDPOINT_AVAILABLE to true to enforce no-list behavior.`
    );
  }

  // TEMP (pre-endpoint): fallback to list and find.
  // This is allowed ONLY while SINGLE_HERO_ENDPOINT_AVAILABLE === false.
  const list = await getUserHeroes(u);
  const found = list.find((h: any) => String(h?.id) === String(userHeroId));
  if (!found) throw new Error(`Hero not found: ${userHeroId}`);
  return found;
}

// ─────────────────────────────────────────────────────────────
// FULL HERO LIST (centralized; screens must not call axios/fetch directly)
// Rule: screens import getUserHeroes()/getUserHeroById() — never hit /user/:username/heroes directly.
// ─────────────────────────────────────────────────────────────

function coerceHeroList(data: any) {
  return Array.isArray(data) ? data : (data?.heroes ?? data ?? []);
}

export async function getUserHeroes(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/heroes`);
  return coerceHeroList(res.data);
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
// EVENTS / EVENT BANNERS (events.tsx)
// ─────────────────────────────────────────────────────────────

export async function getEventBanners() {
  const res = await api.get(`/event-banners`);
  return res.data;
}

export async function pullEventBanner(username: string, bannerId: string, multi: boolean = false) {
  const u = requireUsername(username);
  const res = await api.post(
    `/event-banners/${encodeURIComponent(bannerId)}/pull`,
    null,
    { params: { username: u, multi } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// ADMIN (admin.tsx)
// ─────────────────────────────────────────────────────────────

export async function adminGetUser(usernameOrId: string) {
  const q = requireUsername(usernameOrId);
  const res = await api.get(`/user/${encodeURIComponent(q)}`);
  return res.data;
}

export async function adminGrantResources(targetUsername: string, adminKey: string, resources: Record<string, number>) {
  const res = await api.post(
    `/admin/grant-resources/${encodeURIComponent(targetUsername)}`,
    { resources },
    { params: { admin_key: adminKey } }
  );
  return res.data;
}

export async function adminSetVIP(targetUsername: string, adminKey: string, vipLevel: number) {
  const res = await api.post(
    `/admin/set-vip/${encodeURIComponent(targetUsername)}`,
    null,
    { params: { admin_key: adminKey, vip_level: vipLevel } }
  );
  return res.data;
}

export async function adminMuteUser(targetUsername: string, adminKey: string, durationHours: number) {
  const res = await api.post(
    `/admin/mute-user/${encodeURIComponent(targetUsername)}`,
    null,
    { params: { admin_key: adminKey, duration_hours: durationHours } }
  );
  return res.data;
}

export async function adminBanUser(targetUsername: string, adminKey: string, reason: string) {
  const res = await api.post(
    `/admin/ban-user/${encodeURIComponent(targetUsername)}`,
    null,
    { params: { admin_key: adminKey, reason } }
  );
  return res.data;
}

export async function adminDeleteAccount(targetUsername: string, adminKey: string) {
  const res = await api.delete(
    `/admin/delete-account/${encodeURIComponent(targetUsername)}`,
    { params: { admin_key: adminKey } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// GUILD WAR (guild-war.tsx)
// ─────────────────────────────────────────────────────────────

export async function getGuildWarStatus() {
  const res = await api.get(`/guild-war/status`);
  return res.data;
}

export async function getGuildWarLeaderboard(limit: number = 50) {
  const res = await api.get(`/guild-war/leaderboard`, {
    params: { limit },
  });
  return res.data;
}

export async function getGuildWarHistory(username: string, limit: number = 20) {
  const u = requireUsername(username);
  const res = await api.get(`/guild-war/history/${encodeURIComponent(u)}`, {
    params: { limit },
  });
  return res.data;
}

export async function registerGuildWar(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/guild-war/register/${encodeURIComponent(u)}`);
  return res.data;
}

export async function attackGuildWarApi(username: string, targetGuildId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/guild-war/attack/${encodeURIComponent(u)}`,
    null,
    { params: { target_guild_id: targetGuildId } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// CHAT (chat.tsx)
// ─────────────────────────────────────────────────────────────

export async function getChatBubbles(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/chat-bubbles`);
  return res.data;
}

export async function getChatMessages(params?: {
  channel_type?: string;
  limit?: number;
  before?: string;
}) {
  const res = await api.get(`/chat/messages`, { params });
  return res.data;
}

export async function getUserChatBubble(senderUsername: string) {
  const s = requireUsername(senderUsername);
  const res = await api.get(`/chat/user-bubble/${encodeURIComponent(s)}`);
  return res.data;
}

export async function sendChatMessage(payload: {
  username: string;
  message: string;
  channel_type?: string;
  language?: string;
}) {
  const u = requireUsername(payload.username);
  const res = await api.post(
    `/chat/send`,
    null,
    { params: { username: u, message: payload.message, channel_type: payload.channel_type, language: payload.language } }
  );
  return res.data;
}

export async function equipChatBubble(username: string, bubbleId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/user/${encodeURIComponent(u)}/equip-chat-bubble`,
    null,
    { params: { bubble_id: bubbleId } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// GUILD (guild.tsx)
// ─────────────────────────────────────────────────────────────

export async function getGuild(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/guild/${encodeURIComponent(u)}`);
  return res.data;
}

export async function getGuildLevelInfo(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/guild/${encodeURIComponent(u)}/level-info`);
  return res.data;
}

export async function getAvailableGuilds(limit: number = 20) {
  const res = await api.get(`/guilds`, { params: { limit } });
  return res.data;
}

export async function createGuildApi(username: string, guildName: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/guild/create`,
    null,
    { params: { username: u, guild_name: guildName } }
  );
  return res.data;
}

export async function joinGuildApi(username: string, guildId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/guild/join`,
    null,
    { params: { username: u, guild_id: guildId } }
  );
  return res.data;
}

export async function leaveGuildApi(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/guild/leave`, null, { params: { username: u } });
  return res.data;
}

export async function getGuildBoss(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/guild/${encodeURIComponent(u)}/boss`);
  return res.data;
}

export async function attackGuildBoss(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/guild/${encodeURIComponent(u)}/boss/attack`);
  return res.data;
}

export async function getGuildDonations(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/guild/${encodeURIComponent(u)}/donations`);
  return res.data;
}

export async function donateToGuildApi(username: string, tier: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/guild/${encodeURIComponent(u)}/donate`,
    null,
    { params: { tier } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// PROFILE / FRAMES (profile.tsx)
// ─────────────────────────────────────────────────────────────

export async function getUserGuild(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/guild/${encodeURIComponent(u)}`);
  return res.data;
}

export async function getUserFrames(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/frames`);
  return res.data;
}

export async function equipFrameApi(username: string, frameId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/user/${encodeURIComponent(u)}/equip-frame`,
    null,
    { params: { frame_id: frameId } }
  );
  return res.data;
}

export async function unequipFrameApi(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/user/${encodeURIComponent(u)}/unequip-frame`);
  return res.data;
}

export async function redeemCode(username: string, code: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/codes/redeem`,
    null,
    { params: { username: u, code } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// LAUNCH BANNER (launch-banner.tsx)
// ─────────────────────────────────────────────────────────────

export async function getLaunchBannerStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/launch-banner/status/${encodeURIComponent(u)}`);
  return res.data;
}

export async function pullLaunchBanner(username: string, multi: boolean = false) {
  const u = requireUsername(username);
  const res = await api.post(
    `/launch-banner/pull/${encodeURIComponent(u)}`,
    null,
    { params: { multi } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// LOGIN REWARDS (login-rewards.tsx)
// ─────────────────────────────────────────────────────────────

export async function getLoginRewardsStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/login-rewards/${encodeURIComponent(u)}`);
  return res.data;
}

export async function claimLoginReward(username: string, day: number) {
  const u = requireUsername(username);
  const res = await api.post(
    `/login-rewards/${encodeURIComponent(u)}/claim/${day}`,
    null
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// JOURNEY / DAILY TRACK (journey.tsx)
// ─────────────────────────────────────────────────────────────

export async function getJourneyStatus(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/journey/status/${encodeURIComponent(u)}`);
  return res.data;
}

export async function claimJourneyDaily(username: string, day: number) {
  const u = requireUsername(username);
  const res = await api.post(
    `/journey/claim-daily/${encodeURIComponent(u)}`,
    null,
    { params: { day } }
  );
  return res.data;
}

export async function claimJourneyMilestone(username: string, milestoneId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/journey/claim-milestone/${encodeURIComponent(u)}`,
    null,
    { params: { milestone_id: milestoneId } }
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

// ─────────────────────────────────────────────────────────────
// AUTH / REGISTER / LOGIN (gameStore.ts)
// ─────────────────────────────────────────────────────────────

export async function registerUser(payload: {
  username: string;
  password: string;
  server_id?: string;
  [k: string]: any;
}) {
  const res = await api.post(`/user/register`, payload);
  return res.data;
}

export async function loginAuth(payload: {
  username: string;
  password: string;
  [k: string]: any;
}) {
  const res = await api.post(`/auth/login`, payload);
  return res.data;
}

/** Daily login trigger */
export async function triggerDailyLogin(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/user/${encodeURIComponent(u)}/login`);
  return res.data;
}

export async function setPassword(username: string, newPassword: string) {
  const u = requireUsername(username);
  if (!newPassword) throw new Error('Missing new password');
  const res = await api.post(`/auth/set-password`, null, {
    params: { username: u, new_password: newPassword },
  });
  return res.data;
}

export async function verifyAuthToken(token: string) {
  if (!token) throw new Error('Missing token');
  const res = await api.get(`/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// USER (gameStore.ts helpers)
// ─────────────────────────────────────────────────────────────

// NOTE: fetchUser is already defined at line ~98, re-exported here for clarity
// Do not add duplicate fetchUser - it causes SyntaxError

export async function getUserCR(username: string) {
  const u = requireUsername(username);
  const res = await api.get(`/user/${encodeURIComponent(u)}/cr`);
  return res.data;
}

export async function setProfilePicture(username: string, heroId: string) {
  const u = requireUsername(username);
  const res = await api.post(
    `/user/${encodeURIComponent(u)}/profile-picture`,
    null,
    { params: { hero_id: heroId } }
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// HERO CATALOG (gameStore.ts)
// ─────────────────────────────────────────────────────────────

export async function fetchAllHeroesCatalog() {
  const res = await api.get(`/heroes`);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// PURCHASE VERIFY (RevenueCatService.ts)
// ─────────────────────────────────────────────────────────────

export async function verifyPurchase(payload: {
  username: string;
  productId: string;
  transactionId: string;
  platform?: 'ios' | 'android' | 'web';
  receipt?: string;
  [k: string]: any;
}) {
  // Keep wire shape flexible for RevenueCat payload evolution
  const res = await api.post(`/purchase/verify`, payload);
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// IDLE CLAIM (gameStore.ts)
// ─────────────────────────────────────────────────────────────

export async function claimIdle(username: string) {
  const u = requireUsername(username);
  const res = await api.post(`/idle/claim`, null, { params: { username: u } });
  return res.data;
}
