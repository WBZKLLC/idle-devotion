"""Economy and currency system router"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import Optional

from ..core.database import db, convert_objectid
from ..core.config import (
    STAMINA_MAX, STAMINA_REGEN_MINUTES, STAMINA_COSTS,
    HERO_LEVEL_COSTS, HERO_MAX_LEVEL,
    SKILL_ESSENCE_COSTS, SKILL_MAX_LEVEL,
    STAR_PROMOTION_COSTS, DUPLICATE_CONVERSION,
    DEFAULT_CURRENCIES
)

router = APIRouter(prefix="/economy", tags=["Economy"])

# ==================== STAMINA SYSTEM ====================

def calculate_stamina_regen(user: dict) -> dict:
    """Calculate current stamina after regeneration"""
    current_stamina = user.get("stamina", STAMINA_MAX)
    last_regen = user.get("stamina_last_regen")
    
    if current_stamina >= STAMINA_MAX:
        return {"stamina": STAMINA_MAX, "time_to_next": 0, "max": STAMINA_MAX}
    
    if not last_regen:
        return {"stamina": current_stamina, "time_to_next": STAMINA_REGEN_MINUTES * 60, "max": STAMINA_MAX}
    
    # Convert to datetime if string
    if isinstance(last_regen, str):
        last_regen = datetime.fromisoformat(last_regen)
    
    now = datetime.utcnow()
    minutes_passed = (now - last_regen).total_seconds() / 60
    stamina_gained = int(minutes_passed / STAMINA_REGEN_MINUTES)
    
    new_stamina = min(current_stamina + stamina_gained, STAMINA_MAX)
    
    # Calculate time to next stamina
    remainder_minutes = minutes_passed % STAMINA_REGEN_MINUTES
    time_to_next = int((STAMINA_REGEN_MINUTES - remainder_minutes) * 60)
    
    return {
        "stamina": new_stamina,
        "time_to_next": time_to_next if new_stamina < STAMINA_MAX else 0,
        "max": STAMINA_MAX,
        "regen_rate": f"1 per {STAMINA_REGEN_MINUTES} min"
    }

@router.get("/{username}/stamina")
async def get_stamina(username: str):
    """Get current stamina status"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stamina_info = calculate_stamina_regen(user)
    
    # Update user's stamina if it changed
    if stamina_info["stamina"] != user.get("stamina", 0):
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "stamina": stamina_info["stamina"],
                "stamina_last_regen": datetime.utcnow()
            }}
        )
    
    return stamina_info

@router.post("/{username}/stamina/use")
async def use_stamina(username: str, amount: int, activity: Optional[str] = None):
    """Use stamina for an activity"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If activity specified, use predefined cost
    if activity:
        cost = STAMINA_COSTS.get(activity)
        if cost is None:
            raise HTTPException(status_code=400, detail=f"Unknown activity: {activity}")
        amount = cost
    
    stamina_info = calculate_stamina_regen(user)
    current_stamina = stamina_info["stamina"]
    
    if current_stamina < amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough stamina. Have {current_stamina}, need {amount}"
        )
    
    new_stamina = current_stamina - amount
    
    await db.users.update_one(
        {"username": username},
        {"$set": {
            "stamina": new_stamina,
            "stamina_last_regen": datetime.utcnow() if new_stamina < STAMINA_MAX else user.get("stamina_last_regen")
        }}
    )
    
    return {
        "success": True,
        "stamina_used": amount,
        "stamina_remaining": new_stamina,
        "activity": activity,
    }

@router.post("/{username}/stamina/refill")
async def refill_stamina(username: str, use_gems: bool = True):
    """Refill stamina using Divine Gems"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    gem_cost = 50  # Cost to refill stamina
    
    if use_gems:
        if user.get("divine_gems", 0) < gem_cost:
            raise HTTPException(status_code=400, detail=f"Not enough Divine Gems. Need {gem_cost}")
        
        await db.users.update_one(
            {"username": username},
            {
                "$set": {"stamina": STAMINA_MAX, "stamina_last_regen": datetime.utcnow()},
                "$inc": {"divine_gems": -gem_cost}
            }
        )
        
        return {"success": True, "stamina": STAMINA_MAX, "gems_spent": gem_cost}
    
    raise HTTPException(status_code=400, detail="No refill method specified")

# ==================== CURRENCY MANAGEMENT ====================

