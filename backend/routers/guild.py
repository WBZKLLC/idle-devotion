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
async def donate_to_guild(username: str, tier: str = "small"):
    """
    Donate to guild using tiered system
    Tiers:
    - small: 10,000 Gold → 10 Guild Coins, 50 Guild EXP
    - medium: 50 Gems → 60 Guild Coins, 300 Guild EXP
    - large: 1 Summon Scroll → 200 Guild Coins, 1000 Guild EXP
    """
    from core.guild_system import DONATION_TIERS, DAILY_DONATION_LIMIT
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    if tier not in DONATION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Choose: small, medium, large")
    
    donation_config = DONATION_TIERS[tier]
    cost_type = donation_config["cost_type"]
    cost_amount = donation_config["cost_amount"]
    guild_coins_reward = donation_config["guild_coins_reward"]
    guild_exp_reward = donation_config["guild_exp_reward"]
    
    # Check daily donation limit
    today = datetime.utcnow().date().isoformat()
    donation_count = await db.guild_donations.count_documents({
        "user_id": user["id"],
        "guild_id": guild["id"],
        "date": today
    })
    
    if donation_count >= DAILY_DONATION_LIMIT:
        raise HTTPException(status_code=400, detail=f"Daily donation limit reached ({DAILY_DONATION_LIMIT}/day)")
    
    # Map cost_type to user field
    user_field_map = {
        "gold": "gold",
        "gems": "gems", 
        "summon_scrolls": "summon_scrolls"
    }
    user_field = user_field_map.get(cost_type, cost_type)
    
    if user.get(user_field, 0) < cost_amount:
        raise HTTPException(status_code=400, detail=f"Not enough {cost_type}. Need {cost_amount}")
    
    # Deduct from user
    await db.users.update_one(
        {"username": username},
        {"$inc": {
            user_field: -cost_amount,
            "guild_coins": guild_coins_reward
        }}
    )
    
    # Add EXP to guild and update level
    new_guild_exp = guild.get("exp", 0) + guild_exp_reward
    
    # Calculate new level
    from core.guild_system import get_guild_level, get_guild_member_cap, GUILD_LEVELS
    new_level = get_guild_level(new_guild_exp)
    old_level = guild.get("level", 1)
    leveled_up = new_level > old_level
    
    # Update guild
    await db.guilds.update_one(
        {"id": guild["id"]},
        {
            "$inc": {
                "exp": guild_exp_reward,
                "total_donations": guild_exp_reward,
                "funds": guild_coins_reward  # Guild funds for tech tree
            },
            "$set": {
                "level": new_level,
                "member_cap": get_guild_member_cap(new_level)
            }
        }
    )
    
    # If guild leveled up, distribute rewards to ALL members
    level_up_rewards = None
    if leveled_up:
        level_config = GUILD_LEVELS.get(new_level, {})
        level_up_rewards = level_config.get("level_up_reward", {"gold": 5000, "guild_coins": 50})
        
        # Get all member IDs
        member_ids = guild.get("member_ids", [])
        
        # Distribute rewards to each member
        for member_id in member_ids:
            await db.users.update_one(
                {"id": member_id},
                {"$inc": {
                    "gold": level_up_rewards.get("gold", 5000),
                    "guild_coins": level_up_rewards.get("guild_coins", 50)
                }}
            )
        
        # Record the level-up event
        await db.guild_level_ups.insert_one({
            "id": str(uuid.uuid4()),
            "guild_id": guild["id"],
            "guild_name": guild.get("name"),
            "old_level": old_level,
            "new_level": new_level,
            "rewards_distributed": level_up_rewards,
            "members_rewarded": len(member_ids),
            "triggered_by": username,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Track individual contribution
    await db.guild_donations.insert_one({
        "id": str(uuid.uuid4()),
        "guild_id": guild["id"],
        "user_id": user["id"],
        "username": username,
        "tier": tier,
        "cost_type": cost_type,
        "cost_amount": cost_amount,
        "guild_coins_earned": guild_coins_reward,
        "guild_exp_earned": guild_exp_reward,
        "date": today,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Track weekly contribution for leaderboard
    week_start = (datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())).date().isoformat()
    await db.guild_weekly_contributions.update_one(
        {"user_id": user["id"], "guild_id": guild["id"], "week_start": week_start},
        {
            "$inc": {"total_exp": guild_exp_reward, "donation_count": 1},
            "$set": {"username": username}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "tier": tier,
        "donated": f"{cost_amount} {cost_type}",
        "guild_coins_earned": guild_coins_reward,
        "guild_exp_earned": guild_exp_reward,
        "donations_today": donation_count + 1,
        "donations_remaining": DAILY_DONATION_LIMIT - donation_count - 1,
        "guild_level": new_level,
        "leveled_up": leveled_up,
        "level_up_message": f"Guild leveled up to {new_level}!" if leveled_up else None,
        "level_up_rewards": level_up_rewards if leveled_up else None
    }



@router.get("/guild/{username}/level-info")
async def get_guild_level_info(username: str):
    """Get guild level, unlocks, and progression info"""
    from core.guild_system import GUILD_LEVELS, get_guild_level, get_exp_to_next_level, get_guild_buffs, get_unlocked_features
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    current_exp = guild.get("exp", 0)
    current_level = get_guild_level(current_exp)
    exp_to_next = get_exp_to_next_level(current_exp, current_level)
    
    level_config = GUILD_LEVELS.get(current_level, {})
    next_level_config = GUILD_LEVELS.get(current_level + 1, {})
    
    return {
        "guild_name": guild.get("name"),
        "level": current_level,
        "exp": current_exp,
        "exp_to_next_level": exp_to_next,
        "next_level_exp_required": next_level_config.get("exp_required", 0),
        "member_cap": level_config.get("member_cap", 15),
        "member_count": len(guild.get("member_ids", [])),
        "current_buff": level_config.get("buff"),
        "all_buffs": get_guild_buffs(current_level),
        "unlocked_features": get_unlocked_features(current_level),
        "level_description": level_config.get("description", ""),
        "funds": guild.get("funds", 0),
        "total_donations": guild.get("total_donations", 0),
        "max_level": 10,
        "is_max_level": current_level >= 10
    }


@router.get("/guild/{username}/shop")
async def get_guild_shop(username: str):
    """Get available guild shop items based on guild level"""
    from core.guild_system import GUILD_SHOP_ITEMS, get_guild_level
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    guild_level = get_guild_level(guild.get("exp", 0))
    user_guild_coins = user.get("guild_coins", 0)
    
    # Get week start for stock tracking
    week_start = (datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())).date().isoformat()
    
    # Get user's purchases this week
    purchases = await db.guild_shop_purchases.find({
        "user_id": user["id"],
        "week_start": week_start
    }).to_list(100)
    
    purchase_counts = {}
    for p in purchases:
        item_id = p["item_id"]
        purchase_counts[item_id] = purchase_counts.get(item_id, 0) + p.get("quantity", 1)
    
    available_items = []
    for item in GUILD_SHOP_ITEMS:
        if item["required_level"] <= guild_level:
            purchased_this_week = purchase_counts.get(item["id"], 0)
            available_items.append({
                **item,
                "can_afford": user_guild_coins >= item["price"],
                "stock_remaining": max(0, item["stock_weekly"] - purchased_this_week),
                "purchased_this_week": purchased_this_week
            })
    
    return {
        "guild_level": guild_level,
        "user_guild_coins": user_guild_coins,
        "items": available_items,
        "week_reset": week_start
    }


@router.post("/guild/{username}/shop/buy")
async def buy_guild_shop_item(username: str, item_id: str, quantity: int = 1):
    """Purchase item from guild shop"""
    from core.guild_system import GUILD_SHOP_ITEMS, get_guild_level
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    # Find the item
    item = next((i for i in GUILD_SHOP_ITEMS if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    guild_level = get_guild_level(guild.get("exp", 0))
    if item["required_level"] > guild_level:
        raise HTTPException(status_code=400, detail=f"Guild level {item['required_level']} required")
    
    total_cost = item["price"] * quantity
    if user.get("guild_coins", 0) < total_cost:
        raise HTTPException(status_code=400, detail=f"Not enough guild coins. Need {total_cost}")
    
    # Check weekly stock
    week_start = (datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())).date().isoformat()
    purchases = await db.guild_shop_purchases.find({
        "user_id": user["id"],
        "item_id": item_id,
        "week_start": week_start
    }).to_list(100)
    
    purchased_count = sum(p.get("quantity", 1) for p in purchases)
    if purchased_count + quantity > item["stock_weekly"]:
        raise HTTPException(status_code=400, detail=f"Weekly stock limit reached. {item['stock_weekly'] - purchased_count} remaining")
    
    # Deduct guild coins
    await db.users.update_one(
        {"username": username},
        {"$inc": {"guild_coins": -total_cost}}
    )
    
    # Grant reward
    reward_type = item["reward_type"]
    reward_value = item["reward_value"] * quantity
    
    if reward_type in ["gold", "gems", "coins", "stamina", "divine_essence", "skill_essence", "enhancement_stones"]:
        await db.users.update_one(
            {"username": username},
            {"$inc": {reward_type: reward_value}}
        )
    elif reward_type == "summon_scrolls":
        await db.users.update_one(
            {"username": username},
            {"$inc": {"summon_scrolls": reward_value}}
        )
    elif reward_type == "hero_shard":
        # Random SSR/UR shard
        pass  # Would need hero shard system
    elif reward_type == "frame":
        await db.user_frames.update_one(
            {"user_id": user["id"], "frame_id": reward_value},
            {"$set": {"unlocked": True, "unlocked_at": datetime.utcnow().isoformat()}},
            upsert=True
        )
    
    # Record purchase
    await db.guild_shop_purchases.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "item_id": item_id,
        "quantity": quantity,
        "cost": total_cost,
        "week_start": week_start,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {
        "success": True,
        "item": item["name"],
        "quantity": quantity,
        "cost": total_cost,
        "reward": f"{reward_value} {reward_type}",
        "guild_coins_remaining": user.get("guild_coins", 0) - total_cost
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
