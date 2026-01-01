"""
VIP-BASED IDLE RESOURCE COLLECTION SYSTEM
==========================================

Implements tiered idle resource generation with:
1. VIP Rate Multipliers (5% base → 15% at VIP 7 → +5% per level after)
2. Progression-Based Caps (Abyss, Dungeon, Campaign progress)
3. Multiple Resource Types (excluding super rare)

VIP RATE SCHEDULE:
- VIP 0-6: 5% base rate
- VIP 7: 15% rate
- VIP 8+: +5% per level (20%, 25%, 30%, etc.)

RESOURCES INCLUDED (Moderate):
- Gold
- Coins
- Enhancement Stones
- Skill Essence
- Stamina
- Rune Stones

RESOURCES EXCLUDED (Super Rare):
- Divine Essence
- Blood Crystals
- UR Shards
- Legendary Shards
- Awakening Stones
"""

from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
import math

# ============================================================================
# VIP RATE MULTIPLIERS
# ============================================================================

def get_vip_idle_rate_multiplier(vip_level: int) -> float:
    """
    Get idle resource generation rate multiplier based on VIP level.
    
    VIP 0-6: 5% (0.05)
    VIP 7: 15% (0.15)
    VIP 8+: +5% per level (0.20, 0.25, 0.30, etc.)
    
    Returns multiplier as decimal (e.g., 0.05 = 5%)
    """
    if vip_level < 7:
        return 0.05  # 5% for VIP 0-6
    elif vip_level == 7:
        return 0.15  # 15% for VIP 7
    else:
        # VIP 8+: 15% + 5% per level above 7
        additional_levels = vip_level - 7
        return 0.15 + (additional_levels * 0.05)

def get_vip_idle_rate_display(vip_level: int) -> str:
    """Get display string for VIP idle rate"""
    rate = get_vip_idle_rate_multiplier(vip_level)
    return f"{int(rate * 100)}%"

# ============================================================================
# PROGRESSION-BASED CAPS
# ============================================================================

# Base resource caps per 24 hours at starting progression
BASE_CAPS_24HR = {
    "gold": 5000,
    "coins": 2500,
    "enhancement_stones": 50,
    "skill_essence": 25,
    "stamina": 100,
    "rune_stones": 20,
}

# Multipliers per progression milestone
ABYSS_CAP_MULTIPLIERS = {
    0: 1.0,    # No abyss progress
    10: 1.2,   # Floor 10
    20: 1.5,   # Floor 20
    30: 1.8,   # Floor 30
    40: 2.2,   # Floor 40
    50: 2.7,   # Floor 50
    60: 3.3,   # Floor 60
    70: 4.0,   # Floor 70
    80: 5.0,   # Floor 80
    90: 6.0,   # Floor 90
    100: 8.0,  # Floor 100 (max)
}

DUNGEON_CAP_MULTIPLIERS = {
    0: 1.0,    # No dungeon progress
    1: 1.1,    # Tier 1 dungeons
    2: 1.25,   # Tier 2 dungeons
    3: 1.4,    # Tier 3 dungeons
    4: 1.6,    # Tier 4 dungeons
    5: 1.85,   # Tier 5 dungeons
    6: 2.1,    # Tier 6 dungeons
    7: 2.4,    # Tier 7 dungeons
    8: 2.8,    # Tier 8 dungeons
    9: 3.2,    # Tier 9 dungeons
    10: 4.0,   # Tier 10 dungeons (max)
}

CAMPAIGN_CAP_MULTIPLIERS = {
    0: 1.0,     # Not started
    1: 1.05,    # Chapter 1
    2: 1.1,     # Chapter 2
    3: 1.2,     # Chapter 3
    4: 1.3,     # Chapter 4
    5: 1.45,    # Chapter 5
    6: 1.6,     # Chapter 6
    7: 1.8,     # Chapter 7
    8: 2.0,     # Chapter 8
    9: 2.25,    # Chapter 9
    10: 2.5,    # Chapter 10
    11: 2.8,    # Chapter 11
    12: 3.1,    # Chapter 12
    13: 3.5,    # Chapter 13
    14: 3.9,    # Chapter 14
    15: 4.5,    # Chapter 15
    16: 5.0,    # Chapter 16
    17: 5.6,    # Chapter 17
    18: 6.3,    # Chapter 18
    19: 7.0,    # Chapter 19
    20: 8.0,    # Chapter 20 (max)
}

