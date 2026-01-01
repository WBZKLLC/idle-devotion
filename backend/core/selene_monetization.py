"""
CHRONO-ARCHANGEL SELENE MONETIZATION SYSTEM
============================================

Implements the complete monetization & onboarding system as specified:
1. PlayerJourneyEvent - Banner unlock at Stage 2-10
2. GachaBanner - 7-day limited banner with soft/hard pity
3. DynamicBundles - Context-sensitive purchase triggers
4. Character Power - Overpowered limited character

PSYCHOLOGICAL FRAMEWORK:
- Hook: Introduce Selene at Stage 1-5 as overpowered ally
- Trigger: Auto-unlock banner after Stage 2-10
- Scarcity: Initial resources fall short of guarantee
- Monetization: Tiered bundles based on pity progress

All calculations SERVER-AUTHORITATIVE.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import random
import uuid
import math

# ============================================================================
# 1. CHARACTER SPECIFICATION: CHRONO-ARCHANGEL SELENE
# ============================================================================

CHAR_SELENE_SSR = {
    "id": "char_selene_ssr",
    "name": "Chrono-Archangel Selene",
    "rarity": "SSR",
    "element": "Time",
    "hero_class": "Archangel",
    "role": "MAIN_DPS",
    "exclusive": True,
    "availability_flag": "LIMITED",
    "add_to_standard_pool_after_days": 180,  # 6-month exclusivity
    
    # OVERPOWERED Stats - Designed to trivialize content
    "base_hp": 14500,
    "base_atk": 520,      # 450% skill multiplier vs standard 320%
    "base_def": 310,
    "speed": 135,         # Fastest in game
    "crit_rate": 28,
    "crit_damage": 0.95,
    
    # Dominant skill set
    "skills": [
        {
            "id": "temporal_severance",
            "name": "Temporal Severance",
            "type": "active",
            "description": "Cleave through time itself, dealing 450% ATK to all enemies and reducing their action gauge by 30%.",
            "damage_multiplier": 4.5,  # 450% vs standard 320%
            "aoe": True,
            "cooldown": 3,
            "action_gauge_reduction": 0.30,
        },
        {
            "id": "time_lock",
            "name": "Time Lock",
            "type": "passive",
            "description": "30% chance to freeze an enemy's action gauge for 3 seconds on any attack.",
            "proc_chance": 0.30,
            "freeze_duration": 3.0,
            "trigger": "on_attack",
        },
        {
            "id": "chrono_ascension",
            "name": "Chrono Ascension",
            "type": "ultimate",
            "description": "Ascend beyond time. Deal 680% ATK to single target and gain 100% action gauge.",
            "damage_multiplier": 6.8,
            "self_action_gauge_boost": 1.0,
            "cooldown": 5,
        },
        {
            "id": "temporal_aura",
            "name": "Temporal Aura",
            "type": "passive",
            "description": "Allies gain 15% speed and 10% crit rate when Selene is on the field.",
            "team_speed_boost": 0.15,
            "team_crit_boost": 0.10,
        },
    ],
    
    # Marketing data
    "marketing": {
        "tagline": "The timelines converge. Selene's power is briefly attainable.",
        "unlock_dialogue": "The timelines converge. Selene's power is briefly attainable. This chance will not return.",
        "story_appearance_stage": "1-5",
        "preview_power_level": "GODLIKE",  # One-shots the boss
    },
    
    # Visual/audio
    "image_url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
    "banner_art": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800",
    "theme_music": "epic_chrono_theme",
}

# ============================================================================
# 2. BANNER SPECIFICATION: FATED CHRONOLOGY
# ============================================================================

BANNER_LIMITED_SELENE = {
    "banner_id": "banner_limited_selene",
    "name": "Fated Chronology",
    "subtitle": "LIMITED - 7 DAYS ONLY",
    "duration_hours": 168,  # 7 days from player unlock
    
    # Rates
    "base_SSR_rate": 0.02,        # 2.0%
    "featured_character": "char_selene_ssr",
    "featured_rate_share": 0.50,  # 50% of SSR pulls = Selene (1.0% total)
    
    # Pity system
    "pity_type": "HARD",
    "pity_counter_max": 80,
    "pity_guarantee_target": "char_selene_ssr",  # Guarantees featured
    "soft_pity_start": 50,
    "soft_pity_rate_increase": 0.015,  # +1.5% per pull after 50
    
    # Other rates
    "SR_rate": 0.08,              # 8% SR
    "R_rate": 0.90,               # 90% R (filler)
    
    # Pull costs
    "single_pull_cost": 300,      # Premium currency
    "multi_pull_cost": 2700,      # 10% discount for 10x
    "scroll_single": 1,           # Summon scrolls
    "scroll_multi": 10,
}

# ============================================================================
# 3. INITIAL RESOURCE GRANT (SCARCITY DESIGN)
# ============================================================================

INITIAL_PLAYER_RESOURCES = {
    "premium_currency": 1500,
    "summon_scrolls": 10,
    # Total pull capacity: ~20 pulls
    # Deliberately SHORT of 80-pity guarantee
    # Creates gap of ~60 pulls = monetization opportunity
}

# Calculated resource gaps
def calculate_pulls_from_resources(premium_currency: int, scrolls: int) -> int:
    """Calculate total pulls possible from resources"""
    pulls_from_currency = premium_currency // BANNER_LIMITED_SELENE["single_pull_cost"]
    pulls_from_scrolls = scrolls
    return pulls_from_currency + pulls_from_scrolls

def calculate_gap_to_guarantee(current_pulls: int, pity_counter: int) -> Dict[str, Any]:
    """Calculate how many more pulls/$ needed to guarantee"""
    pulls_to_guarantee = BANNER_LIMITED_SELENE["pity_counter_max"] - pity_counter
    currency_needed = pulls_to_guarantee * BANNER_LIMITED_SELENE["single_pull_cost"]
    
    # Rough USD conversion (assumes $0.99 = 100 premium currency)
    usd_equivalent = (currency_needed / 100) * 0.99
    
    return {
        "pulls_remaining": pulls_to_guarantee,
        "currency_needed": currency_needed,
        "usd_equivalent": round(usd_equivalent, 2),
        "current_pity": pity_counter,
        "guarantee_at": BANNER_LIMITED_SELENE["pity_counter_max"],
    }

# ============================================================================
# 4. DYNAMIC BUNDLE SYSTEM
# ============================================================================

DYNAMIC_BUNDLES = {
    # Bundle 1: Low Barrier Entry ($4.99)
    "offer_starter_summon": {
        "bundle_id": "offer_starter_summon",
        "name": "⚡ Starter Summon Pack",
        "price_usd": 4.99,
        "contents": {
            "summon_scrolls": 10,
            "premium_currency": 500,
        },
        "value_ratio": 5.2,  # 5.2x value vs standard
        "trigger_condition": "performed_pull",  # Any pull on banner
        "trigger_pity_min": 1,
        "trigger_pity_max": 39,
        "marketing_text": "Begin your journey to Selene! Limited offer for new summoners.",
        "limit_per_user": 3,
        "urgency_text": "67% of players purchase this pack!",
    },
    
    # Bundle 2: Mid-Spender Solution ($49.99)
    "offer_ascension_path": {
        "bundle_id": "offer_ascension_path",
        "name": "🌟 Ascension Path Bundle",
        "price_usd": 49.99,
        "contents": {
            "summon_scrolls": 40,
            "premium_currency": 1000,
            "gold": 500000,
        },
        "value_ratio": 4.8,
        "trigger_condition": "pity_range",
        "trigger_pity_min": 40,
        "trigger_pity_max": 60,
        "marketing_text": "Guarantee your victory! Reach your fateful summon.",
        "limit_per_user": 1,
        "urgency_text": "You're halfway to guaranteed Selene!",
    },
    
    # Bundle 3: Whale Option ($99.99)
    "offer_complete_guarantee": {
        "bundle_id": "offer_complete_guarantee",
        "name": "👑 Complete Guarantee Pack",
        "price_usd": 99.99,
        "contents": {
            "summon_scrolls": 80,
            "premium_currency": 3000,
            "exclusive_avatar_frame": "frame_chrono_guardian",
            "gold": 1000000,
            "enhancement_stones": 500,
        },
        "value_ratio": 4.2,
        "trigger_condition": "pity_high",
        "trigger_pity_min": 70,
        "trigger_pity_max": 80,
        "marketing_text": "Secure Chrono-Archangel Selene NOW. Don't let your progress go to waste!",
        "limit_per_user": 1,
        "urgency_text": "Only 10 pulls away! Complete your destiny.",
    },
    
    # Bundle 4: Post-Pull Consolation ($19.99)
    "offer_last_chance": {
        "bundle_id": "offer_last_chance",
        "name": "🔥 Last Chance Bundle",
        "price_usd": 19.99,
        "contents": {
            "summon_scrolls": 20,
            "premium_currency": 800,
        },
        "value_ratio": 4.5,
        "trigger_condition": "pity_range",
        "trigger_pity_min": 60,
        "trigger_pity_max": 70,
        "marketing_text": "So close! Don't miss your destiny.",
        "limit_per_user": 2,
        "urgency_text": "Selene awaits - finish strong!",
    },
}

# ============================================================================
# 5. PLAYER JOURNEY EVENT
# ============================================================================

PLAYER_JOURNEY_EVENT = {
    "event_name": "First_Limited_Banner_Unlock",
    "trigger_type": "PROGRESSION_MILESTONE",
    "trigger_value": "Campaign_Stage_2-10_Victory",
    "execution_priority": "HIGH",
    
    "actions_on_trigger": [
        {"type": "UI.ShowPopup", "content": "full_screen_banner_art"},
        {"type": "Audio.Play", "track": "epic_chrono_theme"},
        {"type": "Narrative.Play", "dialogue": CHAR_SELENE_SSR["marketing"]["unlock_dialogue"]},
        {"type": "System.Unlock", "feature": "banner_limited_selene"},
    ],
    
    # Story hook at Stage 1-5
    "story_hook": {
        "stage": "1-5",
        "event_type": "TEMPORARY_ALLY",
        "ally_character": "char_selene_ssr",
        "ally_power_multiplier": 10.0,  # One-shots everything
        "dialogue_before": "A rift in time tears open. A figure of radiant power steps through...",
        "dialogue_after": "Selene vanishes as quickly as she appeared. 'We will meet again... if fate allows.'",
    },
}

# ============================================================================
# 6. CORE GACHA MECHANICS
# ============================================================================

def calculate_selene_banner_rate(pity_counter: int) -> Tuple[float, str]:
    """
    Calculate current SSR/Selene rate based on pity counter.
    
    Returns:
        Tuple of (featured_rate, rate_type)
    """
    base_ssr_rate = BANNER_LIMITED_SELENE["base_SSR_rate"]
    featured_share = BANNER_LIMITED_SELENE["featured_rate_share"]
    soft_pity_start = BANNER_LIMITED_SELENE["soft_pity_start"]
    soft_pity_increase = BANNER_LIMITED_SELENE["soft_pity_rate_increase"]
    hard_pity = BANNER_LIMITED_SELENE["pity_counter_max"]
    
    if pity_counter >= hard_pity:
        # Hard pity - 100% Selene
        return 1.0, "HARD_PITY"
    elif pity_counter >= soft_pity_start:
        # Soft pity - increasing rate
        pulls_into_soft = pity_counter - soft_pity_start
        bonus_rate = pulls_into_soft * soft_pity_increase
        current_ssr_rate = min(base_ssr_rate + bonus_rate, 1.0)
        featured_rate = current_ssr_rate * featured_share
        return featured_rate, "SOFT_PITY"
    else:
        # Normal rate
        return base_ssr_rate * featured_share, "NORMAL"

def perform_selene_banner_pull(pity_counter: int, has_selene: bool = False) -> Dict[str, Any]:
    """
    Perform a single pull on the Selene banner.
    
    Server-authoritative gacha with soft/hard pity.
    """
    featured_rate, rate_type = calculate_selene_banner_rate(pity_counter)
    hard_pity = BANNER_LIMITED_SELENE["pity_counter_max"]
    
    roll = random.random()
    new_pity = pity_counter + 1
    
    # Hard pity check
    if new_pity >= hard_pity:
        return {
            "rarity": "SSR",
            "is_featured": True,
            "character": CHAR_SELENE_SSR,
            "new_pity": 0,  # Reset
            "rate_type": "HARD_PITY",
            "message": "🌟 GUARANTEED! Chrono-Archangel Selene descends!",
        }
    
    # Featured character check (with soft pity boost)
    if roll < featured_rate:
        return {
            "rarity": "SSR",
            "is_featured": True,
            "character": CHAR_SELENE_SSR,
            "new_pity": 0,  # Reset on featured
            "rate_type": rate_type,
            "message": "✨ LEGENDARY! You summoned Chrono-Archangel Selene!",
        }
    
    # Other SSR check
    base_ssr = BANNER_LIMITED_SELENE["base_SSR_rate"]
    other_ssr_rate = base_ssr * (1 - BANNER_LIMITED_SELENE["featured_rate_share"])
    if roll < featured_rate + other_ssr_rate:
        return {
            "rarity": "SSR",
            "is_featured": False,
            "character": None,  # Random SSR from pool
            "new_pity": new_pity,  # Don't reset for non-featured
            "rate_type": "NORMAL",
            "message": "⭐ SSR Hero obtained! (Not featured)",
        }
    
    # SR check
    sr_threshold = featured_rate + other_ssr_rate + BANNER_LIMITED_SELENE["SR_rate"]
    if roll < sr_threshold:
        return {
            "rarity": "SR",
            "is_featured": False,
            "character": None,
            "new_pity": new_pity,
            "rate_type": "NORMAL",
            "message": "SR Hero obtained",
        }
    
    # R (common) result
    return {
        "rarity": "R",
        "is_featured": False,
        "character": None,
        "new_pity": new_pity,
        "rate_type": "NORMAL",
        "message": "R Hero obtained",
    }

# ============================================================================
# 7. DYNAMIC BUNDLE TRIGGER LOGIC
# ============================================================================

def get_triggered_bundles(
    pity_counter: int,
    total_pulls: int,
    has_selene: bool,
    purchased_bundles: List[str]
) -> List[Dict[str, Any]]:
    """
    Evaluate and return bundles to offer based on player state.
    
    Trigger conditions:
    - performed_pull: Any pull performed
    - pity_range: Pity counter in specific range
    - pity_high: Approaching guarantee
    """
    if has_selene:
        return []  # No bundles if already owns Selene
    
    triggered = []
    
    for bundle_id, bundle in DYNAMIC_BUNDLES.items():
        # Check purchase limit
        purchase_count = purchased_bundles.count(bundle_id)
        if purchase_count >= bundle["limit_per_user"]:
            continue
        
        # Check trigger condition
        trigger = bundle["trigger_condition"]
        min_pity = bundle["trigger_pity_min"]
        max_pity = bundle["trigger_pity_max"]
        
        if trigger == "performed_pull" and total_pulls >= 1:
            if min_pity <= pity_counter <= max_pity:
                triggered.append({**bundle, "relevance_score": 100 - pity_counter})
        elif trigger == "pity_range":
            if min_pity <= pity_counter <= max_pity:
                triggered.append({**bundle, "relevance_score": pity_counter})
        elif trigger == "pity_high":
            if min_pity <= pity_counter <= max_pity:
                triggered.append({**bundle, "relevance_score": pity_counter + 100})
    
    # Sort by relevance (highest first)
    triggered.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    
    return triggered[:3]  # Return top 3 most relevant

# ============================================================================
# 8. BANNER TIME MANAGEMENT
# ============================================================================

def get_selene_banner_time_remaining(unlock_time: datetime) -> Dict[str, Any]:
    """Calculate time remaining on player's Selene banner"""
    duration = timedelta(hours=BANNER_LIMITED_SELENE["duration_hours"])
    expiry_time = unlock_time + duration
    now = datetime.utcnow()
    
    if now >= expiry_time:
        return {
            "is_active": False,
            "expired": True,
            "hours_remaining": 0,
            "minutes_remaining": 0,
            "urgency_level": "EXPIRED",
        }
    
    remaining = expiry_time - now
    hours = remaining.total_seconds() / 3600
    minutes = (remaining.total_seconds() % 3600) / 60
    
    # Urgency levels for UI
    if hours <= 6:
        urgency = "CRITICAL"
    elif hours <= 24:
        urgency = "HIGH"
    elif hours <= 72:
        urgency = "MEDIUM"
    else:
        urgency = "NORMAL"
    
    return {
        "is_active": True,
        "expired": False,
        "hours_remaining": int(hours),
        "minutes_remaining": int(minutes),
        "seconds_remaining": int(remaining.total_seconds()),
        "urgency_level": urgency,
        "expiry_timestamp": expiry_time.isoformat(),
    }

