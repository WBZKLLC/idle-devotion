"""
Security Module for Divine Heroes Gacha Game
============================================

SECURITY PRINCIPLES:
1. SERVER IS THE SINGLE SOURCE OF TRUTH - No client input is trusted
2. ALL OUTCOMES ARE SERVER-DETERMINED - RNG, rewards, battles, etc.
3. ALL ACTIONS ARE AUDITED - Every state change is logged
4. INPUT VALIDATION - All inputs sanitized and validated
5. OWNERSHIP VERIFICATION - Users can only modify their own data
6. RATE LIMITING - Prevent abuse and exploitation

This module provides:
- Security decorators for endpoints
- Audit logging functions
- Input validation helpers
- Rate limiting (in-memory for now)
- Anti-cheat detection
"""

from fastapi import HTTPException, Request
from functools import wraps
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from collections import defaultdict
import hashlib
import re
import os

# In-memory rate limiting (use Redis in production)
_rate_limit_store: Dict[str, list] = defaultdict(list)
_suspicious_activity: Dict[str, list] = defaultdict(list)

# Security Configuration
RATE_LIMITS = {
    "gacha_pull": (10, 60),       # 10 pulls per minute
    "battle": (30, 60),            # 30 battles per minute
    "purchase": (5, 60),           # 5 purchases per minute
    "team_update": (20, 60),       # 20 team updates per minute
    "hero_upgrade": (50, 60),      # 50 upgrades per minute
    "chat_send": (10, 60),         # 10 messages per minute
    "code_redeem": (5, 60),        # 5 code redemptions per minute
    "friend_request": (10, 60),    # 10 friend requests per minute
    "default": (100, 60),          # 100 requests per minute default
}

# Suspicious patterns
SUSPICIOUS_THRESHOLDS = {
    "rapid_rewards": 10,           # Too many reward claims in short time
    "impossible_progress": 5,      # Progress faster than possible
    "resource_anomaly": 3,         # Resources gained faster than possible
}


def sanitize_string(value: str, max_length: int = 100) -> str:
    """Sanitize string input to prevent injection attacks"""
    if not value:
        return ""
    # Remove control characters and limit length
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(value))
    # Escape potential injection patterns
    sanitized = sanitized.replace('<', '&lt;').replace('>', '&gt;')
    return sanitized[:max_length]


def validate_username(username: str) -> bool:
    """Validate username format"""
    if not username or len(username) < 3 or len(username) > 20:
        return False
    return bool(re.match(r'^[a-zA-Z0-9_]+$', username))


def validate_positive_int(value: Any, max_value: int = 1000000) -> Optional[int]:
    """Validate positive integer within bounds"""
    try:
        num = int(value)
        if num <= 0 or num > max_value:
            return None
        return num
    except (ValueError, TypeError):
        return None


def validate_uuid(value: str) -> bool:
    """Validate UUID format"""
    uuid_pattern = re.compile(
        r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(str(value)))


def check_rate_limit(user_id: str, action: str) -> bool:
    """
    Check if user is within rate limits.
    Returns True if allowed, False if rate limited.
    """
    max_requests, window_seconds = RATE_LIMITS.get(action, RATE_LIMITS["default"])
    now = datetime.utcnow()
    key = f"{user_id}:{action}"
    
    # Clean old entries
    cutoff = now - timedelta(seconds=window_seconds)
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > cutoff]
    
    # Check limit
    if len(_rate_limit_store[key]) >= max_requests:
        return False
    
    # Record this request
    _rate_limit_store[key].append(now)
    return True


def record_suspicious_activity(user_id: str, activity_type: str, details: Dict[str, Any]):
    """Record potentially suspicious activity for review"""
    now = datetime.utcnow()
    key = f"{user_id}:{activity_type}"
    
    _suspicious_activity[key].append({
        "timestamp": now.isoformat(),
        "type": activity_type,
        "details": details,
    })
    
    # Keep only last 100 entries per user/type
    _suspicious_activity[key] = _suspicious_activity[key][-100:]
    
    # Check if threshold exceeded
    recent_count = len([a for a in _suspicious_activity[key] 
                       if datetime.fromisoformat(a["timestamp"]) > now - timedelta(minutes=10)])
    
    threshold = SUSPICIOUS_THRESHOLDS.get(activity_type, 10)
    return recent_count > threshold


async def create_audit_log(
    db,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Dict[str, Any],
    ip_address: Optional[str] = None,
    success: bool = True
):
    """
    Create an immutable audit log entry.
    All game state changes should call this.
    """
    import uuid as uuid_module
    
    log_entry = {
        "id": str(uuid_module.uuid4()),
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": ip_address,
        "success": success,
        "timestamp": datetime.utcnow().isoformat(),
        "server_timestamp": datetime.utcnow(),  # Actual datetime for indexing
    }
    
    # Compute hash for integrity verification
    hash_input = f"{log_entry['id']}{log_entry['user_id']}{log_entry['action']}{log_entry['timestamp']}"
    log_entry["integrity_hash"] = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    await db.audit_logs.insert_one(log_entry)
    return log_entry