def get_nearest_milestone(progress: int, milestones: Dict[int, float]) -> float:
    """Get the multiplier for the nearest milestone at or below progress"""
    applicable = [k for k in milestones.keys() if k <= progress]
    if not applicable:
        return 1.0
    return milestones[max(applicable)]

def calculate_resource_caps(
    abyss_floor: int = 0,
    dungeon_tier: int = 0,
    campaign_chapter: int = 0
) -> Dict[str, int]:
    """
    Calculate 24-hour resource caps based on progression.
    
    Final cap = Base Cap × Abyss Mult × Dungeon Mult × Campaign Mult
    """
    abyss_mult = get_nearest_milestone(abyss_floor, ABYSS_CAP_MULTIPLIERS)
    dungeon_mult = get_nearest_milestone(dungeon_tier, DUNGEON_CAP_MULTIPLIERS)
    campaign_mult = get_nearest_milestone(campaign_chapter, CAMPAIGN_CAP_MULTIPLIERS)
    
    total_multiplier = abyss_mult * dungeon_mult * campaign_mult
    
    caps = {}
    for resource, base_cap in BASE_CAPS_24HR.items():
        caps[resource] = int(base_cap * total_multiplier)
    
    return caps

def calculate_resource_caps_with_breakdown(
    abyss_floor: int = 0,
    dungeon_tier: int = 0,
    campaign_chapter: int = 0
) -> Dict[str, Any]:
    """Calculate caps with detailed breakdown for UI"""
    abyss_mult = get_nearest_milestone(abyss_floor, ABYSS_CAP_MULTIPLIERS)
    dungeon_mult = get_nearest_milestone(dungeon_tier, DUNGEON_CAP_MULTIPLIERS)
    campaign_mult = get_nearest_milestone(campaign_chapter, CAMPAIGN_CAP_MULTIPLIERS)
    
    total_multiplier = abyss_mult * dungeon_mult * campaign_mult
    
    caps = {}
    for resource, base_cap in BASE_CAPS_24HR.items():
        caps[resource] = int(base_cap * total_multiplier)
    
    return {
        "caps": caps,
        "multipliers": {
            "abyss": abyss_mult,
            "dungeon": dungeon_mult,
            "campaign": campaign_mult,
            "total": round(total_multiplier, 2),
        },
        "progression": {
            "abyss_floor": abyss_floor,
            "dungeon_tier": dungeon_tier,
            "campaign_chapter": campaign_chapter,
        },
    }

# ============================================================================
# IDLE RESOURCE GENERATION
# ============================================================================

# Resource generation rates per hour at base (before VIP multiplier)
# These are the "potential" amounts - VIP rate determines actual generation
BASE_RATES_PER_HOUR = {
    "gold": 250,
    "coins": 125,
    "enhancement_stones": 3,
    "skill_essence": 2,
    "stamina": 5,
    "rune_stones": 1,
}