# ============================================================================
# 9. MONETIZATION ANALYTICS
# ============================================================================

def calculate_monetization_metrics(
    pity_counter: int,
    total_pulls: int,
    has_selene: bool,
    total_spent_usd: float = 0
) -> Dict[str, Any]:
    """
    Calculate monetization metrics for analytics/display.
    
    Target metrics:
    - ≥15% conversion rate at Stage 2-10
    - ARPPU ≥$35 for this event
    """
    if has_selene:
        return {
            "status": "CONVERTED",
            "message": "Chrono-Archangel Selene is yours!",
            "total_spent": total_spent_usd,
        }
    
    gap = calculate_gap_to_guarantee(total_pulls, pity_counter)
    
    # Recommend bundle based on gap
    if gap["pulls_remaining"] <= 10:
        recommended_bundle = "offer_complete_guarantee"
        message = f"Only {gap['pulls_remaining']} pulls away! Secure Selene now."
    elif gap["pulls_remaining"] <= 30:
        recommended_bundle = "offer_ascension_path"
        message = f"The path to Selene is clear. {gap['pulls_remaining']} pulls remain."
    elif gap["pulls_remaining"] <= 60:
        recommended_bundle = "offer_last_chance"
        message = f"Continue your journey. {gap['pulls_remaining']} pulls to guaranteed Selene."
    else:
        recommended_bundle = "offer_starter_summon"
        message = f"Begin your ascension. Every pull counts toward Selene."
    
    return {
        "status": "IN_PROGRESS",
        "pity_progress": f"{pity_counter}/{BANNER_LIMITED_SELENE['pity_counter_max']}",
        "pulls_to_guarantee": gap["pulls_remaining"],
        "estimated_usd": gap["usd_equivalent"],
        "recommended_bundle": recommended_bundle,
        "message": message,
        "soft_pity_active": pity_counter >= BANNER_LIMITED_SELENE["soft_pity_start"],
        "current_rate": calculate_selene_banner_rate(pity_counter)[0] * 100,
    }

