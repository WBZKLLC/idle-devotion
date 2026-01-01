"""
Admin Router - Modular admin functionality
Extracted from server.py for better code organization
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

router = APIRouter(prefix="/admin", tags=["admin"])

# Database reference will be injected
db = None

def set_database(database):
    """Set the database reference - called from main server"""
    global db
    db = database

@router.get("/users")
async def list_users(admin_key: str, limit: int = 50, skip: int = 0):
    """Admin endpoint to list all users"""
    admin_user = await db.users.find_one({"username": admin_key})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cursor = db.users.find({}, {
        "username": 1, "vip_level": 1, "gems": 1, "coins": 1, "gold": 1,
        "created_at": 1, "is_banned": 1, "is_muted": 1, "total_spent": 1,
        "login_days": 1, "is_admin": 1
    }).skip(skip).limit(limit)
    
    users = []
    async for user in cursor:
        if "_id" in user:
            del user["_id"]
        users.append(user)
    
    total = await db.users.count_documents({})
    
    return {
        "users": users,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@router.post("/user/{username}/action")
async def admin_user_action(username: str, admin_key: str, action: str, params: Dict = None):
    """Universal admin action endpoint"""
    admin_user = await db.users.find_one({"username": admin_key})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    params = params or {}
    
    if action == "grant_resources":
        resources = params.get("resources", {})
        await db.users.update_one({"username": username}, {"$inc": resources})
        return {"success": True, "action": action, "granted": resources}
    
    elif action == "set_vip":
        vip_level = params.get("vip_level", 0)
        await db.users.update_one(
            {"username": username},
            {"$set": {"vip_level": vip_level, "is_admin_set_vip": True}}
        )
        return {"success": True, "action": action, "vip_level": vip_level}
    
    elif action == "ban":
        reason = params.get("reason", "Violation of terms")
        if "ban" not in admin_user.get("admin_permissions", ["ban", "mute", "delete_account"]):
            raise HTTPException(status_code=403, detail="No ban permission")
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_banned": True, "ban_reason": reason, "banned_at": datetime.utcnow().isoformat(), "banned_by": admin_key}}
        )
        return {"success": True, "action": action, "banned": username, "reason": reason}
    
    elif action == "unban":
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_banned": False}, "$unset": {"ban_reason": "", "banned_at": "", "banned_by": ""}}
        )
        return {"success": True, "action": action, "unbanned": username}
    
    elif action == "mute":
        duration_hours = params.get("duration_hours", 24)
        if "mute" not in admin_user.get("admin_permissions", ["ban", "mute", "delete_account"]):
            raise HTTPException(status_code=403, detail="No mute permission")
        mute_until = datetime.utcnow() + timedelta(hours=duration_hours)
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_muted": True, "muted_until": mute_until.isoformat(), "muted_by": admin_key}}
        )
        return {"success": True, "action": action, "muted": username, "until": mute_until.isoformat()}
    
    elif action == "unmute":
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_muted": False}, "$unset": {"muted_until": "", "muted_by": ""}}
        )
        return {"success": True, "action": action, "unmuted": username}
    
    elif action == "delete_account":
        if "delete_account" not in admin_user.get("admin_permissions", ["ban", "mute", "delete_account"]):
            raise HTTPException(status_code=403, detail="No delete permission")
        
        user_id = user["id"]
        await db.users.delete_one({"username": username})
        await db.user_heroes.delete_many({"user_id": user_id})
        await db.user_equipment.delete_many({"owner_id": user_id})
        await db.abyss_progress.delete_many({"user_id": user_id})
        await db.stage_progress.delete_many({"user_id": user_id})
        await db.campaign_progress.delete_many({"user_id": user_id})
        
        return {"success": True, "action": action, "deleted": username}
    
    elif action == "reset_pity":
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "pity_counter": 0,
                "pity_counter_premium": 0,
                "pity_counter_divine": 0,
                "event_banner_pity": 0
            }}
        )
        return {"success": True, "action": action, "reset": "pity counters"}
    
    elif action == "grant_admin":
        if not admin_user.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Super admin required")
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_admin": True, "admin_permissions": ["ban", "mute", "delete_account"]}}
        )
        return {"success": True, "action": action, "granted_admin": username}
    
    elif action == "revoke_admin":
        if not admin_user.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Super admin required")
        await db.users.update_one(
            {"username": username},
            {"$set": {"is_admin": False}, "$unset": {"admin_permissions": ""}}
        )
        return {"success": True, "action": action, "revoked_admin": username}
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

@router.get("/stats")
async def admin_get_stats(admin_key: str):
    """Get game statistics"""
    admin_user = await db.users.find_one({"username": admin_key})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    active_today = await db.users.count_documents({
        "last_login": {"$gte": (datetime.utcnow() - timedelta(days=1)).isoformat()}
    })
    total_vip = await db.users.count_documents({"vip_level": {"$gt": 0}})
    banned_users = await db.users.count_documents({"is_banned": True})
    
    # Revenue stats (simulated)
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$total_spent"}}}
    ]
    result = await db.users.aggregate(pipeline).to_list(1)
    total_revenue = result[0]["total"] if result else 0
    
    return {
        "total_users": total_users,
        "active_today": active_today,
        "total_vip_users": total_vip,
        "banned_users": banned_users,
        "total_revenue": total_revenue,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/servers")
async def admin_get_servers(admin_key: str):
    """Get server list and status"""
    admin_user = await db.users.find_one({"username": admin_key})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Simulated server data
    servers = [
        {"id": "server_1", "name": "Celestial Realm", "status": "online", "players": 12453, "region": "NA"},
        {"id": "server_2", "name": "Divine Kingdom", "status": "online", "players": 8921, "region": "EU"},
        {"id": "server_3", "name": "Sacred Grounds", "status": "online", "players": 15678, "region": "ASIA"},
        {"id": "server_4", "name": "Holy Empire", "status": "maintenance", "players": 0, "region": "NA"},
    ]
    
    return {"servers": servers, "total": len(servers)}

@router.post("/broadcast")
async def admin_broadcast(admin_key: str, message: str, channel: str = "world"):
    """Send a broadcast message to all players"""
    admin_user = await db.users.find_one({"username": admin_key})
    if not admin_user or not admin_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Store broadcast in chat collection
    broadcast = {
        "type": "system_broadcast",
        "channel": channel,
        "message": message,
        "sender": "SYSTEM",
        "admin": admin_key,
        "timestamp": datetime.utcnow().isoformat()
    }
    await db.chat_messages.insert_one(broadcast)
    
    return {"success": True, "broadcast": message, "channel": channel}