@router.get("/{username}/currencies")
async def get_currencies(username: str):
    """Get all currency balances"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "gold": user.get("gold", 0),
        "coins": user.get("coins", 0),
        "crystals": user.get("crystals", 0),
        "divine_essence": user.get("divine_essence", 0),
        "soul_dust": user.get("soul_dust", 0),
        "skill_essence": user.get("skill_essence", 0),
        "star_crystals": user.get("star_crystals", 0),
        "divine_gems": user.get("divine_gems", 0),
        "guild_coins": user.get("guild_coins", 0),
        "pvp_medals": user.get("pvp_medals", 0),
        "enhancement_stones": user.get("enhancement_stones", 0),
        "hero_shards": user.get("hero_shards", 0),
    }

@router.post("/{username}/currencies/add")
async def add_currency(username: str, currency: str, amount: int):
    """Add currency to user (admin/reward endpoint)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    valid_currencies = list(DEFAULT_CURRENCIES.keys())
    if currency not in valid_currencies:
        raise HTTPException(status_code=400, detail=f"Invalid currency. Must be one of: {valid_currencies}")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    await db.users.update_one(
        {"username": username},
        {"$inc": {currency: amount}}
    )
    
    new_balance = user.get(currency, 0) + amount
    return {"success": True, "currency": currency, "added": amount, "new_balance": new_balance}

# ==================== HERO LEVELING ====================

