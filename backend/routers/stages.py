"""
Dungeon/Stage System Router - Server-Authoritative Architecture

SECURITY PRINCIPLE: The client NEVER decides outcomes.
- Client: Requests, Displays, Animates
- Server: Rolls, Validates, Records, Rewards

All RNG, loot drops, battle outcomes are computed server-side.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import random
import uuid
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'divine_heroes')]

# ==================== STAMINA COSTS ====================
STAMINA_COSTS = {
    "exp_stage": 10,
    "gold_stage": 10,
    "skill_dungeon": 12,
    "equipment_dungeon": 15,
    "enhancement_dungeon": 12,
    "boss_challenge": 20,
}

# ==================== STAGE DEFINITIONS ====================
# All drop rates and rewards are SERVER-SIDE ONLY

EXP_STAGES = {
    1: {"name": "Training Grounds I", "difficulty": 1, "base_soul_dust": 200, "base_gold": 500},
    2: {"name": "Training Grounds II", "difficulty": 2, "base_soul_dust": 400, "base_gold": 800},
    3: {"name": "Training Grounds III", "difficulty": 3, "base_soul_dust": 600, "base_gold": 1200},
    4: {"name": "Ancient Library I", "difficulty": 4, "base_soul_dust": 900, "base_gold": 1800},
    5: {"name": "Ancient Library II", "difficulty": 5, "base_soul_dust": 1200, "base_gold": 2500},
    6: {"name": "Ancient Library III", "difficulty": 6, "base_soul_dust": 1600, "base_gold": 3500},
    7: {"name": "Mystic Tower I", "difficulty": 7, "base_soul_dust": 2000, "base_gold": 4500},
    8: {"name": "Mystic Tower II", "difficulty": 8, "base_soul_dust": 2500, "base_gold": 6000},
    9: {"name": "Mystic Tower III", "difficulty": 9, "base_soul_dust": 3200, "base_gold": 8000},
    10: {"name": "Ascension Peak", "difficulty": 10, "base_soul_dust": 4000, "base_gold": 10000},
}

GOLD_STAGES = {
    1: {"name": "Goblin Lair I", "difficulty": 1, "base_gold": 2000, "base_coins": 500},
    2: {"name": "Goblin Lair II", "difficulty": 2, "base_gold": 4000, "base_coins": 800},
    3: {"name": "Goblin Lair III", "difficulty": 3, "base_gold": 6500, "base_coins": 1200},
    4: {"name": "Dragon's Hoard I", "difficulty": 4, "base_gold": 10000, "base_coins": 1800},
    5: {"name": "Dragon's Hoard II", "difficulty": 5, "base_gold": 15000, "base_coins": 2500},
    6: {"name": "Dragon's Hoard III", "difficulty": 6, "base_gold": 22000, "base_coins": 3500},
    7: {"name": "Ancient Vault I", "difficulty": 7, "base_gold": 30000, "base_coins": 5000},
    8: {"name": "Ancient Vault II", "difficulty": 8, "base_gold": 40000, "base_coins": 7000},
    9: {"name": "Ancient Vault III", "difficulty": 9, "base_gold": 55000, "base_coins": 10000},
    10: {"name": "Treasury of Kings", "difficulty": 10, "base_gold": 75000, "base_coins": 15000},
}

SKILL_DUNGEONS = {
    1: {"name": "Elemental Shrine I", "difficulty": 1, "base_skill_essence": 30, "base_gold": 1000},
    2: {"name": "Elemental Shrine II", "difficulty": 2, "base_skill_essence": 50, "base_gold": 1500},
    3: {"name": "Elemental Shrine III", "difficulty": 3, "base_skill_essence": 75, "base_gold": 2200},
    4: {"name": "Arcane Sanctum I", "difficulty": 4, "base_skill_essence": 100, "base_gold": 3000},
    5: {"name": "Arcane Sanctum II", "difficulty": 5, "base_skill_essence": 140, "base_gold": 4000},
    6: {"name": "Arcane Sanctum III", "difficulty": 6, "base_skill_essence": 180, "base_gold": 5500},
    7: {"name": "Forbidden Temple I", "difficulty": 7, "base_skill_essence": 230, "base_gold": 7500},
    8: {"name": "Forbidden Temple II", "difficulty": 8, "base_skill_essence": 300, "base_gold": 10000},
    9: {"name": "Forbidden Temple III", "difficulty": 9, "base_skill_essence": 400, "base_gold": 14000},
    10: {"name": "Sage's Pinnacle", "difficulty": 10, "base_skill_essence": 500, "base_gold": 20000},
}

EQUIPMENT_DUNGEONS = {
    1: {"name": "Rusted Armory I", "difficulty": 1, "common_rate": 90, "uncommon_rate": 10, "rare_rate": 0},
    2: {"name": "Rusted Armory II", "difficulty": 2, "common_rate": 80, "uncommon_rate": 18, "rare_rate": 2},
    3: {"name": "Rusted Armory III", "difficulty": 3, "common_rate": 65, "uncommon_rate": 30, "rare_rate": 5},
    4: {"name": "Knight's Arsenal I", "difficulty": 4, "common_rate": 50, "uncommon_rate": 40, "rare_rate": 10},
    5: {"name": "Knight's Arsenal II", "difficulty": 5, "common_rate": 35, "uncommon_rate": 45, "rare_rate": 18, "epic_rate": 2},
    6: {"name": "Knight's Arsenal III", "difficulty": 6, "common_rate": 20, "uncommon_rate": 45, "rare_rate": 30, "epic_rate": 5},
    7: {"name": "Divine Forge I", "difficulty": 7, "common_rate": 10, "uncommon_rate": 35, "rare_rate": 40, "epic_rate": 14, "legendary_rate": 1},
    8: {"name": "Divine Forge II", "difficulty": 8, "common_rate": 5, "uncommon_rate": 25, "rare_rate": 45, "epic_rate": 22, "legendary_rate": 3},
    9: {"name": "Divine Forge III", "difficulty": 9, "common_rate": 0, "uncommon_rate": 15, "rare_rate": 45, "epic_rate": 35, "legendary_rate": 5},
    10: {"name": "Celestial Armory", "difficulty": 10, "common_rate": 0, "uncommon_rate": 5, "rare_rate": 40, "epic_rate": 45, "legendary_rate": 10},
}

ENHANCEMENT_DUNGEONS = {
    1: {"name": "Stone Quarry I", "difficulty": 1, "base_stones": 5, "base_gold": 500},
    2: {"name": "Stone Quarry II", "difficulty": 2, "base_stones": 8, "base_gold": 800},
    3: {"name": "Stone Quarry III", "difficulty": 3, "base_stones": 12, "base_gold": 1200},
    4: {"name": "Crystal Caves I", "difficulty": 4, "base_stones": 18, "base_gold": 2000},
    5: {"name": "Crystal Caves II", "difficulty": 5, "base_stones": 25, "base_gold": 3000},
    6: {"name": "Crystal Caves III", "difficulty": 6, "base_stones": 35, "base_gold": 4500},
    7: {"name": "Diamond Mine I", "difficulty": 7, "base_stones": 50, "base_gold": 6500},
    8: {"name": "Diamond Mine II", "difficulty": 8, "base_stones": 70, "base_gold": 9000},
    9: {"name": "Diamond Mine III", "difficulty": 9, "base_stones": 100, "base_gold": 13000},
    10: {"name": "Enchanter's Cache", "difficulty": 10, "base_stones": 150, "base_gold": 18000},
}

# ==================== EQUIPMENT GENERATION (Server-Side) ====================
EQUIPMENT_SLOTS = ["weapon", "helmet", "chestplate", "gloves", "boots", "talisman"]
EQUIPMENT_SETS = ["warrior", "mage", "assassin", "tank"]
EQUIPMENT_SLOT_STATS = {
    "weapon": "atk", "helmet": "def", "chestplate": "hp",
    "gloves": "crit_rate", "boots": "speed", "talisman": "crit_dmg",
}
EQUIPMENT_BASE_STATS = {
    "weapon": {"atk": 50}, "helmet": {"def": 30}, "chestplate": {"hp": 500},
    "gloves": {"crit_rate": 3}, "boots": {"speed": 10}, "talisman": {"crit_dmg": 10},
}
EQUIPMENT_RARITY_MULTIPLIERS = {
    "common": 1.0, "uncommon": 1.3, "rare": 1.6, "epic": 2.0, "legendary": 2.5,
}
SOCKET_REQUIREMENTS = {"common": 0, "uncommon": 0, "rare": 0, "epic": 1, "legendary": 2}


def server_generate_equipment(slot: str, rarity: str, owner_id: str) -> dict:
    """SERVER-SIDE equipment generation - all RNG happens here"""
    base_stats = EQUIPMENT_BASE_STATS.get(slot, {})
    primary_stat = EQUIPMENT_SLOT_STATS.get(slot, "atk")
    rarity_mult = EQUIPMENT_RARITY_MULTIPLIERS.get(rarity, 1.0)
    
    # Server rolls primary value with variance
    base_value = base_stats.get(primary_stat, 50)
    variance = random.uniform(0.9, 1.1)  # 10% variance
    primary_value = int(base_value * rarity_mult * variance)
    
    # Server rolls sub stats for rare+ equipment
    sub_stats = {}
    if rarity in ["rare", "epic", "legendary"]:
        num_substats = {"rare": 1, "epic": 2, "legendary": 3}.get(rarity, 0)
        possible_substats = ["atk_percent", "hp_percent", "def_percent", "speed", "crit_rate", "crit_dmg"]
        for _ in range(num_substats):
            stat = random.choice([s for s in possible_substats if s not in sub_stats])
            value = round(random.uniform(1, 5), 1)
            sub_stats[stat] = value
    
    # Server decides set (30% chance to get a set piece)
    set_id = None
    if random.random() < 0.3:
        set_id = random.choice(EQUIPMENT_SETS)
    
    sockets = SOCKET_REQUIREMENTS.get(rarity, 0)
    set_prefix = set_id.capitalize() if set_id else ""
    rarity_prefix = {"common": "", "uncommon": "Fine", "rare": "Superior", "epic": "Epic", "legendary": "Legendary"}.get(rarity, "")
    name = f"{rarity_prefix} {set_prefix} {slot.capitalize()}".strip()
    
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "slot": slot,
        "rarity": rarity,
        "set_id": set_id,
        "level": 1,
        "max_level": 20,
        "primary_stat": primary_stat,
        "primary_value": primary_value,
        "sub_stats": sub_stats,
        "sockets": sockets,
        "equipped_runes": [],
        "owner_id": owner_id,
        "equipped_by": None,
        "is_locked": False,
        "created_at": datetime.utcnow().isoformat(),
    }


# Request models
class StageRequest(BaseModel):
    stage_id: int
    team_ids: Optional[List[str]] = None  # Hero instance IDs (validated server-side)

class SweepRequest(BaseModel):
    stage_id: int
    count: int = 1  # How many times to sweep


router = APIRouter(prefix="/stages", tags=["Dungeons & Stages"])


# ==================== HELPER FUNCTIONS ====================

async def get_user_power(user_id: str, team_ids: Optional[List[str]] = None) -> int:
    """Server-side calculation of user's combat power"""
    if team_ids:
        heroes = await db.user_heroes.find({"id": {"$in": team_ids}, "user_id": user_id}).to_list(10)
    else:
        # Use top 5 heroes by default
        heroes = await db.user_heroes.find({"user_id": user_id}).sort("level", -1).limit(5).to_list(5)
    
    total_power = 0
    for hero in heroes:
        level = hero.get("level", 1)
        atk = hero.get("current_atk", 100)
        hp = hero.get("current_hp", 1000)
        defense = hero.get("current_def", 50)
        total_power += (atk * 2 + hp // 10 + defense) * (1 + level * 0.05)
    
    return int(total_power)


async def validate_stamina(username: str, cost: int) -> tuple:
    """Server-side stamina validation and deduction"""
    user = await db.users.find_one({"username": username})
    if not user:
        return None, "User not found"
    
    current_stamina = user.get("stamina", 100)
    
    # Regenerate stamina
    last_regen = user.get("stamina_last_regen")
    if last_regen:
        if isinstance(last_regen, str):
            last_regen = datetime.fromisoformat(last_regen)
        minutes_passed = (datetime.utcnow() - last_regen).total_seconds() / 60
        stamina_gained = int(minutes_passed / 5)  # 1 per 5 min
        current_stamina = min(current_stamina + stamina_gained, 100)
    
    if current_stamina < cost:
        return None, f"Not enough stamina. Have {current_stamina}, need {cost}"
    
    # Deduct stamina
    new_stamina = current_stamina - cost
    await db.users.update_one(
        {"username": username},
        {"$set": {"stamina": new_stamina, "stamina_last_regen": datetime.utcnow()}}
    )
    
    return user, None


async def record_battle_log(user_id: str, stage_type: str, stage_id: int, victory: bool, rewards: dict):
    """Append-only audit log for all battles"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "stage_type": stage_type,
        "stage_id": stage_id,
        "victory": victory,
        "rewards": rewards,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await db.battle_logs.insert_one(log_entry)
    return log_entry


# ==================== API ENDPOINTS ====================

@router.get("/info")
async def get_stages_info():
    """Get all stage information (public, no secrets)"""
    return {
        "exp_stages": {k: {"name": v["name"], "difficulty": v["difficulty"]} for k, v in EXP_STAGES.items()},
        "gold_stages": {k: {"name": v["name"], "difficulty": v["difficulty"]} for k, v in GOLD_STAGES.items()},
        "skill_dungeons": {k: {"name": v["name"], "difficulty": v["difficulty"]} for k, v in SKILL_DUNGEONS.items()},
        "equipment_dungeons": {k: {"name": v["name"], "difficulty": v["difficulty"]} for k, v in EQUIPMENT_DUNGEONS.items()},
        "enhancement_dungeons": {k: {"name": v["name"], "difficulty": v["difficulty"]} for k, v in ENHANCEMENT_DUNGEONS.items()},
        "stamina_costs": STAMINA_COSTS,
    }


@router.get("/{username}/progress")
async def get_user_stage_progress(username: str):
    """Get user's highest cleared stages"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "exp_stage": 0,
            "gold_stage": 0,
            "skill_dungeon": 0,
            "equipment_dungeon": 0,
            "enhancement_dungeon": 0,
        }
        await db.stage_progress.insert_one(progress)
    
    return {
        "exp_stage": progress.get("exp_stage", 0),
        "gold_stage": progress.get("gold_stage", 0),
        "skill_dungeon": progress.get("skill_dungeon", 0),
        "equipment_dungeon": progress.get("equipment_dungeon", 0),
        "enhancement_dungeon": progress.get("enhancement_dungeon", 0),
    }


