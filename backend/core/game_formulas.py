"""
Game Formulas & Systems for Divine Heroes
==========================================

This module implements the core mathematical formulas from the Idle Angels blueprint:
1. Soft Pity System (increasing rates before hard pity)
2. Character Stat Formulas (level scaling, star multiplier, equipment)
3. Combat Damage Calculation (ATK-DEF, crit, element restraint)
4. Skill Energy/Rage System
5. Equipment Enhancement with success/fail

All calculations are SERVER-AUTHORITATIVE - client cannot manipulate these values.
"""

import random
import math
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime

# ============================================================================
# 1. GACHA SOFT PITY SYSTEM
# ============================================================================

# Pity Configuration
PITY_CONFIG = {
    "common": {
        "hard_pity": 50,
        "soft_pity_start": 35,
        "base_ssr_rate": 0.092,  # 9.2% SSR/SSR+ combined
        "soft_pity_increase": 0.02,  # +2% per pull after soft pity
        "guaranteed_rarity": ["SSR", "SSR+"],
    },
    "premium": {
        "hard_pity": 70,
        "soft_pity_start": 50,
        "base_ur_rate": 0.008,  # 0.8% UR
        "soft_pity_increase": 0.015,  # +1.5% per pull after soft pity
        "guaranteed_rarity": ["UR"],
    },
    "divine": {
        "hard_pity": 40,
        "soft_pity_start": 25,
        "base_ur_plus_rate": 0.008,  # 0.8% UR+
        "soft_pity_increase": 0.025,  # +2.5% per pull after soft pity
        "guaranteed_rarity": ["UR+"],
    }
}


def calculate_gacha_rate_with_soft_pity(
    summon_type: str,
    pity_counter: int,
    base_rate_key: str = "base_ssr_rate"
) -> float:
    """
    Calculate the actual summon rate including soft pity bonus.
    
    Formula:
    if pity_counter > soft_pity_start:
        current_rate = base_rate + (soft_pity_increase * (pity_counter - soft_pity_start))
    if pity_counter >= hard_pity:
        current_rate = 1.0  # 100% guaranteed
    
    Returns: Float between 0.0 and 1.0
    """
    config = PITY_CONFIG.get(summon_type, PITY_CONFIG["common"])
    
    hard_pity = config["hard_pity"]
    soft_pity_start = config["soft_pity_start"]
    
    # Determine base rate key
    if summon_type == "divine":
        base_rate = config["base_ur_plus_rate"]
    elif summon_type == "premium":
        base_rate = config["base_ur_rate"]
    else:
        base_rate = config["base_ssr_rate"]
    
    soft_pity_increase = config["soft_pity_increase"]
    
    # Hard pity - guaranteed
    if pity_counter >= hard_pity:
        return 1.0
    
    # Soft pity - increasing rate
    if pity_counter > soft_pity_start:
        bonus = soft_pity_increase * (pity_counter - soft_pity_start)
        return min(base_rate + bonus, 1.0)
    
    # Normal rate
    return base_rate


def should_trigger_high_tier_pull(summon_type: str, pity_counter: int) -> bool:
    """
    Determine if this pull should guarantee a high-tier hero.
    Uses the soft pity formula to calculate probability.
    """
    rate = calculate_gacha_rate_with_soft_pity(summon_type, pity_counter)
    roll = random.random()
    return roll < rate


# ============================================================================
# 2. CHARACTER STAT FORMULAS
# ============================================================================

# Rarity base stat multipliers
RARITY_MULTIPLIERS = {
    "N": 1.0,
    "R": 1.2,
    "SR": 1.5,
    "SSR": 2.0,
    "SSR+": 2.5,
    "UR": 3.0,
    "UR+": 4.0
}

# Star promotion multipliers (1★ to 6★)
STAR_MULTIPLIERS = {
    0: 1.0,    # No stars
    1: 1.25,   # 1★
    2: 1.50,   # 2★
    3: 1.75,   # 3★
    4: 2.0,    # 4★
    5: 2.5,    # 5★
    6: 3.0,    # 6★ (max)
}

# Awakening multipliers (0-5 stages)
AWAKENING_MULTIPLIERS = {
    0: 1.0,
    1: 1.1,
    2: 1.25,
    3: 1.45,
    4: 1.7,
    5: 2.0,  # Max awakening
}


