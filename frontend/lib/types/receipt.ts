// /app/frontend/lib/types/receipt.ts
// Phase 3.24: Canonical Reward Receipt Type
// Phase 3.26: Added mail_receipt_claim source
//
// Single source of truth for receipt shape.
// All reward-granting endpoints return this shape.
// Frontend MUST use this type for all receipt handling.
//
// LOCKED source values:
// - bond_tribute
// - mail_reward_claim
// - mail_gift_claim
// - mail_receipt_claim (Phase 3.26)
// - daily_login_claim
// - idle_claim
// - admin_grant

/**
 * Valid reward source types (matches backend RewardSource)
 */
export type RewardSource =
  | 'bond_tribute'
  | 'mail_reward_claim'
  | 'mail_gift_claim'
  | 'mail_receipt_claim'  // Phase 3.26: Fallback queue receipts
  | 'daily_login_claim'
  | 'idle_claim'
  | 'admin_grant'
  | 'event_claim'  // Phase 3.29: Events/Quests
  | 'store_redeem';  // Phase 3.30: Store dev redeem

/**
 * Single reward item in a receipt
 */
export interface RewardItem {
  type: string;  // gold, gems, coins, stamina, hero_shard, etc.
  amount: number;
  hero_id?: string | null;  // For hero-specific rewards
  item_id?: string | null;  // For specific items
}

/**
 * User balance snapshot
 */
export interface Balances {
  gold: number;
  coins: number;
  gems: number;
  divine_gems: number;
  crystals: number;
  stamina: number;
  divine_essence: number;
  soul_dust: number;
  skill_essence: number;
  enhancement_stones: number;
  hero_shards: number;
  rune_essence: number;
  [key: string]: number;  // Allow additional currencies
}

/**
 * Canonical receipt shape for all reward grants (Phase 3.24)
 * 
 * REQUIRED fields: source, sourceId, items, balances
 * All reward endpoints MUST return this shape.
 */
export interface RewardReceipt {
  source: RewardSource;
  sourceId: string;  // Origin record ID - ALWAYS required
  items: RewardItem[];  // Rewards granted (empty array if already claimed)
  balances: Balances;  // Current balances after grant
  alreadyClaimed?: boolean;  // True if idempotent duplicate claim
  message?: string;  // Optional human-readable message
}

/**
 * Type guard: Check if an object is a valid RewardReceipt
 */
export function isValidReceipt(obj: unknown): obj is RewardReceipt {
  if (!obj || typeof obj !== 'object') return false;
  const receipt = obj as Record<string, unknown>;
  
  return (
    typeof receipt.source === 'string' &&
    typeof receipt.sourceId === 'string' &&
    Array.isArray(receipt.items) &&
    typeof receipt.balances === 'object' &&
    receipt.balances !== null
  );
}

/**
 * Validate and assert receipt shape (throws if invalid)
 */
export function assertValidReceipt(obj: unknown, context?: string): asserts obj is RewardReceipt {
  if (!isValidReceipt(obj)) {
    const msg = `Invalid receipt shape${context ? ` in ${context}` : ''}: ` +
      `missing source, sourceId, items, or balances`;
    console.error('[RECEIPT_GUARD_FAILED]', msg, obj);
    throw new Error(msg);
  }
}

/**
 * Extract total reward count from receipt
 */
export function getReceiptItemCount(receipt: RewardReceipt): number {
  return receipt.items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Format reward items for display
 */
export function formatReceiptItems(receipt: RewardReceipt): string {
  if (receipt.items.length === 0) {
    return receipt.alreadyClaimed ? 'Already claimed' : 'No rewards';
  }
  
  return receipt.items
    .filter(item => item.amount > 0)
    .map(item => `${item.amount.toLocaleString()} ${formatRewardType(item.type)}`)
    .join(', ');
}

/**
 * Format reward type for display
 */
function formatRewardType(type: string): string {
  const typeMap: Record<string, string> = {
    gold: 'Gold',
    coins: 'Coins',
    gems: 'Gems',
    divine_gems: 'Divine Gems',
    crystals: 'Crystals',
    stamina: 'Stamina',
    divine_essence: 'Divine Essence',
    soul_dust: 'Soul Dust',
    skill_essence: 'Skill Essence',
    enhancement_stones: 'Enhancement Stones',
    hero_shards: 'Hero Shards',
    rune_essence: 'Rune Essence',
  };
  
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