@router.post("/{username}/exp/{stage_id}")
async def battle_exp_stage(username: str, stage_id: int, request: StageRequest):
    """
    Battle EXP Stage - SERVER DECIDES ALL OUTCOMES
    
    1. Server validates stamina
    2. Server calculates player power
    3. Server rolls battle outcome
    4. Server generates rewards
    5. Server records to audit log
    """
    if stage_id not in EXP_STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    stage = EXP_STAGES[stage_id]
    stamina_cost = STAMINA_COSTS["exp_stage"]
    
    # 1. Validate stamina (server-side)
    user, error = await validate_stamina(username, stamina_cost)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    # 2. Check stage unlock
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if progress and progress.get("exp_stage", 0) < stage_id - 1:
        raise HTTPException(status_code=400, detail="Stage not unlocked yet")
    
    # 3. Server calculates power and rolls outcome
    player_power = await get_user_power(user["id"], request.team_ids)
    stage_power = stage["difficulty"] * 500
    
    # Server RNG: win chance based on power ratio
    power_ratio = player_power / max(stage_power, 1)
    base_win_chance = min(0.95, max(0.3, power_ratio * 0.5 + 0.3))
    victory = random.random() < base_win_chance
    
    # 4. Server generates rewards (only if victory)
    rewards = {"gold": 0, "soul_dust": 0}
    if victory:
        # All reward rolls are server-side
        variance = random.uniform(0.9, 1.15)
        rewards["soul_dust"] = int(stage["base_soul_dust"] * variance)
        rewards["gold"] = int(stage["base_gold"] * variance)
        
        # Bonus drop chance (server roll)
        if random.random() < 0.1:  # 10% bonus
            rewards["enhancement_stones"] = random.randint(1, 3)
        
        # Apply rewards
        await db.users.update_one(
            {"username": username},
            {"$inc": {
                "soul_dust": rewards["soul_dust"],
                "gold": rewards["gold"],
                "enhancement_stones": rewards.get("enhancement_stones", 0),
            }}
        )
        
        # Update progress if first clear
        if not progress or progress.get("exp_stage", 0) < stage_id:
            await db.stage_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"exp_stage": stage_id}},
                upsert=True
            )
    
    # 5. Audit log (append-only)
    await record_battle_log(user["id"], "exp_stage", stage_id, victory, rewards)
    
    return {
        "victory": victory,
        "stage_name": stage["name"],
        "rewards": rewards if victory else {},
        "player_power": player_power,
        "stage_power": stage_power,
        "stamina_used": stamina_cost,
    }


