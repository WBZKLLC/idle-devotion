"""
Guild Router - Guild management, boss battles, donations, and guild wars
Extracted from server.py for better modularity
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import Optional
import random
import uuid

from dotenv import load_dotenv
load_dotenv()

# Create router
router = APIRouter(prefix="/api", tags=["guild"])

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


# Guild Boss Templates
GUILD_BOSS_TEMPLATES = [
    {
        "id": "boss_ancient_dragon",
        "name": "Ancient Dragon",
        "tier": 1,
        "element": "fire",
        "base_hp": 500000,
        "base_atk": 5000,
        "rewards": {"coins": 50000, "gold": 25000, "guild_coins": 500}
    },
    {
        "id": "boss_shadow_king",
        "name": "Shadow King",
        "tier": 2,
        "element": "dark",
        "base_hp": 1000000,
        "base_atk": 8000,
        "rewards": {"coins": 100000, "gold": 50000, "guild_coins": 1000}
    },
    {
        "id": "boss_celestial_guardian",
        "name": "Celestial Guardian",
        "tier": 3,
        "element": "light",
        "base_hp": 2000000,
        "base_atk": 12000,
        "rewards": {"coins": 200000, "gold": 100000, "guild_coins": 2000, "crystals": 50}
    },
]


def get_boss_for_guild_level(guild_level: int):
    """Get appropriate boss template based on guild level"""
    if guild_level >= 10:
        return GUILD_BOSS_TEMPLATES[2]  # Tier 3
    elif guild_level >= 5:
        return GUILD_BOSS_TEMPLATES[1]  # Tier 2
    else:
        return GUILD_BOSS_TEMPLATES[0]  # Tier 1


@router.post("/guild/create")
async def create_guild(username: str, guild_name: str):
    """Create a new guild"""
    from server import Guild
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already in a guild
    existing_guild = await db.guilds.find_one({"member_ids": user["id"]})
    if existing_guild:
        raise HTTPException(status_code=400, detail="Already in a guild")
    
    # Check if guild name exists
    existing_name = await db.guilds.find_one({"name": guild_name})
    if existing_name:
        raise HTTPException(status_code=400, detail="Guild name already taken")
    
    guild = Guild(
        name=guild_name,
        leader_id=user["id"],
        member_ids=[user["id"]],
        server_id=user.get("server_id", "server_1")
    )
    
    await db.guilds.insert_one(guild.dict())
    
    return convert_objectid(guild.dict())


@router.post("/guild/join")
async def join_guild(username: str, guild_id: str):
    """Join a guild"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"id": guild_id})
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")
    
    if user["id"] in guild.get("member_ids", []):
        raise HTTPException(status_code=400, detail="Already in this guild")
    
    await db.guilds.update_one(
        {"id": guild_id},
        {"$addToSet": {"member_ids": user["id"]}}
    )
    
    return {"message": "Joined guild successfully"}


@router.get("/guild/{username}")
async def get_user_guild(username: str):
    """Get user's guild"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    
    if not guild:
        return None
    
    # Enrich with member details
    members = []
    for member_id in guild.get("member_ids", []):
        member = await db.users.find_one({"id": member_id})
        if member:
            members.append({
                "username": member["username"],
                "user_id": member["id"],
                "vip_level": member.get("vip_level", 0)
            })
    
    guild_data = convert_objectid(guild)
    guild_data["members"] = members
    guild_data["member_count"] = len(members)
    
    return guild_data


@router.get("/guilds")
async def list_guilds(limit: int = 20, skip: int = 0):
    """List available guilds to join"""
    guilds = await db.guilds.find().skip(skip).limit(limit).to_list(length=limit)
    
    result = []
    for guild in guilds:
        guild_data = convert_objectid(guild)
        guild_data["member_count"] = len(guild.get("member_ids", []))
        result.append(guild_data)
    
    return result


@router.post("/guild/leave")
async def leave_guild(username: str):
    """Leave current guild"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find user's guild
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    # Check if user is leader
    if guild.get("leader_id") == user["id"]:
        # If leader and only member, delete guild
        if len(guild.get("member_ids", [])) == 1:
            await db.guilds.delete_one({"id": guild["id"]})
            return {"message": "Guild disbanded"}
        else:
            raise HTTPException(status_code=400, detail="Transfer leadership before leaving")
    
    # Remove user from guild
    await db.guilds.update_one(
        {"id": guild["id"]},
        {"$pull": {"member_ids": user["id"]}}
    )
    
    return {"message": "Left guild successfully"}


