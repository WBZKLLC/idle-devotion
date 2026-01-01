"""
Battle Service Router - Combat Processing Microservice
Handles all PvE and PvP combat simulations

This is designed to be:
1. Horizontally scalable (stateless)
2. Cache-friendly (leaderboard caching)
3. Event-driven (publishes battle results)

In production, this would be deployed as a separate service
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict, List, Optional
import random
import asyncio

# Import infrastructure
from core.infrastructure import (
    game_cache, event_queue, rate_limiter,
    cached, rate_limited,
    get_cached_leaderboard, set_cached_leaderboard, invalidate_leaderboard
)

router = APIRouter(prefix="/battle", tags=["battle"])

# Database reference will be injected
db = None

def set_database(database):
    """Set the database reference - called from main server"""
    global db
    db = database

# =============================================================================
# BATTLE CONSTANTS
# =============================================================================

ARENA_TICKET_MAX = 5
ARENA_TICKET_REGEN_MINUTES = 30
ARENA_RATING_K_FACTOR = 32  # ELO K-factor

ABYSS_DAMAGE_SCALING = 0.1  # Base damage multiplier
ABYSS_BOSS_HP_SCALING = 1.15  # HP scales 15% per level

# =============================================================================
# ARENA SYSTEM
# =============================================================================

@router.get("/arena/status/{username}")
@rate_limited(cost=1)
async def get_arena_status(username: str):
    """Get player's arena status"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    arena_data = await db.arena_records.find_one({"user_id": user["id"]})
    if not arena_data:
        arena_data = {
            "user_id": user["id"],
            "username": username,
            "rating": 1000,
            "rank": 0,
            "wins": 0,
            "losses": 0,
            "streak": 0,
            "tickets": ARENA_TICKET_MAX,
            "last_ticket_regen": datetime.utcnow().isoformat()
        }
        await db.arena_records.insert_one(arena_data)
    
    # Calculate ticket regeneration
    if arena_data.get("tickets", 0) < ARENA_TICKET_MAX:
        last_regen = datetime.fromisoformat(arena_data.get("last_ticket_regen", datetime.utcnow().isoformat()))
        minutes_elapsed = (datetime.utcnow() - last_regen).total_seconds() / 60
        tickets_to_add = int(minutes_elapsed / ARENA_TICKET_REGEN_MINUTES)
        
        if tickets_to_add > 0:
            new_tickets = min(ARENA_TICKET_MAX, arena_data.get("tickets", 0) + tickets_to_add)
            await db.arena_records.update_one(
                {"user_id": user["id"]},
                {"$set": {"tickets": new_tickets, "last_ticket_regen": datetime.utcnow().isoformat()}}
            )
            arena_data["tickets"] = new_tickets
    
    return {
        "rating": arena_data.get("rating", 1000),
        "rank": arena_data.get("rank", 0),
        "wins": arena_data.get("wins", 0),
        "losses": arena_data.get("losses", 0),
        "streak": arena_data.get("streak", 0),
        "tickets": arena_data.get("tickets", ARENA_TICKET_MAX),
        "max_tickets": ARENA_TICKET_MAX,
        "ticket_regen_minutes": ARENA_TICKET_REGEN_MINUTES
    }