@router.post("/{username}/gold/{stage_id}")
async def battle_gold_stage(username: str, stage_id: int, request: StageRequest):
    """Battle Gold Stage - Server-authoritative"""
    if stage_id not in GOLD_STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    stage = GOLD_STAGES[stage_id]
    stamina_cost = STAMINA_COSTS["gold_stage"]
    
    user, error = await validate_stamina(username, stamina_cost)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if progress and progress.get("gold_stage", 0) < stage_id - 1:
        raise HTTPException(status_code=400, detail="Stage not unlocked yet")
    
    player_power = await get_user_power(user["id"], request.team_ids)
    stage_power = stage["difficulty"] * 500
    
    power_ratio = player_power / max(stage_power, 1)
    base_win_chance = min(0.95, max(0.3, power_ratio * 0.5 + 0.3))
    victory = random.random() < base_win_chance
    
    rewards = {"gold": 0, "coins": 0}
    if victory:
        variance = random.uniform(0.9, 1.15)
        rewards["gold"] = int(stage["base_gold"] * variance)
        rewards["coins"] = int(stage["base_coins"] * variance)
        
        if random.random() < 0.08:
            rewards["divine_gems"] = random.randint(5, 15)
        
        await db.users.update_one(
            {"username": username},
            {"$inc": {
                "gold": rewards["gold"],
                "coins": rewards["coins"],
                "divine_gems": rewards.get("divine_gems", 0),
            }}
        )
        
        if not progress or progress.get("gold_stage", 0) < stage_id:
            await db.stage_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"gold_stage": stage_id}},
                upsert=True
            )
    
    await record_battle_log(user["id"], "gold_stage", stage_id, victory, rewards)
    
    return {
        "victory": victory,
        "stage_name": stage["name"],
        "rewards": rewards if victory else {},
        "player_power": player_power,
        "stage_power": stage_power,
        "stamina_used": stamina_cost,
    }


