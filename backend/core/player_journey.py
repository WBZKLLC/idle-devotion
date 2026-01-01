"""
First 7-Day Player Journey & Economic Model
============================================

This module implements:
1. Day-by-day progression milestones
2. Beginner Missions (reward shower system)
3. Tutorial flow and unlocks
4. Starter packs and monetization hooks
5. Economic balancing (sinks/sources)

Designed around the "S-Curve" progression philosophy.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import math

# ============================================================================
# 1. FIRST 7-DAY JOURNEY CONFIGURATION
# ============================================================================

FIRST_WEEK_JOURNEY = {
    # Day 1: The Immediate Hook (First 30 minutes)
    1: {
        "theme": "The Awakening",
        "description": "Begin your divine journey! Summon your first heroes and conquer the starting realms.",
        "unlocks": [
            "tutorial_summon",      # Guaranteed SSR hero
            "campaign_chapter_1",   # First 10 stages
            "daily_quests",         # Basic quest system
            "idle_rewards",         # Passive income starts
        ],
        "milestones": [
            {"id": "d1_first_summon", "task": "Perform your first summon", "reward": {"crystals": 500, "gold": 50000}},
            {"id": "d1_tutorial_complete", "task": "Complete the tutorial", "reward": {"crystals": 300, "coins": 10000}},
            {"id": "d1_first_upgrade", "task": "Level up a hero to Lv.5", "reward": {"gold": 30000, "hero_exp": 5000}},
            {"id": "d1_first_battle", "task": "Win 5 campaign battles", "reward": {"crystals": 200, "stamina": 50}},
            {"id": "d1_first_team", "task": "Build your first team (3+ heroes)", "reward": {"sr_ticket": 1}},
            {"id": "d1_claim_idle", "task": "Claim idle rewards", "reward": {"gold": 20000}},
        ],
        "login_reward": {"crystals": 100, "gold": 50000, "stamina": 100},
        "total_milestone_crystals": 1000,  # Total earnable
    },
    
    # Day 2-3: System Introduction & First Wall
    2: {
        "theme": "Rising Power",
        "description": "Unlock hero enhancement systems and face your first challenge!",
        "unlocks": [
            "hero_skills",          # Skill upgrade system
            "hero_stars",           # Star promotion
            "equipment_basic",      # Basic equipment
            "shop",                 # Main shop
        ],
        "milestones": [
            {"id": "d2_skill_upgrade", "task": "Upgrade a hero skill to Lv.2", "reward": {"skill_essence": 200, "gold": 50000}},
            {"id": "d2_equip_hero", "task": "Equip 3 items on heroes", "reward": {"enhancement_stones": 30, "crystals": 200}},
            {"id": "d2_clear_ch1", "task": "Clear Campaign Chapter 1", "reward": {"crystals": 500, "ssr_shards": 10}},
            {"id": "d2_power_5000", "task": "Reach 5,000 Team Power", "reward": {"gold": 100000}},
            {"id": "d2_daily_complete", "task": "Complete 5 Daily Quests", "reward": {"crystals": 150, "stamina": 30}},
        ],
        "login_reward": {"crystals": 150, "gold": 80000, "skill_essence": 100},
        "total_milestone_crystals": 850,
    },
    
    3: {
        "theme": "Arena Debut",
        "description": "Enter the Arena and prove your strength against other players!",
        "unlocks": [
            "arena",                # PvP system
            "hero_promotion",       # Star promotion
            "friend_system",        # Social features
        ],
        "milestones": [
            {"id": "d3_arena_battle", "task": "Fight 3 Arena battles", "reward": {"crystals": 300, "pvp_medals": 100}},
            {"id": "d3_first_friend", "task": "Add a friend", "reward": {"gold": 50000, "stamina": 30}},
            {"id": "d3_promote_star", "task": "Promote a hero to 2★", "reward": {"crystals": 400, "ssr_shards": 15}},
            {"id": "d3_power_10k", "task": "Reach 10,000 Team Power", "reward": {"enhancement_stones": 50, "gold": 100000}},
            {"id": "d3_clear_ch2", "task": "Clear Campaign Chapter 2", "reward": {"crystals": 600, "sr_ticket": 2}},
        ],
        "login_reward": {"crystals": 200, "gold": 100000, "arena_tickets": 5},
        "total_milestone_crystals": 1500,
    },
    
    # Day 4-5: Deepening & Socialization
    4: {
        "theme": "Guild Initiation",
        "description": "Join a Guild and discover the power of teamwork!",
        "unlocks": [
            "guild_join",           # Guild system
            "guild_boss",           # Guild boss battles
            "team_fate",            # Synergy bonuses
        ],
        "milestones": [
            {"id": "d4_join_guild", "task": "Join a Guild", "reward": {"crystals": 500, "guild_coins": 500}},
            {"id": "d4_guild_boss", "task": "Attack the Guild Boss", "reward": {"gold": 200000, "crystals": 200}},
            {"id": "d4_fate_bonus", "task": "Activate a Fate Bond (team synergy)", "reward": {"crystals": 300, "ssr_shards": 20}},
            {"id": "d4_arena_rank", "task": "Reach Arena Rank 5000 or higher", "reward": {"pvp_medals": 200, "crystals": 250}},
            {"id": "d4_power_20k", "task": "Reach 20,000 Team Power", "reward": {"enhancement_stones": 80, "gold": 150000}},
        ],
        "login_reward": {"crystals": 250, "gold": 150000, "guild_coins": 300},
        "total_milestone_crystals": 1500,
    },
    
    5: {
        "theme": "Advanced Training",
        "description": "Master advanced systems and prepare for greater challenges!",
        "unlocks": [
            "rune_system",          # Rune socketing
            "awakening",            # Hero awakening
            "abyss_intro",          # Abyss preview
        ],
        "milestones": [
            {"id": "d5_socket_rune", "task": "Socket a Rune into equipment", "reward": {"crystals": 400, "rune_stones": 5}},
            {"id": "d5_awaken_hero", "task": "Awaken a hero to Stage 1", "reward": {"crystals": 500, "awakening_stones": 20}},
            {"id": "d5_clear_ch3", "task": "Clear Campaign Chapter 3", "reward": {"crystals": 700, "ssr_shards": 25}},
            {"id": "d5_arena_rank_3k", "task": "Reach Arena Rank 3000", "reward": {"pvp_medals": 500, "crystals": 300}},
            {"id": "d5_power_35k", "task": "Reach 35,000 Team Power", "reward": {"gold": 300000, "enhancement_stones": 100}},
        ],
        "login_reward": {"crystals": 300, "gold": 200000, "rune_stones": 3},
        "total_milestone_crystals": 2200,
    },
    
    # Day 6-7: Retention & First Monetization Push
    6: {
        "theme": "Event Horizon",
        "description": "The Crimson Eclipse event begins! Exclusive rewards await!",
        "unlocks": [
            "event_banner",         # Limited-time summon
            "event_shop",           # Event currency shop
            "battle_pass",          # Premium pass introduction
        ],
        "milestones": [
            {"id": "d6_event_pull", "task": "Perform 10 Event Banner pulls", "reward": {"blood_crystals": 100, "crystals": 500}},
            {"id": "d6_event_shop", "task": "Purchase from Event Shop", "reward": {"crystals": 300, "enhancement_stones": 50}},
            {"id": "d6_battlepass_claim", "task": "Claim 3 Battle Pass rewards", "reward": {"crystals": 400, "gold": 200000}},
            {"id": "d6_power_50k", "task": "Reach 50,000 Team Power", "reward": {"crystals": 600, "ur_shards": 5}},
            {"id": "d6_abyss_floor5", "task": "Reach Abyss Floor 5", "reward": {"crystals": 500, "abyss_tokens": 50}},
        ],
        "login_reward": {"crystals": 400, "gold": 300000, "blood_crystals": 50},
        "total_milestone_crystals": 2700,
    },
    
    7: {
        "theme": "Divine Ascension",
        "description": "Your dedication is rewarded! Claim your guaranteed SSR hero!",
        "unlocks": [
            "weekly_boss",          # Weekly content
            "transcendence",        # Late-game preview
        ],
        "milestones": [
            {"id": "d7_weekly_boss", "task": "Challenge the Weekly Boss", "reward": {"crystals": 800, "legendary_shard": 1}},
            {"id": "d7_clear_ch4", "task": "Clear Campaign Chapter 4", "reward": {"crystals": 1000, "ssr_ticket": 1}},
            {"id": "d7_arena_rank_2k", "task": "Reach Arena Rank 2000", "reward": {"pvp_medals": 1000, "crystals": 500}},
            {"id": "d7_guild_contribution", "task": "Contribute 1000 points to Guild", "reward": {"guild_coins": 1000, "crystals": 300}},
            {"id": "d7_power_70k", "task": "Reach 70,000 Team Power", "reward": {"crystals": 700, "ur_shards": 10}},
        ],
        "login_reward": {
            "crystals": 500, 
            "gold": 500000, 
            "guaranteed_ssr_selector": 1,  # MAJOR REWARD
            "divine_essence": 50
        },
        "total_milestone_crystals": 4100,
        "special_reward": "SSR Hero Selector (Choose any SSR!)",
    },
}

# Total First Week Rewards Summary
FIRST_WEEK_TOTALS = {
    "crystals": sum(day["total_milestone_crystals"] + day["login_reward"].get("crystals", 0) 
                   for day in FIRST_WEEK_JOURNEY.values()),
    "gold": 1500000,  # Approximate
    "guaranteed_heroes": "1 SSR (Tutorial) + 1 SSR (Day 7 Selector)",
}


# ============================================================================
# 2. BEGINNER MISSIONS (Reward Shower)
# ============================================================================

BEGINNER_MISSIONS = [
    # Immediate (First Hour)
    {"id": "bm_001", "category": "immediate", "task": "Complete Tutorial", "reward": {"crystals": 500}, "priority": 1},
    {"id": "bm_002", "category": "immediate", "task": "Perform 1 Summon", "reward": {"crystals": 200}, "priority": 2},
    {"id": "bm_003", "category": "immediate", "task": "Win First Battle", "reward": {"gold": 50000}, "priority": 3},
    {"id": "bm_004", "category": "immediate", "task": "Level a Hero to Lv.3", "reward": {"hero_exp": 3000}, "priority": 4},
    {"id": "bm_005", "category": "immediate", "task": "Equip First Item", "reward": {"enhancement_stones": 20}, "priority": 5},
    
    # Early (First Day)
    {"id": "bm_010", "category": "early", "task": "Clear Stage 1-5", "reward": {"crystals": 300}},
    {"id": "bm_011", "category": "early", "task": "Level a Hero to Lv.10", "reward": {"crystals": 200, "gold": 30000}},
    {"id": "bm_012", "category": "early", "task": "Upgrade a Skill to Lv.2", "reward": {"skill_essence": 100}},
    {"id": "bm_013", "category": "early", "task": "Build Team of 5 Heroes", "reward": {"crystals": 300}},
    {"id": "bm_014", "category": "early", "task": "Claim Idle Rewards 3 Times", "reward": {"gold": 50000}},
    
    # Progress (First 3 Days)
    {"id": "bm_020", "category": "progress", "task": "Clear Stage 1-10", "reward": {"crystals": 500}},
    {"id": "bm_021", "category": "progress", "task": "Reach 5,000 Team Power", "reward": {"crystals": 400, "sr_ticket": 1}},
    {"id": "bm_022", "category": "progress", "task": "Win 10 Arena Battles", "reward": {"crystals": 500, "pvp_medals": 200}},
    {"id": "bm_023", "category": "progress", "task": "Promote Hero to 2★", "reward": {"crystals": 600}},
    {"id": "bm_024", "category": "progress", "task": "Enhance Equipment to +5", "reward": {"enhancement_stones": 50}},
    
    # Advanced (First Week)
    {"id": "bm_030", "category": "advanced", "task": "Clear Campaign Chapter 2", "reward": {"crystals": 800}},
    {"id": "bm_031", "category": "advanced", "task": "Reach 20,000 Team Power", "reward": {"crystals": 600, "ssr_shards": 20}},
    {"id": "bm_032", "category": "advanced", "task": "Join a Guild", "reward": {"crystals": 500, "guild_coins": 500}},
    {"id": "bm_033", "category": "advanced", "task": "Awaken a Hero", "reward": {"crystals": 700}},
    {"id": "bm_034", "category": "advanced", "task": "Complete 50 Daily Quests Total", "reward": {"crystals": 1000, "ssr_ticket": 1}},
    
    # Mastery (End of First Week)
    {"id": "bm_040", "category": "mastery", "task": "Clear Campaign Chapter 4", "reward": {"crystals": 1500}},
    {"id": "bm_041", "category": "mastery", "task": "Reach 50,000 Team Power", "reward": {"crystals": 1000, "ur_shards": 5}},
    {"id": "bm_042", "category": "mastery", "task": "Reach Arena Rank 3000", "reward": {"crystals": 800}},
    {"id": "bm_043", "category": "mastery", "task": "Reach Abyss Floor 10", "reward": {"crystals": 1200}},
    {"id": "bm_044", "category": "mastery", "task": "Spend 10,000 Crystals", "reward": {"crystals": 2000}},  # Spend to earn back
]


# ============================================================================
# 3. STARTER PACKS & MONETIZATION
# ============================================================================

STARTER_PACKS = {
    # Ultra Value Starter Pack (First Purchase)
    "starter_ultra": {
        "name": "Legendary Starter Pack",
        "price_usd": 0.99,
        "limit": 1,
        "value_ratio": 20,  # 20x value vs baseline
        "available_days": 3,  # Available for first 3 days only
        "contents": {
            "crystals": 1000,
            "gold": 500000,
            "summon_tickets": 10,
            "ssr_shards": 20,
            "enhancement_stones": 100,
        },
        "display_value": "$49.99",  # Shows original value
    },
    
    # Growth Pack (Days 3-7)
    "growth_pack": {
        "name": "Growth Accelerator",
        "price_usd": 4.99,
        "limit": 1,
        "value_ratio": 10,
        "available_days": 7,
        "contents": {
            "crystals": 3000,
            "gold": 2000000,
            "ssr_ticket": 1,
            "hero_exp": 100000,
            "skill_essence": 500,
        },
        "display_value": "$99.99",
    },
    
    # Monthly Card (Key Conversion Tool)
    "monthly_card": {
        "name": "Divine Blessing Card",
        "price_usd": 4.99,
        "duration_days": 30,
        "immediate_reward": {"crystals": 300, "divine_gems": 50},
        "daily_reward": {"crystals": 100, "stamina": 50, "gold": 50000},
        "total_value": 3300,  # 300 + (100 * 30)
        "value_ratio": 6.6,   # vs $4.99 = 500 crystals baseline
    },
    
    # Resource Bundles (For Specific Walls)
    "gold_bundle": {
        "name": "Fortune Bundle",
        "price_usd": 9.99,
        "limit": 3,  # Per month
        "contents": {
            "gold": 10000000,
            "enhancement_stones": 200,
        },
        "value_ratio": 5,
    },
    
    "power_bundle": {
        "name": "Power Surge Bundle",
        "price_usd": 19.99,
        "limit": 2,
        "contents": {
            "crystals": 5000,
            "ssr_ticket": 2,
            "ur_shards": 20,
            "awakening_stones": 50,
        },
        "value_ratio": 4,
    },
}

# Baseline conversion rate (for value calculation)
BASELINE_CRYSTAL_RATE = 100  # 100 crystals per $1


# ============================================================================
# 4. ECONOMIC BALANCING (Sinks & Sources)
# ============================================================================

# Gold Economy
GOLD_SOURCES = {
    "idle_per_hour_base": 10000,       # Base hourly rate
    "campaign_per_stage": 5000,         # Per stage clear
    "daily_quest_total": 100000,        # Total from daily quests
    "arena_daily": 50000,               # Arena rewards
    "guild_daily": 30000,               # Guild activities
}

GOLD_SINKS = {
    # Hero Leveling (Exponential Cost)
    "level_up_formula": "base * (1.15 ^ level)",  # Exponential
    "level_up_base": 100,
    
    # Equipment Enhancement
    "enhance_formula": "base * (1.5 ^ enhance_level)",
    "enhance_base": 1000,
    
    # Skill Upgrades
    "skill_formula": "base * (2.0 ^ skill_level)",
    "skill_base": 5000,
    
    # Star Promotion
    "star_costs": {
        1: 50000,
        2: 150000,
        3: 500000,
        4: 1500000,
        5: 5000000,
    },
    
    # Awakening (Massive sink)
    "awakening_costs": {
        1: 1000000,
        2: 3000000,
        3: 8000000,
        4: 20000000,
        5: 50000000,
    },
}

# Crystal Economy (Premium)
CRYSTAL_SOURCES = {
    "daily_quests": 150,          # Front-loaded daily
    "arena_daily": 50,            # Arena rewards
    "achievements": 5000,         # One-time total
    "events_weekly": 1000,        # Weekly event average
    "login_rewards_weekly": 500,  # 7-day login total
}

CRYSTAL_SINKS = {
    "single_summon": 300,
    "ten_summon": 2700,           # 10% discount
    "stamina_refresh": 50,        # Per refresh
    "shop_refresh": 100,          # Refresh shop
    "instant_idle": 200,          # 8 hours instant
}


def calculate_level_up_cost(level: int) -> int:
    """Calculate gold cost to level up from (level) to (level+1)."""
    base = GOLD_SINKS["level_up_base"]
    return int(base * (1.15 ** level))


def calculate_total_level_cost(from_level: int, to_level: int) -> int:
    """Calculate total gold to level from one level to another."""
    return sum(calculate_level_up_cost(lvl) for lvl in range(from_level, to_level))


def calculate_enhancement_cost(current_level: int) -> int:
    """Calculate gold cost for equipment enhancement."""
    base = GOLD_SINKS["enhance_base"]
    return int(base * (1.5 ** current_level))


def calculate_skill_upgrade_cost(skill_level: int) -> Tuple[int, int]:
    """Calculate gold and skill essence cost for skill upgrade."""
    base = GOLD_SINKS["skill_base"]
    gold_cost = int(base * (2.0 ** skill_level))
    essence_cost = (skill_level + 1) * 50
    return (gold_cost, essence_cost)


def calculate_star_promotion_cost(current_stars: int) -> Dict[str, int]:
    """Calculate cost for star promotion."""
    gold_cost = GOLD_SINKS["star_costs"].get(current_stars, 10000000)
    shards_needed = [10, 20, 40, 60, 100][min(current_stars, 4)]
    return {"gold": gold_cost, "shards": shards_needed}


def calculate_daily_free_crystals() -> int:
    """Calculate expected daily free crystals."""
    return sum(CRYSTAL_SOURCES.values()) // 7  # Weekly avg to daily


def get_starter_pack_value(pack_id: str) -> Dict[str, Any]:
    """Calculate the value proposition of a starter pack."""
    pack = STARTER_PACKS.get(pack_id)
    if not pack:
        return {}
    
    # Calculate crystal equivalent
    contents = pack.get("contents", {})
    crystal_value = contents.get("crystals", 0)
    
    # Add equivalent value for other items
    crystal_value += contents.get("gold", 0) // 10000  # 10k gold = 1 crystal equiv
    crystal_value += contents.get("summon_tickets", 0) * 300  # Each ticket = 300 crystals
    crystal_value += contents.get("ssr_ticket", 0) * 2700     # SSR ticket = 10-pull
    crystal_value += contents.get("ssr_shards", 0) * 50       # 50 crystals per shard
    
    baseline_value = pack["price_usd"] * BASELINE_CRYSTAL_RATE
    actual_ratio = crystal_value / baseline_value if baseline_value > 0 else 0
    
    return {
        "pack": pack,
        "crystal_equivalent": crystal_value,
        "baseline_value": baseline_value,
        "actual_value_ratio": round(actual_ratio, 1),
    }


# ============================================================================
# 5. PLAYER PROGRESSION TRACKING
# ============================================================================

def calculate_expected_day_power(day: int) -> int:
    """Calculate expected team power by day for balanced progression."""
    # S-curve progression
    base_power = 1000
    daily_growth = {
        1: 3000,    # Day 1 end: 3k
        2: 8000,    # Day 2 end: 8k
        3: 15000,   # Day 3 end: 15k (first wall)
        4: 25000,   # Day 4 end: 25k
        5: 40000,   # Day 5 end: 40k
        6: 60000,   # Day 6 end: 60k
        7: 80000,   # Day 7 end: 80k
    }
    return daily_growth.get(day, 100000)


def get_day_journey(day: int, user_data: Dict = None) -> Dict[str, Any]:
    """Get the journey configuration for a specific day."""
    journey = FIRST_WEEK_JOURNEY.get(day)
    if not journey:
        return {"error": "Invalid day"}
    
    result = {
        **journey,
        "day": day,
        "expected_power": calculate_expected_day_power(day),
    }
    
    # If user data provided, calculate progress
    if user_data:
        account_age = user_data.get("account_age_days", 1)
        result["is_current_day"] = account_age == day
        result["is_completed"] = account_age > day
        
    return result


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "FIRST_WEEK_JOURNEY",
    "FIRST_WEEK_TOTALS",
    "BEGINNER_MISSIONS",
    "STARTER_PACKS",
    "BASELINE_CRYSTAL_RATE",
    "GOLD_SOURCES",
    "GOLD_SINKS",
    "CRYSTAL_SOURCES",
    "CRYSTAL_SINKS",
    "calculate_level_up_cost",
    "calculate_total_level_cost",
    "calculate_enhancement_cost",
    "calculate_skill_upgrade_cost",
    "calculate_star_promotion_cost",
    "calculate_daily_free_crystals",
    "get_starter_pack_value",
    "calculate_expected_day_power",
    "get_day_journey",
]