@router.get("/arena/opponents/{username}")
@rate_limited(cost=2)
async def get_arena_opponents(username: str, count: int = 3):
    """Get list of arena opponents near player's rating"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    arena_data = await db.arena_records.find_one({"user_id": user["id"]})
    user_rating = arena_data.get("rating", 1000) if arena_data else 1000
    
    # Find opponents within rating range
    rating_range = 200
    opponents = await db.arena_records.find({
        "username": {"$ne": username},
        "rating": {"$gte": user_rating - rating_range, "$lte": user_rating + rating_range}
    }).limit(count * 2).to_list(count * 2)
    
    # If not enough opponents, generate mock ones
    if len(opponents) < count:
        mock_opponents = []
        for i in range(count - len(opponents)):
            mock_rating = user_rating + random.randint(-150, 150)
            mock_opponents.append({
                "username": f"Challenger_{random.randint(1000, 9999)}",
                "rating": mock_rating,
                "power": int(mock_rating * 50 + random.randint(-5000, 5000)),
                "is_npc": True
            })
        opponents.extend(mock_opponents)
    
    # Select random opponents
    selected = random.sample(opponents, min(count, len(opponents)))
    
    return {
        "opponents": [
            {
                "username": op.get("username"),
                "rating": op.get("rating", 1000),
                "power": op.get("power", 50000),
                "is_npc": op.get("is_npc", False)
            }
            for op in selected
        ]
    }

@router.post("/arena/fight/{username}")
@rate_limited(cost=5)
async def arena_battle(username: str, opponent_username: str):
    """Execute an arena battle"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check tickets
    arena_data = await db.arena_records.find_one({"user_id": user["id"]})
    if not arena_data:
        arena_data = {"user_id": user["id"], "rating": 1000, "tickets": ARENA_TICKET_MAX}
    
    if arena_data.get("tickets", 0) < 1:
        raise HTTPException(status_code=400, detail="No arena tickets available")
    
    # Get user's team power (simplified)
    user_power = user.get("character_rating", 50000)
    
    # Get opponent data
    opponent_arena = await db.arena_records.find_one({"username": opponent_username})
    opponent_power = opponent_arena.get("power", 50000) if opponent_arena else random.randint(40000, 60000)
    opponent_rating = opponent_arena.get("rating", 1000) if opponent_arena else 1000
    
    # Battle simulation (simplified)
    user_score = user_power * random.uniform(0.8, 1.2)
    opponent_score = opponent_power * random.uniform(0.8, 1.2)
    
    victory = user_score > opponent_score
    
    # Calculate rating change (ELO system)
    expected_score = 1 / (1 + 10 ** ((opponent_rating - arena_data.get("rating", 1000)) / 400))
    actual_score = 1.0 if victory else 0.0
    rating_change = int(ARENA_RATING_K_FACTOR * (actual_score - expected_score))
    
    new_rating = max(0, arena_data.get("rating", 1000) + rating_change)
    new_streak = (arena_data.get("streak", 0) + 1) if victory else 0
    
    # Update user's arena record
    update_data = {
        "rating": new_rating,
        "tickets": arena_data.get("tickets", ARENA_TICKET_MAX) - 1,
        "streak": new_streak,
        "last_battle": datetime.utcnow().isoformat()
    }
    
    if victory:
        update_data["wins"] = arena_data.get("wins", 0) + 1
    else:
        update_data["losses"] = arena_data.get("losses", 0) + 1
    
    await db.arena_records.update_one(
        {"user_id": user["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    # Publish battle event for async processing
    await event_queue.publish("ARENA_BATTLE_COMPLETED", {
        "username": username,
        "opponent": opponent_username,
        "victory": victory,
        "rating_change": rating_change,
        "new_rating": new_rating
    })
    
    # Invalidate leaderboard cache
    await invalidate_leaderboard("arena")
    
    # Calculate rewards
    rewards = {}
    if victory:
        rewards["arena_coins"] = 50 + (10 * new_streak)
        rewards["gold"] = 1000 + (200 * new_streak)
        await db.users.update_one({"username": username}, {"$inc": rewards})
    
    return {
        "victory": victory,
        "rating_change": rating_change,
        "new_rating": new_rating,
        "streak": new_streak,
        "rewards": rewards,
        "battle_log": {
            "user_score": int(user_score),
            "opponent_score": int(opponent_score),
            "user_power": user_power,
            "opponent_power": opponent_power
        }
    }

@router.get("/arena/leaderboard")
@cached(ttl=60, key_prefix="leaderboard:arena")
async def get_arena_leaderboard(limit: int = 100):
    """Get arena leaderboard (cached)"""
    # Check cache first
    cached_data = await get_cached_leaderboard("arena", limit)
    if cached_data:
        return {"leaderboard": cached_data, "cached": True}
    
    # Fetch from database
    cursor = db.arena_records.find({}).sort("rating", -1).limit(limit)
    leaderboard = []
    rank = 1
    
    async for record in cursor:
        leaderboard.append({
            "rank": rank,
            "username": record.get("username"),
            "rating": record.get("rating", 1000),
            "wins": record.get("wins", 0),
            "losses": record.get("losses", 0),
            "streak": record.get("streak", 0)
        })
        rank += 1
    
    # Cache the result
    await set_cached_leaderboard("arena", leaderboard, limit, ttl=60)
    
    return {"leaderboard": leaderboard, "cached": False}

# =============================================================================
# ABYSS SYSTEM
# =============================================================================

@router.get("/abyss/status/{username}")
@rate_limited(cost=1)
async def get_abyss_status(username: str):
    """Get player's abyss progress"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "current_level": 1,
            "highest_level": 1,
            "total_clears": 0,
            "last_attempt": None
        }
        await db.abyss_progress.insert_one(progress)
    
    # Generate boss info for current level
    level = progress.get("current_level", 1)
    boss = generate_abyss_boss(level)
    
    return {
        "current_level": level,
        "highest_level": progress.get("highest_level", 1),
        "total_clears": progress.get("total_clears", 0),
        "boss": boss,
        "rewards": calculate_abyss_rewards(level)
    }

@router.post("/abyss/attack/{username}")
@rate_limited(cost=3)
async def abyss_attack(username: str):
    """Attack the current abyss boss"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {"user_id": user["id"], "current_level": 1, "highest_level": 1, "total_clears": 0}
        await db.abyss_progress.insert_one(progress)
    
    level = progress.get("current_level", 1)
    boss = generate_abyss_boss(level)
    
    # Calculate damage based on user power
    user_power = user.get("character_rating", 50000)
    base_damage = int(user_power * ABYSS_DAMAGE_SCALING * random.uniform(0.9, 1.1))
    
    # Check if boss is defeated
    boss_hp = boss["hp"]
    current_hp = progress.get("boss_current_hp", boss_hp)
    new_hp = max(0, current_hp - base_damage)
    
    victory = new_hp <= 0
    
    if victory:
        # Boss defeated - advance level
        new_level = level + 1
        rewards = calculate_abyss_rewards(level)
        
        await db.abyss_progress.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "current_level": new_level,
                "highest_level": max(progress.get("highest_level", 1), new_level),
                "total_clears": progress.get("total_clears", 0) + 1,
                "boss_current_hp": generate_abyss_boss(new_level)["hp"],
                "last_clear": datetime.utcnow().isoformat()
            }}
        )
        
        # Apply rewards
        reward_update = {}
        for key, value in rewards.items():
            if key in ["gold", "coins", "gems", "crystals"]:
                reward_update[key] = value
        
        if reward_update:
            await db.users.update_one({"username": username}, {"$inc": reward_update})
        
        # Invalidate leaderboard
        await invalidate_leaderboard("abyss")
        
        return {
            "victory": True,
            "damage_dealt": base_damage,
            "level_cleared": level,
            "new_level": new_level,
            "rewards": rewards
        }
    else:
        # Boss not defeated - update HP
        await db.abyss_progress.update_one(
            {"user_id": user["id"]},
            {"$set": {"boss_current_hp": new_hp, "last_attempt": datetime.utcnow().isoformat()}}
        )
        
        return {
            "victory": False,
            "damage_dealt": base_damage,
            "boss_hp_remaining": new_hp,
            "boss_hp_max": boss_hp,
            "hp_percent": round((new_hp / boss_hp) * 100, 1)
        }