def calculate_idle_resources(
    hours_elapsed: float,
    vip_level: int,
    abyss_floor: int = 0,
    dungeon_tier: int = 0,
    campaign_chapter: int = 0,
    max_hours: int = 24
) -> Dict[str, Any]:
    """
    Calculate idle resources earned over time.
    
    Formula: Base Rate × Hours × VIP Multiplier (capped at progression-based max)
    
    Returns both earned amounts and cap information.
    """
    # Cap hours
    capped_hours = min(hours_elapsed, max_hours)
    is_capped = hours_elapsed >= max_hours
    
    # Get VIP rate
    vip_rate = get_vip_idle_rate_multiplier(vip_level)
    
    # Get progression caps (24hr caps, scale to actual time)
    caps_24hr = calculate_resource_caps(abyss_floor, dungeon_tier, campaign_chapter)
    time_ratio = capped_hours / 24.0
    
    resources_earned = {}
    resources_capped = {}
    
    for resource, base_rate in BASE_RATES_PER_HOUR.items():
        # Calculate potential earnings
        potential = base_rate * capped_hours * vip_rate
        
        # Apply progression cap (scaled to time)
        max_for_time = caps_24hr.get(resource, 0) * time_ratio
        
        # Final amount is minimum of potential and cap
        final_amount = min(int(potential), int(max_for_time))
        
        resources_earned[resource] = final_amount
        resources_capped[resource] = potential >= max_for_time
    
    return {
        "resources": resources_earned,
        "hours_elapsed": round(capped_hours, 2),
        "is_time_capped": is_capped,
        "resources_capped": resources_capped,
        "vip_rate": vip_rate,
        "vip_rate_display": get_vip_idle_rate_display(vip_level),
    }

def calculate_idle_preview(
    vip_level: int,
    abyss_floor: int = 0,
    dungeon_tier: int = 0,
    campaign_chapter: int = 0,
    hours: int = 24
) -> Dict[str, Any]:
    """
    Calculate preview of idle resources for a given time period.
    Used for UI to show potential earnings.
    """
    return calculate_idle_resources(
        hours_elapsed=hours,
        vip_level=vip_level,
        abyss_floor=abyss_floor,
        dungeon_tier=dungeon_tier,
        campaign_chapter=campaign_chapter,
        max_hours=hours
    )

# ============================================================================
# VIP IDLE HOURS CAP
# ============================================================================

VIP_IDLE_HOURS = {
    0: 8,    # VIP 0: 8 hours
    1: 10,   # VIP 1: 10 hours
    2: 12,   # VIP 2: 12 hours
    3: 14,   # VIP 3: 14 hours
    4: 16,   # VIP 4: 16 hours
    5: 18,   # VIP 5: 18 hours
    6: 20,   # VIP 6: 20 hours
    7: 22,   # VIP 7: 22 hours
    8: 24,   # VIP 8: 24 hours
    9: 30,   # VIP 9: 30 hours
    10: 36,  # VIP 10: 36 hours
    11: 48,  # VIP 11: 48 hours
    12: 60,  # VIP 12: 60 hours (2.5 days)
    13: 72,  # VIP 13: 72 hours (3 days)
    14: 96,  # VIP 14: 96 hours (4 days)
    15: 168, # VIP 15: 168 hours (7 days)
}

def get_vip_idle_hours(vip_level: int) -> int:
    """Get max idle collection hours for VIP level"""
    if vip_level in VIP_IDLE_HOURS:
        return VIP_IDLE_HOURS[vip_level]
    elif vip_level > 15:
        return VIP_IDLE_HOURS[15]  # Cap at VIP 15 hours
    return VIP_IDLE_HOURS[0]

# ============================================================================
# RESOURCE DISPLAY HELPERS
# ============================================================================

RESOURCE_DISPLAY_INFO = {
    "gold": {"name": "Gold", "icon": "🪙", "color": "#c9a227"},
    "coins": {"name": "Coins", "icon": "💰", "color": "#e6c666"},
    "enhancement_stones": {"name": "Enhancement Stones", "icon": "🔨", "color": "#8b5cf6"},
    "skill_essence": {"name": "Skill Essence", "icon": "📖", "color": "#3b82f6"},
    "stamina": {"name": "Stamina", "icon": "⚡", "color": "#22c55e"},
    "rune_stones": {"name": "Rune Stones", "icon": "💠", "color": "#ec4899"},
}

# Super rare resources - EXCLUDED from idle
SUPER_RARE_RESOURCES = [
    "divine_essence",
    "blood_crystals",
    "ur_shards",
    "legendary_shards",
    "awakening_stones",
    "celestial_fragments",
]

