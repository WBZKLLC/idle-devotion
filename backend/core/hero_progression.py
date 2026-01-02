"""
Hero Progression System - Rarity, Fusion & Star Progression
Implements duplicate fusion, star promotion, and rarity ascension mechanics
"""
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import math

# =============================================================================
# RARITY DEFINITIONS
# =============================================================================

class Rarity(Enum):
    N = "N"
    R = "R"
    SR = "SR"
    SSR = "SSR"
    SSR_PLUS = "SSR+"
    UR = "UR"
    UR_PLUS = "UR+"

# Rarity stat multipliers
RARITY_MULTIPLIERS = {
    "N": 0.7,
    "R": 0.9,
    "SR": 1.0,
    "SSR": 1.5,
    "SSR+": 1.8,
    "UR": 2.2,
    "UR+": 2.8
}

# Starting stars by rarity
STARTING_STARS = {
    "N": 1,
    "R": 1,
    "SR": 3,
    "SSR": 5,
    "SSR+": 5,
    "UR": 5,
    "UR+": 5
}

# Max stars by rarity
MAX_STARS = {
    "N": 3,
    "R": 4,
    "SR": 5,
    "SSR": 6,  # 5★+ represented as 6
    "SSR+": 6,
    "UR": 7,   # UR can go to 7 (legendary status)
    "UR+": 7
}

# Shards gained from pulling duplicates
DUPLICATE_SHARD_YIELD = {
    "N": 5,
    "R": 5,
    "SR": 10,
    "SSR": 50,
    "SSR+": 75,
    "UR": 100,
    "UR+": 150
}

# =============================================================================
# STAR PROMOTION CONFIGURATION
# =============================================================================

STAR_PROMOTION_CONFIG = {
    # From 1★ to 2★
    1: {
        "shard_cost": 10,
        "gold_cost": 5000,
        "stat_boost": 0.0,  # No stat boost yet
        "level_cap_unlock": 40,
        "skill_unlock": None,
        "description": "Unlocks Level Cap 40"
    },
    # From 2★ to 3★
    2: {
        "shard_cost": 20,
        "gold_cost": 15000,
        "stat_boost": 0.15,  # +15% base stats
        "level_cap_unlock": 60,
        "skill_unlock": "skill_2",
        "description": "Unlocks Skill 2 • +15% Base Stats"
    },
    # From 3★ to 4★
    3: {
        "shard_cost": 50,
        "gold_cost": 50000,
        "stat_boost": 0.20,  # +20% base stats
        "level_cap_unlock": 80,
        "skill_unlock": None,
        "description": "Unlocks Level Cap 80 • +20% Base Stats"
    },
    # From 4★ to 5★
    4: {
        "shard_cost": 100,
        "gold_cost": 150000,
        "stat_boost": 0.25,  # +25% base stats
        "level_cap_unlock": 90,
        "skill_unlock": "ultimate",
        "description": "Unlocks Ultimate Skill • +25% Base Stats"
    },
    # From 5★ to 5★+ (MAX)
    5: {
        "shard_cost": 200,
        "gold_cost": 500000,
        "stat_boost": 0.40,  # +40% base stats
        "level_cap_unlock": 100,
        "skill_unlock": "all_skills_max",
        "description": "MAX Star • Level Cap 100 • +40% Base Stats"
    },
    # From 5★+ to 6★ (UR Transcendence)
    6: {
        "shard_cost": 300,
        "gold_cost": 1000000,
        "stat_boost": 0.50,  # +50% base stats
        "level_cap_unlock": 120,
        "skill_unlock": "transcended_passive",
        "description": "Transcended Form • +50% Base Stats • New Passive"
    },
    # From 6★ to 7★ (Legendary - UR only)
    7: {
        "shard_cost": 500,
        "gold_cost": 2000000,
        "celestial_sparks": 5,
        "stat_boost": 0.60,
        "level_cap_unlock": 150,
        "skill_unlock": "legendary_awakening",
        "description": "Legendary Awakening • +60% Base Stats • Ultimate Form"
    }
}

# =============================================================================
# RARITY ASCENSION CONFIGURATION
# =============================================================================