def calculate_level_modifier(level: int) -> float:
    """
    Level scaling with diminishing returns.
    Formula: Level_Modifier = (Level ^ 0.8) / 100
    
    Examples:
    - Level 1: 0.01
    - Level 50: 0.189
    - Level 100: 0.251
    - Level 200: 0.334
    """
    return (level ** 0.8) / 100


def calculate_stat_at_level(base_stat: int, level: int) -> float:
    """
    Calculate stat value at a given level.
    Formula: Stat_At_Level = Base_Stat * (1 + Level_Modifier)
    """
    level_mod = calculate_level_modifier(level)
    return base_stat * (1 + level_mod)


def calculate_star_multiplier(star_level: int) -> float:
    """
    Get the star promotion multiplier.
    Formula: Star_Multiplier = 1.0 + (Star_Level * 0.25) [or use lookup table]
    """
    return STAR_MULTIPLIERS.get(min(star_level, 6), 1.0)


def calculate_final_stat(
    base_stat: int,
    level: int,
    star_level: int,
    awakening_level: int,
    flat_equipment_bonus: int = 0,
    percentage_gem_bonus: float = 0.0,
    global_buff_percentage: float = 0.0
) -> int:
    """
    Calculate the final synthesized stat value.
    
    Formula:
    Final_Stat = (Base_Stat * (1 + Level_Modifier) * Star_Multiplier + Sum_Flat_Equipment)
                 * (1 + Sum_Percentage_Gem_Bonuses)
                 * (1 + Global_Buff_Percentages)
                 * Awakening_Multiplier
    """
    # Level scaling
    stat_at_level = calculate_stat_at_level(base_stat, level)
    
    # Star multiplier
    star_mult = calculate_star_multiplier(star_level)
    post_star_stat = stat_at_level * star_mult
    
    # Add flat equipment bonus
    with_equipment = post_star_stat + flat_equipment_bonus
    
    # Apply percentage bonuses (multiplicative)
    with_gems = with_equipment * (1 + percentage_gem_bonus)
    with_buffs = with_gems * (1 + global_buff_percentage)
    
    # Awakening multiplier
    awakening_mult = AWAKENING_MULTIPLIERS.get(awakening_level, 1.0)
    final_stat = with_buffs * awakening_mult
    
    return int(final_stat)


def calculate_hero_power(hero_data: Dict[str, Any]) -> int:
    """
    Calculate total hero power rating for display.
    Power = (HP/10 + ATK*3 + DEF*2 + SPD) * level_factor * rarity_factor
    """
    hp = hero_data.get("current_hp", hero_data.get("base_hp", 1000))
    atk = hero_data.get("current_atk", hero_data.get("base_atk", 100))
    defense = hero_data.get("current_def", hero_data.get("base_def", 50))
    spd = hero_data.get("speed", 100)
    level = hero_data.get("level", 1)
    rarity = hero_data.get("rarity", "SR")
    
    base_power = (hp / 10) + (atk * 3) + (defense * 2) + spd
    level_factor = 1 + calculate_level_modifier(level)
    rarity_factor = RARITY_MULTIPLIERS.get(rarity, 1.0)
    
    return int(base_power * level_factor * rarity_factor)


# ============================================================================
# 3. COMBAT DAMAGE CALCULATION
# ============================================================================

# Element restraint matrix (attacker -> defender = multiplier)
# Fire > Nature, Nature > Water, Water > Fire
# Light <-> Dark (mutual advantage)
ELEMENT_RESTRAINT = {
    "Fire": {"Nature": 1.3, "Water": 0.7},
    "Nature": {"Water": 1.3, "Fire": 0.7},
    "Water": {"Fire": 1.3, "Nature": 0.7},
    "Light": {"Dark": 1.3},
    "Dark": {"Light": 1.3},
    "Wind": {},  # Neutral
}

# Class restraint (Rock-Paper-Scissors)
# Warrior > Archer > Mage > Warrior
CLASS_RESTRAINT = {
    "Warrior": {"Archer": 1.3, "Mage": 0.7},
    "Archer": {"Mage": 1.3, "Warrior": 0.7},
    "Mage": {"Warrior": 1.3, "Archer": 0.7},
    "Support": {},  # Neutral
    "Tank": {},     # Neutral
}

