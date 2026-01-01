"""
Campaign Router - Story Campaign functionality
Extracted from server.py for better code organization
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict, List, Optional
import random

router = APIRouter(prefix="/campaign", tags=["campaign"])

# Database reference will be injected
db = None

# Import campaign data
from core.campaign import (
    CHAPTER_DATA, generate_stage_data, generate_stage_rewards,
    CHAPTER_DIALOGUES, CHAPTER_UNLOCKS, TUTORIAL_STAGES,
    calculate_stage_difficulty
)

def set_database(database):
    """Set the database reference - called from main server"""
    global db
    db = database

@router.get("/chapters")
async def get_campaign_chapters(username: str):
    """Get all campaign chapters with unlock status"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's campaign progress
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "completed_stages": {},  # {"chapter_stage": {"stars": 3, "cleared": True}}
            "current_chapter": 1,
            "highest_stage": {"chapter": 1, "stage": 1}
        }
        await db.campaign_progress.insert_one(progress)
    
    chapters = []
    for chapter_id, chapter_info in CHAPTER_DATA.items():
        # Count cleared stages for this chapter
        chapter_prefix = f"{chapter_id}_"
        cleared_count = sum(1 for k in progress.get("completed_stages", {}).keys() if k.startswith(chapter_prefix))
        total_stages = 21  # 20 regular + 1 boss
        
        # Check if chapter is unlocked
        is_unlocked = chapter_id <= progress.get("current_chapter", 1)
        if chapter_id > 1:
            prev_chapter = f"{chapter_id - 1}_boss"
            is_unlocked = prev_chapter in progress.get("completed_stages", {})
        
        chapters.append({
            "id": chapter_id,
            "name": chapter_info["name"],
            "subtitle": chapter_info.get("subtitle", ""),
            "description": chapter_info.get("description", ""),
            "act": chapter_info.get("act", 1),
            "unlocked": is_unlocked,
            "cleared_stages": cleared_count,
            "total_stages": total_stages,
            "progress_percent": round((cleared_count / total_stages) * 100, 1),
            "recommended_power": chapter_info.get("recommended_power", 1000 * chapter_id),
            "rewards_preview": chapter_info.get("rewards_preview", ["Gold", "Hero Shards", "Equipment"])
        })
    
    return {
        "chapters": chapters,
        "current_chapter": progress.get("current_chapter", 1),
        "total_stars": sum(s.get("stars", 0) for s in progress.get("completed_stages", {}).values())
    }

@router.get("/chapter/{chapter_id}")
async def get_chapter_detail(chapter_id: int, username: str):
    """Get detailed info about a specific chapter"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if chapter_id not in CHAPTER_DATA:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    chapter_info = CHAPTER_DATA[chapter_id]
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {"completed_stages": {}}
    
    # Generate stages
    stages = []
    for stage_num in range(1, 22):  # 1-20 regular + boss at 21
        stage_key = f"{chapter_id}_{stage_num}"
        stage_data = progress.get("completed_stages", {}).get(stage_key, {})
        
        is_boss = stage_num == 21
        is_cleared = stage_data.get("cleared", False)
        stars = stage_data.get("stars", 0)
        
        # Check if stage is unlocked
        is_unlocked = stage_num == 1
        if stage_num > 1:
            prev_key = f"{chapter_id}_{stage_num - 1}"
            is_unlocked = prev_key in progress.get("completed_stages", {})
        
        # First stage of chapter 1 is always unlocked
        if chapter_id == 1 and stage_num == 1:
            is_unlocked = True
        
        stage_info = generate_stage_data(chapter_id, stage_num)
        
        stages.append({
            "stage_num": stage_num,
            "name": stage_info["name"],
            "is_boss": is_boss,
            "unlocked": is_unlocked,
            "cleared": is_cleared,
            "stars": stars,
            "enemies": stage_info.get("enemies", []),
            "rewards": generate_stage_rewards(chapter_id, stage_num, is_first_clear=not is_cleared),
            "stamina_cost": 6 if not is_boss else 12,
            "recommended_power": calculate_stage_difficulty(chapter_id, stage_num)
        })
    
    # Get chapter dialogues
    dialogues = CHAPTER_DIALOGUES.get(chapter_id, {})
    
    return {
        "chapter": {
            "id": chapter_id,
            "name": chapter_info["name"],
            "subtitle": chapter_info.get("subtitle", ""),
            "description": chapter_info.get("description", ""),
            "act": chapter_info.get("act", 1),
            "opening_dialogue": dialogues.get("opening", []),
            "closing_dialogue": dialogues.get("closing", [])
        },
        "stages": stages,
        "user_progress": {
            "total_stars": sum(s["stars"] for s in stages),
            "max_stars": len(stages) * 3,
            "cleared_stages": sum(1 for s in stages if s["cleared"])
        }
    }

@router.get("/stage/{chapter_id}/{stage_num}")
async def get_stage_detail(chapter_id: int, stage_num: int, username: str):
    """Get detailed info about a specific stage"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stage_data = generate_stage_data(chapter_id, stage_num)
    is_boss = stage_num == 21
    
    # Get user progress for this stage
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    stage_key = f"{chapter_id}_{stage_num}"
    stage_progress = progress.get("completed_stages", {}).get(stage_key, {}) if progress else {}
    
    return {
        "chapter_id": chapter_id,
        "stage_num": stage_num,
        "name": stage_data["name"],
        "is_boss": is_boss,
        "cleared": stage_progress.get("cleared", False),
        "best_stars": stage_progress.get("stars", 0),
        "enemies": stage_data.get("enemies", []),
        "waves": stage_data.get("waves", 1),
        "rewards": generate_stage_rewards(chapter_id, stage_num, is_first_clear=not stage_progress.get("cleared", False)),
        "first_clear_rewards": generate_stage_rewards(chapter_id, stage_num, is_first_clear=True),
        "stamina_cost": 6 if not is_boss else 12,
        "recommended_power": calculate_stage_difficulty(chapter_id, stage_num),
        "dialogue": CHAPTER_DIALOGUES.get(chapter_id, {}).get(f"stage_{stage_num}", [])
    }

