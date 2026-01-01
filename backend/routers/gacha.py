"""
Gacha Service Router - Summoning System Microservice
Handles all gacha pulls, pity systems, and banner management

This is a CRITICAL service for:
1. Revenue generation
2. Player retention (pity system)
3. Fair RNG (server-side randomization)

Designed for horizontal scaling with stateless operations
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import random
import hashlib

# Import infrastructure
from core.infrastructure import (
    game_cache, event_queue, rate_limiter,
    rate_limited, invalidate_user_cache
)

router = APIRouter(prefix="/gacha", tags=["gacha"])

# Database reference will be injected
db = None

def set_database(database):
    """Set the database reference - called from main server"""
    global db
    db = database

# =============================================================================
# GACHA CONSTANTS
# =============================================================================

# Standard Banner Rates (Coin pulls)
RATES_STANDARD = {
    "SR": 0.908,
    "SSR": 0.080,
    "SSR+": 0.012
}

# Premium Banner Rates (Crystal pulls)
RATES_PREMIUM = {
    "SR": 0.85,
    "SSR": 0.12,
    "SSR+": 0.02,
    "UR": 0.01
}

# Divine Banner Rates (Divine Essence pulls)
RATES_DIVINE = {
    "UR": 0.027,
    "UR+": 0.008,
    "crystal_8k": 0.005,
    "crystal_5k": 0.010,
    "crystal_3k": 0.020,
    "filler": 0.930  # Divine essence, gold, coins, shards
}

# Pity thresholds
PITY_STANDARD = 50   # Guaranteed SSR+
PITY_PREMIUM = 50    # Guaranteed UR
PITY_DIVINE = 40     # Guaranteed UR+

# Pull costs
COST_STANDARD_SINGLE = 1000     # coins
COST_STANDARD_MULTI = 9000      # coins (10x)
COST_PREMIUM_SINGLE = 300       # crystals
COST_PREMIUM_MULTI = 2700       # crystals (10x)
COST_DIVINE_SINGLE = 1          # divine essence
COST_DIVINE_MULTI = 10          # divine essence (10x)

# =============================================================================
# GACHA PULL ENDPOINTS
# =============================================================================

@router.post("/pull/standard/{username}")
@rate_limited(cost=3)
async def pull_standard(username: str, multi: bool = False):
    """Standard banner pull (coins)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pull_count = 10 if multi else 1
    cost = COST_STANDARD_MULTI if multi else COST_STANDARD_SINGLE
    
    if user.get("coins", 0) < cost:
        raise HTTPException(status_code=400, detail="Insufficient coins")
    
    # Perform pulls
    results, pity_used = await _perform_pulls(
        user, "standard", pull_count, RATES_STANDARD, PITY_STANDARD
    )
    
    # Deduct currency and update pity
    await db.users.update_one(
        {"username": username},
        {
            "$inc": {"coins": -cost, "total_pulls": pull_count},
            "$set": {"pity_counter": user.get("pity_counter", 0) + pull_count - (pull_count if pity_used else 0)}
        }
    )
    
    # Add heroes to user collection
    await _add_heroes_to_collection(user["id"], results)
    
    # Publish event
    await event_queue.publish("GACHA_PULL", {
        "username": username,
        "banner": "standard",
        "pull_count": pull_count,
        "cost": cost,
        "results": [{"name": h["name"], "rarity": h["rarity"]} for h in results]
    })
    
    # Invalidate user cache
    await invalidate_user_cache(username)
    
    return {
        "success": True,
        "banner": "standard",
        "pull_count": pull_count,
        "cost": cost,
        "currency": "coins",
        "results": results,
        "pity_triggered": pity_used,
        "new_pity": user.get("pity_counter", 0) + pull_count if not pity_used else 0
    }