# Position bonus (backline attacking frontline)
POSITION_BONUS = {
    "back_to_front": 1.10,  # 10% bonus
    "front_to_back": 0.95,  # 5% penalty
    "same_line": 1.0,
}


def calculate_critical_chance(attacker_crit: int, defender_tenacity: int) -> float:
    """
    Calculate critical hit chance.
    Formula: Critical_Chance = Attacker_CRT / (Attacker_CRT + Target_TEN + 1000)
    
    With 500 CRT vs 200 TEN: 500 / (500 + 200 + 1000) = 29.4%
    """
    return attacker_crit / (attacker_crit + defender_tenacity + 1000)


def calculate_raw_damage(
    attacker_atk: int,
    skill_modifier: float,
    defender_def: int,
    armor_penetration: float = 0.0
) -> int:
    """
    Calculate raw damage before critical and other multipliers.
    
    Formula:
    Raw_Damage = (Attacker_ATK * Skill_Modifier) - (Defender_DEF * Armor_Factor)
    Armor_Factor = (1 - Armor_Penetration), clamped between 0.2 and 1.0
    """
    # Calculate armor factor
    armor_factor = max(0.2, min(1.0, 1 - armor_penetration))
    
    # Raw damage (minimum 1)
    raw = (attacker_atk * skill_modifier) - (defender_def * armor_factor)
    return max(1, int(raw))


def calculate_critical_damage(raw_damage: int, crit_damage_bonus: float = 0.0) -> int:
    """
    Calculate damage on critical hit.
    Formula: Critical_Damage = Raw_Damage * (1.5 + Attacker_CRT_DMG_Bonus)
    """
    crit_multiplier = 1.5 + crit_damage_bonus
    return int(raw_damage * crit_multiplier)


def get_element_restraint_multiplier(attacker_element: str, defender_element: str) -> float:
    """Get element advantage/disadvantage multiplier."""
    restraints = ELEMENT_RESTRAINT.get(attacker_element, {})
    return restraints.get(defender_element, 1.0)


def get_class_restraint_multiplier(attacker_class: str, defender_class: str) -> float:
    """Get class advantage/disadvantage multiplier."""
    restraints = CLASS_RESTRAINT.get(attacker_class, {})
    return restraints.get(defender_class, 1.0)


def calculate_final_damage(
    attacker: Dict[str, Any],
    defender: Dict[str, Any],
    skill_modifier: float = 1.0,
    attacker_position: str = "front",
    defender_position: str = "front"
) -> Tuple[int, bool, Dict[str, float]]:
    """
    Calculate final damage including all factors.
    
    Returns: (final_damage, is_critical, breakdown_dict)
    """
    # Extract stats
    atk = attacker.get("current_atk", attacker.get("base_atk", 100))
    defender_def = defender.get("current_def", defender.get("base_def", 50))
    crit_rate = attacker.get("crit_rate", 100)
    crit_dmg = attacker.get("crit_damage", 0.5)
    tenacity = defender.get("tenacity", 100)
    armor_pen = attacker.get("armor_penetration", 0.0)
    dmg_reduction = defender.get("damage_reduction", 0.0)
    
    # Elements and classes
    atk_element = attacker.get("element", "Fire")
    def_element = defender.get("element", "Fire")
    atk_class = attacker.get("hero_class", "Warrior")
    def_class = defender.get("hero_class", "Warrior")
    
    # Calculate raw damage
    raw_damage = calculate_raw_damage(atk, skill_modifier, defender_def, armor_pen)
    
    # Check for critical hit
    crit_chance = calculate_critical_chance(crit_rate, tenacity)
    is_critical = random.random() < crit_chance
    
    if is_critical:
        damage = calculate_critical_damage(raw_damage, crit_dmg)
    else:
        damage = raw_damage
    
    # Apply damage reduction
    damage = int(damage * (1 - min(dmg_reduction, 0.8)))  # Cap at 80% reduction
    
    # Apply element restraint
    element_mult = get_element_restraint_multiplier(atk_element, def_element)
    damage = int(damage * element_mult)
    
    # Apply class restraint
    class_mult = get_class_restraint_multiplier(atk_class, def_class)
    damage = int(damage * class_mult)
    
    # Apply position bonus
    if attacker_position == "back" and defender_position == "front":
        pos_mult = POSITION_BONUS["back_to_front"]
    elif attacker_position == "front" and defender_position == "back":
        pos_mult = POSITION_BONUS["front_to_back"]
    else:
        pos_mult = POSITION_BONUS["same_line"]
    
    damage = int(damage * pos_mult)
    
    # Breakdown for logging/display
    breakdown = {
        "raw_damage": raw_damage,
        "skill_modifier": skill_modifier,
        "crit_chance": crit_chance,
        "element_multiplier": element_mult,
        "class_multiplier": class_mult,
        "position_multiplier": pos_mult,
        "damage_reduction": dmg_reduction,
    }
    
    return (max(1, damage), is_critical, breakdown)