@router.get("/abyss/leaderboard")
@cached(ttl=60, key_prefix="leaderboard:abyss")
async def get_abyss_leaderboard(limit: int = 100):
    """Get abyss leaderboard (cached)"""
    cursor = db.abyss_progress.find({}).sort("highest_level", -1).limit(limit)
    leaderboard = []
    rank = 1
    
    async for record in cursor:
        user = await db.users.find_one({"id": record.get("user_id")})
        if user:
            leaderboard.append({
                "rank": rank,
                "username": user.get("username"),
                "highest_level": record.get("highest_level", 1),
                "total_clears": record.get("total_clears", 0)
            })
            rank += 1
    
    return {"leaderboard": leaderboard}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_abyss_boss(level: int) -> Dict:
    """Generate boss stats for a given level"""
    elements = ["Fire", "Water", "Earth", "Wind", "Light", "Dark"]
    boss_names = [
        "Shadow Imp", "Flame Demon", "Frost Giant", "Stone Golem",
        "Thunder Drake", "Void Walker", "Chaos Knight", "Death Lord",
        "Inferno Dragon", "Abyssal Kraken"
    ]
    
    boss_index = (level - 1) % len(boss_names)
    element_index = (level - 1) % len(elements)
    
    base_hp = 5000
    base_atk = 100
    
    return {
        "name": boss_names[boss_index],
        "element": elements[element_index],
        "level": level,
        "hp": int(base_hp * (ABYSS_BOSS_HP_SCALING ** (level - 1))),
        "atk": int(base_atk * (1.1 ** (level - 1))),
        "is_boss": level % 10 == 0
    }

def calculate_abyss_rewards(level: int) -> Dict:
    """Calculate rewards for clearing an abyss level"""
    base_gold = 1000
    base_coins = 500
    
    is_boss = level % 10 == 0
    multiplier = 5 if is_boss else 1
    
    rewards = {
        "gold": int(base_gold * (1.05 ** level) * multiplier),
        "coins": int(base_coins * (1.03 ** level) * multiplier),
        "exp": int(100 * level * multiplier)
    }
    
    # Bonus rewards at milestones
    if level % 50 == 0:
        rewards["gems"] = 100
    if level % 100 == 0:
        rewards["gems"] = rewards.get("gems", 0) + 500
    
    return rewards