def get_resource_info(resource_key: str) -> Dict[str, str]:
    """Get display info for a resource"""
    return RESOURCE_DISPLAY_INFO.get(resource_key, {
        "name": resource_key.replace("_", " ").title(),
        "icon": "🎁",
        "color": "#6b7280",
    })

# ============================================================================
# NEXT MILESTONE CALCULATOR
# ============================================================================

def get_next_milestone_info(
    current_abyss: int,
    current_dungeon: int,
    current_campaign: int
) -> Dict[str, Any]:
    """Get info about next milestones that would increase caps"""
    next_abyss = None
    for floor in sorted(ABYSS_CAP_MULTIPLIERS.keys()):
        if floor > current_abyss:
            next_abyss = floor
            break
    
    next_dungeon = None
    for tier in sorted(DUNGEON_CAP_MULTIPLIERS.keys()):
        if tier > current_dungeon:
            next_dungeon = tier
            break
    
    next_campaign = None
    for chapter in sorted(CAMPAIGN_CAP_MULTIPLIERS.keys()):
        if chapter > current_campaign:
            next_campaign = chapter
            break
    
    current_caps = calculate_resource_caps(current_abyss, current_dungeon, current_campaign)
    
    improvements = []
    
    if next_abyss is not None:
        new_caps = calculate_resource_caps(next_abyss, current_dungeon, current_campaign)
        improvements.append({
            "type": "abyss",
            "target": f"Floor {next_abyss}",
            "gold_increase": new_caps["gold"] - current_caps["gold"],
        })
    
    if next_dungeon is not None:
        new_caps = calculate_resource_caps(current_abyss, next_dungeon, current_campaign)
        improvements.append({
            "type": "dungeon",
            "target": f"Tier {next_dungeon}",
            "gold_increase": new_caps["gold"] - current_caps["gold"],
        })
    
    if next_campaign is not None:
        new_caps = calculate_resource_caps(current_abyss, current_dungeon, next_campaign)
        improvements.append({
            "type": "campaign",
            "target": f"Chapter {next_campaign}",
            "gold_increase": new_caps["gold"] - current_caps["gold"],
        })
    
    return {
        "next_milestones": {
            "abyss": next_abyss,
            "dungeon": next_dungeon,
            "campaign": next_campaign,
        },
        "improvements": sorted(improvements, key=lambda x: x["gold_increase"], reverse=True),
    }

# ============================================================================
# VIP UPGRADE INFO
# ============================================================================

def get_vip_upgrade_info(current_vip: int) -> Dict[str, Any]:
    """Get info about VIP rate improvements"""
    current_rate = get_vip_idle_rate_multiplier(current_vip)
    
    # Find next VIP level with rate increase
    next_upgrade = None
    next_rate = None
    
    if current_vip < 7:
        next_upgrade = 7
        next_rate = 0.15
    elif current_vip >= 7:
        next_upgrade = current_vip + 1
        next_rate = get_vip_idle_rate_multiplier(next_upgrade)
    
    return {
        "current_vip": current_vip,
        "current_rate": current_rate,
        "current_rate_display": get_vip_idle_rate_display(current_vip),
        "next_upgrade_vip": next_upgrade,
        "next_rate": next_rate,
        "next_rate_display": f"{int(next_rate * 100)}%" if next_rate else None,
        "rate_increase": (next_rate - current_rate) if next_rate else 0,
    }

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "get_vip_idle_rate_multiplier",
    "get_vip_idle_rate_display",
    "calculate_resource_caps",
    "calculate_resource_caps_with_breakdown",
    "calculate_idle_resources",
    "calculate_idle_preview",
    "get_vip_idle_hours",
    "get_resource_info",
    "get_next_milestone_info",
    "get_vip_upgrade_info",
    "BASE_CAPS_24HR",
    "BASE_RATES_PER_HOUR",
    "RESOURCE_DISPLAY_INFO",
    "SUPER_RARE_RESOURCES",
]