@router.post("/stage/{chapter_id}/{stage_num}/complete")
async def complete_campaign_stage(chapter_id: int, stage_num: int, username: str, stars: int = 3):
    """Complete a campaign stage"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate stars
    stars = max(1, min(3, stars))
    
    # Get or create progress
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "completed_stages": {},
            "current_chapter": 1,
            "highest_stage": {"chapter": 1, "stage": 1}
        }
        await db.campaign_progress.insert_one(progress)
    
    stage_key = f"{chapter_id}_{stage_num}"
    existing_progress = progress.get("completed_stages", {}).get(stage_key, {})
    is_first_clear = not existing_progress.get("cleared", False)
    
    # Calculate rewards
    rewards = generate_stage_rewards(chapter_id, stage_num, is_first_clear=is_first_clear)
    
    # Update progress
    new_stars = max(existing_progress.get("stars", 0), stars)
    await db.campaign_progress.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                f"completed_stages.{stage_key}": {
                    "cleared": True,
                    "stars": new_stars,
                    "cleared_at": datetime.utcnow().isoformat()
                }
            }
        },
        upsert=True
    )
    
    # Apply rewards to user
    reward_update = {}
    for reward_type, amount in rewards.items():
        if reward_type in ["gold", "coins", "gems", "crystals"]:
            reward_update[reward_type] = amount
    
    if reward_update:
        await db.users.update_one({"username": username}, {"$inc": reward_update})
    
    # Check if this unlocks next chapter
    unlocked_chapter = None
    if stage_num == 21:  # Boss stage completed
        next_chapter = chapter_id + 1
        if next_chapter in CHAPTER_DATA:
            await db.campaign_progress.update_one(
                {"user_id": user["id"]},
                {"$set": {"current_chapter": next_chapter}}
            )
            unlocked_chapter = next_chapter
    
    return {
        "success": True,
        "stage": {"chapter": chapter_id, "stage": stage_num},
        "stars": new_stars,
        "is_first_clear": is_first_clear,
        "rewards": rewards,
        "unlocked_chapter": unlocked_chapter
    }

@router.post("/stage/{chapter_id}/{stage_num}/sweep")
async def sweep_campaign_stage(chapter_id: int, stage_num: int, username: str, count: int = 1):
    """Sweep a cleared stage multiple times"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if stage is cleared with 3 stars
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        raise HTTPException(status_code=400, detail="No progress found")
    
    stage_key = f"{chapter_id}_{stage_num}"
    stage_progress = progress.get("completed_stages", {}).get(stage_key, {})
    
    if not stage_progress.get("cleared"):
        raise HTTPException(status_code=400, detail="Stage not cleared yet")
    
    if stage_progress.get("stars", 0) < 3:
        raise HTTPException(status_code=400, detail="Need 3 stars to sweep")
    
    # Calculate stamina cost
    is_boss = stage_num == 21
    stamina_per_run = 12 if is_boss else 6
    total_stamina = stamina_per_run * count
    
    if user.get("stamina", 0) < total_stamina:
        raise HTTPException(status_code=400, detail="Insufficient stamina")
    
    # Calculate total rewards
    total_rewards = {}
    for _ in range(count):
        rewards = generate_stage_rewards(chapter_id, stage_num, is_first_clear=False)
        for reward_type, amount in rewards.items():
            total_rewards[reward_type] = total_rewards.get(reward_type, 0) + amount
    
    # Apply rewards and deduct stamina
    reward_update = {"stamina": -total_stamina}
    for reward_type, amount in total_rewards.items():
        if reward_type in ["gold", "coins", "gems", "crystals"]:
            reward_update[reward_type] = reward_update.get(reward_type, 0) + amount
    
    await db.users.update_one({"username": username}, {"$inc": reward_update})
    
    return {
        "success": True,
        "sweep_count": count,
        "stamina_used": total_stamina,
        "total_rewards": total_rewards
    }