@router.get("/guild/{username}/boss")
async def get_guild_boss(username: str):
    """Get current guild boss status"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find user's guild
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    # Get or create guild boss state
    boss_state = await db.guild_bosses.find_one({"guild_id": guild["id"], "defeated": False})
    
    if not boss_state:
        # Spawn new boss based on guild level
        guild_level = guild.get("level", 1)
        boss_template = get_boss_for_guild_level(guild_level)
        
        level_multiplier = 1 + (guild_level - 1) * 0.15
        
        boss_state = {
            "id": str(uuid.uuid4()),
            "guild_id": guild["id"],
            "boss_id": boss_template["id"],
            "boss_name": boss_template["name"],
            "tier": boss_template["tier"],
            "element": boss_template["element"],
            "max_hp": int(boss_template["base_hp"] * level_multiplier),
            "current_hp": int(boss_template["base_hp"] * level_multiplier),
            "atk": int(boss_template["base_atk"] * level_multiplier),
            "rewards": boss_template["rewards"],
            "damage_contributors": {},
            "spawn_time": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
            "defeated": False
        }
        
        await db.guild_bosses.insert_one(boss_state)
    
    return convert_objectid(boss_state)


@router.post("/guild/{username}/boss/attack")
async def attack_guild_boss(username: str):
    """Attack the guild boss (limited daily attacks based on VIP level)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    # Calculate max daily attacks based on VIP level
    vip_level = user.get("vip_level", 0)
    max_attacks = 3  # Base attacks
    if vip_level >= 15:
        max_attacks += 4  # +2 at VIP 15
    elif vip_level >= 11:
        max_attacks += 2  # +2 at VIP 11
    elif vip_level >= 9:
        max_attacks += 2  # +1 at VIP 9, +1 at VIP 7
    elif vip_level >= 7:
        max_attacks += 1  # +1 at VIP 7
    
    # Check/reset daily attacks
    today = datetime.utcnow().date()
    last_reset = user.get("guild_boss_attack_last_reset")
    attacks_today = user.get("guild_boss_attacks_today", 0)
    
    if last_reset:
        last_reset_date = last_reset.date() if isinstance(last_reset, datetime) else datetime.fromisoformat(str(last_reset)).date()
        if last_reset_date < today:
            attacks_today = 0  # Reset for new day
    
    if attacks_today >= max_attacks:
        raise HTTPException(
            status_code=400, 
            detail=f"Daily boss attacks exhausted ({attacks_today}/{max_attacks}). VIP {7 if max_attacks == 3 else 'higher'} unlocks more attacks!"
        )
    
    boss_state = await db.guild_bosses.find_one({"guild_id": guild["id"], "defeated": False})
    if not boss_state:
        raise HTTPException(status_code=400, detail="No active boss")
    
    # Get user's team power - use embedded hero_data directly
    # Debug: Check if db is set
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
    
    # Debug: Log hero count
    print(f"[GUILD BOSS] User {username} has {len(user_heroes)} heroes")
    
    total_power = 0
    heroes_used = []
    
    for uh in user_heroes[:6]:
        # Use embedded hero_data from user_heroes document
        hero_data = uh.get("hero_data")
        if hero_data:
            level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
            power = (hero_data.get("base_hp", 1000) + hero_data.get("base_atk", 200) * 3 + hero_data.get("base_def", 100) * 2) * level_mult
            total_power += power
            heroes_used.append(hero_data.get("name", "Unknown Hero"))
    
    print(f"[GUILD BOSS] Total power calculated: {total_power}, Heroes used: {len(heroes_used)}")
    
    if total_power == 0:
        raise HTTPException(status_code=400, detail=f"No heroes to attack with. Found {len(user_heroes)} heroes but none have hero_data.")
    
    # Calculate damage (power-based with variance)
    base_damage = int(total_power * random.uniform(0.8, 1.2))
    is_critical = random.random() < 0.1
    damage = int(base_damage * (2.0 if is_critical else 1.0))
    
    # Apply damage
    new_hp = max(0, boss_state["current_hp"] - damage)
    defeated = new_hp <= 0
    
    # Track contribution
    contributors = boss_state.get("damage_contributors", {})
    contributors[user["id"]] = contributors.get(user["id"], 0) + damage
    
    await db.guild_bosses.update_one(
        {"id": boss_state["id"]},
        {
            "$set": {
                "current_hp": new_hp,
                "defeated": defeated,
                "damage_contributors": contributors
            }
        }
    )
    
    result = {
        "damage_dealt": damage,
        "is_critical": is_critical,
        "boss_hp_remaining": new_hp,
        "boss_max_hp": boss_state["max_hp"],
        "defeated": defeated,
        "heroes_used": heroes_used,
        "your_total_damage": contributors[user["id"]]
    }
    
    # If defeated, distribute rewards
    if defeated:
        total_damage = sum(contributors.values())
        base_rewards = boss_state.get("rewards", {})
        
        # Calculate user's share
        user_share = contributors.get(user["id"], 0) / max(total_damage, 1)
        user_rewards = {}
        
        for reward_type, amount in base_rewards.items():
            user_amount = int(amount * (0.2 + user_share * 0.8))  # Min 20% + share-based
            user_rewards[reward_type] = user_amount
            await db.users.update_one(
                {"username": username},
                {"$inc": {reward_type: user_amount}}
            )
        
        result["rewards"] = user_rewards
        result["contribution_percent"] = round(user_share * 100, 1)
    
    # Increment daily attack counter
    await db.users.update_one(
        {"username": username},
        {
            "$set": {"guild_boss_attack_last_reset": datetime.utcnow()},
            "$inc": {"guild_boss_attacks_today": 1}
        }
    )
    
    # Add attack info to result
    result["attacks_used"] = attacks_today + 1
    result["attacks_max"] = max_attacks
    result["attacks_remaining"] = max_attacks - (attacks_today + 1)
    
    return result


