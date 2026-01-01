"""
Limited-Time Event Banner System
================================

This module implements:
1. Limited-Time Event Banners with exclusive heroes
2. Event milestone rewards
3. Event shop with event currency
4. Banner rotation system

All calculations are SERVER-AUTHORITATIVE.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import random
import uuid

# ============================================================================
# EVENT BANNER CONFIGURATION
# ============================================================================

# Current Featured Banner: "Crimson Eclipse"
CRIMSON_ECLIPSE_BANNER = {
    "id": "crimson_eclipse_2026_01",
    "name": "Crimson Eclipse",
    "description": "The Blood Moon rises! Summon the legendary Vampire Queen Seraphina!",
    "type": "limited",
    "start_date": "2026-01-01T00:00:00",
    "end_date": "2026-01-14T23:59:59",
    "duration_days": 14,
    
    # Featured Hero - EXCLUSIVE UR Damager
    "featured_hero": {
        "id": "seraphina_blood_queen",
        "name": "Seraphina, Blood Queen",
        "rarity": "UR",
        "element": "Dark",
        "hero_class": "Mage",
        "role": "Damage Dealer",
        "exclusive": True,  # Only available during this event
        
        # Base Stats (High damage dealer)
        "base_hp": 8500,
        "base_atk": 420,  # Highest ATK in game
        "base_def": 180,
        "speed": 115,
        
        # Unique Skills
        "skills": [
            {
                "name": "Crimson Slash",
                "type": "active",
                "damage_multiplier": 2.0,
                "cooldown": 0,
                "description": "Basic attack that deals 200% ATK damage and heals for 15% of damage dealt.",
                "effects": ["lifesteal_15"]
            },
            {
                "name": "Blood Nova",
                "type": "active", 
                "damage_multiplier": 4.5,
                "cooldown": 4,
                "description": "Unleash a devastating blood explosion dealing 450% ATK damage to all enemies. Damage increases by 20% for each enemy below 50% HP.",
                "effects": ["aoe", "execute_bonus"]
            },
            {
                "name": "Sanguine Shield",
                "type": "passive",
                "damage_multiplier": 0,
                "cooldown": 0,
                "description": "When HP drops below 30%, gain a shield equal to 50% max HP for 2 turns. Can trigger once per battle.",
                "effects": ["shield_50", "once_per_battle"]
            },
            {
                "name": "Eclipse Finale",
                "type": "ultimate",
                "damage_multiplier": 8.0,
                "cooldown": 0,  # Uses rage
                "rage_cost": 1000,
                "description": "Channel the power of the Blood Moon to deal 800% ATK damage to all enemies. Each kill resets 50% of rage bar.",
                "effects": ["aoe", "rage_refund_on_kill"]
            }
        ],
        
        # Lore
        "lore": "Once a benevolent princess of the Crimson Kingdom, Seraphina was cursed during a lunar eclipse, transforming her into an immortal vampire queen. She now walks the line between darkness and redemption, her immense power matched only by her eternal sorrow.",
        
        # Visual
        "image_url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400"
    },
    
    # Banner Rates (Boosted for featured hero)
    "rates": {
        "featured_UR": 0.7,    # 0.7% for Seraphina specifically
        "other_UR": 0.3,       # 0.3% for other UR heroes
        "SSR": 5.0,            # 5% for SSR
        "SR": 34.0,            # 34% for SR
        "R": 60.0,             # 60% for R
    },
    
    # Pity System (Separate from main banners)
    "pity": {
        "soft_pity_start": 60,
        "hard_pity": 100,      # Guaranteed featured UR at 100 pulls
        "soft_pity_increase": 0.02,  # +2% per pull after soft pity
    },
    
    # Event Currency
    "event_currency": {
        "name": "Blood Crystals",
        "icon": "💎",
        "per_pull": 10,        # Earn 10 per pull
        "bonus_for_10x": 20,   # Bonus 20 for 10-pull
    },
    
    # Cost
    "pull_cost": {
        "crystals_single": 300,
        "crystals_multi": 2700,  # 10% discount for 10x
    }
}

# Event Milestones (spend X pulls for rewards)
EVENT_MILESTONES = {
    "crimson_eclipse_2026_01": [
        {"pulls": 10, "rewards": {"crystals": 500, "gold": 100000, "blood_crystals": 50}},
        {"pulls": 20, "rewards": {"crystals": 800, "sr_ticket": 1, "blood_crystals": 80}},
        {"pulls": 30, "rewards": {"crystals": 1000, "ssr_shards": 20, "blood_crystals": 100}},
        {"pulls": 50, "rewards": {"crystals": 1500, "ssr_ticket": 1, "blood_crystals": 150}},
        {"pulls": 70, "rewards": {"crystals": 2000, "ur_shards": 10, "blood_crystals": 200}},
        {"pulls": 100, "rewards": {"crystals": 3000, "featured_shards": 30, "blood_crystals": 300}},
        {"pulls": 150, "rewards": {"crystals": 5000, "featured_shards": 50, "blood_crystals": 500}},
        {"pulls": 200, "rewards": {"featured_hero_selector": 1, "blood_crystals": 1000}},  # Guaranteed copy
    ]
}

# Event Shop Items (purchasable with Blood Crystals)
EVENT_SHOP = {
    "crimson_eclipse_2026_01": [
        # Featured hero shards
        {"id": "seraphina_shards_10", "name": "Seraphina Shards x10", "cost": 500, "limit": 5, "item": {"featured_shards": 10}},
        {"id": "seraphina_shards_50", "name": "Seraphina Shards x50", "cost": 2000, "limit": 2, "item": {"featured_shards": 50}},
        
        # General resources
        {"id": "ssr_shards_20", "name": "Universal SSR Shards x20", "cost": 300, "limit": 10, "item": {"ssr_shards": 20}},
        {"id": "gold_500k", "name": "Gold x500,000", "cost": 100, "limit": 20, "item": {"gold": 500000}},
        {"id": "crystals_500", "name": "Crystals x500", "cost": 200, "limit": 10, "item": {"crystals": 500}},
        {"id": "enhance_stones_50", "name": "Enhancement Stones x50", "cost": 150, "limit": 15, "item": {"enhancement_stones": 50}},
        {"id": "skill_essence_200", "name": "Skill Essence x200", "cost": 120, "limit": 20, "item": {"skill_essence": 200}},
        
        # Exclusive cosmetics
        {"id": "crimson_frame", "name": "Crimson Eclipse Avatar Frame", "cost": 1500, "limit": 1, "item": {"avatar_frame": "crimson_eclipse"}},
        {"id": "blood_title", "name": "Title: Blood Hunter", "cost": 800, "limit": 1, "item": {"title": "blood_hunter"}},
        
        # Equipment
        {"id": "crimson_weapon", "name": "Crimson Scythe (Legendary Weapon)", "cost": 3000, "limit": 1, "item": {"equipment": {"type": "weapon", "rarity": "legendary", "name": "Crimson Scythe", "base_atk": 150}}},
    ]
}

# ============================================================================
# FUTURE BANNER ROTATION (Calendar)
# ============================================================================

BANNER_ROTATION = [
    {
        "id": "crimson_eclipse_2026_01",
        "start": "2026-01-01",
        "end": "2026-01-14",
        "featured": "Seraphina, Blood Queen",
    },
    {
        "id": "celestial_storm_2026_01",
        "start": "2026-01-15",
        "end": "2026-01-28",
        "featured": "Zephyr, Storm Archon",  # Future UR
    },
    {
        "id": "void_awakening_2026_02",
        "start": "2026-02-01",
        "end": "2026-02-14",
        "featured": "Nyx, Void Empress",  # Future UR
    },
]


# ============================================================================
# EVENT BANNER FUNCTIONS
# ============================================================================

def get_active_event_banner(current_time: datetime = None) -> Optional[Dict[str, Any]]:
    """Get the currently active event banner."""
    if current_time is None:
        current_time = datetime.utcnow()
    
    banner = CRIMSON_ECLIPSE_BANNER
    start = datetime.fromisoformat(banner["start_date"])
    end = datetime.fromisoformat(banner["end_date"])
    
    if start <= current_time <= end:
        remaining = end - current_time
        return {
            **banner,
            "is_active": True,
            "time_remaining_hours": int(remaining.total_seconds() / 3600),
            "time_remaining_days": remaining.days,
        }
    
    return None


def calculate_event_pull_rate(pity_counter: int, banner_config: Dict) -> float:
    """Calculate pull rate with soft pity for event banner."""
    pity = banner_config["pity"]
    hard_pity = pity["hard_pity"]
    soft_pity_start = pity["soft_pity_start"]
    soft_pity_increase = pity["soft_pity_increase"]
    
    # Featured UR rate
    base_rate = banner_config["rates"]["featured_UR"] / 100
    
    if pity_counter >= hard_pity:
        return 1.0  # Guaranteed
    
    if pity_counter > soft_pity_start:
        bonus = soft_pity_increase * (pity_counter - soft_pity_start)
        return min(base_rate + bonus, 1.0)
    
    return base_rate


def perform_event_pull(
    user_pity: int,
    banner_id: str = "crimson_eclipse_2026_01"
) -> tuple:
    """
    Perform a single pull on event banner.
    Returns: (result_type, result_data, new_pity, event_currency_earned)
    
    SERVER-AUTHORITATIVE - all RNG happens here.
    """
    banner = CRIMSON_ECLIPSE_BANNER
    rates = banner["rates"]
    
    # Check for pity
    featured_rate = calculate_event_pull_rate(user_pity, banner)
    roll = random.random()
    
    # Check featured UR first
    if roll < featured_rate or user_pity >= banner["pity"]["hard_pity"]:
        # Got featured UR!
        return (
            "featured_ur",
            banner["featured_hero"],
            0,  # Reset pity
            banner["event_currency"]["per_pull"]
        )
    
    # Roll for other results
    cumulative = featured_rate
    
    # Other UR
    cumulative += rates["other_UR"] / 100
    if roll < cumulative:
        return ("other_ur", {"rarity": "UR"}, user_pity + 1, banner["event_currency"]["per_pull"])
    
    # SSR
    cumulative += rates["SSR"] / 100
    if roll < cumulative:
        return ("ssr", {"rarity": "SSR"}, user_pity + 1, banner["event_currency"]["per_pull"])
    
    # SR
    cumulative += rates["SR"] / 100
    if roll < cumulative:
        return ("sr", {"rarity": "SR"}, user_pity + 1, banner["event_currency"]["per_pull"])
    
    # R (default)
    return ("r", {"rarity": "R"}, user_pity + 1, banner["event_currency"]["per_pull"])


def get_milestone_rewards(total_pulls: int, claimed_milestones: List[int]) -> List[Dict]:
    """Get available milestone rewards based on total pulls."""
    milestones = EVENT_MILESTONES.get("crimson_eclipse_2026_01", [])
    available = []
    
    for milestone in milestones:
        if milestone["pulls"] <= total_pulls and milestone["pulls"] not in claimed_milestones:
            available.append(milestone)
    
    return available


def get_shop_items(purchased_items: Dict[str, int]) -> List[Dict]:
    """Get available shop items with remaining purchase limits."""
    items = EVENT_SHOP.get("crimson_eclipse_2026_01", [])
    result = []
    
    for item in items:
        purchased = purchased_items.get(item["id"], 0)
        remaining = item["limit"] - purchased
        
        result.append({
            **item,
            "purchased": purchased,
            "remaining": remaining,
            "can_purchase": remaining > 0,
        })
    
    return result


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "CRIMSON_ECLIPSE_BANNER",
    "EVENT_MILESTONES",
    "EVENT_SHOP",
    "BANNER_ROTATION",
    "get_active_event_banner",
    "calculate_event_pull_rate",
    "perform_event_pull",
    "get_milestone_rewards",
    "get_shop_items",
]