@router.post("/{username}/skill/{stage_id}")
async def battle_skill_dungeon(username: str, stage_id: int, request: StageRequest):
    """Battle Skill Dungeon - Server-authoritative"""
    if stage_id not in SKILL_DUNGEONS:
        raise HTTPException(status_code=400, detail="Invalid dungeon")
    
    stage = SKILL_DUNGEONS[stage_id]
    stamina_cost = STAMINA_COSTS["skill_dungeon"]
    
    user, error = await validate_stamina(username, stamina_cost)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if progress and progress.get("skill_dungeon", 0) < stage_id - 1:
        raise HTTPException(status_code=400, detail="Dungeon not unlocked yet")
    
    player_power = await get_user_power(user["id"], request.team_ids)
    stage_power = stage["difficulty"] * 600
    
    power_ratio = player_power / max(stage_power, 1)
    base_win_chance = min(0.95, max(0.25, power_ratio * 0.45 + 0.25))
    victory = random.random() < base_win_chance
    
    rewards = {"skill_essence": 0, "gold": 0}
    if victory:
        variance = random.uniform(0.9, 1.15)
        rewards["skill_essence"] = int(stage["base_skill_essence"] * variance)
        rewards["gold"] = int(stage["base_gold"] * variance)
        
        await db.users.update_one(
            {"username": username},
            {"$inc": {"skill_essence": rewards["skill_essence"], "gold": rewards["gold"]}}
        )
        
        if not progress or progress.get("skill_dungeon", 0) < stage_id:
            await db.stage_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"skill_dungeon": stage_id}},
                upsert=True
            )
    
    await record_battle_log(user["id"], "skill_dungeon", stage_id, victory, rewards)
    
    return {
        "victory": victory,
        "stage_name": stage["name"],
        "rewards": rewards if victory else {},
        "stamina_used": stamina_cost,
    }