ASCENSION_CONFIG = {
    # SSR → SSR+ (Enhanced)
    "SSR_to_SSR+": {
        "required_rarity": "SSR",
        "required_stars": 6,  # Must be 5★+
        "shard_cost": 50,  # Additional shards
        "celestial_sparks": 1,
        "gold_cost": 500000,
        "result_rarity": "SSR+",
        "new_multiplier": 1.8,
        "bonus_passive": "enhanced_trait",
        "description": "Ascend to SSR+ • Gain Enhanced Trait"
    },
    # SSR+ → UR (Mythic)
    "SSR+_to_UR": {
        "required_rarity": "SSR+",
        "required_stars": 6,
        "shard_cost": 100,
        "celestial_sparks": 3,
        "gold_cost": 1000000,
        "result_rarity": "UR",
        "new_multiplier": 2.2,
        "bonus_passive": "mythic_awakening",
        "description": "Ascend to UR (Mythic) • Gain Mythic Awakening"
    },
    # UR → UR+ (Divine)
    "UR_to_UR+": {
        "required_rarity": "UR",
        "required_stars": 7,
        "shard_cost": 200,
        "celestial_sparks": 5,
        "divine_essence": 50,
        "gold_cost": 2000000,
        "result_rarity": "UR+",
        "new_multiplier": 2.8,
        "bonus_passive": "divine_form",
        "description": "Ascend to UR+ (Divine) • Ultimate Power Unlocked"
    }
}

# =============================================================================
# LEVEL CAP BY STARS
# =============================================================================

def get_level_cap(stars: int, rarity: str) -> int:
    """Get max level based on star count"""
    base_caps = {
        1: 30,
        2: 40,
        3: 60,
        4: 80,
        5: 90,
        6: 100,
        7: 120
    }
    
    # UR and UR+ get bonus level caps
    rarity_bonus = {
        "N": 0,
        "R": 0,
        "SR": 0,
        "SSR": 0,
        "SSR+": 10,
        "UR": 20,
        "UR+": 30
    }
    
    return base_caps.get(stars, 30) + rarity_bonus.get(rarity, 0)

# =============================================================================
# STAT CALCULATION
# =============================================================================

def calculate_star_multiplier(stars: int) -> float:
    """
    Calculate cumulative star multiplier from all promotions
    Stars 1-2: No stat boost
    Star 3: +15%
    Star 4: +20% (cumulative: +35%)
    Star 5: +25% (cumulative: +60%)
    Star 5+: +40% (cumulative: +100%)
    Star 6: +50% (cumulative: +150%)
    Star 7: +60% (cumulative: +210%)
    """
    multiplier = 1.0
    
    if stars >= 3:
        multiplier += 0.15  # 3★ bonus
    if stars >= 4:
        multiplier += 0.20  # 4★ bonus
    if stars >= 5:
        multiplier += 0.25  # 5★ bonus
    if stars >= 6:
        multiplier += 0.40  # 5★+ bonus
    if stars >= 7:
        multiplier += 0.50  # 6★ bonus (transcended)
    
    return multiplier


def calculate_final_stat(
    base_stat: int,
    rarity: str,
    stars: int,
    level: int,
    flat_bonus: int = 0,
    percent_bonus: float = 0.0
) -> int:
    """
    Calculate final stat using the formula:
    Final_Stat = (Hero_Base_Stat × Rarity_Multiplier × Star_Multiplier × Level_Scaling) + Flat_Bonuses
    Then apply percentage bonuses
    """
    rarity_mult = RARITY_MULTIPLIERS.get(rarity, 1.0)
    star_mult = calculate_star_multiplier(stars)
    
    # Level scaling: 1% per level above 1
    level_scaling = 1.0 + (level - 1) * 0.01
    
    # Calculate base final stat
    final_stat = base_stat * rarity_mult * star_mult * level_scaling
    
    # Add flat bonuses (from equipment, etc.)
    final_stat += flat_bonus
    
    # Apply percentage bonuses (from buffs, passives, etc.)
    final_stat *= (1.0 + percent_bonus)
    
    return int(final_stat)


def calculate_hero_power(
    base_hp: int,
    base_atk: int,
    base_def: int,
    base_speed: int,
    rarity: str,
    stars: int,
    level: int
) -> int:
    """Calculate total hero combat power rating"""
    hp = calculate_final_stat(base_hp, rarity, stars, level)
    atk = calculate_final_stat(base_atk, rarity, stars, level)
    defense = calculate_final_stat(base_def, rarity, stars, level)
    speed = calculate_final_stat(base_speed, rarity, stars, level)
    
    # Power formula: ATK weighted heavily
    power = hp + (atk * 3) + (defense * 2) + (speed * 1.5)
    return int(power)

