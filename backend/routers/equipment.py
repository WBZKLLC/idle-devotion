"""Equipment system router"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
import random
import uuid
from datetime import datetime

from ..core.database import db, convert_objectid
from ..core.config import (
    EQUIPMENT_SLOTS, EQUIPMENT_SLOT_STATS, EQUIPMENT_RARITIES,
    EQUIPMENT_RARITY_MULTIPLIERS, EQUIPMENT_BASE_STATS, EQUIPMENT_MAX_LEVEL,
    EQUIPMENT_ENHANCE_COSTS, EQUIPMENT_SETS, RUNE_TYPES, RUNE_RARITIES,
    SOCKET_REQUIREMENTS
)
from ..models.requests import EquipRequest, EnhanceEquipmentRequest, SocketRuneRequest

router = APIRouter(prefix="/equipment", tags=["Equipment"])

# ==================== EQUIPMENT GENERATION ====================

def generate_equipment(
    slot: str,
    rarity: str = "common",
    set_id: Optional[str] = None,
    owner_id: Optional[str] = None
) -> dict:
    """Generate a new piece of equipment"""
    base_stats = EQUIPMENT_BASE_STATS.get(slot, {})
    primary_stat = EQUIPMENT_SLOT_STATS.get(slot, "atk")
    rarity_mult = EQUIPMENT_RARITY_MULTIPLIERS.get(rarity, 1.0)
    
    # Calculate primary stat value
    base_value = base_stats.get(primary_stat, 50)
    primary_value = int(base_value * rarity_mult)
    
    # Generate sub stats for rare+ equipment
    sub_stats = {}
    if rarity in ["rare", "epic", "legendary"]:
        num_substats = {"rare": 1, "epic": 2, "legendary": 3}.get(rarity, 0)
        possible_substats = ["atk_percent", "hp_percent", "def_percent", "speed", "crit_rate", "crit_dmg"]
        for _ in range(num_substats):
            stat = random.choice([s for s in possible_substats if s not in sub_stats])
            # Random value between 1-5% for percentage stats
            value = round(random.uniform(1, 5), 1)
            sub_stats[stat] = value
    
    # Determine sockets
    sockets = SOCKET_REQUIREMENTS.get(rarity, 0)
    
    # Generate name
    set_prefix = EQUIPMENT_SETS.get(set_id, {}).get("name", "").split()[0] if set_id else ""
    rarity_prefix = {"common": "", "uncommon": "Fine", "rare": "Superior", "epic": "Epic", "legendary": "Legendary"}.get(rarity, "")
    slot_name = slot.capitalize()
    name = f"{rarity_prefix} {set_prefix} {slot_name}".strip()
    
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "slot": slot,
        "rarity": rarity,
        "set_id": set_id,
        "level": 1,
        "max_level": EQUIPMENT_MAX_LEVEL,
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

def generate_rune(rune_type: str, rarity: str = "common", owner_id: Optional[str] = None) -> dict:
    """Generate a new rune"""
    rune_config = RUNE_TYPES.get(rune_type)
    if not rune_config:
        rune_type = random.choice(list(RUNE_TYPES.keys()))
        rune_config = RUNE_TYPES[rune_type]
    
    tier = RUNE_RARITIES.index(rarity) + 1 if rarity in RUNE_RARITIES else 1
    tier = min(tier, 5)
    
    stat = rune_config["stat"]
    value = rune_config["values"][tier - 1]
    
    name = f"{rarity.capitalize()} {rune_type.capitalize()} Rune"
    
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "rune_type": rune_type,
        "rarity": rarity,
        "tier": tier,
        "stat": stat,
        "value": value,
        "owner_id": owner_id,
        "equipped_on": None,
        "created_at": datetime.utcnow().isoformat(),
    }

# ==================== API ENDPOINTS ====================

@router.get("/{username}")
async def get_user_equipment(username: str):
    """Get all equipment owned by user"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    equipment = await db.equipment.find({"owner_id": user["id"]}).to_list(1000)
    return [convert_objectid(e) for e in equipment]