@router.post("/{username}/equipment/{stage_id}")
async def battle_equipment_dungeon(username: str, stage_id: int, request: StageRequest):
    """
    Battle Equipment Dungeon - SERVER GENERATES ALL LOOT
    
    All equipment rarity rolls happen server-side.
    """
    if stage_id not in EQUIPMENT_DUNGEONS:
        raise HTTPException(status_code=400, detail="Invalid dungeon")
    
    stage = EQUIPMENT_DUNGEONS[stage_id]
    stamina_cost = STAMINA_COSTS["equipment_dungeon"]
    
    user, error = await validate_stamina(username, stamina_cost)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if progress and progress.get("equipment_dungeon", 0) < stage_id - 1:
        raise HTTPException(status_code=400, detail="Dungeon not unlocked yet")
    
    player_power = await get_user_power(user["id"], request.team_ids)
    stage_power = stage["difficulty"] * 700
    
    power_ratio = player_power / max(stage_power, 1)
    base_win_chance = min(0.95, max(0.2, power_ratio * 0.4 + 0.2))
    victory = random.random() < base_win_chance
    
    rewards = {"gold": 2000 * stage["difficulty"]}
    equipment_dropped = None
    
    if victory:
        # SERVER ROLLS equipment rarity
        roll = random.random() * 100
        rarity = "common"
        cumulative = 0
        for r in ["legendary", "epic", "rare", "uncommon", "common"]:
            rate = stage.get(f"{r}_rate", 0)
            cumulative += rate
            if roll < cumulative:
                rarity = r
                break
        
        # SERVER generates equipment
        slot = random.choice(EQUIPMENT_SLOTS)
        equipment_dropped = server_generate_equipment(slot, rarity, user["id"])
        
        # Save to database
        equipment_copy = dict(equipment_dropped)
        await db.equipment.insert_one(equipment_copy)
        
        rewards["equipment"] = {
            "id": equipment_dropped["id"],
            "name": equipment_dropped["name"],
            "rarity": equipment_dropped["rarity"],
            "slot": equipment_dropped["slot"],
        }
        
        await db.users.update_one({"username": username}, {"$inc": {"gold": rewards["gold"]}})
        
        if not progress or progress.get("equipment_dungeon", 0) < stage_id:
            await db.stage_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"equipment_dungeon": stage_id}},
                upsert=True
            )
    
    await record_battle_log(user["id"], "equipment_dungeon", stage_id, victory, rewards)
    
    return {
        "victory": victory,
        "stage_name": stage["name"],
        "rewards": rewards if victory else {},
        "equipment_dropped": equipment_dropped if victory else None,
        "stamina_used": stamina_cost,
    }