# ============================================================================
# 10. SIMULATION & TESTING
# ============================================================================

def simulate_player_journey(num_players: int = 10000) -> Dict[str, Any]:
    """
    Simulate player journeys to validate monetization targets.
    
    Targets:
    - ≥15% purchase initiation at Stage 2-10
    - ARPPU ≥$35
    """
    results = {
        "total_players": num_players,
        "reached_stage_2_10": 0,
        "initiated_purchase": 0,
        "total_revenue": 0,
        "paying_users": 0,
    }
    
    for _ in range(num_players):
        # Assume 80% reach stage 2-10
        if random.random() < 0.80:
            results["reached_stage_2_10"] += 1
            
            # Initial resources
            pulls_available = calculate_pulls_from_resources(
                INITIAL_PLAYER_RESOURCES["premium_currency"],
                INITIAL_PLAYER_RESOURCES["summon_scrolls"]
            )
            
            pity = 0
            has_selene = False
            spent = 0
            
            # Simulate pulls with initial resources
            for _ in range(pulls_available):
                result = perform_selene_banner_pull(pity, has_selene)
                pity = result["new_pity"]
                if result["is_featured"]:
                    has_selene = True
                    break
            
            # Decision to purchase based on sunk cost / progress
            if not has_selene and pity >= 20:
                # Higher pity = higher conversion chance
                purchase_chance = 0.10 + (pity / 80) * 0.20  # 10-30% based on progress
                
                if random.random() < purchase_chance:
                    results["initiated_purchase"] += 1
                    results["paying_users"] += 1
                    
                    # Simulate bundle purchase
                    if pity >= 70:
                        spent = 99.99
                    elif pity >= 40:
                        spent = 49.99
                    elif pity >= 20:
                        spent = random.choice([4.99, 19.99, 49.99])
                    else:
                        spent = 4.99
                    
                    results["total_revenue"] += spent
    
    # Calculate metrics
    conversion_rate = (results["initiated_purchase"] / results["reached_stage_2_10"]) * 100 if results["reached_stage_2_10"] > 0 else 0
    arppu = results["total_revenue"] / results["paying_users"] if results["paying_users"] > 0 else 0
    
    return {
        **results,
        "conversion_rate_percent": round(conversion_rate, 2),
        "arppu": round(arppu, 2),
        "targets_met": {
            "conversion_15_percent": conversion_rate >= 15,
            "arppu_35_usd": arppu >= 35,
        },
    }