@router.post("/{username}/hero/{hero_instance_id}/level-up")
async def level_up_hero(username: str, hero_instance_id: str, levels: int = 1):
    """Level up a hero using Gold and Soul Dust"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    current_level = hero.get("level", 1)
    target_level = min(current_level + levels, HERO_MAX_LEVEL)
    
    if current_level >= HERO_MAX_LEVEL:
        raise HTTPException(status_code=400, detail="Hero is already max level")
    
    # Calculate costs
    total_gold = 0
    total_soul_dust = 0
    
    for lvl in range(current_level, target_level):
        for (min_lvl, max_lvl), (gold, dust) in HERO_LEVEL_COSTS.items():
            if min_lvl <= lvl + 1 <= max_lvl:
                total_gold += gold
                total_soul_dust += dust
                break
    
    # Check resources
    if user.get("gold", 0) < total_gold:
        raise HTTPException(status_code=400, detail=f"Not enough Gold. Need {total_gold}")
    if user.get("soul_dust", 0) < total_soul_dust:
        raise HTTPException(status_code=400, detail=f"Not enough Soul Dust. Need {total_soul_dust}")
    
    # Get base hero stats
    hero_data = await db.heroes.find_one({"id": hero["hero_id"]})
    if not hero_data:
        raise HTTPException(status_code=404, detail="Hero data not found")
    
    # Calculate new stats (each level adds ~3% to base stats)
    level_mult = 1 + (target_level - 1) * 0.03
    new_hp = int(hero_data.get("base_hp", 1000) * level_mult)
    new_atk = int(hero_data.get("base_atk", 100) * level_mult)
    new_def = int(hero_data.get("base_def", 50) * level_mult)
    
    # Deduct resources
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gold": -total_gold, "soul_dust": -total_soul_dust}}
    )
    
    # Update hero
    await db.user_heroes.update_one(
        {"id": hero_instance_id},
        {"$set": {
            "level": target_level,
            "current_hp": new_hp,
            "current_atk": new_atk,
            "current_def": new_def,
        }}
    )
    
    return {
        "success": True,
        "new_level": target_level,
        "gold_spent": total_gold,
        "soul_dust_spent": total_soul_dust,
        "new_stats": {"hp": new_hp, "atk": new_atk, "def": new_def},
    }

# ==================== SKILL UPGRADING ====================

@router.post("/{username}/hero/{hero_instance_id}/upgrade-skill")
async def upgrade_skill(username: str, hero_instance_id: str, skill_id: str):
    """Upgrade a hero's skill using Skill Essence"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    skill_levels = hero.get("skill_levels", {})
    current_level = skill_levels.get(skill_id, 1)
    
    if current_level >= SKILL_MAX_LEVEL:
        raise HTTPException(status_code=400, detail="Skill is already max level")
    
    # Get cost
    cost = SKILL_ESSENCE_COSTS[current_level] if current_level < len(SKILL_ESSENCE_COSTS) else SKILL_ESSENCE_COSTS[-1]
    
    if user.get("skill_essence", 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough Skill Essence. Need {cost}")
    
    # Deduct and upgrade
    skill_levels[skill_id] = current_level + 1
    
    await db.users.update_one(
        {"username": username},
        {"$inc": {"skill_essence": -cost}}
    )
    
    await db.user_heroes.update_one(
        {"id": hero_instance_id},
        {"$set": {"skill_levels": skill_levels}}
    )
    
    return {
        "success": True,
        "skill_id": skill_id,
        "new_level": current_level + 1,
        "essence_spent": cost,
    }

# ==================== STAR PROMOTION ====================

@router.post("/{username}/hero/{hero_instance_id}/promote")
async def promote_hero(username: str, hero_instance_id: str):
    """Promote a hero's star rank using Star Crystals"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    current_stars = hero.get("stars", 0)
    
    if current_stars >= 6:
        raise HTTPException(status_code=400, detail="Hero is already max stars")
    
    cost = STAR_PROMOTION_COSTS.get(current_stars, 9999)
    
    if user.get("star_crystals", 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough Star Crystals. Need {cost}")
    
    # Deduct and promote
    await db.users.update_one(
        {"username": username},
        {"$inc": {"star_crystals": -cost}}
    )
    
    await db.user_heroes.update_one(
        {"id": hero_instance_id},
        {"$inc": {"stars": 1}}
    )
    
    return {
        "success": True,
        "new_stars": current_stars + 1,
        "crystals_spent": cost,
    }

# ==================== HERO DISMANTLING ====================

@router.post("/{username}/hero/dismantle")
async def dismantle_heroes(username: str, hero_instance_ids: list):
    """Dismantle heroes to get Star Crystals"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not hero_instance_ids:
        raise HTTPException(status_code=400, detail="No heroes selected")
    
    total_crystals = 0
    dismantled = []
    
    for hero_id in hero_instance_ids:
        hero = await db.user_heroes.find_one({"id": hero_id, "user_id": user["id"]})
        if not hero:
            continue
        
        if hero.get("is_locked", False):
            continue  # Skip locked heroes
        
        # Get hero rarity
        hero_data = await db.heroes.find_one({"id": hero["hero_id"]})
        if not hero_data:
            continue
        
        rarity = hero_data.get("rarity", "SR")
        crystals = DUPLICATE_CONVERSION.get(rarity, 10)
        
        # Bonus for duplicates
        duplicates = hero.get("duplicates", 0)
        crystals += duplicates * (crystals // 2)
        
        total_crystals += crystals
        dismantled.append({
            "hero_id": hero_id,
            "rarity": rarity,
            "crystals": crystals,
        })
        
        # Delete hero
        await db.user_heroes.delete_one({"id": hero_id})
    
    if total_crystals > 0:
        await db.users.update_one(
            {"username": username},
            {"$inc": {"star_crystals": total_crystals}}
        )
    
    return {
        "success": True,
        "heroes_dismantled": len(dismantled),
        "total_star_crystals": total_crystals,
        "details": dismantled,
    }

# ==================== STAGE REWARDS ====================

@router.get("/stage-costs")
async def get_stage_costs():
    """Get stamina costs for all stage types"""
    return STAMINA_COSTS

@router.post("/{username}/claim-stage-rewards")
async def claim_stage_rewards(username: str, stage_type: str, stage_id: str = "1"):
    """Claim rewards from completing a stage"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Define stage rewards based on type
    stage_rewards = {
        "exp_stage": {
            "soul_dust": lambda: 500 + int(stage_id) * 100,
            "gold": lambda: 1000 + int(stage_id) * 200,
        },
        "gold_stage": {
            "gold": lambda: 5000 + int(stage_id) * 500,
        },
        "skill_dungeon": {
            "skill_essence": lambda: 50 + int(stage_id) * 20,
            "gold": lambda: 2000,
        },
        "equipment_dungeon": {
            "enhancement_stones": lambda: 10 + int(stage_id) * 5,
            "gold": lambda: 3000,
        },
    }
    
    rewards_config = stage_rewards.get(stage_type)
    if not rewards_config:
        raise HTTPException(status_code=400, detail=f"Unknown stage type: {stage_type}")
    
    # Calculate rewards
    rewards = {}
    updates = {}
    for currency, calc in rewards_config.items():
        amount = calc()
        rewards[currency] = amount
        updates[currency] = amount
    
    # Apply rewards
    await db.users.update_one(
        {"username": username},
        {"$inc": updates}
    )
    
    return {
        "success": True,
        "stage_type": stage_type,
        "rewards": rewards,
    }
