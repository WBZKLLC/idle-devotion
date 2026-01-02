"""
Hero Progression Router - Star Promotion, Rarity Ascension, Shard Management
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Optional
import uuid

from dotenv import load_dotenv
load_dotenv()

# Import progression system
from core.hero_progression import (
    RARITY_MULTIPLIERS,
    STARTING_STARS,
    MAX_STARS,
    DUPLICATE_SHARD_YIELD,
    STAR_PROMOTION_CONFIG,
    ASCENSION_CONFIG,
    calculate_star_multiplier,
    calculate_final_stat,
    calculate_hero_power,
    can_promote_star,
    get_promotion_cost,
    can_ascend_rarity,
    get_ascension_info,
    handle_duplicate_pull,
    get_level_cap,
    get_unlocked_skills,
    get_max_skill_level,
    get_hero_progression_summary,
    calculate_copies_needed
)

# Create router
router = APIRouter(prefix="/api/hero", tags=["hero-progression"])

# Database will be set from main server
db = None


def set_database(database):
    """Set the database instance from main server"""
    global db
    db = database


def convert_objectid(doc):
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [convert_objectid(d) for d in doc]
    if isinstance(doc, dict):
        return {k: (str(v) if k == "_id" else convert_objectid(v)) for k, v in doc.items()}
    return doc


# =============================================================================
# SHARD MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/{username}/shards")
async def get_hero_shards(username: str):
    """Get all hero shards for a user"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    shards = await db.hero_shards.find({"user_id": user["id"]}).to_list(1000)
    
    # Enrich with hero data
    enriched = []
    for shard in shards:
        hero = await db.heroes.find_one({"id": shard["hero_id"]})
        if hero:
            enriched.append({
                "hero_id": shard["hero_id"],
                "hero_name": hero.get("name", "Unknown"),
                "rarity": hero.get("rarity", "SR"),
                "shard_count": shard.get("shard_count", 0),
                "image_url": hero.get("image_url")
            })
    
    return {
        "shards": enriched,
        "total_heroes_with_shards": len(enriched)
    }


@router.get("/{username}/shards/{hero_id}")
async def get_specific_hero_shards(username: str, hero_id: str):
    """Get shard count for a specific hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    shard_entry = await db.hero_shards.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    return {
        "hero_id": hero_id,
        "shard_count": shard_entry.get("shard_count", 0) if shard_entry else 0
    }


# =============================================================================
# STAR PROMOTION ENDPOINTS
# =============================================================================

@router.get("/{username}/hero/{hero_id}/progression")
async def get_hero_progression(username: str, hero_id: str):
    """Get full progression info for a hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find user's hero
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not owned")
    
    hero_data = user_hero.get("hero_data", {})
    if not hero_data:
        hero_data = await db.heroes.find_one({"id": hero_id})
    
    # Get shard count
    shard_entry = await db.hero_shards.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    shards = shard_entry.get("shard_count", 0) if shard_entry else 0
    
    # Get progression summary
    rarity = hero_data.get("rarity", "SR")
    stars = user_hero.get("stars", STARTING_STARS.get(rarity, 1))
    level = user_hero.get("level", 1)
    
    summary = get_hero_progression_summary(
        hero_name=hero_data.get("name", "Unknown"),
        rarity=rarity,
        stars=stars,
        shards=shards,
        level=level
    )
    
    # Add current stats
    summary["current_stats"] = {
        "hp": calculate_final_stat(hero_data.get("base_hp", 1000), rarity, stars, level),
        "atk": calculate_final_stat(hero_data.get("base_atk", 100), rarity, stars, level),
        "def": calculate_final_stat(hero_data.get("base_def", 100), rarity, stars, level),
        "speed": calculate_final_stat(hero_data.get("base_speed", 100), rarity, stars, level),
        "power": calculate_hero_power(
            hero_data.get("base_hp", 1000),
            hero_data.get("base_atk", 100),
            hero_data.get("base_def", 100),
            hero_data.get("base_speed", 100),
            rarity, stars, level
        )
    }
    
    # Add next star preview stats
    if summary["next_promotion"]:
        next_stars = stars + 1
        summary["next_star_stats"] = {
            "hp": calculate_final_stat(hero_data.get("base_hp", 1000), rarity, next_stars, level),
            "atk": calculate_final_stat(hero_data.get("base_atk", 100), rarity, next_stars, level),
            "def": calculate_final_stat(hero_data.get("base_def", 100), rarity, next_stars, level),
            "speed": calculate_final_stat(hero_data.get("base_speed", 100), rarity, next_stars, level),
        }
    
    summary["user_gold"] = user.get("gold", 0)
    summary["celestial_sparks"] = user.get("celestial_sparks", 0)
    summary["divine_essence"] = user.get("divine_essence", 0)
    
    return summary