@router.get("/{username}/runes")
async def get_user_runes(username: str):
    """Get all runes owned by user"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    runes = await db.runes.find({"owner_id": user["id"]}).to_list(1000)
    return [convert_objectid(r) for r in runes]

@router.post("/{username}/equip")
async def equip_item(username: str, request: EquipRequest):
    """Equip an item to a hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find equipment
    equipment = await db.equipment.find_one({"id": request.equipment_id, "owner_id": user["id"]})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Find hero
    hero = await db.user_heroes.find_one({"id": request.hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    slot = equipment["slot"]
    
    # Unequip current item in slot if any
    current_equipped_id = hero.get("equipment", {}).get(slot)
    if current_equipped_id:
        await db.equipment.update_one(
            {"id": current_equipped_id},
            {"$set": {"equipped_by": None}}
        )
    
    # If equipment was equipped elsewhere, unequip it
    if equipment.get("equipped_by"):
        old_hero = await db.user_heroes.find_one({"id": equipment["equipped_by"]})
        if old_hero:
            old_equipment = old_hero.get("equipment", {})
            old_equipment[slot] = None
            await db.user_heroes.update_one(
                {"id": equipment["equipped_by"]},
                {"$set": {"equipment": old_equipment}}
            )
    
    # Equip new item
    hero_equipment = hero.get("equipment", {})
    hero_equipment[slot] = request.equipment_id
    
    await db.user_heroes.update_one(
        {"id": request.hero_instance_id},
        {"$set": {"equipment": hero_equipment}}
    )
    
    await db.equipment.update_one(
        {"id": request.equipment_id},
        {"$set": {"equipped_by": request.hero_instance_id}}
    )
    
    return {"success": True, "message": f"Equipped {equipment['name']} to hero"}

@router.post("/{username}/unequip")
async def unequip_item(username: str, equipment_id: str, hero_instance_id: str):
    """Unequip an item from a hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    equipment = await db.equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    slot = equipment["slot"]
    hero_equipment = hero.get("equipment", {})
    hero_equipment[slot] = None
    
    await db.user_heroes.update_one(
        {"id": hero_instance_id},
        {"$set": {"equipment": hero_equipment}}
    )
    
    await db.equipment.update_one(
        {"id": equipment_id},
        {"$set": {"equipped_by": None}}
    )
    
    return {"success": True, "message": f"Unequipped {equipment['name']}"}

@router.post("/{username}/enhance")
async def enhance_equipment(username: str, request: EnhanceEquipmentRequest):
    """Enhance equipment using gold and enhancement stones"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    equipment = await db.equipment.find_one({"id": request.equipment_id, "owner_id": user["id"]})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    current_level = equipment.get("level", 1)
    target_level = min(current_level + request.levels, EQUIPMENT_MAX_LEVEL)
    
    if current_level >= EQUIPMENT_MAX_LEVEL:
        raise HTTPException(status_code=400, detail="Equipment is already max level")
    
    # Calculate total cost
    total_gold = 0
    total_stones = 0
    for lvl in range(current_level, target_level):
        costs = EQUIPMENT_ENHANCE_COSTS.get(lvl + 1, (1000, 5))
        total_gold += costs[0]
        total_stones += costs[1]
    
    # Check resources
    if user.get("gold", 0) < total_gold:
        raise HTTPException(status_code=400, detail=f"Not enough gold. Need {total_gold}")
    if user.get("enhancement_stones", 0) < total_stones:
        raise HTTPException(status_code=400, detail=f"Not enough enhancement stones. Need {total_stones}")
    
    # Calculate new primary value
    rarity_mult = EQUIPMENT_RARITY_MULTIPLIERS.get(equipment["rarity"], 1.0)
    base_value = equipment["primary_value"] / (1 + (current_level - 1) * 0.1)  # Get original base
    new_value = int(base_value * (1 + (target_level - 1) * 0.1))
    
    # Deduct resources and update equipment
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gold": -total_gold, "enhancement_stones": -total_stones}}
    )
    
    await db.equipment.update_one(
        {"id": request.equipment_id},
        {"$set": {"level": target_level, "primary_value": new_value}}
    )
    
    return {
        "success": True,
        "new_level": target_level,
        "new_primary_value": new_value,
        "gold_spent": total_gold,
        "stones_spent": total_stones,
    }

@router.post("/{username}/socket-rune")
async def socket_rune(username: str, request: SocketRuneRequest):
    """Socket a rune into equipment"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    equipment = await db.equipment.find_one({"id": request.equipment_id, "owner_id": user["id"]})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    rune = await db.runes.find_one({"id": request.rune_id, "owner_id": user["id"]})
    if not rune:
        raise HTTPException(status_code=404, detail="Rune not found")
    
    # Check if equipment has sockets
    if equipment.get("sockets", 0) <= 0:
        raise HTTPException(status_code=400, detail="Equipment has no sockets")
    
    equipped_runes = equipment.get("equipped_runes", [])
    if len(equipped_runes) >= equipment["sockets"]:
        raise HTTPException(status_code=400, detail="All sockets are filled")
    
    # Check if rune is already socketed elsewhere
    if rune.get("equipped_on"):
        raise HTTPException(status_code=400, detail="Rune is already socketed in another item")
    
    # Socket the rune
    equipped_runes.append(request.rune_id)
    
    await db.equipment.update_one(
        {"id": request.equipment_id},
        {"$set": {"equipped_runes": equipped_runes}}
    )
    
    await db.runes.update_one(
        {"id": request.rune_id},
        {"$set": {"equipped_on": request.equipment_id}}
    )
    
    return {"success": True, "message": f"Socketed {rune['name']} into {equipment['name']}"}

@router.post("/{username}/unsocket-rune")
async def unsocket_rune(username: str, equipment_id: str, rune_id: str):
    """Remove a rune from equipment"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    equipment = await db.equipment.find_one({"id": equipment_id, "owner_id": user["id"]})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipped_runes = equipment.get("equipped_runes", [])
    if rune_id not in equipped_runes:
        raise HTTPException(status_code=400, detail="Rune is not socketed in this equipment")
    
    equipped_runes.remove(rune_id)
    
    await db.equipment.update_one(
        {"id": equipment_id},
        {"$set": {"equipped_runes": equipped_runes}}
    )
    
    await db.runes.update_one(
        {"id": rune_id},
        {"$set": {"equipped_on": None}}
    )
    
    return {"success": True, "message": "Rune removed"}

@router.get("/sets/info")
async def get_equipment_sets_info():
    """Get information about all equipment sets"""
    return EQUIPMENT_SETS

@router.post("/{username}/craft")
async def craft_equipment(username: str, slot: str, rarity: str = "common", set_id: Optional[str] = None):
    """Craft a new piece of equipment (for testing/rewards)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if slot not in EQUIPMENT_SLOTS:
        raise HTTPException(status_code=400, detail=f"Invalid slot. Must be one of: {EQUIPMENT_SLOTS}")
    
    if rarity not in EQUIPMENT_RARITIES:
        raise HTTPException(status_code=400, detail=f"Invalid rarity. Must be one of: {EQUIPMENT_RARITIES}")
    
    if set_id and set_id not in EQUIPMENT_SETS:
        raise HTTPException(status_code=400, detail=f"Invalid set. Must be one of: {list(EQUIPMENT_SETS.keys())}")
    
    equipment = generate_equipment(slot, rarity, set_id, user["id"])
    await db.equipment.insert_one(equipment)
    
    return {"success": True, "equipment": equipment}

@router.post("/{username}/craft-rune")
async def craft_rune(username: str, rune_type: Optional[str] = None, rarity: str = "common"):
    """Craft a new rune (for testing/rewards)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if rune_type and rune_type not in RUNE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid rune type. Must be one of: {list(RUNE_TYPES.keys())}")
    
    if rarity not in RUNE_RARITIES:
        raise HTTPException(status_code=400, detail=f"Invalid rarity. Must be one of: {RUNE_RARITIES}")
    
    if not rune_type:
        rune_type = random.choice(list(RUNE_TYPES.keys()))
    
    rune = generate_rune(rune_type, rarity, user["id"])
    await db.runes.insert_one(rune)
    
    return {"success": True, "rune": rune}

@router.get("/{username}/hero/{hero_instance_id}/equipped")
async def get_hero_equipped(username: str, hero_instance_id: str):
    """Get all equipment currently equipped on a hero"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    equipped = {}
    hero_equipment = hero.get("equipment", {})
    
    for slot, equipment_id in hero_equipment.items():
        if equipment_id:
            equipment = await db.equipment.find_one({"id": equipment_id})
            if equipment:
                equipped[slot] = convert_objectid(equipment)
    
    # Calculate set bonuses
    set_counts = {}
    for slot, equip in equipped.items():
        if equip and equip.get("set_id"):
            set_id = equip["set_id"]
            set_counts[set_id] = set_counts.get(set_id, 0) + 1
    
    active_bonuses = {}
    for set_id, count in set_counts.items():
        set_data = EQUIPMENT_SETS.get(set_id, {})
        bonuses = set_data.get("bonuses", {})
        for piece_count, bonus in bonuses.items():
            if count >= piece_count:
                for stat, value in bonus.items():
                    active_bonuses[stat] = active_bonuses.get(stat, 0) + value
    
    return {
        "equipped": equipped,
        "set_counts": set_counts,
        "active_bonuses": active_bonuses,
    }