@router.post("/{username}/enhancement/{stage_id}")
async def battle_enhancement_dungeon(username: str, stage_id: int, request: StageRequest):
    """Battle Enhancement Stone Dungeon - Server-authoritative"""
    if stage_id not in ENHANCEMENT_DUNGEONS:
        raise HTTPException(status_code=400, detail="Invalid dungeon")
    
    stage = ENHANCEMENT_DUNGEONS[stage_id]
    stamina_cost = STAMINA_COSTS["enhancement_dungeon"]
    
    user, error = await validate_stamina(username, stamina_cost)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if progress and progress.get("enhancement_dungeon", 0) < stage_id - 1:
        raise HTTPException(status_code=400, detail="Dungeon not unlocked yet")
    
    player_power = await get_user_power(user["id"], request.team_ids)
    stage_power = stage["difficulty"] * 550
    
    power_ratio = player_power / max(stage_power, 1)
    base_win_chance = min(0.95, max(0.3, power_ratio * 0.45 + 0.3))
    victory = random.random() < base_win_chance
    
    rewards = {"enhancement_stones": 0, "gold": 0}
    if victory:
        variance = random.uniform(0.9, 1.15)
        rewards["enhancement_stones"] = int(stage["base_stones"] * variance)
        rewards["gold"] = int(stage["base_gold"] * variance)
        
        # Rare rune drop
        if random.random() < 0.05 * stage["difficulty"]:
            rewards["rune_drop"] = True
        
        await db.users.update_one(
            {"username": username},
            {"$inc": {"enhancement_stones": rewards["enhancement_stones"], "gold": rewards["gold"]}}
        )
        
        if not progress or progress.get("enhancement_dungeon", 0) < stage_id:
            await db.stage_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"enhancement_dungeon": stage_id}},
                upsert=True
            )
    
    await record_battle_log(user["id"], "enhancement_dungeon", stage_id, victory, rewards)
    
    return {
        "victory": victory,
        "stage_name": stage["name"],
        "rewards": rewards if victory else {},
        "stamina_used": stamina_cost,
    }