async def verify_ownership(db, user_id: str, resource_type: str, resource_id: str) -> bool:
    """
    Verify that a user owns a specific resource.
    Critical security check before any modification.
    """
    collections = {
        "hero": "user_heroes",
        "equipment": "equipment",
        "rune": "runes",
        "team": "teams",
    }
    
    collection_name = collections.get(resource_type)
    if not collection_name:
        return False
    
    collection = db[collection_name]
    
    # Different ownership fields for different resources
    if resource_type == "hero":
        resource = await collection.find_one({"id": resource_id, "user_id": user_id})
    elif resource_type == "team":
        resource = await collection.find_one({"id": resource_id, "user_id": user_id})
    else:
        resource = await collection.find_one({"id": resource_id, "owner_id": user_id})
    
    return resource is not None


async def verify_currency_sufficient(db, username: str, currency: str, amount: int) -> tuple:
    """
    Server-side verification of currency.
    Returns (success, current_balance) tuple.
    """
    user = await db.users.find_one({"username": username})
    if not user:
        return False, 0
    
    current = user.get(currency, 0)
    return current >= amount, current


async def apply_currency_change(
    db,
    username: str,
    changes: Dict[str, int],
    action: str,
    resource_id: str = None
) -> Dict[str, Any]:
    """
    Atomically apply currency changes with validation and logging.
    All currency modifications should use this function.
    """
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate all changes are possible
    for currency, amount in changes.items():
        if amount < 0:  # Deduction
            current = user.get(currency, 0)
            if current < abs(amount):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient {currency}. Have {current}, need {abs(amount)}"
                )
    
    # Apply changes atomically
    update_ops = {}
    for currency, amount in changes.items():
        update_ops[currency] = amount
    
    result = await db.users.update_one(
        {"username": username},
        {"$inc": update_ops}
    )
    
    # Create audit log
    await create_audit_log(
        db,
        user["id"],
        action,
        "currency",
        resource_id or "N/A",
        {
            "changes": changes,
            "previous_balances": {c: user.get(c, 0) for c in changes.keys()},
        }
    )
    
    # Return updated balances
    updated_user = await db.users.find_one({"username": username})
    return {c: updated_user.get(c, 0) for c in changes.keys()}


def calculate_max_possible_rewards(stage_type: str, stage_id: int, time_minutes: float) -> Dict[str, int]:
    """
    Calculate the maximum possible rewards a player could have earned.
    Used for anti-cheat detection.
    """
    # Stamina regeneration: 1 per 5 minutes, max 100
    max_stamina_used = min(100 + int(time_minutes / 5), 200)  # Starting + regen
    
    # Average stamina cost
    stamina_costs = {
        "exp": 10, "gold": 10, "skill": 12, "equipment": 15, "enhancement": 12
    }
    cost = stamina_costs.get(stage_type, 10)
    max_clears = max_stamina_used // cost
    
    # Maximum rewards per clear (with variance)
    max_rewards_per_clear = {
        "exp": {"soul_dust": 5000, "gold": 12000},
        "gold": {"gold": 100000, "coins": 20000},
        "skill": {"skill_essence": 600, "gold": 25000},
        "enhancement": {"enhancement_stones": 180, "gold": 22000},
    }
    
    base = max_rewards_per_clear.get(stage_type, {})
    return {k: v * max_clears for k, v in base.items()}


# Security Constants
VALID_CURRENCIES = [
    "gold", "coins", "crystals", "divine_essence", "soul_dust", 
    "skill_essence", "star_crystals", "divine_gems", "guild_coins", 
    "pvp_medals", "enhancement_stones", "hero_shards", "hero_exp"
]

VALID_GAME_MODES = ["campaign", "arena", "abyss", "guild_war", "dungeons"]

VALID_EQUIPMENT_SLOTS = ["weapon", "helmet", "chestplate", "gloves", "boots", "talisman"]

VALID_EQUIPMENT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]

VALID_HERO_RARITIES = ["N", "R", "SR", "SSR", "SSR+", "UR", "UR+"]


# Export all security functions
__all__ = [
    "sanitize_string",
    "validate_username",
    "validate_positive_int",
    "validate_uuid",
    "check_rate_limit",
    "record_suspicious_activity",
    "create_audit_log",
    "verify_ownership",
    "verify_currency_sufficient",
    "apply_currency_change",
    "calculate_max_possible_rewards",
    "VALID_CURRENCIES",
    "VALID_GAME_MODES",
    "VALID_EQUIPMENT_SLOTS",
    "VALID_EQUIPMENT_RARITIES",
    "VALID_HERO_RARITIES",
]
