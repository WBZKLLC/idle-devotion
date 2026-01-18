"""
LAUNCH EXCLUSIVE BANNER SYSTEM
==============================

This module implements the high-conversion monetization system:
1. Exclusive "Must-Have" UR Character (Aethon, The Celestial Blade)
2. 50/80 Soft/Hard Pity with 50% Rate-Up
3. Strategic Bundle Triggers on Pull Failures
4. Unlock after Stage 2-10 clearance
5. 72-hour FOMO window for new players

PSYCHOLOGICAL LEVERS:
- Loss Aversion (FOMO): Limited time, won't return for 6 months
- Sunk Cost Fallacy: Progress tracking encourages completion
- Calculated Investment: Clear pity = calculable purchase

All calculations SERVER-AUTHORITATIVE.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import random
import uuid

# ============================================================================
# 1. THE PRODUCT: AETHON, THE CELESTIAL BLADE
# ============================================================================

EXCLUSIVE_HERO = {
    "id": "aethon_celestial_blade",
    "name": "Aethon, The Celestial Blade",
    "rarity": "UR",
    "element": "Light",
    "hero_class": "Warrior",
    "role": "DPS",
    "exclusive": True,
    "exclusive_duration_months": 6,  # Won't be in standard pool for 6 months
    
    # Character image - Divine celestial warrior
    "image_url": "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=400",
    
    # OVERPOWERED Stats (trivializes early/mid-game)
    "base_hp": 12000,
    "base_atk": 480,      # Highest ATK in game
    "base_def": 280,
    "speed": 125,         # Fastest hero
    "crit_rate": 25,      # Built-in crit
    "crit_damage": 0.8,   # 80% crit damage bonus
    
    # DOMINANT Skills
    "skills": [
        {
            "name": "Divine Severance",
            "type": "active",
            "damage_multiplier": 2.5,
            "cooldown": 0,
            "description": "Strike with celestial power dealing 250% ATK damage. Ignores 30% of enemy DEF.",
            "effects": ["armor_pierce_30", "basic_attack"],
        },
        {
            "name": "Blade Storm",
            "type": "active",
            "damage_multiplier": 3.5,
            "cooldown": 3,
            "target": "all_enemies",
            "description": "Unleash a storm of holy blades dealing 350% ATK damage to ALL enemies. Each enemy killed extends duration by 1 turn.",
            "effects": ["aoe", "reset_on_kill"],
        },
        {
            "name": "Celestial Aegis",
            "type": "passive",
            "damage_multiplier": 0,
            "cooldown": 0,
            "description": "Immune to control effects. When HP drops below 50%, gain 100% ATK boost for 3 turns. (Once per battle)",
            "effects": ["cc_immune", "low_hp_buff", "once_per_battle"],
        },
        {
            "name": "Judgment of Light",
            "type": "ultimate",
            "damage_multiplier": 12.0,  # MASSIVE damage
            "cooldown": 0,
            "rage_cost": 1000,
            "description": "Call down divine judgment dealing 1200% ATK damage to a single target. If this kills the target, immediately gain 500 rage.",
            "effects": ["single_target", "execute", "rage_refund_500"],
        },
    ],
    
    # Story Integration
    "story_introduction": {
        "appears_in": "tutorial_stage_1_5",
        "role": "mysterious_ally",
        "cutscene": "Aethon descends from the heavens, his blade gleaming with celestial light. In a single strike, he obliterates the demon horde that had you cornered. 'You have potential, mortal. Prove yourself worthy, and I may lend you my power.'",
    },
    
    # Marketing Text
    "marketing": {
        "tagline": "The Blade That Cleaves Destiny",
        "description": "LIMITED TIME ONLY! Aethon, the legendary Celestial Blade, descends for just 72 hours! This divine warrior won't return for 6 MONTHS!",
        "power_claim": "Trivialize ALL early content with the most powerful hero ever released!",
    },
    
    "image_url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
}

# ============================================================================
# 2. BANNER CONFIGURATION
# ============================================================================

LAUNCH_EXCLUSIVE_BANNER = {
    "id": "launch_exclusive_aethon_2026",
    "name": "Celestial Descent",
    "subtitle": "LIMITED - 72 HOURS ONLY",
    "type": "launch_exclusive",
    
    # Timing
    "duration_hours": 72,
    "unlock_requirement": "stage_2_10",  # Unlocks after clearing 2-10
    
    # Rates (2% SSR total, 50% of SSR is Aethon = 1% Aethon rate)
    "rates": {
        "featured_UR": 1.0,    # 1% for Aethon (50% of 2% SSR pool conceptually)
        "other_SSR": 1.0,      # 1% for other SSR
        "SR": 8.0,             # 8% for SR
        "R": 30.0,             # 30% for R  
        "N": 60.0,             # 60% for N (fodder)
    },
    
    # Pity System (THE KEY TO MONETIZATION)
    "pity": {
        "soft_pity_start": 50,        # Rate dramatically increases after 50
        "hard_pity": 80,              # GUARANTEED Aethon at 80
        "soft_pity_rate_increase": 0.05,  # +5% per pull after soft pity
        "guaranteed_featured": True,   # Hard pity guarantees AETHON, not random SSR
    },
    
    # Visual
    "banner_color": "#FFD700",  # Gold
    "urgency_color": "#FF4444", # Red for timer
    
    # Currency
    "pull_cost": {
        "crystals_single": 300,
        "crystals_multi": 2700,  # 10% discount
    },
}

# ============================================================================
# 3. STRATEGIC BUNDLE SYSTEM
# ============================================================================

LAUNCH_BUNDLES = {
    # Tier 1: Low-barrier convertor (gets free players to spend ANYTHING)
    "starter_summon_pack": {
        "id": "starter_summon_pack",
        "name": "⚡ Starter Summon Pack",
        "price_usd": 4.99,
        "limit_per_user": 1,
        "value_multiplier": 5,  # 5x value vs baseline
        
        "contents": {
            "summon_tickets": 10,  # 10 pulls
            "crystals": 500,
            "gold": 200000,
        },
        
        "display": {
            "original_price": "$24.99",
            "discount_percent": 80,
            "tag": "BEST VALUE",
            "urgency": "First purchase only!",
        },
        
        # Trigger conditions
        "trigger": {
            "type": "post_pull_failure",
            "min_pulls": 10,
            "no_featured_hero": True,
        },
    },
    
    # Tier 2: Mid-spender commitment pack
    "ascension_bundle": {
        "id": "ascension_bundle",
        "name": "🌟 Ascension Bundle",
        "price_usd": 49.99,
        "limit_per_user": 2,
        "value_multiplier": 4,
        
        "contents": {
            "summon_tickets": 40,  # 40 pulls (halfway to guarantee)
            "crystals": 2000,
            "gold": 1000000,
            "enhancement_stones": 200,
            "exclusive_frame": "celestial_ascendant",
        },
        
        "display": {
            "original_price": "$199.99",
            "discount_percent": 75,
            "tag": "REACH YOUR GUARANTEE",
            "urgency": "Only during Celestial Descent!",
        },
        
        "trigger": {
            "type": "post_pull_failure",
            "min_pulls": 30,
            "pity_progress_percent": 40,  # Show when 40%+ to pity
        },
    },
    
    # Tier 3: Whale instant gratification
    "celestial_path": {
        "id": "celestial_path",
        "name": "👑 Celestial Path",
        "price_usd": 99.99,
        "limit_per_user": 1,
        "value_multiplier": 3.5,
        
        "contents": {
            "summon_tickets": 80,  # FULL GUARANTEE
            "crystals": 5000,
            "gold": 3000000,
            "enhancement_stones": 500,
            "skill_essence": 1000,
            "exclusive_skin": "aethon_divine_form",
            "exclusive_title": "Celestial Champion",
            "exclusive_frame": "divine_mandate",
        },
        
        "display": {
            "original_price": "$349.99",
            "discount_percent": 71,
            "tag": "INSTANT GUARANTEE",
            "urgency": "Get Aethon NOW + Exclusive Rewards!",
        },
        
        "trigger": {
            "type": "banner_view",
            "show_always": True,  # Always visible for whales
        },
    },
    
    # Emergency "Almost There" pack
    "final_push": {
        "id": "final_push",
        "name": "🔥 Final Push",
        "price_usd": 19.99,
        "limit_per_user": 3,
        "value_multiplier": 4,
        
        "contents": {
            "summon_tickets": 15,
            "crystals": 1000,
        },
        
        "display": {
            "original_price": "$79.99",
            "discount_percent": 75,
            "tag": "SO CLOSE!",
            "urgency": "You're almost there!",
        },
        
        "trigger": {
            "type": "near_pity",
            "pity_progress_min": 60,  # Show when 60+ pulls
            "pity_progress_max": 79,  # But not at 80
        },
    },
}

# ============================================================================
# 4. FREE CURRENCY ALLOCATION (Strategic Shortfall)
# ============================================================================

FREE_LAUNCH_CURRENCY = {
    # Day 1 Achievements + Mail = enough for 20-30 pulls
    "welcome_mail": {
        "crystals": 1000,  # ~3 pulls
        "summon_tickets": 5,
    },
    "tutorial_completion": {
        "crystals": 500,
        "summon_tickets": 3,
    },
    "stage_1_clear": {
        "crystals": 300,
    },
    "stage_2_clear": {
        "crystals": 500,
        "summon_tickets": 5,
    },
    "first_hero_level_10": {
        "crystals": 200,
    },
    "first_team_build": {
        "crystals": 300,
        "summon_tickets": 2,
    },
    "new_player_login_day1": {
        "crystals": 500,
        "summon_tickets": 5,
    },
    
    # TOTAL: ~3300 crystals + 20 tickets = ~31 pulls
    # This is INTENTIONALLY short of the 80-pull guarantee (need 49 more)
    # 49 pulls = 14,700 crystals = ~$49-100 in bundles
}

TOTAL_FREE_PULLS_DAY1 = 31  # Calculated from above
PULLS_SHORT_OF_GUARANTEE = 80 - TOTAL_FREE_PULLS_DAY1  # 49 pulls needed


# ============================================================================
# 5. BANNER FUNCTIONS (SERVER-AUTHORITATIVE)
# ============================================================================

def calculate_launch_banner_rate(pity_counter: int) -> Tuple[float, str]:
    """
    Calculate pull rate with soft/hard pity for launch banner.
    
    Returns: (rate, rate_type)
    - rate: Float 0.0-1.0 for featured hero
    - rate_type: "normal", "soft_pity", or "hard_pity"
    """
    config = LAUNCH_EXCLUSIVE_BANNER["pity"]
    hard_pity = config["hard_pity"]
    soft_pity = config["soft_pity_start"]
    increase_per_pull = config["soft_pity_rate_increase"]
    
    base_rate = LAUNCH_EXCLUSIVE_BANNER["rates"]["featured_UR"] / 100  # 1%
    
    # Hard pity - guaranteed
    if pity_counter >= hard_pity:
        return (1.0, "hard_pity")
    
    # Soft pity - dramatically increasing rate
    if pity_counter >= soft_pity:
        pulls_into_soft = pity_counter - soft_pity
        bonus = increase_per_pull * pulls_into_soft
        rate = min(base_rate + bonus, 1.0)
        return (rate, "soft_pity")
    
    # Normal rate
    return (base_rate, "normal")


def perform_launch_banner_pull(pity_counter: int) -> Dict[str, Any]:
    """
    Perform a single pull on the launch exclusive banner.
    SERVER-AUTHORITATIVE - all RNG happens here.
    
    Returns pull result with hero data and pity info.
    """
    featured_rate, rate_type = calculate_launch_banner_rate(pity_counter)
    roll = random.random()
    
    # Check for featured hero (Aethon)
    if roll < featured_rate:
        return {
            "success": True,
            "is_featured": True,
            "hero": EXCLUSIVE_HERO,
            "rarity": "UR",
            "new_pity": 0,  # Reset
            "rate_type": rate_type,
            "message": "🌟 LEGENDARY! You summoned Aethon, The Celestial Blade! 🌟",
        }
    
    # Roll for other results
    rates = LAUNCH_EXCLUSIVE_BANNER["rates"]
    cumulative = featured_rate
    
    # Other SSR (1%)
    cumulative += rates["other_SSR"] / 100
    if roll < cumulative:
        return {
            "success": True,
            "is_featured": False,
            "rarity": "SSR",
            "new_pity": pity_counter + 1,
            "rate_type": "normal",
        }
    
    # SR (8%)
    cumulative += rates["SR"] / 100
    if roll < cumulative:
        return {
            "success": True,
            "is_featured": False,
            "rarity": "SR",
            "new_pity": pity_counter + 1,
            "rate_type": "normal",
        }
    
    # R (30%)
    cumulative += rates["R"] / 100
    if roll < cumulative:
        return {
            "success": True,
            "is_featured": False,
            "rarity": "R",
            "new_pity": pity_counter + 1,
            "rate_type": "normal",
        }
    
    # N (default)
    return {
        "success": True,
        "is_featured": False,
        "rarity": "N",
        "new_pity": pity_counter + 1,
        "rate_type": "normal",
    }


def get_bundle_triggers(
    pity_counter: int,
    total_pulls: int,
    has_featured: bool,
    purchased_bundles: List[str]
) -> List[Dict[str, Any]]:
    """
    Determine which bundles to show based on player state.
    This is the MONETIZATION ENGINE.
    """
    triggered_bundles = []
    pity_progress = (pity_counter / 80) * 100
    
    for bundle_id, bundle in LAUNCH_BUNDLES.items():
        # Skip if already purchased at limit
        purchased_count = purchased_bundles.count(bundle_id)
        if purchased_count >= bundle.get("limit_per_user", 1):
            continue
        
        trigger = bundle.get("trigger", {})
        should_show = False
        priority = 0
        
        # Check trigger conditions
        if trigger.get("show_always"):
            should_show = True
            priority = 1
        
        elif trigger.get("type") == "post_pull_failure":
            if not has_featured and total_pulls >= trigger.get("min_pulls", 0):
                if "pity_progress_percent" in trigger:
                    if pity_progress >= trigger["pity_progress_percent"]:
                        should_show = True
                        priority = 3
                else:
                    should_show = True
                    priority = 2
        
        elif trigger.get("type") == "near_pity":
            min_prog = trigger.get("pity_progress_min", 0)
            max_prog = trigger.get("pity_progress_max", 100)
            if min_prog <= pity_counter <= max_prog:
                should_show = True
                priority = 4  # Highest priority
        
        if should_show:
            triggered_bundles.append({
                **bundle,
                "priority": priority,
                "pity_progress": round(pity_progress, 1),
                "pulls_to_guarantee": 80 - pity_counter,
            })
    
    # Sort by priority (highest first)
    triggered_bundles.sort(key=lambda x: x["priority"], reverse=True)
    
    return triggered_bundles


def check_banner_unlock(user_progress: Dict) -> Dict[str, Any]:
    """
    Check if user has unlocked the launch banner.
    Unlocks after clearing Stage 2-10.
    """
    completed_stages = user_progress.get("completed_stages", [])
    unlock_stage = "2-10"
    
    is_unlocked = unlock_stage in completed_stages
    
    return {
        "is_unlocked": is_unlocked,
        "unlock_requirement": f"Clear Stage {unlock_stage}",
        "current_progress": len(completed_stages),
    }


def get_banner_time_remaining(user_first_unlock: datetime) -> Dict[str, Any]:
    """
    Calculate remaining time for this user's banner.
    Each user gets their own 72-hour window.
    """
    duration = timedelta(hours=LAUNCH_EXCLUSIVE_BANNER["duration_hours"])
    end_time = user_first_unlock + duration
    now = datetime.utcnow()
    
    if now >= end_time:
        return {
            "is_active": False,
            "expired": True,
            "hours_remaining": 0,
            "minutes_remaining": 0,
        }
    
    remaining = end_time - now
    hours = int(remaining.total_seconds() // 3600)
    minutes = int((remaining.total_seconds() % 3600) // 60)
    
    return {
        "is_active": True,
        "expired": False,
        "hours_remaining": hours,
        "minutes_remaining": minutes,
        "urgency_level": "critical" if hours < 12 else "high" if hours < 24 else "normal",
        "end_time": end_time.isoformat(),
    }


def calculate_pulls_from_bundle(bundle_id: str) -> int:
    """Calculate how many pulls a bundle provides."""
    bundle = LAUNCH_BUNDLES.get(bundle_id)
    if not bundle:
        return 0
    
    contents = bundle.get("contents", {})
    tickets = contents.get("summon_tickets", 0)
    crystals = contents.get("crystals", 0)
    
    # Convert crystals to pulls (300 per pull)
    crystal_pulls = crystals // 300
    
    return tickets + crystal_pulls


def get_monetization_summary(pity_counter: int) -> Dict[str, Any]:
    """
    Provide clear "calculable purchase" information.
    This transforms spending from gambling to calculated investment.
    """
    pulls_needed = 80 - pity_counter
    crystals_needed = pulls_needed * 300
    
    # Calculate cheapest bundle path
    bundle_options = []
    
    if pulls_needed <= 15:
        bundle_options.append({
            "bundles": ["final_push"],
            "total_cost": 19.99,
            "pulls_provided": 15 + 3,  # tickets + crystals
        })
    
    if pulls_needed <= 40:
        bundle_options.append({
            "bundles": ["ascension_bundle"],
            "total_cost": 49.99,
            "pulls_provided": 40 + 6,
        })
    
    bundle_options.append({
        "bundles": ["celestial_path"],
        "total_cost": 99.99,
        "pulls_provided": 80 + 16,
        "bonus": "Includes exclusive skin, title, and frame!",
    })
    
    return {
        "current_pity": pity_counter,
        "pulls_to_guarantee": pulls_needed,
        "crystals_needed": crystals_needed,
        "progress_percent": round((pity_counter / 80) * 100, 1),
        "recommended_bundles": bundle_options,
        "message": f"You are {pulls_needed} pulls away from a GUARANTEED Aethon!",
    }


# ============================================================================
# 6. ANALYTICS & TRACKING
# ============================================================================

def track_banner_interaction(
    user_id: str,
    action: str,
    details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Track user interactions for analytics.
    Used to optimize conversion rates.
    """
    return {
        "user_id": user_id,
        "action": action,
        "timestamp": datetime.utcnow().isoformat(),
        "banner_id": LAUNCH_EXCLUSIVE_BANNER["id"],
        "details": details,
    }


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "EXCLUSIVE_HERO",
    "LAUNCH_EXCLUSIVE_BANNER", 
    "LAUNCH_BUNDLES",
    "FREE_LAUNCH_CURRENCY",
    "TOTAL_FREE_PULLS_DAY1",
    "PULLS_SHORT_OF_GUARANTEE",
    "calculate_launch_banner_rate",
    "perform_launch_banner_pull",
    "get_bundle_triggers",
    "check_banner_unlock",
    "get_banner_time_remaining",
    "calculate_pulls_from_bundle",
    "get_monetization_summary",
    "track_banner_interaction",
]
