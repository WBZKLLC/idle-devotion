"""
Comprehensive Guild System with Tiered Progression, Donations, and Rewards
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import uuid
import random

# =============================================================================
# GUILD LEVEL CONFIGURATION
# =============================================================================

GUILD_LEVELS = {
    1: {
        "exp_required": 0,
        "member_cap": 15,
        "unlocks": ["guild_shop", "daily_donation"],
        "buff": None,
        "description": "Guild Shop and Daily Donations unlocked",
        "level_up_reward": {"gold": 1000, "guild_coins": 10}
    },
    2: {
        "exp_required": 1000,
        "member_cap": 18,
        "unlocks": ["raid_boss_tier1"],
        "buff": None,
        "description": "Guild Raid Boss (Tier I) unlocked",
        "level_up_reward": {"gold": 2500, "guild_coins": 25}
    },
    3: {
        "exp_required": 2500,
        "member_cap": 21,
        "unlocks": [],
        "buff": {"type": "idle_gold", "value": 5},
        "description": "Guild Buff: Gold Idle Gain +5%",
        "level_up_reward": {"gold": 5000, "guild_coins": 50}
    },
    4: {
        "exp_required": 5000,
        "member_cap": 24,
        "unlocks": ["raid_boss_tier2", "guild_shop_upgrade"],
        "buff": None,
        "description": "Guild Raid Boss (Tier II), Shop Inventory Expanded",
        "level_up_reward": {"gold": 10000, "guild_coins": 100}
    },
    5: {
        "exp_required": 10000,
        "member_cap": 27,
        "unlocks": [],
        "buff": {"type": "hero_exp", "value": 5},
        "description": "Guild Buff: Hero EXP Gain +5%",
        "level_up_reward": {"gold": 20000, "guild_coins": 200}
    },
    6: {
        "exp_required": 20000,
        "member_cap": 28,
        "unlocks": ["guild_tech_tree"],
        "buff": None,
        "description": "Guild Tech Tree unlocked",
        "level_up_reward": {"gold": 35000, "guild_coins": 350}
    },
    7: {
        "exp_required": 35000,
        "member_cap": 29,
        "unlocks": ["raid_boss_tier3"],
        "buff": None,
        "description": "Guild Raid Boss (Tier III) unlocked",
        "level_up_reward": {"gold": 50000, "guild_coins": 500}
    },
    8: {
        "exp_required": 60000,
        "member_cap": 30,
        "unlocks": [],
        "buff": {"type": "guild_attack", "value": 10},
        "description": "Guild Buff: Attack in Guild Content +10%",
        "level_up_reward": {"gold": 75000, "guild_coins": 750}
    },
    9: {
        "exp_required": 100000,
        "member_cap": 30,
        "unlocks": ["exclusive_cosmetics"],
        "buff": None,
        "description": "Exclusive Guild Frame and Avatar Border in Shop",
        "level_up_reward": {"gold": 100000, "guild_coins": 1000}
    },
    10: {
        "exp_required": 150000,
        "member_cap": 30,
        "unlocks": ["max_level_bonus"],
        "buff": {"type": "all_stats", "value": 3},
        "description": "Permanent Guild Buff: All Stats +3% for all members",
        "level_up_reward": {"gold": 200000, "guild_coins": 2000, "gems": 500}
    }
}

# =============================================================================
# DONATION TIERS
# =============================================================================

DONATION_TIERS = {
    "small": {
        "name": "Small Donation",
        "cost_type": "gold",
        "cost_amount": 10000,
        "guild_coins_reward": 10,
        "guild_exp_reward": 50,
        "description": "Donate 10,000 Gold"
    },
    "medium": {
        "name": "Medium Donation",
        "cost_type": "gems",
        "cost_amount": 50,
        "guild_coins_reward": 60,
        "guild_exp_reward": 300,
        "description": "Donate 50 Crystals"
    },
    "large": {
        "name": "Large Donation",
        "cost_type": "summon_scrolls",  
        "cost_amount": 1,
        "guild_coins_reward": 200,
        "guild_exp_reward": 1000,
        "description": "Donate 1 Summon Scroll"
    }
}

DAILY_DONATION_LIMIT = 3

# =============================================================================
# GUILD TECH TREE
# =============================================================================

GUILD_TECH_TREE = {
    "prosperity": {
        "name": "Prosperity",
        "icon": "cash",
        "ranks": [
            {"rank": 1, "name": "Gold Rush I", "effect": "idle_gold", "value": 2, "cost": 5000},
            {"rank": 2, "name": "Stamina Plus", "effect": "stamina_cap", "value": 5, "cost": 15000},
            {"rank": 3, "name": "Double Rewards", "effect": "double_daily_chance", "value": 5, "cost": 50000},
            {"rank": 4, "name": "Gold Rush II", "effect": "idle_gold", "value": 3, "cost": 100000},
            {"rank": 5, "name": "Resource Master", "effect": "resource_gain", "value": 5, "cost": 200000},
        ]
    },
    "offense": {
        "name": "Offense",
        "icon": "flash",
        "ranks": [
            {"rank": 1, "name": "Attack Up I", "effect": "attack", "value": 2, "cost": 5000},
            {"rank": 2, "name": "Critical Edge", "effect": "crit_rate", "value": 2, "cost": 15000},
            {"rank": 3, "name": "Attack Up II", "effect": "attack", "value": 3, "cost": 50000},
            {"rank": 4, "name": "Critical Damage", "effect": "crit_damage", "value": 5, "cost": 100000},
            {"rank": 5, "name": "Devastation", "effect": "attack", "value": 5, "cost": 200000},
        ]
    },
    "defense": {
        "name": "Defense",
        "icon": "shield",
        "ranks": [
            {"rank": 1, "name": "Defense Up I", "effect": "defense", "value": 2, "cost": 5000},
            {"rank": 2, "name": "HP Boost", "effect": "hp", "value": 3, "cost": 15000},
            {"rank": 3, "name": "Defense Up II", "effect": "defense", "value": 3, "cost": 50000},
            {"rank": 4, "name": "Resilience", "effect": "damage_reduction", "value": 2, "cost": 100000},
            {"rank": 5, "name": "Fortress", "effect": "hp", "value": 5, "cost": 200000},
        ]
    }
}

# =============================================================================
# GUILD BOSS TIERS
# =============================================================================

GUILD_BOSS_TIERS = {
    1: {
        "name": "Ancient Dragon",
        "element": "fire",
        "emoji": "🐉",
        "base_hp": 500000,
        "base_atk": 5000,
        "rewards": {
            "guild_coins": 500,
            "gold": 25000,
            "coins": 50000
        },
        "required_level": 2
    },
    2: {
        "name": "Shadow Titan",
        "element": "dark",
        "emoji": "⚡",
        "base_hp": 1500000,
        "base_atk": 10000,
        "rewards": {
            "guild_coins": 1000,
            "gold": 50000,
            "coins": 100000,
            "crystals": 25
        },
        "required_level": 4
    },
    3: {
        "name": "Celestial Guardian",
        "element": "light",
        "emoji": "👹",
        "base_hp": 3000000,
        "base_atk": 20000,
        "rewards": {
            "guild_coins": 2000,
            "gold": 100000,
            "coins": 200000,
            "crystals": 50,
            "divine_essence": 5
        },
        "required_level": 7
    }
}

# =============================================================================
# GUILD SHOP ITEMS
# =============================================================================

GUILD_SHOP_ITEMS = [
    {
        "id": "ssr_shard_random",
        "name": "Random SSR Shard",
        "description": "Shard for a random SSR hero",
        "price": 200,
        "stock_weekly": 5,
        "required_level": 1,
        "reward_type": "hero_shard",
        "reward_value": 1,
        "icon": "star"
    },
    {
        "id": "summon_scroll_1",
        "name": "Summon Scroll",
        "description": "1x Premium summon",
        "price": 500,
        "stock_weekly": 3,
        "required_level": 1,
        "reward_type": "summon_scrolls",
        "reward_value": 1,
        "icon": "document"
    },
    {
        "id": "gold_pack_small",
        "name": "Gold Pack (Small)",
        "description": "10,000 Gold",
        "price": 100,
        "stock_weekly": 10,
        "required_level": 1,
        "reward_type": "gold",
        "reward_value": 10000,
        "icon": "cash"
    },
    {
        "id": "crystal_pack",
        "name": "Crystal Pack",
        "description": "100 Crystals",
        "price": 300,
        "stock_weekly": 5,
        "required_level": 3,
        "reward_type": "gems",
        "reward_value": 100,
        "icon": "diamond"
    },
    {
        "id": "ur_shard_random",
        "name": "Random UR Shard",
        "description": "Shard for a random UR hero",
        "price": 1000,
        "stock_weekly": 2,
        "required_level": 5,
        "reward_type": "hero_shard",
        "reward_value": 1,
        "icon": "star"
    },
    {
        "id": "enhancement_stones",
        "name": "Enhancement Stones",
        "description": "50 Enhancement Stones",
        "price": 150,
        "stock_weekly": 10,
        "required_level": 2,
        "reward_type": "enhancement_stones",
        "reward_value": 50,
        "icon": "cube"
    },
    {
        "id": "divine_essence_pack",
        "name": "Divine Essence Pack",
        "description": "5 Divine Essence",
        "price": 800,
        "stock_weekly": 3,
        "required_level": 6,
        "reward_type": "divine_essence",
        "reward_value": 5,
        "icon": "sparkles"
    },
    {
        "id": "exclusive_frame_guild",
        "name": "Guild Champion Frame",
        "description": "Exclusive profile frame",
        "price": 5000,
        "stock_weekly": 1,
        "required_level": 9,
        "reward_type": "frame",
        "reward_value": "guild_champion",
        "icon": "image"
    },
    {
        "id": "stamina_refill",
        "name": "Stamina Refill",
        "description": "Restore 100 Stamina",
        "price": 50,
        "stock_weekly": 20,
        "required_level": 1,
        "reward_type": "stamina",
        "reward_value": 100,
        "icon": "flash"
    },
    {
        "id": "skill_essence_pack",
        "name": "Skill Essence Pack",
        "description": "100 Skill Essence",
        "price": 200,
        "stock_weekly": 5,
        "required_level": 4,
        "reward_type": "skill_essence",
        "reward_value": 100,
        "icon": "book"
    }
]

# =============================================================================
# GUILD QUEST TEMPLATES
# =============================================================================

GUILD_QUEST_TEMPLATES = [
    {
        "type": "collective_stages",
        "name": "Stage Clearance",
        "description": "Clear {target} campaign stages collectively",
        "targets": [50, 100, 200],
        "rewards": {"guild_coins": 100, "guild_exp": 200}
    },
    {
        "type": "collective_summons",
        "name": "Fortune Seekers",
        "description": "Perform {target} summons collectively",
        "targets": [20, 50, 100],
        "rewards": {"guild_coins": 150, "guild_exp": 300}
    },
    {
        "type": "collective_donations",
        "name": "Guild Supporters",
        "description": "Make {target} donations collectively",
        "targets": [10, 25, 50],
        "rewards": {"guild_coins": 200, "guild_exp": 500}
    },
    {
        "type": "collective_boss_attacks",
        "name": "Boss Slayers",
        "description": "Attack guild boss {target} times collectively",
        "targets": [15, 30, 60],
        "rewards": {"guild_coins": 150, "guild_exp": 400}
    },
    {
        "type": "collective_idle_claims",
        "name": "Idle Masters",
        "description": "Claim idle rewards {target} times collectively",
        "targets": [20, 50, 100],
        "rewards": {"guild_coins": 75, "guild_exp": 150}
    }
]

# =============================================================================
# MEMBER ROLES
# =============================================================================

MEMBER_ROLES = {
    "leader": {
        "name": "Guild Leader",
        "permissions": ["manage_members", "edit_settings", "upgrade_tech", "start_quests", "approve_requests", "promote", "demote", "kick", "disband"],
        "icon": "👑"
    },
    "officer": {
        "name": "Officer",
        "permissions": ["approve_requests", "start_quests", "kick"],
        "icon": "⚔️"
    },
    "member": {
        "name": "Member",
        "permissions": ["donate", "participate", "chat"],
        "icon": "🛡️"
    }
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_guild_level(exp: int) -> int:
    """Calculate guild level from EXP"""
    level = 1
    for lvl, config in GUILD_LEVELS.items():
        if exp >= config["exp_required"]:
            level = lvl
        else:
            break
    return level


def get_exp_to_next_level(current_exp: int, current_level: int) -> int:
    """Get EXP needed for next level"""
    if current_level >= 10:
        return 0
    next_level = current_level + 1
    return GUILD_LEVELS[next_level]["exp_required"] - current_exp


def get_guild_member_cap(level: int) -> int:
    """Get member cap for guild level"""
    return GUILD_LEVELS.get(level, GUILD_LEVELS[1])["member_cap"]


def get_guild_buffs(level: int) -> List[Dict]:
    """Get all active buffs for guild level"""
    buffs = []
    for lvl in range(1, level + 1):
        buff = GUILD_LEVELS[lvl].get("buff")
        if buff:
            buffs.append({**buff, "from_level": lvl})
    return buffs


def get_unlocked_features(level: int) -> List[str]:
    """Get all unlocked features for guild level"""
    features = []
    for lvl in range(1, level + 1):
        features.extend(GUILD_LEVELS[lvl].get("unlocks", []))
    return features


def calculate_boss_rewards(contribution_percent: float, base_rewards: Dict, tier: int) -> Dict:
    """Calculate individual rewards based on contribution"""
    rewards = {}
    
    # Minimum 20% of rewards for participation
    # Plus contribution-based bonus (up to 80% extra)
    share_multiplier = 0.2 + (contribution_percent / 100) * 0.8
    
    # Tier bonus
    tier_multiplier = 1 + (tier - 1) * 0.25
    
    for reward_type, amount in base_rewards.items():
        rewards[reward_type] = int(amount * share_multiplier * tier_multiplier)
    
    return rewards


def get_weekly_leaderboard_rewards(rank: int) -> Dict:
    """Get rewards for weekly donation leaderboard"""
    if rank == 1:
        return {"guild_coins": 500, "title": "Patron of the Guild", "title_duration_days": 7}
    elif rank == 2:
        return {"guild_coins": 300, "title": "Guild Benefactor", "title_duration_days": 7}
    elif rank == 3:
        return {"guild_coins": 200, "title": "Guild Supporter", "title_duration_days": 7}
    return {}