@router.post("/pull/premium/{username}")
@rate_limited(cost=5)
async def pull_premium(username: str, multi: bool = False):
    """Premium banner pull (crystals)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pull_count = 10 if multi else 1
    cost = COST_PREMIUM_MULTI if multi else COST_PREMIUM_SINGLE
    
    if user.get("gems", 0) < cost:
        raise HTTPException(status_code=400, detail="Insufficient crystals")
    
    # Perform pulls
    results, pity_used = await _perform_pulls(
        user, "premium", pull_count, RATES_PREMIUM, PITY_PREMIUM
    )
    
    # Deduct currency
    await db.users.update_one(
        {"username": username},
        {
            "$inc": {"gems": -cost, "total_pulls": pull_count},
            "$set": {"pity_counter_premium": user.get("pity_counter_premium", 0) + pull_count if not pity_used else 0}
        }
    )
    
    # Add heroes to collection
    await _add_heroes_to_collection(user["id"], results)
    
    # Publish event
    await event_queue.publish("GACHA_PULL", {
        "username": username,
        "banner": "premium",
        "pull_count": pull_count,
        "cost": cost,
        "results": [{"name": h["name"], "rarity": h["rarity"]} for h in results]
    })
    
    await invalidate_user_cache(username)
    
    return {
        "success": True,
        "banner": "premium",
        "pull_count": pull_count,
        "cost": cost,
        "currency": "crystals",
        "results": results,
        "pity_triggered": pity_used
    }

@router.post("/pull/divine/{username}")
@rate_limited(cost=10)
async def pull_divine(username: str, multi: bool = False):
    """Divine banner pull (divine essence) - includes filler rewards"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pull_count = 10 if multi else 1
    cost = COST_DIVINE_MULTI if multi else COST_DIVINE_SINGLE
    
    if user.get("divine_essence", 0) < cost:
        raise HTTPException(status_code=400, detail="Insufficient divine essence")
    
    # Perform divine pulls (can return heroes or filler)
    results, filler_rewards = await _perform_divine_pulls(user, pull_count)
    
    # Deduct divine essence
    update_ops = {"divine_essence": -cost, "total_pulls": pull_count}
    
    # Add filler rewards
    for reward_type, amount in filler_rewards.items():
        if reward_type in ["crystals", "gems"]:
            update_ops["gems"] = update_ops.get("gems", 0) + amount
        elif reward_type in ["gold", "coins", "hero_shards", "divine_essence"]:
            update_ops[reward_type] = update_ops.get(reward_type, 0) + amount
    
    await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Add heroes to collection (only actual heroes, not filler)
    heroes_only = [r for r in results if not r.get("is_filler")]
    if heroes_only:
        await _add_heroes_to_collection(user["id"], heroes_only)
    
    await invalidate_user_cache(username)
    
    return {
        "success": True,
        "banner": "divine",
        "pull_count": pull_count,
        "cost": cost,
        "currency": "divine_essence",
        "results": results,
        "filler_rewards_collected": filler_rewards
    }

# =============================================================================
# BANNER INFO ENDPOINTS
# =============================================================================

@router.get("/banners")
async def get_available_banners():
    """Get all available banners"""
    return {
        "banners": [
            {
                "id": "standard",
                "name": "Coin Summon",
                "description": "Standard pool with SSR+ heroes",
                "currency": "coins",
                "cost_single": COST_STANDARD_SINGLE,
                "cost_multi": COST_STANDARD_MULTI,
                "rates": RATES_STANDARD,
                "pity": PITY_STANDARD,
                "guaranteed": "SSR+"
            },
            {
                "id": "premium",
                "name": "Crystal Summon",
                "description": "Premium pool with UR heroes",
                "currency": "crystals",
                "cost_single": COST_PREMIUM_SINGLE,
                "cost_multi": COST_PREMIUM_MULTI,
                "rates": RATES_PREMIUM,
                "pity": PITY_PREMIUM,
                "guaranteed": "UR"
            },
            {
                "id": "divine",
                "name": "Divine Summon",
                "description": "Ultimate pool with UR+ heroes and filler rewards",
                "currency": "divine_essence",
                "cost_single": COST_DIVINE_SINGLE,
                "cost_multi": COST_DIVINE_MULTI,
                "rates": RATES_DIVINE,
                "pity": PITY_DIVINE,
                "guaranteed": "UR+"
            }
        ]
    }