# =============================================================================
# PROMOTION & ASCENSION CHECKS
# =============================================================================

def can_promote_star(
    current_stars: int,
    rarity: str,
    shards: int,
    gold: int,
    celestial_sparks: int = 0
) -> Tuple[bool, str]:
    """Check if hero can be promoted to next star"""
    max_star = MAX_STARS.get(rarity, 5)
    
    if current_stars >= max_star:
        return False, f"Already at maximum stars for {rarity} rarity"
    
    config = STAR_PROMOTION_CONFIG.get(current_stars)
    if not config:
        return False, "Invalid star level"
    
    if shards < config["shard_cost"]:
        return False, f"Need {config['shard_cost']} shards (have {shards})"
    
    if gold < config["gold_cost"]:
        return False, f"Need {config['gold_cost']:,} gold (have {gold:,})"
    
    if config.get("celestial_sparks", 0) > 0:
        if celestial_sparks < config["celestial_sparks"]:
            return False, f"Need {config['celestial_sparks']} Celestial Sparks"
    
    return True, "Ready to promote!"


def get_promotion_cost(current_stars: int) -> Dict:
    """Get the cost for next star promotion"""
    config = STAR_PROMOTION_CONFIG.get(current_stars, {})
    return {
        "shards": config.get("shard_cost", 0),
        "gold": config.get("gold_cost", 0),
        "celestial_sparks": config.get("celestial_sparks", 0),
        "stat_boost": config.get("stat_boost", 0),
        "description": config.get("description", ""),
        "level_cap_unlock": config.get("level_cap_unlock", 0),
        "skill_unlock": config.get("skill_unlock")
    }


def can_ascend_rarity(
    rarity: str,
    stars: int,
    shards: int,
    celestial_sparks: int,
    divine_essence: int,
    gold: int
) -> Tuple[bool, str, Optional[str]]:
    """Check if hero can ascend to next rarity tier"""
    
    # Determine ascension path
    ascension_key = None
    if rarity == "SSR" and stars >= 6:
        ascension_key = "SSR_to_SSR+"
    elif rarity == "SSR+" and stars >= 6:
        ascension_key = "SSR+_to_UR"
    elif rarity == "UR" and stars >= 7:
        ascension_key = "UR_to_UR+"
    
    if not ascension_key:
        return False, "Hero cannot ascend at current rarity/star level", None
    
    config = ASCENSION_CONFIG[ascension_key]
    
    if shards < config["shard_cost"]:
        return False, f"Need {config['shard_cost']} shards", ascension_key
    
    if celestial_sparks < config["celestial_sparks"]:
        return False, f"Need {config['celestial_sparks']} Celestial Sparks", ascension_key
    
    if gold < config["gold_cost"]:
        return False, f"Need {config['gold_cost']:,} gold", ascension_key
    
    if config.get("divine_essence", 0) > 0:
        if divine_essence < config["divine_essence"]:
            return False, f"Need {config['divine_essence']} Divine Essence", ascension_key
    
    return True, "Ready to ascend!", ascension_key


def get_ascension_info(rarity: str) -> Optional[Dict]:
    """Get ascension requirements for a rarity"""
    ascension_key = None
    if rarity == "SSR":
        ascension_key = "SSR_to_SSR+"
    elif rarity == "SSR+":
        ascension_key = "SSR+_to_UR"
    elif rarity == "UR":
        ascension_key = "UR_to_UR+"
    
    if not ascension_key:
        return None
    
    config = ASCENSION_CONFIG[ascension_key]
    return {
        "required_stars": config["required_stars"],
        "shard_cost": config["shard_cost"],
        "celestial_sparks": config["celestial_sparks"],
        "divine_essence": config.get("divine_essence", 0),
        "gold_cost": config["gold_cost"],
        "result_rarity": config["result_rarity"],
        "bonus_passive": config["bonus_passive"],
        "description": config["description"]
    }

# =============================================================================
# DUPLICATE HANDLING
# =============================================================================