# ============================================================================
# 11. DATABASE SCHEMA REQUIREMENTS
# ============================================================================

PLAYER_GACHA_LOG_SCHEMA = {
    "collection": "player_gacha_log",
    "fields": {
        "id": "UUID PRIMARY KEY",
        "user_id": "UUID FOREIGN KEY -> users.id",
        "banner_id": "STRING NOT NULL",
        "pity_counter": "INTEGER NOT NULL",
        "pull_result": "STRING NOT NULL",  # SSR, SR, R
        "is_featured": "BOOLEAN",
        "character_id": "STRING",
        "timestamp": "DATETIME NOT NULL",
    },
    "indexes": [
        "CREATE INDEX idx_user_banner ON player_gacha_log(user_id, banner_id)",
        "CREATE INDEX idx_timestamp ON player_gacha_log(timestamp)",
    ],
}

SELENE_BANNER_PROGRESS_SCHEMA = {
    "collection": "selene_banner_progress",
    "fields": {
        "user_id": "UUID PRIMARY KEY",
        "pity_counter": "INTEGER DEFAULT 0",
        "total_pulls": "INTEGER DEFAULT 0",
        "has_selene": "BOOLEAN DEFAULT FALSE",
        "unlock_timestamp": "DATETIME",
        "purchased_bundles": "ARRAY[STRING]",
        "total_spent_usd": "DECIMAL DEFAULT 0",
    },
}

# Export all components
__all__ = [
    "CHAR_SELENE_SSR",
    "BANNER_LIMITED_SELENE",
    "INITIAL_PLAYER_RESOURCES",
    "DYNAMIC_BUNDLES",
    "PLAYER_JOURNEY_EVENT",
    "calculate_selene_banner_rate",
    "perform_selene_banner_pull",
    "get_triggered_bundles",
    "get_selene_banner_time_remaining",
    "calculate_monetization_metrics",
    "calculate_gap_to_guarantee",
    "simulate_player_journey",
]