@router.get("/pity/{username}")
async def get_pity_status(username: str):
    """Get player's pity counters"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "standard": {
            "current": user.get("pity_counter", 0),
            "threshold": PITY_STANDARD,
            "guaranteed": "SSR+"
        },
        "premium": {
            "current": user.get("pity_counter_premium", 0),
            "threshold": PITY_PREMIUM,
            "guaranteed": "UR"
        },
        "divine": {
            "current": user.get("pity_counter_divine", 0),
            "threshold": PITY_DIVINE,
            "guaranteed": "UR+"
        }
    }

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _perform_pulls(user: Dict, banner: str, count: int, rates: Dict, pity_threshold: int) -> Tuple[List, bool]:
    """Perform gacha pulls with pity system"""
    pity_field = f"pity_counter{'_' + banner if banner != 'standard' else ''}"
    current_pity = user.get(pity_field, 0)
    
    results = []
    pity_used = False
    
    for i in range(count):
        # Check pity
        if current_pity + i + 1 >= pity_threshold:
            # Pity triggered - get highest rarity
            highest_rarity = max(rates.keys(), key=lambda r: _rarity_rank(r))
            hero = await _get_random_hero(highest_rarity)
            results.append(hero)
            pity_used = True
            current_pity = 0
        else:
            # Normal pull
            rarity = _roll_rarity(rates)
            hero = await _get_random_hero(rarity)
            results.append(hero)
    
    return results, pity_used

async def _perform_divine_pulls(user: Dict, count: int) -> Tuple[List, Dict]:
    """Perform divine pulls with filler rewards"""
    current_pity = user.get("pity_counter_divine", 0)
    
    results = []
    filler_rewards = {
        "crystals": 0,
        "gold": 0,
        "coins": 0,
        "hero_shards": 0,
        "divine_essence": 0
    }
    
    for i in range(count):
        # Check pity
        if current_pity + i + 1 >= PITY_DIVINE:
            hero = await _get_random_hero("UR+")
            results.append(hero)
            current_pity = 0
            continue
        
        # Roll for reward type
        roll = random.random()
        cumulative = 0
        
        for reward_type, rate in RATES_DIVINE.items():
            cumulative += rate
            if roll <= cumulative:
                if reward_type in ["UR+", "UR"]:
                    hero = await _get_random_hero(reward_type)
                    results.append(hero)
                elif reward_type == "crystal_8k":
                    filler_rewards["crystals"] += 8000
                    results.append({"name": "8,000 Crystals", "rarity": "jackpot", "is_filler": True, "display": "💎 8K Crystals"})
                elif reward_type == "crystal_5k":
                    filler_rewards["crystals"] += 5000
                    results.append({"name": "5,000 Crystals", "rarity": "rare", "is_filler": True, "display": "💎 5K Crystals"})
                elif reward_type == "crystal_3k":
                    filler_rewards["crystals"] += 3000
                    results.append({"name": "3,000 Crystals", "rarity": "common", "is_filler": True, "display": "💎 3K Crystals"})
                else:
                    # Filler reward
                    filler = _generate_filler_reward()
                    filler_rewards[filler["type"]] += filler["amount"]
                    results.append({
                        "name": filler["name"],
                        "rarity": "filler",
                        "is_filler": True,
                        "display": filler["display"]
                    })
                break
    
    return results, filler_rewards

def _roll_rarity(rates: Dict) -> str:
    """Roll for a rarity based on rates"""
    roll = random.random()
    cumulative = 0
    
    for rarity, rate in rates.items():
        cumulative += rate
        if roll <= cumulative:
            return rarity
    
    return list(rates.keys())[0]  # Fallback to first rarity

def _rarity_rank(rarity: str) -> int:
    """Get numeric rank for rarity comparison"""
    ranks = {"N": 0, "R": 1, "SR": 2, "SSR": 3, "SSR+": 4, "UR": 5, "UR+": 6}
    return ranks.get(rarity, 0)

async def _get_random_hero(rarity: str) -> Dict:
    """Get a random hero of specified rarity"""
    heroes = await db.heroes.find({"rarity": rarity}).to_list(100)
    
    if not heroes:
        # Fallback - generate placeholder
        return {
            "id": f"hero_{rarity}_{random.randint(1000, 9999)}",
            "name": f"Divine {rarity} Hero",
            "rarity": rarity,
            "element": random.choice(["Fire", "Water", "Earth", "Wind", "Light", "Dark"]),
            "hero_class": random.choice(["Warrior", "Mage", "Archer"]),
            "base_hp": 1000 * _rarity_rank(rarity),
            "base_atk": 100 * _rarity_rank(rarity)
        }
    
    hero = random.choice(heroes)
    return {
        "id": hero.get("id"),
        "name": hero.get("name"),
        "rarity": hero.get("rarity"),
        "element": hero.get("element"),
        "hero_class": hero.get("hero_class"),
        "base_hp": hero.get("base_hp"),
        "base_atk": hero.get("base_atk"),
        "image_url": hero.get("image_url")
    }

def _generate_filler_reward() -> Dict:
    """Generate a random filler reward"""
    filler_types = [
        {"type": "gold", "amount": 500000, "name": "500K Gold", "display": "🪙 500K Gold", "weight": 20},
        {"type": "gold", "amount": 250000, "name": "250K Gold", "display": "🪙 250K Gold", "weight": 30},
        {"type": "coins", "amount": 50000, "name": "50K Coins", "display": "💰 50K Coins", "weight": 25},
        {"type": "hero_shards", "amount": 50, "name": "50 Hero Shards", "display": "🌟 50 Shards", "weight": 15},
        {"type": "hero_shards", "amount": 25, "name": "25 Hero Shards", "display": "🌟 25 Shards", "weight": 20},
        {"type": "divine_essence", "amount": 5, "name": "5 Divine Essence", "display": "✨ 5 Essence", "weight": 10}
    ]
    
    total_weight = sum(f["weight"] for f in filler_types)
    roll = random.randint(1, total_weight)
    cumulative = 0
    
    for filler in filler_types:
        cumulative += filler["weight"]
        if roll <= cumulative:
            return filler
    
    return filler_types[0]

async def _add_heroes_to_collection(user_id: str, heroes: List[Dict]) -> None:
    """Add pulled heroes to user's collection"""
    for hero in heroes:
        if hero.get("is_filler"):
            continue
        
        existing = await db.user_heroes.find_one({
            "user_id": user_id,
            "hero_id": hero["id"]
        })
        
        if existing:
            # Increase duplicates
            await db.user_heroes.update_one(
                {"_id": existing["_id"]},
                {"$inc": {"duplicates": 1}}
            )
        else:
            # Add new hero
            await db.user_heroes.insert_one({
                "user_id": user_id,
                "hero_id": hero["id"],
                "hero_name": hero["name"],
                "rarity": hero["rarity"],
                "level": 1,
                "stars": 1,
                "rank": 1,
                "duplicates": 0,
                "obtained_at": datetime.utcnow().isoformat()
            })