@router.post("/{username}/sweep/{stage_type}/{stage_id}")
async def sweep_stage(username: str, stage_type: str, stage_id: int, request: SweepRequest):
    """
    Sweep (auto-clear) a previously beaten stage multiple times.
    SERVER calculates all rewards - client just displays animation.
    """
    stage_maps = {
        "exp": (EXP_STAGES, "exp_stage", STAMINA_COSTS["exp_stage"]),
        "gold": (GOLD_STAGES, "gold_stage", STAMINA_COSTS["gold_stage"]),
        "skill": (SKILL_DUNGEONS, "skill_dungeon", STAMINA_COSTS["skill_dungeon"]),
        "enhancement": (ENHANCEMENT_DUNGEONS, "enhancement_dungeon", STAMINA_COSTS["enhancement_dungeon"]),
    }
    
    if stage_type not in stage_maps:
        raise HTTPException(status_code=400, detail="Invalid stage type")
    
    stages, progress_key, stamina_cost = stage_maps[stage_type]
    
    if stage_id not in stages:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    stage = stages[stage_id]
    count = min(request.count, 10)  # Max 10 sweeps at once
    total_stamina = stamina_cost * count
    
    user, error = await validate_stamina(username, total_stamina)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    # Check if stage is cleared
    progress = await db.stage_progress.find_one({"user_id": user["id"]})
    if not progress or progress.get(progress_key, 0) < stage_id:
        raise HTTPException(status_code=400, detail="Must clear stage manually first")
    
    # SERVER calculates all sweep rewards
    total_rewards = {}
    for _ in range(count):
        variance = random.uniform(0.9, 1.1)
        if stage_type == "exp":
            total_rewards["soul_dust"] = total_rewards.get("soul_dust", 0) + int(stage["base_soul_dust"] * variance)
            total_rewards["gold"] = total_rewards.get("gold", 0) + int(stage["base_gold"] * variance)
        elif stage_type == "gold":
            total_rewards["gold"] = total_rewards.get("gold", 0) + int(stage["base_gold"] * variance)
            total_rewards["coins"] = total_rewards.get("coins", 0) + int(stage["base_coins"] * variance)
        elif stage_type == "skill":
            total_rewards["skill_essence"] = total_rewards.get("skill_essence", 0) + int(stage["base_skill_essence"] * variance)
            total_rewards["gold"] = total_rewards.get("gold", 0) + int(stage["base_gold"] * variance)
        elif stage_type == "enhancement":
            total_rewards["enhancement_stones"] = total_rewards.get("enhancement_stones", 0) + int(stage["base_stones"] * variance)
            total_rewards["gold"] = total_rewards.get("gold", 0) + int(stage["base_gold"] * variance)
    
    # Apply all rewards
    await db.users.update_one({"username": username}, {"$inc": total_rewards})
    
    # Audit log
    await record_battle_log(user["id"], f"{stage_type}_sweep", stage_id, True, {"count": count, **total_rewards})
    
    return {
        "success": True,
        "sweeps": count,
        "total_stamina_used": total_stamina,
        "total_rewards": total_rewards,
    }