@router.post("/guild/{username}/donate")
async def donate_to_guild(username: str, currency_type: str = "coins", amount: int = 1000):
    """Donate currency to guild"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    if currency_type not in ["coins", "gold"]:
        raise HTTPException(status_code=400, detail="Can only donate coins or gold")
    
    if user.get(currency_type, 0) < amount:
        raise HTTPException(status_code=400, detail=f"Not enough {currency_type}")
    
    # Deduct from user
    await db.users.update_one(
        {"username": username},
        {"$inc": {currency_type: -amount}}
    )
    
    # Add to guild treasury
    await db.guilds.update_one(
        {"id": guild["id"]},
        {
            "$inc": {
                f"treasury_{currency_type}": amount,
                "total_donations": amount,
                "exp": amount // 100  # Guild gains XP from donations
            }
        }
    )
    
    # Track individual contribution
    await db.guild_donations.insert_one({
        "id": str(uuid.uuid4()),
        "guild_id": guild["id"],
        "user_id": user["id"],
        "username": username,
        "currency_type": currency_type,
        "amount": amount,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Reward donor with guild points
    guild_points = amount // 50
    await db.users.update_one(
        {"username": username},
        {"$inc": {"guild_points": guild_points}}
    )
    
    return {
        "success": True,
        "donated": amount,
        "currency_type": currency_type,
        "guild_points_earned": guild_points,
        "guild_treasury": {
            "coins": guild.get("treasury_coins", 0) + (amount if currency_type == "coins" else 0),
            "gold": guild.get("treasury_gold", 0) + (amount if currency_type == "gold" else 0)
        }
    }


@router.get("/guild/{username}/donations")
async def get_guild_donations(username: str, limit: int = 20):
    """Get recent guild donations"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    donations = await db.guild_donations.find(
        {"guild_id": guild["id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "donations": [convert_objectid(d) for d in donations],
        "treasury": {
            "coins": guild.get("treasury_coins", 0),
            "gold": guild.get("treasury_gold", 0)
        },
        "total_donated": guild.get("total_donations", 0)
    }