@router.post("/{username}/hero/{hero_id}/promote")
async def promote_hero_star(username: str, hero_id: str):
    """Promote a hero to the next star level"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find user's hero
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not owned")
    
    hero_data = user_hero.get("hero_data", {})
    rarity = hero_data.get("rarity", "SR")
    current_stars = user_hero.get("stars", STARTING_STARS.get(rarity, 1))
    
    # Get shard count
    shard_entry = await db.hero_shards.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    shards = shard_entry.get("shard_count", 0) if shard_entry else 0
    
    # Get promotion config
    config = STAR_PROMOTION_CONFIG.get(current_stars)
    if not config:
        raise HTTPException(status_code=400, detail="Cannot promote further")
    
    # Check requirements
    can_do, message = can_promote_star(
        current_stars, rarity, shards, 
        user.get("gold", 0),
        user.get("celestial_sparks", 0)
    )
    
    if not can_do:
        raise HTTPException(status_code=400, detail=message)
    
    # Deduct costs
    new_stars = current_stars + 1
    shard_cost = config["shard_cost"]
    gold_cost = config["gold_cost"]
    spark_cost = config.get("celestial_sparks", 0)
    
    # Update shard count
    await db.hero_shards.update_one(
        {"user_id": user["id"], "hero_id": hero_id},
        {"$inc": {"shard_count": -shard_cost}}
    )
    
    # Update user gold and sparks
    update_user = {"$inc": {"gold": -gold_cost}}
    if spark_cost > 0:
        update_user["$inc"]["celestial_sparks"] = -spark_cost
    await db.users.update_one({"username": username}, update_user)
    
    # Update hero stars and level cap
    new_level_cap = get_level_cap(new_stars, rarity)
    await db.user_heroes.update_one(
        {"user_id": user["id"], "hero_id": hero_id},
        {"$set": {
            "stars": new_stars,
            "max_level": new_level_cap
        }}
    )
    
    # Calculate new stats
    level = user_hero.get("level", 1)
    new_stats = {
        "hp": calculate_final_stat(hero_data.get("base_hp", 1000), rarity, new_stars, level),
        "atk": calculate_final_stat(hero_data.get("base_atk", 100), rarity, new_stars, level),
        "def": calculate_final_stat(hero_data.get("base_def", 100), rarity, new_stars, level),
        "speed": calculate_final_stat(hero_data.get("base_speed", 100), rarity, new_stars, level),
    }
    
    return {
        "success": True,
        "hero_name": hero_data.get("name"),
        "previous_stars": current_stars,
        "new_stars": new_stars,
        "stars_display": "★" * new_stars,
        "new_level_cap": new_level_cap,
        "stat_boost": f"+{int(config['stat_boost'] * 100)}%",
        "new_stats": new_stats,
        "skill_unlock": config.get("skill_unlock"),
        "shards_spent": shard_cost,
        "gold_spent": gold_cost,
        "message": f"🌟 {hero_data.get('name')} promoted to {new_stars}★!"
    }


# =============================================================================
# RARITY ASCENSION ENDPOINTS
# =============================================================================

@router.get("/{username}/hero/{hero_id}/ascension")
async def get_hero_ascension_info(username: str, hero_id: str):
    """Get ascension requirements for a hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not owned")
    
    hero_data = user_hero.get("hero_data", {})
    rarity = hero_data.get("rarity", "SR")
    stars = user_hero.get("stars", STARTING_STARS.get(rarity, 1))
    
    ascension_info = get_ascension_info(rarity)
    if not ascension_info:
        return {
            "can_ascend": False,
            "reason": f"{rarity} heroes cannot be ascended further",
            "current_rarity": rarity,
            "current_stars": stars
        }
    
    # Get shard count
    shard_entry = await db.hero_shards.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    shards = shard_entry.get("shard_count", 0) if shard_entry else 0
    
    can_ascend, message, _ = can_ascend_rarity(
        rarity, stars, shards,
        user.get("celestial_sparks", 0),
        user.get("divine_essence", 0),
        user.get("gold", 0)
    )
    
    return {
        "current_rarity": rarity,
        "current_stars": stars,
        "target_rarity": ascension_info["result_rarity"],
        "required_stars": ascension_info["required_stars"],
        "has_required_stars": stars >= ascension_info["required_stars"],
        "shard_cost": ascension_info["shard_cost"],
        "shards_owned": shards,
        "celestial_sparks_cost": ascension_info["celestial_sparks"],
        "celestial_sparks_owned": user.get("celestial_sparks", 0),
        "divine_essence_cost": ascension_info.get("divine_essence", 0),
        "divine_essence_owned": user.get("divine_essence", 0),
        "gold_cost": ascension_info["gold_cost"],
        "gold_owned": user.get("gold", 0),
        "can_ascend": can_ascend,
        "reason": message,
        "bonus_passive": ascension_info["bonus_passive"],
        "description": ascension_info["description"]
    }