# ============================================================================
# 4. SKILL ENERGY/RAGE SYSTEM
# ============================================================================

MAX_RAGE = 1000  # Full rage bar


def calculate_rage_gained_from_damage(damage_taken: int, max_hp: int) -> int:
    """
    Calculate rage gained when taking damage.
    Formula: Rage_Gained = Damage_Taken / (Max_HP * 0.1)
    
    Example: 500 damage taken with 5000 max HP = 500 / 500 = 100 rage
    """
    if max_hp <= 0:
        return 0
    rage_per_hp = 1 / (max_hp * 0.1)
    rage_gained = int(damage_taken * rage_per_hp)
    return min(rage_gained, MAX_RAGE)


def calculate_rage_gained_from_dealing(damage_dealt: int, base_rage: int = 100) -> int:
    """
    Calculate rage gained when dealing damage.
    Base 100 rage per attack, bonus based on damage dealt.
    """
    bonus = int(damage_dealt / 100)  # +1 rage per 100 damage
    return min(base_rage + bonus, MAX_RAGE // 2)  # Cap at half bar per attack


def can_use_ultimate(current_rage: int) -> bool:
    """Check if ultimate skill can be activated."""
    return current_rage >= MAX_RAGE


def use_ultimate(current_rage: int) -> int:
    """Use ultimate and return remaining rage."""
    if current_rage >= MAX_RAGE:
        return 0  # Reset to 0
    return current_rage  # Can't use, return unchanged


# ============================================================================
# 5. EQUIPMENT ENHANCEMENT SYSTEM
# ============================================================================

ENHANCEMENT_BASE_COST = 1000  # Gold
ENHANCEMENT_COST_MULTIPLIER = 1.5
ENHANCEMENT_MAX_LEVEL = 20

# Success rates decrease at higher levels
ENHANCEMENT_SUCCESS_RATES = {
    range(0, 5): 1.0,      # 100% success for +0 to +5
    range(5, 10): 0.75,    # 75% for +5 to +10
    range(10, 15): 0.50,   # 50% for +10 to +15
    range(15, 18): 0.30,   # 30% for +15 to +18
    range(18, 20): 0.15,   # 15% for +18 to +20
    range(20, 21): 0.05,   # 5% for +20 (max)
}


def get_enhancement_cost(current_level: int) -> int:
    """
    Calculate gold cost for next enhancement level.
    Formula: Cost = Base_Cost * (1.5 ^ Target_Level)
    """
    target_level = current_level + 1
    return int(ENHANCEMENT_BASE_COST * (ENHANCEMENT_COST_MULTIPLIER ** target_level))


def get_enhancement_success_rate(current_level: int) -> float:
    """Get success rate for enhancing from current level."""
    for level_range, rate in ENHANCEMENT_SUCCESS_RATES.items():
        if current_level in level_range:
            return rate
    return 0.05  # Default to 5%


def attempt_enhancement(current_level: int) -> Tuple[bool, int, int]:
    """
    Attempt to enhance equipment.
    
    Returns: (success, new_level, gold_cost)
    """
    if current_level >= ENHANCEMENT_MAX_LEVEL:
        return (False, current_level, 0)
    
    cost = get_enhancement_cost(current_level)
    success_rate = get_enhancement_success_rate(current_level)
    
    success = random.random() < success_rate
    new_level = current_level + 1 if success else current_level
    
    return (success, new_level, cost)


def calculate_equipment_stat_bonus(base_stat: int, enhancement_level: int) -> int:
    """
    Calculate stat bonus from equipment enhancement.
    Each level adds 5% of base stat, compounding.
    """
    multiplier = 1 + (enhancement_level * 0.05)
    return int(base_stat * multiplier) - base_stat  # Return just the bonus


# ============================================================================
# 6. SHARD & DUPLICATE SYSTEM
# ============================================================================

SHARD_REQUIREMENTS = {
    1: 10,   # 10 shards for 1★ -> 2★
    2: 20,   # 20 shards for 2★ -> 3★
    3: 40,   # 40 shards for 3★ -> 4★
    4: 60,   # 60 shards for 4★ -> 5★
    5: 100,  # 100 shards for 5★ -> 6★
}

DUPLICATE_SHARD_REWARDS = {
    "N": 2,
    "R": 5,
    "SR": 10,
    "SSR": 15,
    "SSR+": 20,
    "UR": 30,
    "UR+": 50,
}


def get_shards_required_for_promotion(current_stars: int) -> int:
    """Get shards needed to promote to next star level."""
    return SHARD_REQUIREMENTS.get(current_stars, 0)


def get_shards_from_duplicate(rarity: str) -> int:
    """Get shards when pulling a duplicate hero."""
    return DUPLICATE_SHARD_REWARDS.get(rarity, 5)


def can_promote_star(current_stars: int, current_shards: int) -> bool:
    """Check if hero can be promoted to next star level."""
    required = get_shards_required_for_promotion(current_stars)
    return required > 0 and current_shards >= required


# ============================================================================
# 7. MONTHLY SUBSCRIPTION SYSTEM
# ============================================================================

MONTHLY_CARD_CONFIG = {
    "price_usd": 4.99,
    "immediate_gems": 120,
    "daily_gems": 100,
    "duration_days": 30,
    "total_value": 3120,  # 120 + (100 * 30)
}


def calculate_subscription_daily_reward(days_remaining: int) -> Dict[str, int]:
    """Calculate daily subscription rewards."""
    if days_remaining <= 0:
        return {}
    
    return {
        "crystals": MONTHLY_CARD_CONFIG["daily_gems"],
        "bonus_stamina": 50,  # Bonus stamina for subscribers
    }


def get_subscription_status(purchase_date: datetime, current_date: datetime) -> Dict[str, Any]:
    """Get subscription status and remaining days."""
    if not purchase_date:
        return {"active": False, "days_remaining": 0}
    
    days_elapsed = (current_date - purchase_date).days
    days_remaining = max(0, MONTHLY_CARD_CONFIG["duration_days"] - days_elapsed)
    
    return {
        "active": days_remaining > 0,
        "days_remaining": days_remaining,
        "daily_gems": MONTHLY_CARD_CONFIG["daily_gems"] if days_remaining > 0 else 0,
    }


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Gacha
    "PITY_CONFIG",
    "calculate_gacha_rate_with_soft_pity",
    "should_trigger_high_tier_pull",
    # Stats
    "RARITY_MULTIPLIERS",
    "STAR_MULTIPLIERS",
    "AWAKENING_MULTIPLIERS",
    "calculate_level_modifier",
    "calculate_stat_at_level",
    "calculate_star_multiplier",
    "calculate_final_stat",
    "calculate_hero_power",
    # Combat
    "ELEMENT_RESTRAINT",
    "CLASS_RESTRAINT",
    "POSITION_BONUS",
    "calculate_critical_chance",
    "calculate_raw_damage",
    "calculate_critical_damage",
    "get_element_restraint_multiplier",
    "get_class_restraint_multiplier",
    "calculate_final_damage",
    # Rage
    "MAX_RAGE",
    "calculate_rage_gained_from_damage",
    "calculate_rage_gained_from_dealing",
    "can_use_ultimate",
    "use_ultimate",
    # Equipment
    "get_enhancement_cost",
    "get_enhancement_success_rate",
    "attempt_enhancement",
    "calculate_equipment_stat_bonus",
    # Shards
    "get_shards_required_for_promotion",
    "get_shards_from_duplicate",
    "can_promote_star",
    # Subscription
    "MONTHLY_CARD_CONFIG",
    "calculate_subscription_daily_reward",
    "get_subscription_status",
]