def handle_duplicate_pull(rarity: str) -> Dict:
    """
    Handle pulling a duplicate hero
    Returns shard conversion info
    """
    shards = DUPLICATE_SHARD_YIELD.get(rarity, 5)
    
    return {
        "converted_to_shards": True,
        "shard_amount": shards,
        "message": f"Duplicate! Converted into {shards} Hero Shards."
    }


def calculate_total_shards_needed(from_stars: int, to_stars: int) -> int:
    """Calculate total shards needed to promote from one star level to another"""
    total = 0
    for star in range(from_stars, to_stars):
        config = STAR_PROMOTION_CONFIG.get(star, {})
        total += config.get("shard_cost", 0)
    return total


def calculate_copies_needed(rarity: str, target_stars: int) -> int:
    """
    Calculate how many copies (pulls) needed to reach target stars
    Includes the initial copy
    """
    starting_stars = STARTING_STARS.get(rarity, 1)
    
    if target_stars <= starting_stars:
        return 1  # Just the initial copy
    
    total_shards = calculate_total_shards_needed(starting_stars, target_stars)
    shards_per_dupe = DUPLICATE_SHARD_YIELD.get(rarity, 10)
    
    # Add 1 for the initial copy
    return 1 + math.ceil(total_shards / shards_per_dupe)

# =============================================================================
# SKILL UNLOCKS
# =============================================================================

SKILL_UNLOCK_BY_STARS = {
    1: ["skill_1"],  # Basic skill always available
    2: ["skill_1"],
    3: ["skill_1", "skill_2"],  # Unlock skill 2 at 3★
    4: ["skill_1", "skill_2", "skill_3"],  # Unlock skill 3 at 4★
    5: ["skill_1", "skill_2", "skill_3", "ultimate"],  # Unlock ultimate at 5★
    6: ["skill_1", "skill_2", "skill_3", "ultimate", "passive_enhanced"],
    7: ["skill_1", "skill_2", "skill_3", "ultimate", "passive_enhanced", "legendary_skill"]
}


def get_unlocked_skills(stars: int) -> List[str]:
    """Get list of unlocked skill slots for star level"""
    return SKILL_UNLOCK_BY_STARS.get(stars, ["skill_1"])


def get_max_skill_level(stars: int) -> int:
    """Get maximum skill level based on stars"""
    skill_caps = {
        1: 1,
        2: 2,
        3: 4,
        4: 6,
        5: 8,
        6: 10,
        7: 12
    }
    return skill_caps.get(stars, 1)

# =============================================================================
# PROGRESSION SUMMARY
# =============================================================================

def get_hero_progression_summary(
    hero_name: str,
    rarity: str,
    stars: int,
    shards: int,
    level: int
) -> Dict:
    """Get comprehensive progression summary for a hero"""
    
    max_star = MAX_STARS.get(rarity, 5)
    level_cap = get_level_cap(stars, rarity)
    star_mult = calculate_star_multiplier(stars)
    rarity_mult = RARITY_MULTIPLIERS.get(rarity, 1.0)
    
    # Next promotion info
    next_promo = None
    if stars < max_star:
        cost = get_promotion_cost(stars)
        can_promote, message = can_promote_star(stars, rarity, shards, 999999999)  # Ignore gold for display
        next_promo = {
            "next_star": stars + 1,
            "shard_cost": cost["shards"],
            "gold_cost": cost["gold"],
            "shards_owned": shards,
            "shards_needed": max(0, cost["shards"] - shards),
            "can_promote": can_promote,
            "description": cost["description"]
        }
    
    # Ascension info
    ascension = get_ascension_info(rarity)
    
    # Copies calculation
    copies_for_max = calculate_copies_needed(rarity, max_star)
    
    return {
        "hero_name": hero_name,
        "rarity": rarity,
        "stars": stars,
        "max_stars": max_star,
        "stars_display": f"{'★' * stars}{'☆' * (max_star - stars)}",
        "level": level,
        "level_cap": level_cap,
        "shards": shards,
        "stat_multiplier": round(rarity_mult * star_mult, 2),
        "rarity_multiplier": rarity_mult,
        "star_multiplier": round(star_mult, 2),
        "unlocked_skills": get_unlocked_skills(stars),
        "max_skill_level": get_max_skill_level(stars),
        "next_promotion": next_promo,
        "ascension_available": ascension,
        "copies_for_max_stars": copies_for_max,
        "is_maxed": stars >= max_star
    }