@router.post("/{username}/hero/{hero_id}/ascend")
async def ascend_hero_rarity(username: str, hero_id: str):
    """Ascend a hero to the next rarity tier"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not owned")
    
    hero_data = user_hero.get("hero_data", {})
    rarity = hero_data.get("rarity", "SR")
    stars = user_hero.get("stars", STARTING_STARS.get(rarity, 1))
    
    # Get shard count
    shard_entry = await db.hero_shards.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    shards = shard_entry.get("shard_count", 0) if shard_entry else 0
    
    # Check if can ascend
    can_ascend, message, ascension_key = can_ascend_rarity(
        rarity, stars, shards,
        user.get("celestial_sparks", 0),
        user.get("divine_essence", 0),
        user.get("gold", 0)
    )
    
    if not can_ascend:
        raise HTTPException(status_code=400, detail=message)
    
    config = ASCENSION_CONFIG[ascension_key]
    new_rarity = config["result_rarity"]
    
    # Deduct costs
    await db.hero_shards.update_one(
        {"user_id": user["id"], "hero_id": hero_id},
        {"$inc": {"shard_count": -config["shard_cost"]}}
    )
    
    user_update = {
        "$inc": {
            "gold": -config["gold_cost"],
            "celestial_sparks": -config["celestial_sparks"]
        }
    }
    if config.get("divine_essence", 0) > 0:
        user_update["$inc"]["divine_essence"] = -config["divine_essence"]
    
    await db.users.update_one({"username": username}, user_update)
    
    # Update hero rarity
    await db.user_heroes.update_one(
        {"user_id": user["id"], "hero_id": hero_id},
        {"$set": {
            "hero_data.rarity": new_rarity,
            "awakened_passive": config["bonus_passive"],
            "ascension_date": datetime.utcnow().isoformat()
        }}
    )
    
    # Calculate new power
    level = user_hero.get("level", 1)
    new_power = calculate_hero_power(
        hero_data.get("base_hp", 1000),
        hero_data.get("base_atk", 100),
        hero_data.get("base_def", 100),
        hero_data.get("base_speed", 100),
        new_rarity, stars, level
    )
    
    return {
        "success": True,
        "hero_name": hero_data.get("name"),
        "previous_rarity": rarity,
        "new_rarity": new_rarity,
        "new_multiplier": RARITY_MULTIPLIERS[new_rarity],
        "bonus_passive": config["bonus_passive"],
        "new_power": new_power,
        "message": f"✨ {hero_data.get('name')} has ascended to {new_rarity}!"
    }


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@router.get("/config/rarities")
async def get_rarity_config():
    """Get all rarity configuration"""
    return {
        "multipliers": RARITY_MULTIPLIERS,
        "starting_stars": STARTING_STARS,
        "max_stars": MAX_STARS,
        "duplicate_shard_yield": DUPLICATE_SHARD_YIELD
    }


@router.get("/config/promotions")
async def get_promotion_config():
    """Get star promotion configuration"""
    return {
        "promotions": STAR_PROMOTION_CONFIG
    }


@router.get("/config/ascensions")
async def get_ascension_config():
    """Get rarity ascension configuration"""
    return {
        "ascensions": ASCENSION_CONFIG
    }


@router.get("/calculate-copies/{rarity}/{target_stars}")
async def calculate_copies_for_stars(rarity: str, target_stars: int):
    """Calculate how many copies needed to reach target stars"""
    copies = calculate_copies_needed(rarity, target_stars)
    return {
        "rarity": rarity,
        "target_stars": target_stars,
        "copies_needed": copies,
        "starting_stars": STARTING_STARS.get(rarity, 1),
        "note": f"Pull {copies} copies to reach {target_stars}★ (includes initial copy)"
    }
