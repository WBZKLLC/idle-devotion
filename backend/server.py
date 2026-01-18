from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime, timedelta, timezone
import random
from bson import ObjectId
import re
import asyncio
import json
from passlib.context import CryptContext
from jose import JWTError, jwt
import secrets

# Load environment variables FIRST
load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Import new modular routers
from routers import equipment as equipment_router
from routers import economy as economy_router
from routers import stages as stages_router
from routers import admin as admin_router
from routers import campaign as campaign_router
from routers import battle as battle_router
from routers import gacha as gacha_router
from routers import auth as auth_router
from routers import guild as guild_router
from routers import hero_progression as hero_progression_router

# Import security module
from core.security import (
    sanitize_string, validate_username, validate_positive_int, validate_uuid,
    check_rate_limit, record_suspicious_activity, create_audit_log,
    verify_ownership, verify_currency_sufficient, apply_currency_change,
    VALID_CURRENCIES, VALID_GAME_MODES, VALID_HERO_RARITIES
)

# Import game formulas module
from core.game_formulas import (
    calculate_gacha_rate_with_soft_pity, should_trigger_high_tier_pull,
    calculate_final_stat, calculate_hero_power, calculate_final_damage,
    calculate_rage_gained_from_damage, calculate_rage_gained_from_dealing,
    can_use_ultimate, MAX_RAGE, attempt_enhancement, get_enhancement_cost,
    get_shards_from_duplicate, can_promote_star, get_shards_required_for_promotion,
    ELEMENT_RESTRAINT, CLASS_RESTRAINT, STAR_MULTIPLIERS, AWAKENING_MULTIPLIERS,
    get_subscription_status, MONTHLY_CARD_CONFIG
)

# Import event banner system
from core.event_banners import (
    CRIMSON_ECLIPSE_BANNER, EVENT_MILESTONES, EVENT_SHOP,
    get_active_event_banner, perform_event_pull, get_milestone_rewards, get_shop_items
)

# Import player journey system
from core.player_journey import (
    FIRST_WEEK_JOURNEY, BEGINNER_MISSIONS, STARTER_PACKS,
    calculate_level_up_cost, calculate_enhancement_cost, calculate_skill_upgrade_cost,
    get_day_journey
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# =============================================================================
# SUPER ADMIN CONFIGURATION (Server-enforced, single admin)
# =============================================================================
# SECURITY: The super-admin canonical identity is HARDCODED - not configurable
# This ensures "adam" is ALWAYS the super-admin, regardless of env changes
SUPER_ADMIN_CANON = "adam"  # NEVER change this - hardcoded identity

# Display name only (for logging/UI) - changing this does NOT change who is admin
SUPER_ADMIN_DISPLAY_NAME = os.environ.get("SUPER_ADMIN_DISPLAY_NAME", "ADAM")

ADMIN_MFA_BYPASS = os.environ.get("ADMIN_MFA_BYPASS", "true").lower() == "true"  # Dev mode

# Bootstrap token for one-time ADAM creation (set in env, use once, then remove)
SUPER_ADMIN_BOOTSTRAP_TOKEN = os.environ.get("SUPER_ADMIN_BOOTSTRAP_TOKEN", None)

# Server dev mode - allows simulated purchases (MUST be false in production)
SERVER_DEV_MODE = os.environ.get("SERVER_DEV_MODE", "true").lower() == "true"

# =============================================================================
# PHASE 3.15: PRODUCTION ENVIRONMENT ASSERTIONS (P0 Revision A)
# =============================================================================
# When SERVER_DEV_MODE=false, the server REQUIRES payment verification secrets.
# This runs at MODULE LOAD TIME - before FastAPI app is created, before routes
# are wired, and before any requests can be served.
#
# FAIL-FAST: If required secrets are missing, the server will not start.

REVENUECAT_SECRET_KEY = os.environ.get("REVENUECAT_SECRET_KEY", None)
REVENUECAT_WEBHOOK_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET", None)

def assert_production_config():
    """
    FAIL-FAST: Validate production configuration at module load.
    If SERVER_DEV_MODE=false, payment verification secrets MUST be configured.
    
    This runs BEFORE the FastAPI app is created, ensuring the server
    cannot accept requests without proper security configuration.
    
    SECURITY: Never prints secret values, only their presence/absence.
    """
    missing = []
    warnings = []
    
    # REQUIRED secrets for production
    if not REVENUECAT_SECRET_KEY:
        missing.append("REVENUECAT_SECRET_KEY")
    if not REVENUECAT_WEBHOOK_SECRET:
        missing.append("REVENUECAT_WEBHOOK_SECRET")
    
    # RECOMMENDED: JWT_SECRET_KEY should be stable in production
    # (auto-generated is fine but changes on restart = token invalidation)
    jwt_key = os.environ.get("JWT_SECRET_KEY", None)
    if not jwt_key:
        warnings.append("JWT_SECRET_KEY not set (auto-generated key will invalidate tokens on restart)")
    
    # Print warnings (non-fatal)
    for warn in warnings:
        print(f"⚠️  {warn}")
    
    # Check for missing required secrets
    if missing:
        error_msg = (
            "\n🚨 PRODUCTION CONFIGURATION ERROR 🚨\n"
            "SERVER_DEV_MODE=false but missing required secrets:\n"
            + "\n".join(f"  • {s}" for s in missing) + "\n\n"
            "Production server CANNOT start without payment verification.\n"
            "Either set these environment variables or use SERVER_DEV_MODE=true for development.\n"
        )
        print(error_msg)
        raise RuntimeError("Production configuration incomplete - see above for details")
    
    print("✅ Production configuration validated: all required secrets present")

# =============================================================================
# STARTUP VALIDATION (runs at module load, before FastAPI app creation)
# =============================================================================
if SERVER_DEV_MODE:
    print("⚠️  SERVER_DEV_MODE=TRUE (simulated purchases ENABLED - do not use in production)")
else:
    print("🔒 SERVER_DEV_MODE=FALSE (simulated purchases DISABLED)")
    # Phase 3.15: Assert production config when not in dev mode
    # This will raise RuntimeError and prevent server from starting if secrets are missing
    assert_production_config()

# SECURITY: Reserved usernames that can NEVER be registered via normal registration
# "adam" is ALWAYS reserved - this is hardcoded and cannot be changed
RESERVED_USERNAMES_CANON = frozenset({SUPER_ADMIN_CANON})

# Security
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hash a password for storing"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create a JWT access token with unique token ID (jti) for traceability.
    
    CRITICAL: exp and iat are stored as integer UNIX timestamps (not datetimes).
    This ensures jwt.decode() returns consistent int types.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    jti = str(uuid.uuid4())  # Unique token ID for audit/revocation
    to_encode.update({
        "exp": int(expire.timestamp()),   # Integer UNIX timestamp
        "jti": jti,
        "iat": int(now.timestamp()),      # Integer UNIX timestamp
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return the payload (includes jti for audit)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# =============================================================================
# CENTRALIZED AUTH + REVOCATION GATE (Single Source of Truth)
# =============================================================================

def _to_dt_utc(ts) -> Optional[datetime]:
    """Convert timestamp to timezone-aware UTC datetime.
    
    Always returns timezone-aware UTC, never naive.
    Handles: int/float (unix timestamp), datetime (aware or naive).
    """
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(ts, datetime):
        # If naive, assume UTC; if aware, convert to UTC
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
    return None


def _normalize_dt_utc(dt) -> Optional[datetime]:
    """Normalize a value to timezone-aware UTC datetime.
    
    Defensive implementation that handles:
    - None: returns None
    - int/float: treats as UNIX timestamp, converts to aware UTC
    - naive datetime: assumes UTC, attaches tzinfo
    - aware datetime: converts to UTC
    - other types: returns None (does not raise)
    
    Used for values from MongoDB (may be naive) and for defensive
    handling on audit/revocation paths where crashes must be avoided.
    """
    if dt is None:
        return None
    if isinstance(dt, (int, float)):
        try:
            return datetime.fromtimestamp(dt, tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None  # Invalid timestamp
    if not isinstance(dt, datetime):
        return None  # Unknown type - return None safely
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def authenticate_request(
    credentials: Optional[HTTPAuthorizationCredentials],
    *,
    require_auth: bool,
) -> tuple:
    """
    Central auth + revocation gate. Single source of truth for all auth checks.
    
    Performs:
    1. JWT verification
    2. Validates jti and iat are present (required for revocation)
    3. UUID format validation
    4. User lookup by immutable ID
    5. Frozen account check
    6. tokens_valid_after check (mass revocation)
    7. Individual jti revocation check
    
    Args:
        credentials: HTTP Bearer credentials
        require_auth: If True, raises HTTPException on failure.
                      If False, returns (None, None) on failure.
    
    Returns:
        (user_dict, payload_dict) on success
        (None, None) on failure (if require_auth=False)
    
    Raises:
        HTTPException: On auth failure (if require_auth=True)
    """
    if not credentials:
        if require_auth:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return None, None
    
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        if require_auth:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return None, None
    
    user_id = payload.get("sub")
    jti = payload.get("jti")
    iat = payload.get("iat")
    exp = payload.get("exp")
    
    # Validate sub exists
    if not user_id:
        if require_auth:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return None, None
    
    # SECURITY: Require jti and iat for revocation checks
    # Tokens without these cannot be properly revoked/audited
    if not jti or iat is None:
        if require_auth:
            raise HTTPException(status_code=401, detail="Invalid token: missing required claims")
        return None, None
    
    # Validate sub is UUID format
    try:
        uuid.UUID(user_id)
    except (ValueError, TypeError):
        if require_auth:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return None, None
    
    # Load user by immutable UUID id
    user = await db.users.find_one({"id": user_id})
    if not user:
        if require_auth:
            raise HTTPException(status_code=401, detail="User not found")
        return None, None
    
    # SECURITY: Frozen account check
    if user.get("account_frozen"):
        if require_auth:
            raise HTTPException(status_code=403, detail="Account is frozen")
        return None, None
    
    # SECURITY: tokens_valid_after check (mass revocation)
    # Both datetimes normalized to timezone-aware UTC for consistent comparison
    token_iat_dt = _to_dt_utc(iat)
    if token_iat_dt is None:
        # iat exists but couldn't be converted (invalid format)
        if require_auth:
            raise HTTPException(status_code=401, detail="Invalid token: bad iat")
        return None, None
    
    tokens_valid_after = user.get("tokens_valid_after")
    if tokens_valid_after:
        tva = _normalize_dt_utc(tokens_valid_after)
        if token_iat_dt < tva:
            if require_auth:
                raise HTTPException(status_code=401, detail="Token has been revoked")
            return None, None
    
    # SECURITY: Individual jti revocation check
    if await is_token_revoked(jti):
        if require_auth:
            raise HTTPException(status_code=401, detail="Token has been revoked")
        return None, None
    
    # Attach auth context for downstream use (audit logging, etc.)
    user["_auth_jti"] = jti
    user["_auth_iat"] = iat
    user["_auth_exp"] = exp
    
    return user, payload


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current user from JWT token.
    
    Returns None on auth failure (for optional auth endpoints).
    Uses centralized authenticate_request() for all checks.
    """
    user, _ = await authenticate_request(credentials, require_auth=False)
    return user

# =============================================================================
# SUPER ADMIN HELPERS (Server-authoritative, JWT-bound)
# =============================================================================

def get_user_id(user: dict) -> str:
    """Standardized helper to get user ID from user dict (handles both 'id' and '_id')"""
    return str(user.get("id") or user.get("_id") or "")

def canonicalize_username(username: str) -> str:
    """Convert username to canonical form for lookups.
    Always lowercase, trimmed. This is the source of truth for identity.
    """
    return username.strip().lower()

def assert_account_active(user: dict):
    """
    Assert that a user account is not frozen.
    
    MUST be called on ALL mutation endpoints (economy, upgrades, purchases, etc.)
    to ensure frozen accounts cannot modify any state.
    
    Raises:
        HTTPException: 403 if account is frozen
    """
    if user.get("account_frozen"):
        raise HTTPException(
            status_code=403, 
            detail="Account is frozen. Contact support.",
            headers={"X-Frozen-Reason": "account_frozen"}
        )

async def get_user_for_mutation(username: str) -> dict:
    """
    Fetch a user by username for mutation operations.
    
    Combines user lookup + frozen account check in one call.
    Use this for all state-mutating endpoints (POST/PUT/PATCH/DELETE).
    
    Raises:
        HTTPException: 404 if user not found
        HTTPException: 403 if account is frozen
    """
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    assert_account_active(user)
    return user

async def get_user_readonly(username: str) -> dict:
    """
    Fetch a user by username for read-only operations.
    
    Does NOT check frozen status - frozen accounts can still view their data.
    Use this for GET endpoints.
    
    Raises:
        HTTPException: 404 if user not found
    """
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def is_super_admin(user: dict) -> bool:
    """Check if user is the super admin via canonical username.
    
    SECURITY: Uses hardcoded SUPER_ADMIN_CANON ("adam"), NOT an env var.
    This ensures the super-admin identity cannot be changed by config.
    """
    if not user:
        return False
    username_canon = user.get("username_canon") or ""
    return username_canon == SUPER_ADMIN_CANON


async def require_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency that requires the super admin (ADAM) to be authenticated.
    
    Uses centralized authenticate_request() for all auth + revocation checks,
    then additionally verifies the user is ADAM (via username_canon).
    
    Returns 401 if not logged in or token revoked.
    Returns 403 if logged in but not ADAM or account frozen.
    Returns the admin user dict if valid (includes _auth_* for audit).
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Optional: MFA check for production
    # if user.get("mfa_enabled") and not ADMIN_MFA_BYPASS:
    #     mfa_code = request.headers.get("X-Admin-MFA")
    #     if not validate_totp(user.get("mfa_secret"), mfa_code):
    #         raise HTTPException(status_code=403, detail="MFA required")
    
    return user

async def enforce_single_admin():
    """
    Startup safety check: Ensure only the user with username_canon=="adam" has is_admin=True.
    Any other user with is_admin=True gets it removed.
    
    SECURITY: Uses hardcoded SUPER_ADMIN_CANON, NOT an env var.
    """
    # Remove is_admin from ALL users first (clean slate)
    await db.users.update_many(
        {"is_admin": True},
        {"$set": {"is_admin": False}}
    )
    
    # Then set is_admin=True ONLY for username_canon=="adam" (hardcoded)
    result = await db.users.update_one(
        {"username_canon": SUPER_ADMIN_CANON},
        {"$set": {"is_admin": True}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Admin privileges granted to {SUPER_ADMIN_DISPLAY_NAME}")
    elif result.matched_count == 0:
        # SECURITY: No admin account exists - log warning, do NOT grant to anyone else
        print(f"⚠️ WARNING: No user with username_canon='{SUPER_ADMIN_CANON}' found. No admin granted.")
    
    # Log any users that had is_admin removed (for audit)
    # This is handled by the clean slate approach above

# =============================================================================
# GOD MODE AUDIT LOGGING
# =============================================================================

class AdminAuditLog(BaseModel):
    """Audit log entry for admin actions - production-grade traceability"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))  # Unique per-request correlation ID
    action_type: str  # set_currencies, set_vip, reset_user, ban_user, etc.
    issued_by: str  # Admin username (always ADAM)
    issued_by_user_id: Optional[str] = None  # Admin's UUID for extra traceability
    auth_jti: Optional[str] = None  # JWT token ID for session correlation / incident response
    target_username: str
    target_user_id: str
    fields_changed: dict = Field(default_factory=dict)  # {field: {old: x, new: y}}
    reason: Optional[str] = None
    request_ip: Optional[str] = None
    user_agent: Optional[str] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    batch_id: Optional[str] = None  # For batch operations (e.g., spawn_gift to all users)
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # Timezone-aware UTC


# =============================================================================
# TOKEN REVOCATION
# =============================================================================

class RevokedToken(BaseModel):
    """Revoked JWT token entry for surgical token invalidation"""
    jti: str  # Unique token ID from JWT
    user_id: str  # User whose token was revoked
    revoked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # Timezone-aware UTC
    expires_at: datetime  # When the original token would have expired (for TTL cleanup) - MUST be timezone-aware UTC
    reason: Optional[str] = None
    revoked_by: Optional[str] = None  # Admin who revoked (if admin action)


async def is_token_revoked(jti: str) -> bool:
    """Check if a specific token has been revoked by jti"""
    if not jti:
        return False
    revoked = await db.revoked_tokens.find_one({"jti": jti})
    return revoked is not None


async def revoke_token(
    jti: str, 
    user_id: str, 
    expires_at: datetime, 
    reason: str = None, 
    revoked_by: str = None
):
    """
    Revoke a specific token by jti.
    
    Only catches DuplicateKeyError (already revoked).
    Other DB failures will raise and must be handled by caller.
    
    expires_at MUST be timezone-aware UTC for TTL index to work correctly.
    If normalization fails, defaults to now + 8 days to ensure record persists.
    """
    from pymongo.errors import DuplicateKeyError
    
    # Ensure expires_at is timezone-aware UTC for TTL index
    # If normalization fails, use safe fallback (token TTL + buffer) to ensure
    # revocation record persists long enough to cover any valid token
    expires_at_utc = _normalize_dt_utc(expires_at)
    if expires_at_utc is None:
        expires_at_utc = datetime.now(timezone.utc) + timedelta(days=8)
    
    revoked = RevokedToken(
        jti=jti,
        user_id=user_id,
        expires_at=expires_at_utc,
        reason=reason,
        revoked_by=revoked_by,
        # revoked_at uses model default (datetime.now(timezone.utc))
    )
    try:
        result = await db.revoked_tokens.insert_one(revoked.dict())
        print(f"🔒 Token revoked: jti={jti[:12]}..., inserted_id={result.inserted_id}")
    except DuplicateKeyError:
        print(f"🔒 Token already revoked: jti={jti[:12]}...")
    except Exception as e:
        print(f"❌ Error revoking token: {e}")
        raise


async def revoke_all_user_tokens(user_id: str):
    """Revoke all tokens for a user by setting tokens_valid_after to now (timezone-aware UTC)"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"tokens_valid_after": datetime.now(timezone.utc)}}
    )

async def log_god_action(
    admin_user: dict,
    action_type: str,
    target_username: str,
    target_user_id: str,
    fields_changed: dict,
    reason: Optional[str] = None,
    request: Request = None,
    batch_id: Optional[str] = None,
    auth_jti: Optional[str] = None,
) -> AdminAuditLog:
    """
    Log a GOD MODE admin action with full audit trail.
    
    This creates a permanent record of every admin action for:
    - Security auditing
    - Rollback capabilities
    - Compliance requirements
    - Incident response (via request_id and auth_jti)
    
    Returns the log entry (includes request_id for response correlation).
    """
    log_entry = AdminAuditLog(
        action_type=action_type,
        issued_by=admin_user.get("username", "UNKNOWN"),
        issued_by_user_id=get_user_id(admin_user) if admin_user else None,
        auth_jti=auth_jti,
        target_username=target_username,
        target_user_id=target_user_id,
        fields_changed=fields_changed,
        reason=reason,
        request_ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        request_path=str(request.url.path) if request else None,
        request_method=request.method if request else None,
        batch_id=batch_id,
        # issued_at uses model default (datetime.utcnow) - single source of truth
    )
    
    await db.admin_audit_log.insert_one(log_entry.dict())
    return log_entry

async def log_admin_action(
    admin_user: dict,
    action_type: str,
    target_user_id: str,
    target_username: str,
    reason: str,
    request: Request = None,
    duration_minutes: Optional[int] = None,
    notes: Optional[str] = None
):
    """Log a chat moderation admin action with full audit trail"""
    action = ChatModerationAction(
        user_id=target_user_id,
        username=target_username,
        action_type=action_type,
        reason=reason,
        duration_minutes=duration_minutes,
        issued_by=admin_user.get("username", "UNKNOWN"),
        notes=notes
    )
    
    action_dict = action.dict()
    
    # Add audit metadata
    if request:
        action_dict["audit_ip"] = request.client.host if request.client else None
        action_dict["audit_user_agent"] = request.headers.get("user-agent")
    
    await db.chat_moderation_log.insert_one(action_dict)
    return action

# AI Narration setup
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    AI_ENABLED = True
except ImportError:
    AI_ENABLED = False
    print("Warning: emergentintegrations not available, AI narration disabled")

def convert_objectid(obj):
    """Convert ObjectId to string in MongoDB documents"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, ObjectId):
                obj[key] = str(value)
            elif isinstance(value, dict):
                convert_objectid(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        convert_objectid(item)
    return obj

import hashlib

def generate_stable_hero_id(hero_name: str, rarity: str) -> str:
    """Generate a stable, deterministic hero ID based on name and rarity.
    This ensures hero IDs don't change between server restarts."""
    unique_string = f"{hero_name}_{rarity}_divine_heroes_v1"
    return hashlib.md5(unique_string.encode()).hexdigest()

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Ascension Images Helper - loads from /app/art/ascension/<HeroName>/manifest.json
ASCENSION_CACHE: Dict[str, dict] = {}

def get_ascension_images(hero_name: str) -> dict:
    """Load ascension images from manifest file for a hero.
    Returns dict with keys "1" through "6" mapping to image URLs.
    """
    if hero_name in ASCENSION_CACHE:
        return ASCENSION_CACHE[hero_name]
    
    # Convert hero name to folder format: "Phoenix the Reborn" -> "Phoenix_the_Reborn"
    folder_name = hero_name.replace(" ", "_")
    manifest_path = Path("/app/art/ascension") / folder_name / "manifest.json"
    
    result = {}
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                data = json.load(f)
                # Convert "1_star", "2_star" keys to "1", "2" etc.
                if "ascension_images" in data:
                    for key, value in data["ascension_images"].items():
                        # Extract star number from "1_star", "2_star", etc.
                        star_num = key.split("_")[0]
                        if isinstance(value, dict) and "url" in value:
                            result[star_num] = value["url"]
                        elif isinstance(value, str):
                            result[star_num] = value
        except Exception as e:
            logging.warning(f"Failed to load ascension manifest for {hero_name}: {e}")
    
    ASCENSION_CACHE[hero_name] = result
    return result

# =============================================================================
# PHASE 3.24: CANONICAL REWARD RECEIPT SYSTEM
# =============================================================================
# All reward-granting endpoints MUST return this shape:
# { source, sourceId, items, balances, alreadyClaimed? }
#
# LOCKED source values:
# - bond_tribute
# - mail_reward_claim
# - mail_gift_claim
# - daily_login_claim
# - idle_claim
# - admin_grant
# =============================================================================

from typing import Literal, Any

RewardSource = Literal[
    "bond_tribute",
    "mail_reward_claim", 
    "mail_gift_claim",
    "mail_receipt_claim",  # Phase 3.26: Fallback queue receipts
    "daily_login_claim",
    "daily_claim",  # Phase 3.32: Daily login calendar
    "idle_claim",
    "admin_grant",
    "event_claim",  # Phase 3.29: Events/Quests
    "store_redeem",  # Phase 3.30: Store dev redeem
    "summon_single",  # Phase 3.33: Single gacha pull
    "summon_multi",  # Phase 3.33: Multi gacha pull
    "pity_reward",  # Phase 3.33: Pity system reward
    "hero_promotion",  # Phase 3.39: Hero star promotion
    "hero_ascension",  # Phase 3.44: Hero ascension
    "iap_purchase"  # Phase 3.42: RevenueCat IAP
]

class RewardItem(BaseModel):
    """Single reward item in a receipt"""
    type: str  # gold, gems, coins, stamina, hero_shard, etc.
    amount: int
    hero_id: Optional[str] = None  # For hero-specific rewards
    item_id: Optional[str] = None  # For specific items

class RewardReceipt(BaseModel):
    """Canonical receipt shape for all reward grants (Phase 3.24)"""
    source: str  # RewardSource value
    sourceId: str  # Origin record ID (tributeId, mailItemId, etc.) - ALWAYS required
    items: List[RewardItem] = Field(default_factory=list)  # Rewards granted
    balances: Dict[str, int] = Field(default_factory=dict)  # Current balances after grant
    alreadyClaimed: bool = False  # True if idempotent duplicate claim
    message: Optional[str] = None  # Optional human-readable message


async def get_user_balances(user: dict) -> Dict[str, int]:
    """Extract current balance snapshot from user dict"""
    return {
        "gold": user.get("gold", 0),
        "coins": user.get("coins", 0),
        "gems": user.get("gems", 0),
        "divine_gems": user.get("divine_gems", 0),
        "crystals": user.get("crystals", 0),
        "stamina": user.get("stamina", 0),
        "divine_essence": user.get("divine_essence", 0),
        "soul_dust": user.get("soul_dust", 0),
        "skill_essence": user.get("skill_essence", 0),
        "enhancement_stones": user.get("enhancement_stones", 0),
        "hero_shards": user.get("hero_shards", 0),
        "rune_essence": user.get("rune_essence", 0),
    }


async def grant_rewards_canonical(
    user: dict,
    source: str,
    source_id: str,
    rewards: List[Dict[str, any]],
    already_claimed: bool = False,
    message: Optional[str] = None
) -> dict:
    """
    Canonical reward grant helper (Phase 3.24).
    
    All reward endpoints MUST use this to ensure consistent receipt shape.
    
    Args:
        user: User dict (must have been fetched for mutation)
        source: RewardSource value
        source_id: Origin record ID (MUST be provided)
        rewards: List of {type, amount, hero_id?, item_id?}
        already_claimed: True if this is an idempotent duplicate claim
        message: Optional human-readable message
    
    Returns:
        Canonical receipt dict with source, sourceId, items, balances, alreadyClaimed
    """
    # Guard: source_id is ALWAYS required
    if not source_id:
        raise ValueError("grant_rewards_canonical: sourceId is ALWAYS required")
    
    # Guard: source must be valid
    valid_sources = ["bond_tribute", "mail_reward_claim", "mail_gift_claim", 
                     "mail_receipt_claim", "daily_login_claim", "daily_claim",
                     "idle_claim", "admin_grant", "event_claim", "store_redeem",
                     "summon_single", "summon_multi", "pity_reward",
                     "hero_promotion", "hero_ascension", "iap_purchase"]
    if source not in valid_sources:
        raise ValueError(f"grant_rewards_canonical: invalid source '{source}'")
    
    items = []
    inc_ops = {}
    
    # Process rewards if not already claimed
    if not already_claimed and rewards:
        for reward in rewards:
            reward_type = reward.get("type", "")
            amount = reward.get("amount", 0)
            
            if amount > 0 and reward_type:
                # Map reward type to user field
                field_map = {
                    "gold": "gold",
                    "coins": "coins",
                    "gems": "gems",
                    "divine_gems": "divine_gems",
                    "crystals": "crystals",
                    "stamina": "stamina",
                    "divine_essence": "divine_essence",
                    "soul_dust": "soul_dust",
                    "skill_essence": "skill_essence",
                    "enhancement_stones": "enhancement_stones",
                    "hero_shards": "hero_shards",
                    "rune_essence": "rune_essence",
                }
                
                if reward_type in field_map:
                    inc_ops[field_map[reward_type]] = inc_ops.get(field_map[reward_type], 0) + amount
                
                items.append({
                    "type": reward_type,
                    "amount": amount,
                    "hero_id": reward.get("hero_id"),
                    "item_id": reward.get("item_id"),
                })
    
    # Apply rewards to user if any
    if inc_ops:
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": inc_ops}
        )
    
    # Fetch fresh user for balance snapshot
    fresh_user = await db.users.find_one({"id": user["id"]})
    balances = await get_user_balances(fresh_user or user)
    
    # Emit telemetry event
    if not already_claimed and items:
        logging.info(f"[REWARD_GRANTED] source={source} sourceId={source_id} "
                    f"user={user.get('username')} items_count={len(items)}")
    
    return {
        "source": source,
        "sourceId": source_id,
        "items": items,
        "balances": balances,
        "alreadyClaimed": already_claimed,
        "message": message,
    }


# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# =============================================================================
# SECURITY MIDDLEWARE: Global Admin Route Lock
# =============================================================================
# This middleware acts as a FAIL-CLOSED outer wall for all /api/admin/* routes.
# Even if a developer forgets to add Depends(require_super_admin), this prevents
# anonymous access to admin endpoints.
# 
# NOTE: This does NOT replace require_super_admin - it's an additional layer.
# =============================================================================

@app.middleware("http")
async def admin_route_guard(request: Request, call_next):
    """
    Global security gate for admin routes.
    
    Blocks ANY request to /api/admin/* without Authorization header.
    This is a fail-closed design - even if an endpoint lacks proper
    auth dependency, it cannot be accessed anonymously.
    """
    path = request.url.path
    
    if path.startswith("/api/admin"):
        auth = request.headers.get("authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return JSONResponse(
                status_code=403,
                content={"detail": "Admin access required", "code": "ADMIN_AUTH_REQUIRED"}
            )
    
    return await call_next(request)

# Add rate limiter to the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class HeroSkill(BaseModel):
    id: str
    name: str
    description: str
    skill_type: str  # "active" or "passive"
    damage_multiplier: float = 1.0
    heal_percent: float = 0.0
    buff_type: Optional[str] = None  # "atk", "def", "speed", etc.
    buff_percent: float = 0.0
    cooldown: int = 0  # turns
    unlock_level: int = 1
    unlock_stars: int = 0

class HeroBase(BaseModel):
    name: str
    rarity: str  # N, R, SR, SSR, SSR+, UR, UR+
    element: str  # Fire, Water, Earth, Wind, Light, Dark
    hero_class: str  # Warrior, Mage, Archer (triangle system)
    base_hp: int
    base_atk: int
    base_def: int
    base_speed: int = 100
    image_url: str
    description: str
    # Skills - defined per hero
    skills: List[HeroSkill] = []
    # Position preference
    position: str = "back"  # "front" or "back"

class Hero(HeroBase):
    id: str = ""  # Will be set by __init__ or explicitly
    
    def __init__(self, **data):
        # Generate stable ID based on name and rarity if not provided
        if not data.get('id') or data.get('id') == '':
            name = data.get('name', '')
            rarity = data.get('rarity', '')
            data['id'] = generate_stable_hero_id(name, rarity)
        super().__init__(**data)

class Equipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slot: str  # "weapon", "armor", "helmet", "boots", "ring", "necklace"
    rarity: str  # "common", "uncommon", "rare", "epic", "legendary"
    level: int = 1
    max_level: int = 20
    stat_type: str  # "atk", "def", "hp", "speed", "crit"
    stat_value: int
    set_name: Optional[str] = None  # For set bonuses

class UserHero(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    hero_id: str
    level: int = 1
    max_level: int = 100
    exp: int = 0
    rank: int = 1  # 1-10 (star promotion)
    stars: int = 0  # 0-6 stars per rank
    awakening_level: int = 0  # 0-5 awakening stages
    duplicates: int = 0  # Shards for promotion
    # Current stats (calculated from base + upgrades)
    current_hp: int
    current_atk: int
    current_def: int
    current_speed: int = 100
    # Equipment slots
    equipment: Dict[str, Optional[str]] = {
        "weapon": None, "armor": None, "helmet": None,
        "boots": None, "ring": None, "necklace": None
    }
    # Skill levels
    skill_levels: Dict[str, int] = {}
    # Team position
    team_position: Optional[int] = None  # 1-6 position in team
    acquired_at: datetime = Field(default_factory=datetime.utcnow)

# Class advantage system (rock-paper-scissors)
CLASS_ADVANTAGES = {
    "Warrior": {"strong_against": "Archer", "weak_against": "Mage"},
    "Mage": {"strong_against": "Warrior", "weak_against": "Archer"},
    "Archer": {"strong_against": "Mage", "weak_against": "Warrior"},
}

# Element advantage system
ELEMENT_ADVANTAGES = {
    "Fire": {"strong_against": "Wind", "weak_against": "Water"},
    "Water": {"strong_against": "Fire", "weak_against": "Earth"},
    "Earth": {"strong_against": "Water", "weak_against": "Wind"},
    "Wind": {"strong_against": "Earth", "weak_against": "Fire"},
    "Light": {"strong_against": "Dark", "weak_against": "Dark"},
    "Dark": {"strong_against": "Light", "weak_against": "Light"},
}

# Rarity stat multipliers
RARITY_MULTIPLIERS = {
    "N": 1.0, "R": 1.2, "SR": 1.5, "SSR": 2.0, 
    "SSR+": 2.5, "UR": 3.0, "UR+": 4.0
}

# Level up costs (gold per level)
def get_level_up_cost(current_level: int) -> int:
    return 100 * current_level * current_level

# EXP required per level
def get_exp_required(level: int) -> int:
    return 100 * level * level

# Star promotion shard requirements
STAR_SHARD_COSTS = {1: 10, 2: 20, 3: 40, 4: 80, 5: 160, 6: 320}

# Awakening costs
AWAKENING_COSTS = {
    1: {"shards": 50, "gold": 10000},
    2: {"shards": 100, "gold": 25000},
    3: {"shards": 200, "gold": 50000},
    4: {"shards": 400, "gold": 100000},
    5: {"shards": 800, "gold": 250000},
}

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    username_canon: str = ""  # Canonical username (lowercase, trimmed) - REQUIRED for lookups
    password_hash: Optional[str] = None  # Hashed password for secure login
    server_id: str = "server_1"  # Server assignment with default
    
    # ==================== TOKEN REVOCATION ====================
    tokens_valid_after: datetime = Field(default_factory=lambda: datetime(1970, 1, 1))  # Tokens with iat < this are invalid
    account_frozen: bool = False  # Frozen accounts cannot authenticate
    frozen_at: Optional[datetime] = None
    frozen_reason: Optional[str] = None
    
    # ==================== CURRENCY SYSTEM ====================
    crystals: int = 300  # Premium currency (renamed from gems)
    coins: int = 10000  # Regular currency
    gold: int = 5000  # Idle resource - sink: hero leveling, gear upgrades
    divine_essence: int = 0  # Ultra-rare currency for UR+ summons
    hero_shards: int = 0  # Universal hero shards for upgrades
    friendship_points: int = 0  # Friend currency
    
    # NEW CURRENCIES
    soul_dust: int = 0  # Hero EXP currency - source: EXP stages, sink: hero level
    skill_essence: int = 0  # Source: daily dungeons, sink: hero skill levels
    star_crystals: int = 0  # Source: dismantling heroes, sink: star promotion
    divine_gems: int = 100  # Premium - source: purchases/daily quests, sink: summons/shop refresh
    guild_coins: int = 0  # Source: guild activities, sink: guild shop
    pvp_medals: int = 0  # Source: Arena, sink: PvP shop
    enhancement_stones: int = 0  # For equipment enhancement
    hero_exp: int = 0  # Hero experience points for leveling heroes
    
    # ==================== STAMINA SYSTEM ====================
    stamina: int = 100  # Max 100, regen 1 per 5 minutes
    stamina_last_regen: Optional[datetime] = None
    
    # ==================== GACHA PITY ====================
    pity_counter: int = 0  # Counts towards guaranteed SSR at 50 (common)
    pity_counter_premium: int = 0  # Separate pity for premium summons (UR)
    pity_counter_divine: int = 0  # Pity for divine summons (UR+) - 40 pity
    total_pulls: int = 0
    
    # ==================== LOGIN/DAILY ====================
    login_days: int = 0
    last_login: Optional[datetime] = None
    daily_summons_claimed: int = 0  # Track daily free summons
    profile_picture_hero_id: Optional[str] = None  # Hero ID for profile picture
    
    # VIP System
    vip_level: int = 0  # 0-15
    total_spent: float = 0.0  # Total USD spent
    avatar_frame: str = "default"  # Avatar frame (default, gold, diamond, rainbow, legendary, divine)
    first_purchase_used: bool = False  # Track if first purchase bonus claimed
    # Divine Package Purchase Tracking (resets monthly)
    divine_pack_49_purchased: int = 0  # How many $49.99 packs purchased this month (max 3)
    divine_pack_99_purchased: int = 0  # How many $99.99 packs purchased this month (max 3)
    divine_pack_last_reset: Optional[datetime] = None  # Last monthly reset
    # Idle Collection System
    idle_collection_started_at: Optional[datetime] = None
    idle_collection_last_claimed: Optional[datetime] = None
    # Active Button System (instant 120min collection)
    active_uses_today: int = 0
    active_last_reset: Optional[datetime] = None  # Last daily reset
    # Guild Boss Attack System
    guild_boss_attacks_today: int = 0  # Daily attack counter
    guild_boss_attack_last_reset: Optional[datetime] = None  # Last daily reset
    
    # ==================== ARENA ====================
    arena_rank: int = 0
    arena_tickets_today: int = 5
    arena_last_reset: Optional[datetime] = None
    
    # Resource Bag (track collected resources)
    resource_bag: dict = Field(default_factory=lambda: {
        "coins_collected": 0,
        "gold_collected": 0,
        "crystals_collected": 0,
        "exp_collected": 0,
        "materials_collected": 0,
        "last_updated": None
    })
    # Chat unlock system
    tutorial_completed: bool = False
    chat_unlock_time: Optional[datetime] = None  # When chat becomes available
    chat_unlocked: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Crystal Store Packages
CRYSTAL_PACKAGES = {
    "starter": {
        "id": "starter",
        "price_usd": 0.99,
        "crystals": 100,
        "display_name": "Starter Pack",
        "bonus": 0
    },
    "small": {
        "id": "small",
        "price_usd": 4.99,
        "crystals": 500,
        "display_name": "Small Pack",
        "bonus": 0
    },
    "medium": {
        "id": "medium",
        "price_usd": 9.99,
        "crystals": 1000,
        "display_name": "Medium Pack",
        "bonus": 0
    },
    "large": {
        "id": "large",
        "price_usd": 19.99,
        "crystals": 2000,
        "display_name": "Large Pack",
        "bonus": 0
    },
    "premium": {
        "id": "premium",
        "price_usd": 49.99,
        "crystals": 3440,
        "display_name": "Premium Pack",
        "bonus": 440  # 3000 base + 440 bonus
    },
    "ultimate": {
        "id": "ultimate",
        "price_usd": 99.99,
        "crystals": 6880,
        "display_name": "Ultimate Pack",
        "bonus": 880  # 6000 base + 880 bonus
    }
}

# Divine Packages (Limited to 3 per month each)
DIVINE_PACKAGES = {
    "divine_49": {
        "id": "divine_49",
        "price_usd": 49.99,
        "divine_essence": 40,
        "crystals": 3440,
        "display_name": "Divine Blessing",
        "monthly_limit": 3,
        "description": "40 Divine Essence + 3440 Crystals"
    },
    "divine_99": {
        "id": "divine_99",
        "price_usd": 99.99,
        "divine_essence": 75,
        "crystals": 6880,
        "display_name": "Divine Ascension",
        "monthly_limit": 3,
        "description": "75 Divine Essence + 6880 Crystals"
    }
}

class MarqueeNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    server_id: str
    username: str
    hero_name: str
    hero_rarity: str  # UR or UR+
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: str  # e.g., "Player123 obtained UR+ Raphael the Eternal!"

class VIPPackage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vip_level: int
    package_tier: str  # "basic", "premium", "elite"
    crystal_cost: int
    rewards: Dict[str, int]  # {"coins": 1000, "gold": 500, etc}
    daily_limit: int = 3  # Can buy 3 times per day

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    # Hero positions: slots 1-3 are front line, 4-6 are back line
    slot_1: Optional[str] = None  # Front Left
    slot_2: Optional[str] = None  # Front Center
    slot_3: Optional[str] = None  # Front Right
    slot_4: Optional[str] = None  # Back Left
    slot_5: Optional[str] = None  # Back Center
    slot_6: Optional[str] = None  # Back Right
    hero_ids: List[str] = []  # Legacy - all hero IDs
    is_active: bool = False
    team_power: int = 0  # Cached team CR

class GachaResult(BaseModel):
    heroes: List[UserHero]
    new_pity_counter: int
    crystals_spent: int
    coins_spent: int

class PullRequest(BaseModel):
    pull_type: str  # "single" or "multi"
    currency_type: str  # "crystals" or "coins"

class AbyssBattleRequest(BaseModel):
    team_ids: List[str] = []  # List of team IDs

class ArenaBattleRequest(BaseModel):
    team_id: str = "default"  # Team ID for arena battle

class IdleRewards(BaseModel):
    gold_earned: int
    time_away: int  # seconds

class LoginReward(BaseModel):
    crystals: int = 0
    coins: int = 0
    gold: int = 0
    free_summons: int = 0
    day_count: int

class Island(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    order: int  # Island sequence
    chapters: List[int]  # Chapter numbers on this island
    unlock_chapter: int = 0  # Which chapter unlocks this island

class Chapter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chapter_number: int
    island_id: str
    name: str
    required_power: int  # Minimum CR to have a chance
    enemy_power: int  # Enemy team power
    rewards: Dict[str, int]  # {"crystals": 50, "coins": 1000, "gold": 500}
    first_clear_bonus: Dict[str, int]  # Extra rewards on first clear

class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    completed_chapters: List[int] = []
    current_chapter: int = 1
    total_stars: int = 0  # For future star rating system

class BattleResult(BaseModel):
    victory: bool
    rewards: Dict[str, int]
    user_power: int
    enemy_power: int
    damage_dealt: int
    damage_taken: int

class SupportTicket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    subject: str
    message: str
    status: str = "open"  # open, in_progress, resolved
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FriendRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    to_user_id: str
    status: str = "pending"  # pending, accepted, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Friendship(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    friend_id: str
    last_collected: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PlayerCharacter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str = "Divine Avatar"
    level: int = 1
    exp: int = 0
    # Buff percentages (0.05 = 5% buff)
    atk_buff: float = 0.0
    def_buff: float = 0.0
    hp_buff: float = 0.0
    crit_buff: float = 0.0
    # Upgrade costs increase with level
    upgrade_cost_crystals: int = 100
    upgrade_time_hours: int = 24

class AbyssProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    current_level: int = 1
    highest_level: int = 1
    total_clears: int = 0
    last_attempt: Optional[datetime] = None

class ArenaRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    rating: int = 1000  # ELO-style rating
    wins: int = 0
    losses: int = 0
    win_streak: int = 0
    highest_rating: int = 1000
    season_rank: int = 0

class Guild(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    leader_id: str
    member_ids: List[str] = []
    level: int = 1
    server_id: str  # Server-specific guilds
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Server(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Server 1", "Server Alpha"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    account_count: int = 0
    status: str = "active"  # active, full, merged
    merged_into_id: Optional[str] = None  # If merged, which server
    merge_date: Optional[datetime] = None

SERVER_CAPACITY = 220
SERVER_MAX_AFTER_MERGE = 440
SERVER_LIFETIME_DAYS = 14
SERVER_MERGE_INTERVAL_DAYS = 90  # 3 months

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_username: str
    channel_type: str  # "world", "local", "guild", "private"
    channel_id: Optional[str] = None  # guild_id for guild chat, friend_id for private
    message: str
    language: str = "en"  # User's language
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    server_region: str = "global"  # For local chat

# Supported languages for translation
SUPPORTED_LANGUAGES = [
    "en",  # English
    "fr",  # French
    "es",  # Spanish
    "zh-CN",  # Simplified Chinese
    "zh-TW",  # Traditional Chinese
    "ms",  # Malay
    "fil",  # Filipino
    "ru",  # Russian
    "id"   # Indonesian
]

# ============================================================================
# CHAT MODERATION SYSTEM - Production-grade for Google Play / Apple Review
# ============================================================================

# Configuration constants
CHAT_CONFIG = {
    "max_message_length": 500,
    "max_fetch_limit": 100,
    "rate_limit_messages_per_minute": 10,
    "rate_limit_burst": 5,
    "retention_days": 90,  # Messages older than this are eligible for cleanup
    "min_message_length": 1,
    "allowed_chars_pattern": r'^[\w\s\.,!?\'"@#$%&*()+=\-:;<>\[\]{}|/\\~`^\n\r\u00A0-\uFFFF]+$',
}

# Profanity filter - comprehensive word list
PROFANITY_LIST = [
    # English profanity
    "fuck", "fucker", "fucking", "fucked", "fck", "f*ck", "f**k",
    "shit", "shitty", "bullshit", "sh*t", "s**t",
    "ass", "asshole", "a**hole", "a$$",
    "bitch", "b*tch", "b**ch",
    "bastard", "dick", "d*ck", "pussy", "p*ssy", "cock", "c*ck",
    "cunt", "c*nt", "c**t",
    # Slurs (critical for app store compliance)
    "nigger", "n*gger", "n**ger", "nigga", "n*gga",
    "fag", "faggot", "f*g", "f*ggot",
    "retard", "retarded", "r*tard",
    "kike", "k*ke", "spic", "sp*c", "chink", "ch*nk",
    "tranny", "tr*nny",
    # Common variations/leetspeak
    "f4ck", "sh1t", "b1tch", "a55", "d1ck", "c0ck",
    # Add more as needed
]

# Slurs that result in immediate shadowban consideration
SEVERE_SLURS = [
    "nigger", "nigga", "faggot", "kike", "spic", "chink", "tranny",
]

# PII patterns to detect and block
PII_PATTERNS = [
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'email'),  # Email
    (r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b', 'phone_us'),  # US phone
    (r'\b(?:\+?[0-9]{1,3}[-.\s]?)?[0-9]{6,14}\b', 'phone_intl'),  # International phone
    (r'\b[0-9]{3}[-.\s]?[0-9]{2}[-.\s]?[0-9]{4}\b', 'ssn'),  # SSN pattern
    (r'\b[0-9]{16}\b', 'credit_card'),  # Credit card (basic)
]

# URL pattern - block ALL URLs as per config
URL_PATTERN = re.compile(
    r'(?:https?://|www\.|ftp://|[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|org|net|edu|gov|mil|co|io|app|dev|xyz|info|biz|me|tv|cc|us|uk|ca|au|de|fr|jp|cn|ru|br|in|it|es|nl|se|no|fi|dk|pl|cz|at|ch|be|ie|nz|sg|hk|kr|tw|my|ph|id|th|vn|mx|ar|cl|pe|co|ve|ec|bo|py|uy))[^\s]*',
    re.IGNORECASE
)

def detect_pii(message: str) -> Optional[str]:
    """Detect PII in message, returns type if found"""
    for pattern, pii_type in PII_PATTERNS:
        if re.search(pattern, message):
            return pii_type
    return None

def detect_url(message: str) -> bool:
    """Detect URLs in message"""
    return bool(URL_PATTERN.search(message))

def contains_severe_slur(message: str) -> bool:
    """Check if message contains severe slurs (DEPRECATED - use check_prohibited_tokens)"""
    msg_lower = message.lower()
    for slur in SEVERE_SLURS:
        if slur in msg_lower:
            return True
    return False

# ============================================================================
# ROBUST SLUR DETECTION (Leetspeak/Unicode resistant)
# ============================================================================
import unicodedata

LEET_MAP = str.maketrans({
    "0": "o",
    "1": "i",
    "!": "i",
    "3": "e",
    "@": "a",
    "$": "s",
    "5": "s",
    "7": "t",
    "4": "a",
    "8": "b",
    "9": "g",
    "|": "i",
    "+": "t",
})

_non_alnum = re.compile(r"[^a-z0-9]+")

def canonicalize_for_filter(text: str) -> str:
    """
    Normalize text for slur detection:
    - Unicode NFKC normalization
    - Lowercase
    - Leetspeak substitution
    - Strip non-alphanumerics
    """
    # Normalize unicode (e.g., fullwidth chars, accents)
    t = unicodedata.normalize("NFKC", text)
    t = t.lower()
    t = t.translate(LEET_MAP)
    # Remove anything that isn't a-z/0-9
    t = _non_alnum.sub("", t)
    return t

# Prohibited tokens - use internal keys to avoid logging slurs
# These result in PERMANENT BAN
PROHIBITED_TOKENS = {
    "slur_racial_1": "nigger",
    "slur_racial_2": "nigga",
    "slur_ethnic_1": "spic",
    "slur_ethnic_2": "kike",
    "slur_ethnic_3": "chink",
    "slur_homophobic_1": "faggot",
}

def check_prohibited_tokens(text: str) -> Optional[str]:
    """
    Check if text contains prohibited tokens after canonicalization.
    Returns the token key if found, None otherwise.
    """
    canonicalized = canonicalize_for_filter(text)
    for key, token in PROHIBITED_TOKENS.items():
        if token in canonicalized:
            return key
    return None

async def issue_permanent_ban(user_id: str, username: str, reason_key: str):
    """
    Issue a permanent chat ban for prohibited content.
    Does NOT log the original message content.
    """
    now = datetime.utcnow()
    
    # Upsert ban status
    await db.chat_user_status.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "username": username,
            "is_banned": True,
            "ban_expires_at": None,  # Permanent
        }},
        upsert=True
    )
    
    # Log moderation action (without message content)
    action = ChatModerationAction(
        user_id=user_id,
        username=username,
        action_type="ban",
        reason=f"Auto-ban: prohibited content ({reason_key})",
        duration_minutes=None,  # Permanent
        issued_by="system",
        notes="Permanent ban for prohibited slur token. Original message not logged."
    )
    await db.chat_moderation_log.insert_one(action.dict())

def censor_message(message: str) -> str:
    """Censor profanity in message"""
    censored = message
    for word in PROFANITY_LIST:
        # Case insensitive replacement with word boundaries
        pattern = re.compile(r'\b' + re.escape(word) + r'\b', re.IGNORECASE)
        censored = pattern.sub("***", censored)
    return censored

def sanitize_chat_message(message: str) -> str:
    """Sanitize chat message - strip control chars, normalize whitespace"""
    # Remove control characters except newlines
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', message)
    # Normalize whitespace
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized

# Chat moderation models
class ChatReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reporter_id: str
    reporter_username: str
    reported_user_id: str
    reported_username: str
    message_id: Optional[str] = None
    reason: str  # spam, harassment, hate_speech, inappropriate, other
    details: Optional[str] = None
    status: str = "pending"  # pending, reviewed, actioned, dismissed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    action_taken: Optional[str] = None

class ChatModerationAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    action_type: str  # mute, ban, shadowban, warn
    reason: str
    duration_minutes: Optional[int] = None  # None = permanent
    issued_by: str  # admin username or "system"
    issued_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True
    notes: Optional[str] = None

class UserChatStatus(BaseModel):
    """Track user's chat status for moderation"""
    user_id: str
    username: str
    is_muted: bool = False
    mute_expires_at: Optional[datetime] = None
    is_banned: bool = False
    ban_expires_at: Optional[datetime] = None
    is_shadowbanned: bool = False
    shadowban_expires_at: Optional[datetime] = None
    warning_count: int = 0
    report_count: int = 0
    blocked_users: List[str] = Field(default_factory=list)  # List of user IDs
    last_message_at: Optional[datetime] = None
    messages_in_window: int = 0  # For rate limiting
    rate_limit_window_start: Optional[datetime] = None

# Rate limiting tracking (in-memory, consider Redis for production scale)
chat_rate_limits: Dict[str, dict] = {}

def check_chat_rate_limit(user_id: str) -> tuple[bool, Optional[int]]:
    """Check if user is rate limited. Returns (is_allowed, retry_after_seconds)"""
    now = datetime.utcnow()
    window_seconds = 60
    max_messages = CHAT_CONFIG["rate_limit_messages_per_minute"]
    
    if user_id not in chat_rate_limits:
        chat_rate_limits[user_id] = {
            "window_start": now,
            "count": 0
        }
    
    user_limit = chat_rate_limits[user_id]
    window_elapsed = (now - user_limit["window_start"]).total_seconds()
    
    if window_elapsed >= window_seconds:
        # Reset window
        user_limit["window_start"] = now
        user_limit["count"] = 1
        return (True, None)
    
    if user_limit["count"] >= max_messages:
        retry_after = int(window_seconds - window_elapsed)
        return (False, retry_after)
    
    user_limit["count"] += 1
    return (True, None)

async def get_user_chat_status(user_id: str) -> Optional[dict]:
    """Get user's chat moderation status"""
    status = await db.chat_user_status.find_one({"user_id": user_id})
    return status

async def is_user_chat_restricted(user_id: str) -> tuple[bool, str]:
    """Check if user can send messages. Returns (is_restricted, reason)"""
    status = await get_user_chat_status(user_id)
    if not status:
        return (False, "")
    
    now = datetime.utcnow()
    
    # Check ban
    if status.get("is_banned"):
        expires = status.get("ban_expires_at")
        if expires is None or expires > now:
            return (True, "You are banned from chat")
        # Ban expired, clear it
        await db.chat_user_status.update_one(
            {"user_id": user_id},
            {"$set": {"is_banned": False, "ban_expires_at": None}}
        )
    
    # Check mute
    if status.get("is_muted"):
        expires = status.get("mute_expires_at")
        if expires is None or expires > now:
            return (True, "You are muted")
        # Mute expired, clear it
        await db.chat_user_status.update_one(
            {"user_id": user_id},
            {"$set": {"is_muted": False, "mute_expires_at": None}}
        )
    
    return (False, "")

async def is_user_shadowbanned(user_id: str) -> bool:
    """Check if user is shadowbanned"""
    status = await get_user_chat_status(user_id)
    if not status:
        return False
    
    if status.get("is_shadowbanned"):
        expires = status.get("shadowban_expires_at")
        now = datetime.utcnow()
        if expires is None or expires > now:
            return True
        # Shadowban expired, clear it
        await db.chat_user_status.update_one(
            {"user_id": user_id},
            {"$set": {"is_shadowbanned": False, "shadowban_expires_at": None}}
        )
    
    return False

async def log_moderation_action(
    user_id: str,
    username: str,
    action_type: str,
    reason: str,
    issued_by: str,
    duration_minutes: Optional[int] = None,
    notes: Optional[str] = None
):
    """Log a moderation action for audit trail"""
    expires_at = None
    if duration_minutes:
        expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes)
    
    action = ChatModerationAction(
        user_id=user_id,
        username=username,
        action_type=action_type,
        reason=reason,
        duration_minutes=duration_minutes,
        issued_by=issued_by,
        expires_at=expires_at,
        notes=notes
    )
    
    await db.chat_moderation_log.insert_one(action.dict())
    return action

# VIP tier thresholds (spending in USD)
VIP_TIERS = {
    0: {"spend": 0, "idle_hours": 8},
    1: {"spend": 10, "idle_hours": 10},
    2: {"spend": 25, "idle_hours": 12},
    3: {"spend": 50, "idle_hours": 14},
    4: {"spend": 100, "idle_hours": 16},
    5: {"spend": 250, "idle_hours": 18},
    6: {"spend": 500, "idle_hours": 20},
    7: {"spend": 1000, "idle_hours": 22},
    8: {"spend": 2000, "idle_hours": 24},
    9: {"spend": 3500, "idle_hours": 30},
    10: {"spend": 5000, "idle_hours": 36},
    11: {"spend": 7500, "idle_hours": 48},
    12: {"spend": 10000, "idle_hours": 60},
    13: {"spend": 15000, "idle_hours": 72},
    14: {"spend": 20000, "idle_hours": 96},
    15: {"spend": 25000, "idle_hours": 168},  # 7 days
}

def calculate_vip_level(total_spent: float) -> int:
    """Calculate VIP level based on total spent"""
    vip_level = 0
    for level in range(15, -1, -1):
        if total_spent >= VIP_TIERS[level]["spend"]:
            vip_level = level
            break
    return vip_level

def get_idle_cap_hours(vip_level: int) -> int:
    """Get idle collection cap hours for VIP level"""
    return VIP_TIERS.get(vip_level, VIP_TIERS[0])["idle_hours"]

# Import the new idle resource system
from core.idle_resources import (
    get_vip_idle_rate_multiplier,
    get_vip_idle_rate_display,
    calculate_resource_caps,
    calculate_resource_caps_with_breakdown,
    calculate_idle_resources,
    calculate_idle_preview,
    get_vip_idle_hours,
    get_next_milestone_info,
    get_vip_upgrade_info,
    BASE_RATES_PER_HOUR,
    RESOURCE_DISPLAY_INFO,
)

def get_idle_gold_rate(vip_level: int) -> float:
    """Get idle gold generation rate per minute based on VIP level - LEGACY"""
    # This is now handled by the new idle_resources system
    base_rate = 100.0
    bonus_multiplier = 1.0 + (vip_level * 0.10)
    return base_rate * bonus_multiplier

def get_avatar_frame(vip_level: int) -> str:
    """Get avatar frame based on VIP level"""
    if vip_level >= 15:
        return "divine"
    elif vip_level >= 14:
        return "legendary"
    elif vip_level >= 13:
        return "rainbow"
    elif vip_level >= 12:
        return "diamond"
    elif vip_level >= 8:
        return "gold"
    else:
        return "default"

# VIP Package configurations - can be purchased with crystals
VIP_PACKAGES = {
    # VIP 0-3: Early game packages
    0: {
        "basic": {"crystal_cost": 200, "rewards": {"coins": 5000, "gold": 2500}},
        "premium": {"crystal_cost": 500, "rewards": {"coins": 15000, "gold": 7500}},
        "elite": {"crystal_cost": 1000, "rewards": {"coins": 35000, "gold": 17500, "crystals": 100}}
    },
    1: {
        "basic": {"crystal_cost": 300, "rewards": {"coins": 8000, "gold": 4000}},
        "premium": {"crystal_cost": 750, "rewards": {"coins": 25000, "gold": 12500}},
        "elite": {"crystal_cost": 1500, "rewards": {"coins": 60000, "gold": 30000, "crystals": 200}}
    },
    2: {
        "basic": {"crystal_cost": 400, "rewards": {"coins": 12000, "gold": 6000}},
        "premium": {"crystal_cost": 1000, "rewards": {"coins": 40000, "gold": 20000}},
        "elite": {"crystal_cost": 2000, "rewards": {"coins": 90000, "gold": 45000, "crystals": 300}}
    },
    3: {
        "basic": {"crystal_cost": 500, "rewards": {"coins": 18000, "gold": 9000}},
        "premium": {"crystal_cost": 1250, "rewards": {"coins": 60000, "gold": 30000}},
        "elite": {"crystal_cost": 2500, "rewards": {"coins": 135000, "gold": 67500, "crystals": 400}}
    },
    # VIP 4-7: Mid game packages
    4: {
        "basic": {"crystal_cost": 600, "rewards": {"coins": 25000, "gold": 12500}},
        "premium": {"crystal_cost": 1500, "rewards": {"coins": 80000, "gold": 40000}},
        "elite": {"crystal_cost": 3000, "rewards": {"coins": 180000, "gold": 90000, "crystals": 500}}
    },
    5: {
        "basic": {"crystal_cost": 750, "rewards": {"coins": 35000, "gold": 17500}},
        "premium": {"crystal_cost": 1875, "rewards": {"coins": 110000, "gold": 55000}},
        "elite": {"crystal_cost": 3750, "rewards": {"coins": 250000, "gold": 125000, "crystals": 650}}
    },
    6: {
        "basic": {"crystal_cost": 900, "rewards": {"coins": 50000, "gold": 25000}},
        "premium": {"crystal_cost": 2250, "rewards": {"coins": 150000, "gold": 75000}},
        "elite": {"crystal_cost": 4500, "rewards": {"coins": 350000, "gold": 175000, "crystals": 800}}
    },
    7: {
        "basic": {"crystal_cost": 1100, "rewards": {"coins": 70000, "gold": 35000}},
        "premium": {"crystal_cost": 2750, "rewards": {"coins": 200000, "gold": 100000}},
        "elite": {"crystal_cost": 5500, "rewards": {"coins": 480000, "gold": 240000, "crystals": 1000}}
    },
    # VIP 8-11: High tier packages
    8: {
        "basic": {"crystal_cost": 1300, "rewards": {"coins": 100000, "gold": 50000}},
        "premium": {"crystal_cost": 3250, "rewards": {"coins": 280000, "gold": 140000}},
        "elite": {"crystal_cost": 6500, "rewards": {"coins": 650000, "gold": 325000, "crystals": 1200}}
    },
    9: {
        "basic": {"crystal_cost": 1500, "rewards": {"coins": 140000, "gold": 70000}},
        "premium": {"crystal_cost": 3750, "rewards": {"coins": 380000, "gold": 190000}},
        "elite": {"crystal_cost": 7500, "rewards": {"coins": 850000, "gold": 425000, "crystals": 1400}}
    },
    10: {
        "basic": {"crystal_cost": 1750, "rewards": {"coins": 200000, "gold": 100000}},
        "premium": {"crystal_cost": 4375, "rewards": {"coins": 520000, "gold": 260000}},
        "elite": {"crystal_cost": 8750, "rewards": {"coins": 1150000, "gold": 575000, "crystals": 1600}}
    },
    11: {
        "basic": {"crystal_cost": 2000, "rewards": {"coins": 280000, "gold": 140000}},
        "premium": {"crystal_cost": 5000, "rewards": {"coins": 700000, "gold": 350000}},
        "elite": {"crystal_cost": 10000, "rewards": {"coins": 1500000, "gold": 750000, "crystals": 1800}}
    },
    # VIP 12-15: Endgame whale packages
    12: {
        "basic": {"crystal_cost": 2500, "rewards": {"coins": 400000, "gold": 200000}},
        "premium": {"crystal_cost": 6250, "rewards": {"coins": 950000, "gold": 475000}},
        "elite": {"crystal_cost": 12500, "rewards": {"coins": 2000000, "gold": 1000000, "crystals": 2000}}
    },
    13: {
        "basic": {"crystal_cost": 3000, "rewards": {"coins": 550000, "gold": 275000}},
        "premium": {"crystal_cost": 7500, "rewards": {"coins": 1250000, "gold": 625000}},
        "elite": {"crystal_cost": 15000, "rewards": {"coins": 2600000, "gold": 1300000, "crystals": 2500}}
    },
    14: {
        "basic": {"crystal_cost": 3500, "rewards": {"coins": 750000, "gold": 375000}},
        "premium": {"crystal_cost": 8750, "rewards": {"coins": 1600000, "gold": 800000}},
        "elite": {"crystal_cost": 17500, "rewards": {"coins": 3300000, "gold": 1650000, "crystals": 3000}}
    },
    15: {
        "basic": {"crystal_cost": 4000, "rewards": {"coins": 1000000, "gold": 500000}},
        "premium": {"crystal_cost": 10000, "rewards": {"coins": 2100000, "gold": 1050000}},
        "elite": {"crystal_cost": 20000, "rewards": {"coins": 4200000, "gold": 2100000, "crystals": 3500}}
    }
}

# Gacha rates configuration
# Common Summons (coins) - NO UR/UR+ heroes
GACHA_RATES_COMMON = {
    "SR": 90.8,    # 90.8%
    "SSR": 8.0,    # 8%
    "SSR+": 1.2,   # 1.2% - Rare tier exclusive to common summons
}

# Premium Summons (crystals) - UR is highest tier here (UR+ moved to divine)
GACHA_RATES_PREMIUM = {
    "SR": 66.8,   # 66.8%
    "SSR": 32.0,  # 32%
    "UR": 1.2,    # 1.2% - Premium exclusive (very rare)
}

# Divine Summons (Divine Essence) - Mixed rewards pool
# Heroes: UR+ 0.8%, UR 2.7% = 3.5% total heroes
# High-value: Crystals, Runes, etc. = ~12% total
# Filler: ~84.5% various resources
GACHA_RATES_DIVINE = {
    # Heroes (3.5% total)
    "UR+": 0.8,           # 0.8% - Ultra rare divine heroes
    "UR": 2.7,            # 2.7% - Rare divine heroes
    # Crystal Jackpots (5.9% total)
    "crystals_8000": 1.2, # 1.2% - 8000 crystals jackpot
    "crystals_5000": 1.7, # 1.7% - 5000 crystals
    "crystals_3000": 3.0, # 3.0% - 3000 crystals
    # Enhancement & Crafting Materials (12% total)
    "enhance_stone_100": 2.0,     # 2% - 100 Enhancement Stones (rare)
    "enhance_stone_50": 4.0,      # 4% - 50 Enhancement Stones
    "rune_epic": 1.5,             # 1.5% - Epic Rune (random stat)
    "rune_rare": 3.0,             # 3% - Rare Rune (random stat)
    "skill_essence_500": 1.5,     # 1.5% - 500 Skill Essence
    # Divine Essence (20% total - allows more pulls!)
    "divine_essence_10": 8.0,    # 8% - 10 Divine Essence
    "divine_essence_5": 12.0,    # 12% - 5 Divine Essence
    # Gold & Currency (28% total)
    "gold_500k": 6.0,            # 6% - 500,000 Gold
    "gold_250k": 10.0,           # 10% - 250,000 Gold
    "coins_100k": 6.0,           # 6% - 100,000 Coins
    "star_crystals_100": 3.0,    # 3% - 100 Star Crystals (ascension)
    "star_crystals_50": 3.0,     # 3% - 50 Star Crystals
    # Hero Progression (18.6% total)
    "hero_shards_50": 5.0,       # 5% - 50 Universal Hero Shards
    "hero_shards_25": 8.0,       # 8% - 25 Universal Hero Shards
    "hero_exp_50k": 5.6,         # 5.6% - 50,000 Hero EXP
}

# Divine summon filler reward definitions
DIVINE_FILLER_REWARDS = {
    # Crystal Jackpots
    "crystals_8000": {"crystals": 8000, "display": "💎 8,000 Crystals!", "rarity": "legendary"},
    "crystals_5000": {"crystals": 5000, "display": "💎 5,000 Crystals!", "rarity": "epic"},
    "crystals_3000": {"crystals": 3000, "display": "💎 3,000 Crystals!", "rarity": "rare"},
    # Enhancement & Crafting
    "enhance_stone_100": {"enhancement_stones": 100, "display": "🔨 100 Enhancement Stones!", "rarity": "epic"},
    "enhance_stone_50": {"enhancement_stones": 50, "display": "🔨 50 Enhancement Stones", "rarity": "rare"},
    "rune_epic": {"rune": "epic", "display": "🔮 Epic Rune!", "rarity": "epic"},
    "rune_rare": {"rune": "rare", "display": "🔮 Rare Rune", "rarity": "rare"},
    "skill_essence_500": {"skill_essence": 500, "display": "📖 500 Skill Essence!", "rarity": "epic"},
    # Divine Essence
    "divine_essence_10": {"divine_essence": 10, "display": "✨ 10 Divine Essence!", "rarity": "epic"},
    "divine_essence_5": {"divine_essence": 5, "display": "✨ 5 Divine Essence", "rarity": "rare"},
    # Gold & Currency
    "gold_500k": {"gold": 500000, "display": "🪙 500K Gold!", "rarity": "epic"},
    "gold_250k": {"gold": 250000, "display": "🪙 250K Gold", "rarity": "rare"},
    "coins_100k": {"coins": 100000, "display": "💰 100K Coins", "rarity": "uncommon"},
    "star_crystals_100": {"star_crystals": 100, "display": "⭐ 100 Star Crystals!", "rarity": "epic"},
    "star_crystals_50": {"star_crystals": 50, "display": "⭐ 50 Star Crystals", "rarity": "rare"},
    # Hero Progression
    "hero_shards_50": {"hero_shards": 50, "display": "🌟 50 Hero Shards!", "rarity": "epic"},
    "hero_shards_25": {"hero_shards": 25, "display": "🌟 25 Hero Shards", "rarity": "rare"},
    "hero_exp_50k": {"hero_exp": 50000, "display": "📈 50K Hero EXP", "rarity": "rare"},
}

PITY_THRESHOLD_COMMON = 50   # Guaranteed SSR+ at 50 pulls for common
PITY_THRESHOLD_PREMIUM = 50  # Guaranteed UR at 50 pulls for premium
PITY_THRESHOLD_DIVINE = 40   # Guaranteed UR+ at 40 pulls for divine

# Divine Essence cost per pull
DIVINE_ESSENCE_COST_SINGLE = 1
DIVINE_ESSENCE_COST_MULTI = 10
CRYSTAL_COST_SINGLE = 100
CRYSTAL_COST_MULTI = 900  # 10 pulls, 100 crystal discount
COIN_COST_SINGLE = 1000
COIN_COST_MULTI = 9000

# Hero Skills Templates
def create_warrior_skills(rarity: str) -> List[HeroSkill]:
    base_mult = RARITY_MULTIPLIERS.get(rarity, 1.0)
    return [
        HeroSkill(id="w_slash", name="Crushing Blow", description="Deal heavy damage to a single enemy",
                  skill_type="active", damage_multiplier=1.5 * base_mult, cooldown=2, unlock_level=1),
        HeroSkill(id="w_taunt", name="Guardian's Taunt", description="Force enemies to attack you for 2 turns",
                  skill_type="active", buff_type="taunt", cooldown=4, unlock_level=10),
        HeroSkill(id="w_passive", name="Iron Will", description="Increases DEF by 15%",
                  skill_type="passive", buff_type="def", buff_percent=0.15, unlock_level=20),
        HeroSkill(id="w_ultimate", name="Judgment Strike", description="Massive damage to all enemies",
                  skill_type="active", damage_multiplier=2.5 * base_mult, cooldown=6, unlock_level=40, unlock_stars=3),
    ]

def create_mage_skills(rarity: str) -> List[HeroSkill]:
    base_mult = RARITY_MULTIPLIERS.get(rarity, 1.0)
    return [
        HeroSkill(id="m_bolt", name="Arcane Bolt", description="Magical attack on single target",
                  skill_type="active", damage_multiplier=1.8 * base_mult, cooldown=2, unlock_level=1),
        HeroSkill(id="m_aoe", name="Meteor Storm", description="Damage all enemies",
                  skill_type="active", damage_multiplier=1.2 * base_mult, cooldown=4, unlock_level=10),
        HeroSkill(id="m_passive", name="Arcane Mastery", description="Increases ATK by 20%",
                  skill_type="passive", buff_type="atk", buff_percent=0.20, unlock_level=20),
        HeroSkill(id="m_ultimate", name="Apocalypse", description="Devastating magic on all enemies",
                  skill_type="active", damage_multiplier=3.0 * base_mult, cooldown=6, unlock_level=40, unlock_stars=3),
    ]

def create_archer_skills(rarity: str) -> List[HeroSkill]:
    base_mult = RARITY_MULTIPLIERS.get(rarity, 1.0)
    return [
        HeroSkill(id="a_shot", name="Piercing Arrow", description="High damage to single target",
                  skill_type="active", damage_multiplier=1.6 * base_mult, cooldown=2, unlock_level=1),
        HeroSkill(id="a_rain", name="Arrow Rain", description="Damage all enemies",
                  skill_type="active", damage_multiplier=1.0 * base_mult, cooldown=4, unlock_level=10),
        HeroSkill(id="a_passive", name="Eagle Eye", description="Increases CRIT by 25%",
                  skill_type="passive", buff_type="crit", buff_percent=0.25, unlock_level=20),
        HeroSkill(id="a_ultimate", name="Divine Volley", description="Rapid attacks on random enemies",
                  skill_type="active", damage_multiplier=2.2 * base_mult, cooldown=6, unlock_level=40, unlock_stars=3),
    ]

# Initialize hero pool with expanded roster
HERO_POOL = [
    # ========== SR HEROES (Common) ==========
    # Warriors (Front Line)
    Hero(name="Azrael the Fallen", rarity="SR", element="Dark", hero_class="Warrior", 
         base_hp=1200, base_atk=150, base_def=100, base_speed=90, position="front",
         skills=create_warrior_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/50j0skb7_d761d1ac-f0ff-4f14-8a7f-87e5cc648362_0.webp",
         description="A fallen angel seeking redemption through battle"),
    Hero(name="Marcus the Shield", rarity="SR", element="Earth", hero_class="Warrior",
         base_hp=1400, base_atk=130, base_def=120, base_speed=85, position="front",
         skills=create_warrior_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/m81tep7w_0da7bd86-d35a-40ea-a1a5-46944c7d8e0b_1.webp",
         description="A stalwart defender who never retreats"),
    Hero(name="Kane the Berserker", rarity="SR", element="Fire", hero_class="Warrior",
         base_hp=1100, base_atk=170, base_def=80, base_speed=95, position="front",
         skills=create_warrior_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/9ngqqo95_1470e2cd-98b3-482f-acb6-fafc44807b7f_0.webp",
         description="Fury incarnate, dealing devastating blows"),
    
    # Mages (Back Line)
    Hero(name="Soren the Flame", rarity="SR", element="Fire", hero_class="Mage",
         base_hp=900, base_atk=180, base_def=70, base_speed=100, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/0f8i5knu_e5bd6276-a5ec-4e9d-8169-89acac57097c_0.webp",
         description="A passionate sorcerer wielding infernal flames"),
    Hero(name="Lysander the Frost", rarity="SR", element="Water", hero_class="Mage",
         base_hp=950, base_atk=175, base_def=75, base_speed=95, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/9ijpyi0f_c9ee07c0-d764-41db-928a-fd8a81db116c_0.webp",
         description="Master of ice who freezes enemies solid"),
    Hero(name="Theron the Storm", rarity="SR", element="Wind", hero_class="Mage",
         base_hp=880, base_atk=185, base_def=65, base_speed=110, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_anim-architecture/artifacts/k3vlxynj_4677f199-45e6-40e9-9041-90a2ceaa4bef_1.webp",
         description="Commands lightning and thunder with ease"),
    
    # Archers (Back Line)
    Hero(name="Kai the Tempest", rarity="SR", element="Wind", hero_class="Archer",
         base_hp=1000, base_atk=170, base_def=80, base_speed=115, position="back",
         skills=create_archer_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/srpcitke_1815eeaa-cab8-4cd7-9ba9-ab4bf787b3dc_1.webp",
         description="Swift as the wind, deadly as the storm"),
    Hero(name="Robin the Hunter", rarity="SR", element="Earth", hero_class="Archer",
         base_hp=1050, base_atk=165, base_def=85, base_speed=105, position="back",
         skills=create_archer_skills("SR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/yoie191d_c8795d3c-31ba-4cb8-8c5f-13453eb66a1c_1.webp",
         description="Never misses his mark, ever"),
    
    # ========== SSR HEROES ==========
    # Warriors
    Hero(name="Darius the Void", rarity="SSR", element="Dark", hero_class="Warrior",
         base_hp=2000, base_atk=200, base_def=180, base_speed=88, position="front",
         skills=create_warrior_skills("SSR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/2wqe1exw_877d7d48-2f40-4ae0-944d-a6946400e548_0.webp",
         description="A demonic guardian with impenetrable defense"),
    Hero(name="Leon the Paladin", rarity="SSR", element="Light", hero_class="Warrior",
         base_hp=1800, base_atk=220, base_def=160, base_speed=92, position="front",
         skills=create_warrior_skills("SSR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/6peescvq_fa7fcb4a-3719-4d48-8692-33ad74918ec6_0.webp",
         description="Holy warrior blessed by the divine"),
    
    # Mages
    Hero(name="Lucian the Divine", rarity="SSR", element="Light", hero_class="Mage",
         base_hp=1400, base_atk=260, base_def=120, base_speed=98, position="back",
         skills=create_mage_skills("SSR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/f7fqkty9_13d8d012-2401-426a-a0d8-1a9afedff057_0.webp",
         description="An angelic being with devastating magic"),
    Hero(name="Morgana the Shadow", rarity="SSR", element="Dark", hero_class="Mage",
         base_hp=1300, base_atk=280, base_def=100, base_speed=102, position="back",
         skills=create_mage_skills("SSR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/x9t7n51w_8228dfa1-3572-49cb-b789-5a621764f5d3_1.webp",
         description="Mistress of dark arts and forbidden spells"),
    
    # Archers
    Hero(name="Artemis the Swift", rarity="SSR", element="Wind", hero_class="Archer",
         base_hp=1500, base_atk=250, base_def=130, base_speed=120, position="back",
         skills=create_archer_skills("SSR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/o6074mys_5fe0fdf8-21e7-49f5-870e-259f14fb1409_1.webp",
         description="Goddess of the hunt, unmatched in speed"),
    
    # ========== SSR+ HEROES (Common Summon Exclusive) ==========
    Hero(name="Orion the Mystic", rarity="SSR+", element="Water", hero_class="Mage",
         base_hp=1700, base_atk=310, base_def=140, base_speed=105, position="back",
         skills=create_mage_skills("SSR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/r0wkb1xk_5bbd14c2-d4c3-4477-b6fa-3cdf4aabdae9_1.webp",
         description="A rare sorcerer who commands the tides"),
    Hero(name="Phoenix the Reborn", rarity="SSR+", element="Fire", hero_class="Warrior",
         base_hp=2100, base_atk=280, base_def=170, base_speed=95, position="front",
         skills=create_warrior_skills("SSR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/ir1idv9o_b2bd213d-4d35-4988-828c-a7c378dbabcd_0.webp",
         description="Rising from ashes, immortal in battle"),
    Hero(name="Gale the Windwalker", rarity="SSR+", element="Wind", hero_class="Archer",
         base_hp=1600, base_atk=300, base_def=130, base_speed=130, position="back",
         skills=create_archer_skills("SSR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/ndsa97l6_8a14cd8a-b83b-4232-9425-a0f490dace6c_1.webp",
         description="Moves faster than the eye can see"),
    
    # ========== UR HEROES (Premium Crystal Exclusive) ==========
    Hero(name="Seraphiel the Radiant", rarity="UR", element="Light", hero_class="Mage",
         base_hp=2000, base_atk=380, base_def=180, base_speed=110, position="back",
         skills=create_mage_skills("UR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/yd2leerw_65d04397-928b-4153-af53-96c39918910e_0.webp",
         description="An archangel with power beyond mortal comprehension"),
    Hero(name="Malachi the Destroyer", rarity="UR", element="Fire", hero_class="Warrior",
         base_hp=2500, base_atk=350, base_def=200, base_speed=100, position="front",
         skills=create_warrior_skills("UR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/qwvq8m6v_d0e5654d-dc16-47cd-8a70-6a123478289c_1.webp",
         description="A god of war who revels in destruction"),
    Hero(name="Selene the Moonbow", rarity="UR", element="Dark", hero_class="Archer",
         base_hp=1900, base_atk=400, base_def=160, base_speed=125, position="back",
         skills=create_archer_skills("UR"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/ookkqikz_1949fe60-a799-4d0d-8103-0130d0644d51_0.webp",
         description="Huntress of the night, death from the shadows"),
    
    # ========== UR+ HEROES (Divine Summon Exclusive) ==========
    Hero(name="Raphael the Eternal", rarity="UR+", element="Light", hero_class="Mage",
         base_hp=2800, base_atk=500, base_def=220, base_speed=115, position="back",
         skills=create_mage_skills("UR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/thladr5g_f649bfb6-10cc-460a-ba97-832e416a36a6_0.webp",
         description="The supreme deity of magic and transcendence"),
    Hero(name="Michael the Archangel", rarity="UR+", element="Light", hero_class="Warrior",
         base_hp=3200, base_atk=450, base_def=280, base_speed=105, position="front",
         skills=create_warrior_skills("UR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/esd84dro_a9902469-a543-4564-a32d-1d5c5f6d3834_1.webp",
         description="Commander of the heavenly host, invincible in combat"),
    Hero(name="Apollyon the Fallen", rarity="UR+", element="Dark", hero_class="Archer",
         base_hp=2600, base_atk=520, base_def=200, base_speed=135, position="back",
         skills=create_archer_skills("UR+"),
         image_url="https://customer-assets.emergentagent.com/job_c8748f08-a318-4a5c-a64d-da94566b2c02/artifacts/by0e84wz_72919b08-6082-4031-8fc1-0e7a4dc1433c_1.webp",
         description="The angel of the abyss, bringer of destruction"),
]

async def init_heroes():
    """Initialize hero pool in database - uses stable IDs to prevent sync issues"""
    for hero in HERO_POOL:
        # Use upsert to ensure hero data is always in sync with code
        # The stable ID ensures the same hero always has the same ID
        await db.heroes.update_one(
            {"id": hero.id},  # Match by stable ID
            {"$set": hero.dict()},
            upsert=True
        )
    
    # Clean up any old heroes that might have random UUIDs
    valid_ids = [h.id for h in HERO_POOL]
    await db.heroes.delete_many({"id": {"$nin": valid_ids}})

async def init_islands_and_chapters():
    """Initialize story mode islands and chapters"""
    islands_data = [
        {"name": "Celestial Shores", "order": 1, "chapters": [1, 2, 3, 4, 5], "unlock_chapter": 0},
        {"name": "Infernal Wastelands", "order": 2, "chapters": [6, 7, 8, 9, 10], "unlock_chapter": 5},
        {"name": "Mystic Peaks", "order": 3, "chapters": [11, 12, 13, 14, 15], "unlock_chapter": 10},
        {"name": "Void Dimension", "order": 4, "chapters": [16, 17, 18, 19, 20], "unlock_chapter": 15},
        {"name": "Divine Realm", "order": 5, "chapters": [21, 22, 23, 24, 25], "unlock_chapter": 20},
    ]
    
    for island_data in islands_data:
        existing = await db.islands.find_one({"name": island_data["name"]})
        if not existing:
            island = Island(**island_data)
            await db.islands.insert_one(island.dict())
    
    # Chapter configuration with progressive difficulty
    chapters_data = []
    base_power = 1000
    for i in range(1, 26):
        island_id = ""
        for island_data in islands_data:
            if i in island_data["chapters"]:
                island_result = await db.islands.find_one({"name": island_data["name"]})
                island_id = island_result["id"] if island_result else ""
                break
        
        # Progressive difficulty scaling (F2P becomes harder)
        difficulty_multiplier = 1.0 + (i - 1) * 0.15  # 15% increase per chapter
        required_power = int(base_power * difficulty_multiplier * 0.7)  # 70% of enemy power
        enemy_power = int(base_power * difficulty_multiplier)
        
        chapter = Chapter(
            chapter_number=i,
            island_id=island_id,
            name=f"Chapter {i}: Trial of Valor",
            required_power=required_power,
            enemy_power=enemy_power,
            rewards={"coins": 500 * i, "gold": 250 * i, "crystals": 10 * (i // 5)},
            first_clear_bonus={"crystals": 50, "coins": 2000}
        )
        
        existing = await db.chapters.find_one({"chapter_number": i})
        if not existing:
            await db.chapters.insert_one(chapter.dict())

@app.on_event("startup")
async def startup_event():
    await init_heroes()
    await init_islands_and_chapters()
    
    # =============================================================================
    # IDENTITY HARDENING: Database indexes and migrations
    # =============================================================================
    
    # 1. Create unique index on username_canon (NOT sparse - all users must have it)
    try:
        # Drop sparse index if it exists, then create non-sparse
        await db.users.drop_index("username_canon_1")
    except Exception:
        pass  # Index may not exist
    try:
        await db.users.create_index([("username_canon", 1)], unique=True)
        print("✅ Created unique index on username_canon (non-sparse)")
    except Exception as e:
        print(f"⚠️ Index on username_canon may already exist: {e}")
    
    # 2. Create unique index on user.id for fast JWT lookups
    # NOT sparse - migration guarantees all users have UUID id
    # NOTE: If index already exists with different options, manually drop and recreate
    try:
        await db.users.create_index([("id", 1)], unique=True)
        print("✅ Created unique index on user.id (non-sparse)")
    except Exception as e:
        # Index may already exist (possibly with different options like sparse)
        # This is fine - the index serves its purpose either way
        # To change index options, run a manual migration script
        if "already exists" in str(e).lower() or "IndexKeySpecsConflict" in str(e):
            print("ℹ️ Index on user.id already exists (run migration script to change options)")
        else:
            print(f"⚠️ Index on user.id: {e}")
    
    # 3. Migrate existing users: populate username_canon if missing/null/empty
    users_without_canon = await db.users.find({
        "$or": [
            {"username_canon": {"$exists": False}},
            {"username_canon": None},
            {"username_canon": ""},
        ]
    }).to_list(None)
    if users_without_canon:
        print(f"🔄 Migrating {len(users_without_canon)} users to have username_canon...")
        for user in users_without_canon:
            username = user.get("username", "")
            if username:
                canon = canonicalize_username(username)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"username_canon": canon}}
                )
        print(f"✅ Migration complete: {len(users_without_canon)} users updated with username_canon")
    
    # 4. Migrate legacy users: ensure all have UUID "id" field (not null/empty)
    users_without_uuid = await db.users.find({
        "$or": [
            {"id": {"$exists": False}},
            {"id": None},
            {"id": ""},
        ]
    }).to_list(None)
    if users_without_uuid:
        print(f"🔄 Migrating {len(users_without_uuid)} users to have UUID id...")
        for user in users_without_uuid:
            new_id = str(uuid.uuid4())
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"id": new_id}}
            )
        print(f"✅ Migration complete: {len(users_without_uuid)} users updated with UUID id")
    
    # SECURITY: Enforce single admin (only username_canon=="adam")
    await enforce_single_admin()
    print(f"✅ Admin enforcement complete. Super admin canon: {SUPER_ADMIN_CANON}")
    
    # Create chat indexes for performance
    await db.chat_messages.create_index([("channel_type", 1), ("timestamp", -1)])
    await db.chat_messages.create_index([("sender_id", 1)])
    await db.chat_messages.create_index([("client_msg_id", 1)], sparse=True)
    await db.chat_messages.create_index([("timestamp", 1)], expireAfterSeconds=90*24*60*60)  # 90 day retention
    
    # Create moderation indexes
    await db.chat_reports.create_index([("status", 1), ("created_at", -1)])
    await db.chat_reports.create_index([("reported_user_id", 1)])
    await db.chat_user_status.create_index([("user_id", 1)], unique=True)
    await db.chat_moderation_log.create_index([("username", 1), ("issued_at", -1)])
    
    # Create GOD MODE audit log indexes for fast investigation queries
    try:
        await db.admin_audit_log.create_index([("issued_at", -1)])
        await db.admin_audit_log.create_index([("action_type", 1), ("issued_at", -1)])
        await db.admin_audit_log.create_index([("target_username", 1), ("issued_at", -1)])
        await db.admin_audit_log.create_index([("target_user_id", 1), ("issued_at", -1)])
        await db.admin_audit_log.create_index([("issued_by", 1), ("issued_at", -1)])
        await db.admin_audit_log.create_index([("request_id", 1)], unique=True)  # Always generated, not sparse
        await db.admin_audit_log.create_index([("batch_id", 1)], sparse=True)  # Optional field, sparse OK
        await db.admin_audit_log.create_index([("auth_jti", 1)], sparse=True)  # Optional field, sparse OK
        print("✅ Created admin_audit_log indexes")
    except Exception as e:
        # Index may already exist (possibly with different options like sparse)
        # This is fine - the index serves its purpose either way
        if "already exists" in str(e).lower() or "IndexKeySpecsConflict" in str(e):
            print("ℹ️ admin_audit_log indexes already exist (run migration script to change options)")
        else:
            print(f"⚠️ admin_audit_log indexes: {e}")
    
    # Create token revocation indexes
    try:
        await db.revoked_tokens.create_index([("jti", 1)], unique=True)  # Fast lookup by token ID
        await db.revoked_tokens.create_index([("user_id", 1)])  # Find all revoked tokens for a user
        await db.revoked_tokens.create_index([("expires_at", 1)], expireAfterSeconds=0)  # TTL cleanup
        print("✅ Created revoked_tokens indexes (jti unique, user_id, TTL on expires_at)")
    except Exception as e:
        print(f"⚠️ revoked_tokens indexes may already exist: {e}")

async def get_random_hero_from_db(pity_counter: int, summon_type: str = "common"):
    """Select a random hero based on gacha rates with pity system
    
    Args:
        pity_counter: Number of pulls since last high-tier hero
        summon_type: "common" (coins), "premium" (crystals/UR), or "divine" (divine essence/UR+)
    
    Returns:
        For divine summons: tuple (hero_or_none, filler_reward_or_none)
        For other summons: hero dict
    """
    if summon_type == "divine":
        # Divine pool: Mixed rewards - Heroes (UR+/UR) + Crystals + Filler
        # Pity system: guarantee UR+ at threshold
        if pity_counter >= PITY_THRESHOLD_DIVINE:
            # Pity hit - guaranteed UR+ hero
            available_heroes = await db.heroes.find({"rarity": "UR+"}).to_list(100)
            hero = random.choice(available_heroes) if available_heroes else None
            return (hero, None)
        
        # Roll for reward type
        reward_types = list(GACHA_RATES_DIVINE.keys())
        weights = list(GACHA_RATES_DIVINE.values())
        selected_reward = random.choices(reward_types, weights=weights)[0]
        
        # Check if it's a hero roll
        if selected_reward in ["UR+", "UR"]:
            available_heroes = await db.heroes.find({"rarity": selected_reward}).to_list(100)
            hero = random.choice(available_heroes) if available_heroes else None
            return (hero, None)
        
        # It's a filler reward (crystals, gold, essence, shards)
        filler_data = DIVINE_FILLER_REWARDS.get(selected_reward, {})
        return (None, {
            "type": selected_reward,
            **filler_data
        })
    
    elif summon_type == "premium":
        # Premium pool: SR, SSR, UR (no UR+ - moved to divine)
        available_heroes = await db.heroes.find({"rarity": {"$in": ["SR", "SSR", "UR"]}}).to_list(100)
        rates = GACHA_RATES_PREMIUM
        pity_threshold = PITY_THRESHOLD_PREMIUM
        
        # Pity system: guarantee UR at threshold
        if pity_counter >= pity_threshold:
            rarities = ["SSR", "UR"]
            weights = [30, 70]  # High UR chance at pity
        else:
            rarities = list(rates.keys())
            weights = list(rates.values())
    
    else:  # common
        # Common pool: SR, SSR, and SSR+ heroes only (no UR/UR+)
        available_heroes = await db.heroes.find({"rarity": {"$in": ["SR", "SSR", "SSR+"]}}).to_list(100)
        rates = GACHA_RATES_COMMON
        pity_threshold = PITY_THRESHOLD_COMMON
        
        # Common pity: guaranteed SSR or SSR+
        if pity_counter >= pity_threshold:
            rarities = ["SSR", "SSR+"]
            weights = [70, 30]  # SSR+ is rarer even at pity
        else:
            rarities = list(rates.keys())
            weights = list(rates.values())
    
    selected_rarity = random.choices(rarities, weights=weights)[0]
    
    # Get all heroes of selected rarity from available pool
    rarity_heroes = [h for h in available_heroes if h.get("rarity") == selected_rarity]
    
    if not rarity_heroes:
        # Fallback to SR if no heroes found (shouldn't happen)
        rarity_heroes = [h for h in available_heroes if h.get("rarity") == "SR"]
    
    return random.choice(rarity_heroes) if rarity_heroes else None

# API Routes - Authentication Models
class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    user: dict
    token: str
    message: str

@api_router.post("/user/register")
async def register_user(request: RegisterRequest):
    """Register a new user with password.
    
    SECURITY:
    - Creates canonical username (lowercase) for reliable lookups
    - Rejects any username in RESERVED_USERNAMES_CANON (always includes "adam")
    - JWT 'sub' is the immutable UUID "id" field (not username)
    """
    username = request.username.strip()
    password = request.password
    
    # Create canonical username for lookups
    username_canon = canonicalize_username(username)
    
    # Validate username
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be less than 20 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
    
    # SECURITY: Check reserved usernames (always includes "adam")
    if username_canon in RESERVED_USERNAMES_CANON:
        raise HTTPException(status_code=400, detail="This username is reserved")
    
    # Validate password
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if canonical username exists (prevents 'Adam', 'ADAM', 'adam' duplicates)
    existing = await db.users.find_one({"username_canon": username_canon})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user with hashed password and canonical username
    user = User(
        username=username,
        username_canon=username_canon,
        password_hash=hash_password(password)
    )
    await db.users.insert_one(user.dict())
    
    # Create JWT token with UUID "id" as subject (NEVER username)
    token = create_access_token(data={"sub": user.id})
    
    user_dict = user.dict()
    del user_dict["password_hash"]  # Don't send password hash to client
    
    return {
        "user": user_dict,
        "token": token,
        "message": "Account created successfully"
    }

@api_router.post("/auth/login")
async def auth_login(request: LoginRequest):
    """Authenticate user with password and return JWT token.
    
    SECURITY:
    - Looks up user via username_canon (prevents case-sensitivity exploits)
    - JWT 'sub' is ALWAYS the UUID "id" field (never ObjectId)
    """
    username = request.username.strip()
    password = request.password
    
    # Find user by canonical username (case-insensitive lookup)
    username_canon = canonicalize_username(username)
    user = await db.users.find_one({"username_canon": username_canon})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # SECURITY: Ensure user has UUID "id" field (migrate if needed)
    if not user.get("id"):
        # Legacy user without UUID id - generate one now
        new_id = str(uuid.uuid4())
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"id": new_id}}
        )
        user["id"] = new_id
    
    # Check if user has a password set
    if not user.get("password_hash"):
        # Legacy user without password - require password setup
        raise HTTPException(
            status_code=403, 
            detail="This account requires a password. Please set a password to continue."
        )
    
    # Verify password
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create JWT token with UUID "id" as subject (NEVER use _id)
    token = create_access_token(data={"sub": user["id"]})
    
    # Return user data without password hash
    user_data = convert_objectid(user.copy())
    if "password_hash" in user_data:
        del user_data["password_hash"]
    
    return {
        "user": user_data,
        "token": token,
        "message": "Login successful"
    }

@api_router.post("/auth/set-password")
async def set_password(username: str, new_password: str):
    """Set password for a legacy account (users without passwords).
    
    SECURITY: Looks up user via username_canon, ensures UUID id, JWT uses UUID.
    """
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    username_canon = canonicalize_username(username)
    user = await db.users.find_one({"username_canon": username_canon})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # SECURITY: Frozen accounts cannot change password
    assert_account_active(user)
    
    if user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account already has a password")
    
    # Ensure user has UUID id
    if not user.get("id"):
        new_id = str(uuid.uuid4())
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"id": new_id}}
        )
        user["id"] = new_id
    
    # Set the password
    await db.users.update_one(
        {"username_canon": username_canon},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Create JWT token with UUID "id" as subject (NEVER use _id)
    token = create_access_token(data={"sub": user["id"]})
    
    return {
        "message": "Password set successfully",
        "token": token
    }

@api_router.get("/auth/verify")
async def verify_auth(current_user: dict = Depends(get_current_user)):
    """Verify JWT token is valid and return user data"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_data = convert_objectid(current_user.copy())
    if "password_hash" in user_data:
        del user_data["password_hash"]
    
    return {"valid": True, "user": user_data}


@api_router.post("/auth/logout")
@limiter.limit("10/minute")  # Prevent logout spam
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Logout by revoking the current token.
    
    The token's jti is added to the revoked_tokens collection,
    making it immediately invalid for future requests.
    
    Rate limited to 10/minute to prevent abuse.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    jti = current_user.get("_auth_jti")
    exp = current_user.get("_auth_exp")
    user_id = get_user_id(current_user)
    
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid token: missing jti")
    
    if exp is None:
        raise HTTPException(status_code=401, detail="Invalid token: missing expiration")
    
    # Derive expires_at from token exp (timezone-aware UTC) + 5 minute buffer for clock skew
    try:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) + timedelta(minutes=5)
    except (ValueError, TypeError, OSError):
        raise HTTPException(status_code=401, detail="Invalid token: invalid expiration")
    
    await revoke_token(
        jti=jti,
        user_id=user_id,
        expires_at=expires_at,
        reason="User logout",
        revoked_by=current_user.get("username"),
    )
    
    return {"success": True, "message": "Logged out successfully"}


# =============================================================================
# SUPER ADMIN BOOTSTRAP ENDPOINT (One-time use)
# =============================================================================
class BootstrapAdminRequest(BaseModel):
    password: str

@api_router.post("/admin/bootstrap-super-admin")
async def bootstrap_super_admin(
    request: BootstrapAdminRequest,
    bootstrap_token: str = Header(None, alias="X-Bootstrap-Token")
):
    """
    One-time endpoint to create the ADAM super admin account.
    
    SECURITY:
    - Requires SUPER_ADMIN_BOOTSTRAP_TOKEN env var to be set
    - Requires X-Bootstrap-Token header to match
    - Can only be used ONCE (fails if adam account exists)
    - After use, remove SUPER_ADMIN_BOOTSTRAP_TOKEN from env
    
    Usage:
    1. Set SUPER_ADMIN_BOOTSTRAP_TOKEN=<secure-random-token> in env
    2. Call this endpoint with X-Bootstrap-Token: <same-token>
    3. Remove SUPER_ADMIN_BOOTSTRAP_TOKEN from env
    """
    # Check if bootstrap is enabled
    if not SUPER_ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=403, 
            detail="Bootstrap disabled. Set SUPER_ADMIN_BOOTSTRAP_TOKEN env var."
        )
    
    # Verify bootstrap token
    if not bootstrap_token or bootstrap_token != SUPER_ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid bootstrap token")
    
    # Validate password
    if len(request.password) < 12:
        raise HTTPException(
            status_code=400, 
            detail="Admin password must be at least 12 characters"
        )
    
    # Check if admin account already exists (uses hardcoded SUPER_ADMIN_CANON)
    existing = await db.users.find_one({"username_canon": SUPER_ADMIN_CANON})
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Super admin account already exists. Bootstrap can only run once."
        )
    
    # Create admin account with hardcoded canonical name
    admin_user = User(
        username=SUPER_ADMIN_DISPLAY_NAME,  # Display name only
        username_canon=SUPER_ADMIN_CANON,   # Hardcoded identity
        password_hash=hash_password(request.password)
    )
    await db.users.insert_one(admin_user.dict())
    
    # Mark as admin
    await db.users.update_one(
        {"username_canon": SUPER_ADMIN_CANON},
        {"$set": {"is_admin": True}}
    )
    
    # Create JWT token
    token = create_access_token(data={"sub": admin_user.id})
    
    return {
        "message": f"Super admin account created successfully",
        "token": token,
        "warning": "Remove SUPER_ADMIN_BOOTSTRAP_TOKEN from environment immediately!"
    }

@api_router.get("/user/{username}")
async def get_user(username: str):
    """Get user data"""
    user = await get_user_readonly(username)  # Includes frozen check
    return convert_objectid(user)

@api_router.post("/user/{username}/login")
async def user_login(username: str):
    """Handle daily login tracking - NO rewards given here"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    now = datetime.utcnow()
    last_login = user_data.get("last_login")
    login_days = user_data.get("login_days", 0)
    
    # Check if it's a new day - only increment login_days
    if last_login:
        if isinstance(last_login, str):
            last_login = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
        last_login_date = last_login.date()
        today = now.date()
        if last_login_date < today:
            login_days += 1
    else:
        login_days = 1
    
    # Update last login time only - NO rewards
    await db.users.update_one(
        {"username": username},
        {"$set": {
            "last_login": now,
            "login_days": login_days
        }}
    )
    
    # Return minimal response - no free rewards
    return {
        "day_count": login_days,
        "coins": 0,
        "gold": 0,
        "crystals": 0,
        "gems": 0,
        "free_summons": 0
    }

@api_router.post("/user/{username}/profile-picture")
async def update_profile_picture(username: str, hero_id: str):
    """Update user's profile picture to a hero they own"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    # Verify user owns this hero
    user_hero = await db.user_heroes.find_one({"user_id": user_data["id"], "hero_id": hero_id})
    if not user_hero:
        raise HTTPException(status_code=400, detail="You don't own this hero")
    
    # Update profile picture
    await db.users.update_one(
        {"username": username},
        {"$set": {"profile_picture_hero_id": hero_id}}
    )
    
    return {"message": "Profile picture updated successfully", "hero_id": hero_id}

# Frame definitions with VIP requirements
FRAME_DEFINITIONS = {
    "default": {"name": "Basic Frame", "required_vip": 0},
    "bronze": {"name": "Bronze Frame", "required_vip": 1},
    "silver": {"name": "Silver Frame", "required_vip": 3},
    "gold": {"name": "Golden Frame", "required_vip": 5},
    "platinum": {"name": "Platinum Frame", "required_vip": 7},
    "diamond": {"name": "Diamond Frame", "required_vip": 9},
    "rainbow": {"name": "Rainbow Frame", "required_vip": 11},
    "legendary": {"name": "Legendary Frame", "required_vip": 13},
    "divine": {"name": "Divine Frame", "required_vip": 15},
    # Special frames unlocked by achievements
    "champion": {"name": "Arena Champion", "special": True},
    "abyss_conqueror": {"name": "Abyss Conqueror", "special": True},
    "guild_master": {"name": "Guild Master", "special": True},
    "campaign_hero": {"name": "Campaign Hero", "special": True},
}

@api_router.get("/user/{username}/frames")
async def get_user_frames(username: str):
    """Get all frames available to a user based on VIP level and achievements"""
    user_data = await get_user_readonly(username)  # Includes frozen check
    
    vip_level = user_data.get("vip_level", 0)
    unlocked_special = user_data.get("unlocked_frames", [])
    equipped_frame = user_data.get("equipped_frame") or user_data.get("avatar_frame", "default")
    
    available_frames = []
    locked_frames = []
    
    for frame_id, frame_data in FRAME_DEFINITIONS.items():
        frame_info = {
            "id": frame_id,
            "name": frame_data["name"],
            "is_equipped": frame_id == equipped_frame,
        }
        
        if frame_data.get("special"):
            frame_info["is_special"] = True
            if frame_id in unlocked_special:
                frame_info["unlocked"] = True
                available_frames.append(frame_info)
            else:
                frame_info["unlocked"] = False
                frame_info["unlock_hint"] = f"Unlock through {frame_data['name'].replace(' ', ' ').lower()} achievement"
                locked_frames.append(frame_info)
        else:
            frame_info["required_vip"] = frame_data["required_vip"]
            if vip_level >= frame_data["required_vip"]:
                frame_info["unlocked"] = True
                available_frames.append(frame_info)
            else:
                frame_info["unlocked"] = False
                locked_frames.append(frame_info)
    
    return {
        "equipped_frame": equipped_frame,
        "vip_level": vip_level,
        "available_frames": available_frames,
        "locked_frames": locked_frames,
    }

@api_router.post("/user/{username}/equip-frame")
async def equip_frame(username: str, frame_id: str):
    """Equip a profile frame"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    vip_level = user_data.get("vip_level", 0)
    unlocked_special = user_data.get("unlocked_frames", [])
    
    # Validate frame exists
    if frame_id not in FRAME_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Invalid frame ID")
    
    frame_data = FRAME_DEFINITIONS[frame_id]
    
    # Check if user can equip this frame
    if frame_data.get("special"):
        if frame_id not in unlocked_special:
            raise HTTPException(status_code=403, detail="You haven't unlocked this special frame")
    else:
        if vip_level < frame_data["required_vip"]:
            raise HTTPException(
                status_code=403, 
                detail=f"VIP {frame_data['required_vip']} required for this frame"
            )
    
    # Equip the frame
    await db.users.update_one(
        {"username": username},
        {"$set": {"equipped_frame": frame_id, "avatar_frame": frame_id}}
    )
    
    return {
        "success": True,
        "message": f"Equipped {frame_data['name']}",
        "equipped_frame": frame_id,
    }

@api_router.post("/user/{username}/unequip-frame")
async def unequip_frame(username: str):
    """Unequip current frame and revert to default"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    await db.users.update_one(
        {"username": username},
        {"$set": {"equipped_frame": "default", "avatar_frame": "default"}}
    )
    
    return {
        "success": True,
        "message": "Frame unequipped, reverted to default",
        "equipped_frame": "default",
    }

# ============================================
# CHAT BUBBLE SYSTEM
# ============================================

# Chat bubble definitions - some are hidden/exclusive
CHAT_BUBBLE_DEFINITIONS = {
    "default": {
        "name": "Basic Bubble",
        "colors": ["#FAF9F6", "#F5F5DC"],  # Eggshell white
        "text_color": "#1a1a1a",
        "border_color": "#d4d4d4",
        "unlock_method": "default",
        "description": "Standard chat bubble"
    },
    "vip_emerald": {
        "name": "Emerald Elite",
        "colors": ["#50C878", "#228B22"],  # Emerald green
        "text_color": "#ffffff",
        "border_color": "#006400",
        "icon": "💎",
        "unlock_method": "vip",
        "required_vip": 9,
        "description": "Exclusive to VIP 9+ members"
    },
    "vip_skyblue": {
        "name": "Sky Sovereign",
        "colors": ["#87CEEB", "#00BFFF"],  # Sky blue
        "text_color": "#ffffff",
        "border_color": "#4169E1",
        "icon": "☁️",
        "unlock_method": "vip",
        "required_vip": 15,
        "description": "Ultimate VIP 15 exclusive"
    },
    "selene_fuchsia": {
        "name": "Chrono Whisper",
        "colors": ["#FF00FF", "#DA70D6", "#BA55D3"],  # Fuchsia/Magenta
        "text_color": "#ffffff",
        "border_color": "#8B008B",
        "icon": "⏳",
        "unlock_method": "selene_spending",
        "required_spending": 200.00,  # Hidden requirement
        "description": "Rare collector's bubble",
        "hidden_unlock": True  # Don't show the real requirement
    },
    "admin_rainbow": {
        "name": "Cosmic Creator",
        "colors": ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#9400D3"],
        "text_color": "#ffffff",
        "border_color": "#FFD700",
        "icon": "🌈",
        "unlock_method": "admin_exclusive",
        "description": "One of a kind - The Creator's Mark",
        "unique": True,
        "glow_effect": True,
        "animated": True
    }
}

@api_router.get("/user/{username}/chat-bubbles")
async def get_user_chat_bubbles(username: str):
    """Get all chat bubbles available to a user"""
    user_data = await get_user_readonly(username)  # Includes frozen check
    
    vip_level = user_data.get("vip_level", 0)
    equipped_bubble = user_data.get("equipped_chat_bubble", "default")
    unlocked_bubbles = user_data.get("unlocked_chat_bubbles", ["default"])
    is_admin = user_data.get("is_admin", False)
    
    # Get Selene banner spending
    selene_progress = await db.selene_banner_progress.find_one({"user_id": user_data["id"]})
    selene_spending = selene_progress.get("total_spent_usd", 0) if selene_progress else 0
    
    available_bubbles = []
    locked_bubbles = []
    
    for bubble_id, bubble_data in CHAT_BUBBLE_DEFINITIONS.items():
        bubble_info = {
            "id": bubble_id,
            "name": bubble_data["name"],
            "colors": bubble_data["colors"],
            "text_color": bubble_data["text_color"],
            "border_color": bubble_data["border_color"],
            "icon": bubble_data.get("icon"),
            "description": bubble_data["description"],
            "is_equipped": bubble_id == equipped_bubble,
            "glow_effect": bubble_data.get("glow_effect", False),
            "animated": bubble_data.get("animated", False),
        }
        
        unlock_method = bubble_data["unlock_method"]
        is_unlocked = False
        
        if unlock_method == "default":
            is_unlocked = True
        elif unlock_method == "vip":
            is_unlocked = vip_level >= bubble_data.get("required_vip", 0)
            if not is_unlocked:
                bubble_info["unlock_hint"] = f"Reach VIP {bubble_data['required_vip']}"
        elif unlock_method == "selene_spending":
            is_unlocked = selene_spending >= bubble_data.get("required_spending", 0)
            if not is_unlocked:
                # Hidden requirement - show vague hint
                bubble_info["unlock_hint"] = "Support the Fated Chronology event"
        elif unlock_method == "admin_exclusive":
            is_unlocked = is_admin and username == "Adam"  # Only Adam gets this
            if not is_unlocked:
                bubble_info["unlock_hint"] = "???"
                bubble_info["unique"] = True
        
        # Check if manually unlocked
        if bubble_id in unlocked_bubbles:
            is_unlocked = True
        
        bubble_info["unlocked"] = is_unlocked
        
        if is_unlocked:
            available_bubbles.append(bubble_info)
        else:
            locked_bubbles.append(bubble_info)
    
    return {
        "equipped_bubble": equipped_bubble,
        "available_bubbles": available_bubbles,
        "locked_bubbles": locked_bubbles,
        "vip_level": vip_level,
    }

@api_router.post("/user/{username}/equip-chat-bubble")
async def equip_chat_bubble(username: str, bubble_id: str):
    """Equip a chat bubble"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    # Validate bubble exists
    if bubble_id not in CHAT_BUBBLE_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Invalid bubble ID")
    
    bubble_data = CHAT_BUBBLE_DEFINITIONS[bubble_id]
    vip_level = user_data.get("vip_level", 0)
    unlocked_bubbles = user_data.get("unlocked_chat_bubbles", ["default"])
    is_admin = user_data.get("is_admin", False)
    
    # Check unlock requirements
    unlock_method = bubble_data["unlock_method"]
    can_equip = False
    
    if unlock_method == "default":
        can_equip = True
    elif unlock_method == "vip":
        can_equip = vip_level >= bubble_data.get("required_vip", 0)
    elif unlock_method == "selene_spending":
        selene_progress = await db.selene_banner_progress.find_one({"user_id": user_data["id"]})
        selene_spending = selene_progress.get("total_spent_usd", 0) if selene_progress else 0
        can_equip = selene_spending >= bubble_data.get("required_spending", 0)
    elif unlock_method == "admin_exclusive":
        can_equip = is_admin and username == "Adam"
    
    if bubble_id in unlocked_bubbles:
        can_equip = True
    
    if not can_equip:
        raise HTTPException(status_code=403, detail="You haven't unlocked this chat bubble")
    
    # Equip the bubble
    await db.users.update_one(
        {"username": username},
        {"$set": {"equipped_chat_bubble": bubble_id}}
    )
    
    return {
        "success": True,
        "message": f"Equipped {bubble_data['name']}",
        "equipped_bubble": bubble_id,
    }

@api_router.get("/chat/user-bubble/{username}")
async def get_user_equipped_bubble(username: str):
    """Get a user's equipped chat bubble for display"""
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        return CHAT_BUBBLE_DEFINITIONS["default"]
    
    bubble_id = user_data.get("equipped_chat_bubble", "default")
    bubble = CHAT_BUBBLE_DEFINITIONS.get(bubble_id, CHAT_BUBBLE_DEFINITIONS["default"])
    
    return {
        "bubble_id": bubble_id,
        **bubble
    }

# Update Selene banner to track spending
@api_router.post("/selene-banner/record-purchase")
async def record_selene_purchase(username: str, amount_usd: float, bundle_id: str):
    """Record a purchase on the Selene banner (for chat bubble unlock tracking)"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    # Update spending tracking
    await db.selene_banner_progress.update_one(
        {"user_id": user_data["id"]},
        {
            "$inc": {"total_spent_usd": amount_usd},
            "$push": {
                "purchase_history": {
                    "bundle_id": bundle_id,
                    "amount_usd": amount_usd,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        },
        upsert=True
    )
    
    # Check if they unlocked the fuchsia bubble
    progress = await db.selene_banner_progress.find_one({"user_id": user_data["id"]})
    total_spent = progress.get("total_spent_usd", 0)
    
    unlocked_bubble = None
    if total_spent >= 200.00:
        # Silently unlock the fuchsia bubble
        await db.users.update_one(
            {"username": username},
            {"$addToSet": {"unlocked_chat_bubbles": "selene_fuchsia"}}
        )
        unlocked_bubble = "selene_fuchsia"
    
    return {
        "success": True,
        "total_spent": total_spent,
        "unlocked_bubble": unlocked_bubble  # Will be None unless they hit $200
    }

@api_router.post("/gacha/pull")
@limiter.limit("30/minute")  # Max 30 gacha pulls per minute per IP (prevents abuse)
async def pull_gacha(request: Request, username: str, body: PullRequest):
    """Perform gacha pull - Premium (crystals) or Common (coins) (rate limited)"""
    user_data = await get_user_for_mutation(username)  # Includes frozen check
    
    user = User(**user_data)
    num_pulls = 10 if body.pull_type == "multi" else 1
    
    # Determine summon type: common (coins), premium (crystals), or divine (divine_essence)
    summon_type = "common"
    if body.currency_type == "crystals":
        summon_type = "premium"
    elif body.currency_type == "divine_essence":
        summon_type = "divine"
    
    # Calculate cost and deduct
    if summon_type == "divine":
        cost = DIVINE_ESSENCE_COST_MULTI if body.pull_type == "multi" else DIVINE_ESSENCE_COST_SINGLE
        if user.divine_essence < cost:
            raise HTTPException(status_code=400, detail="Not enough Divine Essence")
        user.divine_essence -= cost
        crystals_spent = 0
        coins_spent = 0
        divine_spent = cost
        pity_counter = user.pity_counter_divine
    elif summon_type == "premium":
        cost = CRYSTAL_COST_MULTI if body.pull_type == "multi" else CRYSTAL_COST_SINGLE
        if user.crystals < cost:
            raise HTTPException(status_code=400, detail="Not enough crystals")
        user.crystals -= cost
        crystals_spent = cost
        coins_spent = 0
        divine_spent = 0
        pity_counter = user.pity_counter_premium
    else:  # common
        cost = COIN_COST_MULTI if body.pull_type == "multi" else COIN_COST_SINGLE
        if user.coins < cost:
            raise HTTPException(status_code=400, detail="Not enough coins")
        user.coins -= cost
        crystals_spent = 0
        coins_spent = cost
        divine_spent = 0
        pity_counter = user.pity_counter
    
    # Perform pulls
    pulled_heroes = []
    filler_rewards_collected = {
        "crystals": 0,
        "gold": 0,
        "coins": 0,
        "divine_essence": 0,
        "hero_shards": 0,
        "enhancement_stones": 0,
        "skill_essence": 0,
        "star_crystals": 0,
        "hero_exp": 0,
    }
    filler_display_items = []  # For showing in UI
    runes_earned = []  # For rune drops
    
    for _ in range(num_pulls):
        pity_counter += 1
        
        if summon_type == "divine":
            # Divine summon returns tuple: (hero_or_none, filler_reward_or_none)
            result = await get_random_hero_from_db(pity_counter, summon_type)
            hero, filler_reward = result
            
            if filler_reward:
                # Add filler rewards to collection
                for key in ["crystals", "gold", "coins", "divine_essence", "hero_shards", 
                           "enhancement_stones", "skill_essence", "star_crystals", "hero_exp"]:
                    if key in filler_reward:
                        filler_rewards_collected[key] += filler_reward[key]
                
                # Handle rune drops separately (they're actual items, not currency)
                if "rune" in filler_reward:
                    runes_earned.append(filler_reward["rune"])
                
                # Add display item for UI
                filler_display_items.append({
                    "type": filler_reward.get("type", "unknown"),
                    "display": filler_reward.get("display", "Reward"),
                    "rarity": filler_reward.get("rarity", "common"),
                    "is_filler": True
                })
                continue  # No hero to process
            
            if not hero:
                continue
            
            # Reset pity on UR+ hero
            if hero.get("rarity") == "UR+":
                pity_counter = 0
        else:
            # Premium/Common returns just hero
            hero = await get_random_hero_from_db(pity_counter, summon_type)
            
            if not hero:
                continue  # Skip if no hero found (shouldn't happen)
            
            # Reset pity based on pool type
            if summon_type == "premium":
                # Premium: reset on SSR or UR
                if hero.get("rarity") in ["SSR", "UR"]:
                    pity_counter = 0
            else:
                # Common: reset on SSR or SSR+
                if hero.get("rarity") in ["SSR", "SSR+"]:
                    pity_counter = 0
        
        # Create user hero instance
        user_hero = UserHero(
            user_id=user.id,
            hero_id=hero.get("id"),
            current_hp=hero.get("base_hp", 1000),
            current_atk=hero.get("base_atk", 100),
            current_def=hero.get("base_def", 50)
        )
        
        # Add hero info for frontend display
        user_hero_dict = user_hero.dict()
        user_hero_dict["hero_name"] = hero.get("name")
        user_hero_dict["rarity"] = hero.get("rarity")
        user_hero_dict["image_url"] = hero.get("image_url")
        user_hero_dict["element"] = hero.get("element")
        user_hero_dict["hero_class"] = hero.get("hero_class")
        
        # Check for duplicates and merge
        existing_heroes = await db.user_heroes.find(
            {"user_id": user.id, "hero_id": hero.get("id")}
        ).to_list(100)
        
        if existing_heroes:
            # Increment duplicates on the first instance
            first_hero = existing_heroes[0]
            await db.user_heroes.update_one(
                {"id": first_hero["id"]},
                {"$inc": {"duplicates": 1}}
            )
            # Update the hero instance to reflect duplicate
            user_hero.duplicates = first_hero.get("duplicates", 0) + 1
            user_hero.id = first_hero["id"]  # Use existing ID for return
        else:
            await db.user_heroes.insert_one(user_hero.dict())
        
        # Create server-wide marquee notification for UR or UR+ pulls
        if hero.get("rarity") in ["UR", "UR+"]:
            marquee = MarqueeNotification(
                server_id=user.server_id,
                username=username,
                hero_name=hero.get("name"),
                hero_rarity=hero.get("rarity"),
                message=f"🎉 {username} obtained {hero.get('rarity')} {hero.get('name')}!"
            )
            await db.marquee_notifications.insert_one(marquee.dict())
        
        pulled_heroes.append(user_hero_dict)
    
    user.total_pulls += num_pulls
    
    # Update user with new pity counter
    if summon_type == "divine":
        user.pity_counter_divine = pity_counter
        # Apply filler rewards from divine summons
        user.crystals += filler_rewards_collected.get("crystals", 0)
        user.gold += filler_rewards_collected.get("gold", 0)
        user.coins += filler_rewards_collected.get("coins", 0)
        user.divine_essence += filler_rewards_collected.get("divine_essence", 0)
        user.hero_shards = getattr(user, 'hero_shards', 0) + filler_rewards_collected.get("hero_shards", 0)
        # Apply new resource types
        user.enhancement_stones = getattr(user, 'enhancement_stones', 0) + filler_rewards_collected.get("enhancement_stones", 0)
        user.skill_essence = getattr(user, 'skill_essence', 0) + filler_rewards_collected.get("skill_essence", 0)
        user.star_crystals = getattr(user, 'star_crystals', 0) + filler_rewards_collected.get("star_crystals", 0)
        user.hero_exp = getattr(user, 'hero_exp', 0) + filler_rewards_collected.get("hero_exp", 0)
        
        # Create rune items for rune drops
        for rune_rarity in runes_earned:
            import random
            rune_stats = ["ATK", "DEF", "HP", "SPD", "CRIT", "CRIT_DMG"]
            main_stat = random.choice(rune_stats)
            rune_value = {"epic": random.randint(8, 15), "rare": random.randint(5, 10)}.get(rune_rarity, 5)
            
            rune_item = {
                "id": str(uuid.uuid4()),
                "user_id": user.id,
                "rarity": rune_rarity,
                "main_stat": main_stat,
                "main_value": rune_value,
                "sub_stats": [],
                "level": 0,
                "equipped_to": None,
                "created_at": datetime.utcnow().isoformat()
            }
            await db.user_runes.insert_one(rune_item)
    elif summon_type == "premium":
        user.pity_counter_premium = pity_counter
    else:
        user.pity_counter = pity_counter
    
    # Update user
    await db.users.update_one(
        {"username": username},
        {"$set": user.dict()}
    )
    
    # Combine heroes and filler rewards for display
    all_results = pulled_heroes + filler_display_items
    
    return {
        "heroes": all_results,  # Now includes both heroes and filler rewards
        "pulled_heroes_count": len(pulled_heroes),
        "filler_rewards_count": len(filler_display_items),
        "filler_rewards_collected": filler_rewards_collected,
        "runes_earned": len(runes_earned),
        "new_pity_counter": pity_counter,
        "crystals_spent": crystals_spent,
        "coins_spent": coins_spent,
        "divine_spent": divine_spent
    }

@api_router.get("/heroes")
async def get_all_heroes():
    """Get all available heroes in the pool"""
    heroes = await db.heroes.find().to_list(1000)
    return [convert_objectid(hero) for hero in heroes]

@api_router.get("/user/{username}/heroes")
async def get_user_heroes(username: str):
    """Get all heroes owned by user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    # Enrich with hero data + ascension images
    enriched_heroes = []
    for uh in user_heroes:
        hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
        if hero_data:
            hero_dict = convert_objectid(hero_data)
            # Add ascension images from manifest if available
            ascension_images = get_ascension_images(hero_dict.get("name", ""))
            if ascension_images:
                hero_dict["ascension_images"] = ascension_images
            enriched_heroes.append({
                **convert_objectid(uh),
                "hero_data": hero_dict
            })
    
    return enriched_heroes

@api_router.get("/user/{username}/heroes/{user_hero_id}")
async def get_user_hero_by_id(username: str, user_hero_id: str):
    """Get a single hero owned by user by its user_hero_id (not hero_id).
    
    This is the canonical single-hero fetch endpoint.
    Returns the enriched hero with hero_data and ascension images.
    """
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Find the user's hero instance by id
    user_hero = await db.user_heroes.find_one({"id": user_hero_id, "user_id": user["id"]})
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    # Enrich with hero data + ascension images
    hero_data = await db.heroes.find_one({"id": user_hero["hero_id"]})
    if hero_data:
        hero_dict = convert_objectid(hero_data)
        # Add ascension images from manifest if available
        ascension_images = get_ascension_images(hero_dict.get("name", ""))
        if ascension_images:
            hero_dict["ascension_images"] = ascension_images
        return {
            **convert_objectid(user_hero),
            "hero_data": hero_dict
        }
    
    # Fallback: return hero without enrichment if catalog entry missing
    return convert_objectid(user_hero)

@api_router.post("/user/{username}/heroes/{hero_instance_id}/upgrade")
async def upgrade_hero(username: str, hero_instance_id: str):
    """Upgrade hero rank using duplicates"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    hero = await db.user_heroes.find_one({"id": hero_instance_id, "user_id": user["id"]})
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    # Calculate duplicates needed for next rank
    current_rank = hero["rank"]
    if current_rank >= 10:
        raise HTTPException(status_code=400, detail="Max rank reached. Use star chart for further progression")
    
    duplicates_needed = current_rank * 2  # Progressive duplicate requirement
    
    if hero["duplicates"] < duplicates_needed:
        raise HTTPException(status_code=400, detail=f"Need {duplicates_needed} duplicates to rank up")
    
    # Upgrade hero
    new_rank = current_rank + 1
    stat_boost = 1.15  # 15% stat increase per rank
    
    await db.user_heroes.update_one(
        {"id": hero_instance_id},
        {
            "$set": {
                "rank": new_rank,
                "current_hp": int(hero["current_hp"] * stat_boost),
                "current_atk": int(hero["current_atk"] * stat_boost),
                "current_def": int(hero["current_def"] * stat_boost)
            },
            "$inc": {"duplicates": -duplicates_needed}
        }
    )
    
    updated_hero = await db.user_heroes.find_one({"id": hero_instance_id})
    return convert_objectid(updated_hero)

@api_router.post("/team/create")
async def create_team(username: str, team_name: str):
    """Create a new team"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    team = Team(user_id=user["id"], name=team_name)
    await db.teams.insert_one(team.dict())
    return team

@api_router.get("/team/{username}")
async def get_user_teams(username: str):
    """Get all teams for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    teams = await db.teams.find({"user_id": user["id"]}).to_list(100)
    return [convert_objectid(team) for team in teams]

@api_router.put("/team/{team_id}/heroes")
async def update_team_heroes(team_id: str, hero_ids: List[str]):
    """Update team composition"""
    if len(hero_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 heroes per team")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$set": {"hero_ids": hero_ids}}
    )
    
    updated_team = await db.teams.find_one({"id": team_id})
    return convert_objectid(updated_team)

@api_router.get("/team/{username}/by-mode")
async def get_teams_by_mode(username: str):
    """Get all mode-specific teams for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get mode teams from user document
    mode_teams = user.get("mode_teams", {})
    return mode_teams

@api_router.post("/team/save-mode-team")
async def save_mode_team(username: str, mode: str, slot_1: str = None, slot_2: str = None, 
                         slot_3: str = None, slot_4: str = None, slot_5: str = None, slot_6: str = None):
    """Save a team for a specific game mode with full audit logging"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    valid_modes = ["campaign", "arena", "abyss", "guild_war", "dungeons"]
    if mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be one of: {valid_modes}")
    
    # Collect hero IDs
    hero_ids = [slot_1, slot_2, slot_3, slot_4, slot_5, slot_6]
    hero_ids = [h for h in hero_ids if h]  # Remove None values
    
    # Validate hero ownership
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
    user_hero_ids = [h["id"] for h in user_heroes]
    
    for hero_id in hero_ids:
        if hero_id and hero_id not in user_hero_ids:
            raise HTTPException(status_code=400, detail=f"Hero {hero_id} not owned by user")
    
    # Check if team exists for this mode
    mode_teams = user.get("mode_teams", {})
    existing_team_id = mode_teams.get(mode)
    
    team_data = {
        "slot_1": slot_1,
        "slot_2": slot_2,
        "slot_3": slot_3,
        "slot_4": slot_4,
        "slot_5": slot_5,
        "slot_6": slot_6,
        "hero_ids": hero_ids,
        "mode": mode,
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    if existing_team_id:
        # Update existing team
        await db.teams.update_one(
            {"id": existing_team_id},
            {"$set": team_data}
        )
        team_id = existing_team_id
    else:
        # Create new team
        team_id = str(uuid.uuid4())
        team_data.update({
            "id": team_id,
            "user_id": user["id"],
            "name": f"{mode.replace('_', ' ').title()} Team",
            "is_active": mode == "campaign",
            "created_at": datetime.utcnow().isoformat(),
        })
        await db.teams.insert_one(team_data)
        
        # Update user's mode teams mapping
        mode_teams[mode] = team_id
        await db.users.update_one(
            {"username": username},
            {"$set": {"mode_teams": mode_teams}}
        )
    
    # Log the change to audit collection
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": username,
        "action": "team_update",
        "mode": mode,
        "team_id": team_id,
        "hero_ids": hero_ids,
        "timestamp": datetime.utcnow().isoformat(),
        "details": {
            "slot_1": slot_1,
            "slot_2": slot_2,
            "slot_3": slot_3,
            "slot_4": slot_4,
            "slot_5": slot_5,
            "slot_6": slot_6,
        }
    }
    await db.team_change_logs.insert_one(audit_log)
    
    return {"id": team_id, "mode": mode, "status": "saved", "hero_count": len(hero_ids)}

@api_router.get("/team/{username}/change-logs")
async def get_team_change_logs(username: str, limit: int = 50):
    """Get team change audit logs for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    logs = await db.team_change_logs.find(
        {"user_id": user["id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [convert_objectid(log) for log in logs]

@api_router.get("/hero/{username}/change-logs")
async def get_hero_change_logs(username: str, hero_id: str = None, limit: int = 50):
    """Get hero modification audit logs"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    query = {"user_id": user["id"]}
    if hero_id:
        query["hero_id"] = hero_id
    
    logs = await db.hero_change_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return [convert_objectid(log) for log in logs]

@api_router.post("/idle/claim")
async def claim_idle_rewards(
    username: str = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Claim idle rewards with canonical receipt.
    
    Phase 3.31: Simplified idle loop with fixed rates:
    - Gold: 120/hr
    - Stamina: 6/hr
    - Gems: 0/hr
    - Cap: 8h default (VIP extensible)
    
    Returns canonical receipt shape:
    { source, sourceId, items, balances, alreadyClaimed }
    """
    # Phase 3.31: Use auth-token identity
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    username = user["username"]
    
    # Generate unique sourceId for this claim
    claim_id = f"idle_{user['id']}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    # Calculate VIP level
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    idle_max_hours = get_vip_idle_hours(vip_level)
    
    # Get progression data for caps
    abyss_progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    abyss_floor = abyss_progress.get("highest_floor", 0) if abyss_progress else 0
    
    stage_progress = await db.stage_progress.find_one({"user_id": user["id"]})
    dungeon_tier = stage_progress.get("dungeon_tier", 0) if stage_progress else 0
    campaign_chapter = stage_progress.get("campaign_chapter", 0) if stage_progress else 0
    
    # Get idle collection start time
    collection_started = user.get("idle_collection_started_at")
    if not collection_started:
        # First time - start collection, return empty receipt
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "idle_collection_started_at": datetime.utcnow(),
                "vip_level": vip_level
            }}
        )
        
        # Get fresh balances
        fresh_user = await db.users.find_one({"username": username})
        balances = await get_user_balances(fresh_user or user)
        
        return {
            # Canonical receipt fields
            "source": "idle_claim",
            "sourceId": claim_id,
            "items": [],
            "balances": balances,
            "alreadyClaimed": False,
            # Legacy fields
            "resources": {},
            "time_away": 0,
            "collection_started": True,
            "vip_level": vip_level,
            "vip_rate": get_vip_idle_rate_display(vip_level),
            "max_hours": idle_max_hours
        }
    
    # Calculate time since collection started
    now = datetime.utcnow()
    if isinstance(collection_started, str):
        collection_started = datetime.fromisoformat(collection_started.replace("Z", "+00:00")).replace(tzinfo=None)
    
    time_away_seconds = (now - collection_started).total_seconds()
    hours_elapsed = time_away_seconds / 3600
    
    # Calculate resources using new system
    idle_result = calculate_idle_resources(
        hours_elapsed=hours_elapsed,
        vip_level=vip_level,
        abyss_floor=abyss_floor,
        dungeon_tier=dungeon_tier,
        campaign_chapter=campaign_chapter,
        max_hours=idle_max_hours
    )
    
    resources = idle_result["resources"]
    
    # Update user with all resources and restart collection
    update_ops = {"$set": {
        "idle_collection_started_at": now,
        "idle_collection_last_claimed": now,
        "vip_level": vip_level
    }}
    
    # Build $inc for resources
    inc_ops = {}
    for resource, amount in resources.items():
        if amount > 0:
            inc_ops[resource] = amount
    
    if inc_ops:
        update_ops["$inc"] = inc_ops
    
    await db.users.update_one({"username": username}, update_ops)
    
    # Refresh user for return
    fresh_user = await db.users.find_one({"username": username})
    balances = await get_user_balances(fresh_user or user)
    
    # Build canonical items list
    items = [{"type": k, "amount": v} for k, v in resources.items() if v > 0]
    
    # Log telemetry
    if items:
        logging.info(f"[REWARD_GRANTED] source=idle_claim sourceId={claim_id} "
                    f"user={username} items_count={len(items)}")
    
    return {
        # Canonical receipt fields
        "source": "idle_claim",
        "sourceId": claim_id,
        "items": items,
        "balances": balances,
        "alreadyClaimed": False,
        # Legacy fields for backward compatibility
        "resources": resources,
        "gold_earned": resources.get("gold", 0),
        "time_away": int(time_away_seconds),
        "hours_away": round(idle_result["hours_elapsed"], 2),
        "is_time_capped": idle_result["is_time_capped"],
        "resources_capped": idle_result["resources_capped"],
        "vip_level": vip_level,
        "vip_rate": idle_result["vip_rate_display"],
        "max_hours": idle_max_hours,
        "progression": {
            "abyss_floor": abyss_floor,
            "dungeon_tier": dungeon_tier,
            "campaign_chapter": campaign_chapter,
        }
    }

@api_router.get("/idle/status/{username}")
async def get_idle_status(username: str):
    """Get current idle collection status (legacy route)"""
    # Redirect to auth-based endpoint logic
    user = await get_user_readonly(username)
    return await _get_idle_status_impl(user)


@api_router.get("/idle/status")
async def get_idle_status_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current idle collection status (auth-token identity)
    
    Phase 3.31: Returns simplified idle status:
    - lastClaimAt: timestamp of last claim
    - elapsedSeconds: time since last claim
    - capSeconds: max idle time (8h default)
    - pendingRewards: { gold, stamina, gems }
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    return await _get_idle_status_impl(user)


async def _get_idle_status_impl(user: dict):
    """Shared implementation for idle status
    
    Phase 3.31: Simplified idle status with fixed rates:
    - Gold: 120/hr
    - Stamina: 6/hr  
    - Gems: 0/hr (idle is baseline, not premium)
    """
    # Phase 3.31: Fixed rates (no VIP, no progression caps)
    IDLE_RATES = {
        "gold": 120,      # per hour
        "stamina": 6,     # per hour
        "gems": 0,        # no gems from idle
    }
    
    # Cap from VIP level (8h default)
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    idle_cap_hours = get_vip_idle_hours(vip_level)
    cap_seconds = idle_cap_hours * 3600
    
    collection_started = user.get("idle_collection_started_at")
    last_claimed = user.get("idle_collection_last_claimed")
    
    if not collection_started:
        # Not yet started - show potential
        return {
            "lastClaimAt": None,
            "elapsedSeconds": 0,
            "capSeconds": cap_seconds,
            "capHours": idle_cap_hours,
            "pendingRewards": {"gold": 0, "stamina": 0, "gems": 0},
            "isCapped": False,
            "isCollecting": False,
            "rates": IDLE_RATES,
        }
    
    # Calculate elapsed time
    now = datetime.utcnow()
    if isinstance(collection_started, str):
        collection_started = datetime.fromisoformat(collection_started.replace("Z", "+00:00")).replace(tzinfo=None)
    
    elapsed_seconds = int((now - collection_started).total_seconds())
    capped_seconds = min(elapsed_seconds, cap_seconds)
    hours_elapsed = capped_seconds / 3600
    is_capped = elapsed_seconds >= cap_seconds
    
    # Calculate pending rewards using fixed rates
    pending_rewards = {
        "gold": int(hours_elapsed * IDLE_RATES["gold"]),
        "stamina": int(hours_elapsed * IDLE_RATES["stamina"]),
        "gems": 0,
    }
    
    # Format last claim timestamp
    last_claim_iso = None
    if last_claimed:
        if isinstance(last_claimed, str):
            last_claim_iso = last_claimed
        else:
            last_claim_iso = last_claimed.isoformat() + "Z"
    
    return {
        "lastClaimAt": last_claim_iso,
        "elapsedSeconds": elapsed_seconds,
        "capSeconds": cap_seconds,
        "capHours": idle_cap_hours,
        "pendingRewards": pending_rewards,
        "isCapped": is_capped,
        "isCollecting": True,
        "rates": IDLE_RATES,
    }


@api_router.post("/idle/instant-collect/{username}")
async def instant_collect_idle(username: str):
    """
    VIP 1+ Instant Collect: Claim 2 hours of idle rewards instantly.
    Has a 4-hour cooldown between uses.
    """
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    
    # Check VIP requirement
    if vip_level < 1:
        raise HTTPException(status_code=403, detail="VIP 1+ required for Instant Collect")
    
    now = datetime.utcnow()
    
    # Check cooldown (4 hours)
    last_instant_collect = user.get("last_instant_collect")
    if last_instant_collect:
        time_since_last = now - last_instant_collect
        cooldown_hours = 4
        if time_since_last.total_seconds() < cooldown_hours * 3600:
            remaining_seconds = (cooldown_hours * 3600) - time_since_last.total_seconds()
            remaining_minutes = int(remaining_seconds / 60)
            raise HTTPException(
                status_code=400, 
                detail=f"Instant Collect on cooldown. {remaining_minutes} minutes remaining."
            )
    
    # Get user progression for caps
    abyss_floor = user.get("abyss_floor", 0)
    dungeon_tier = user.get("dungeon_tier", 0)
    campaign_chapter = user.get("campaign_chapter", 0)
    
    # Calculate 2 hours of idle rewards
    instant_hours = 2
    idle_result = calculate_idle_resources(
        hours_elapsed=instant_hours,
        vip_level=vip_level,
        abyss_floor=abyss_floor,
        dungeon_tier=dungeon_tier,
        campaign_chapter=campaign_chapter,
        max_hours=instant_hours
    )
    
    resources = idle_result["resources"]
    gold_earned = resources.get("gold", 0)
    
    # Calculate EXP (10% of gold earned)
    exp_earned = int(gold_earned * 0.1)
    
    # Update user resources
    update_data = {
        "last_instant_collect": now,
        "gold": user.get("gold", 0) + gold_earned,
        "exp": user.get("exp", 0) + exp_earned,
    }
    
    # Add other resources
    for resource, amount in resources.items():
        if resource != "gold" and amount > 0:
            current_amount = user.get(resource, 0)
            update_data[resource] = current_amount + amount
    
    await db.users.update_one(
        {"username": username},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "gold_earned": gold_earned,
        "exp_earned": exp_earned,
        "resources_earned": resources,
        "hours_collected": instant_hours,
        "next_available": now + timedelta(hours=4),
        "vip_level": vip_level
    }

@api_router.get("/vip/info/{username}")
async def get_vip_info(username: str):
    """Get VIP information and benefits - monetary thresholds hidden from users"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    total_spent = user.get("total_spent", 0)
    current_vip = calculate_vip_level(total_spent)
    
    # Get current tier info
    current_tier = VIP_TIERS[current_vip]
    
    # Get next tier info
    next_vip = min(current_vip + 1, 15)
    next_tier = VIP_TIERS[next_vip]
    
    # Calculate progress percentage without revealing actual amounts
    current_threshold = VIP_TIERS[current_vip]["spend"]
    next_threshold = next_tier["spend"] if next_vip > current_vip else current_threshold
    progress_in_tier = total_spent - current_threshold
    tier_range = next_threshold - current_threshold if next_threshold > current_threshold else 1
    progress_percent = min(100, int((progress_in_tier / tier_range) * 100)) if next_vip > current_vip else 100
    
    return {
        "current_vip_level": current_vip,
        "current_idle_hours": current_tier["idle_hours"],
        "current_idle_rate": get_idle_gold_rate(current_vip),
        "current_avatar_frame": get_avatar_frame(current_vip),
        "next_vip_level": next_vip if next_vip > current_vip else None,
        "next_idle_hours": next_tier["idle_hours"] if next_vip > current_vip else None,
        "next_idle_rate": get_idle_gold_rate(next_vip) if next_vip > current_vip else None,
        "next_avatar_frame": get_avatar_frame(next_vip) if next_vip > current_vip else None,
        "progress_to_next_percent": progress_percent,
        "message": "Continue supporting Selene to unlock VIP rewards!" if next_vip > current_vip else "Maximum VIP achieved!"
    }

@api_router.get("/vip/comparison/{username}")
async def get_vip_comparison(username: str):
    """Get VIP tier comparison for store display - monetary thresholds hidden"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    total_spent = user.get("total_spent", 0)
    current_vip = calculate_vip_level(total_spent)
    
    # Build comparison data - benefits only, no monetary amounts
    comparison = {
        "current_vip": current_vip,
        "tiers": {}
    }
    
    # Previous tier (if exists)
    if current_vip > 0:
        prev_vip = current_vip - 1
        comparison["tiers"]["previous"] = {
            "level": prev_vip,
            "idle_hours": VIP_TIERS[prev_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(prev_vip),
            "avatar_frame": get_avatar_frame(prev_vip),
            "status": "completed"
        }
    
    # Current tier
    comparison["tiers"]["current"] = {
        "level": current_vip,
        "idle_hours": VIP_TIERS[current_vip]["idle_hours"],
        "idle_rate": get_idle_gold_rate(current_vip),
        "avatar_frame": get_avatar_frame(current_vip),
        "status": "active"
    }
    
    # Next tier (if exists) - show benefits to motivate, not costs
    if current_vip < 15:
        next_vip = current_vip + 1
        comparison["tiers"]["next"] = {
            "level": next_vip,
            "idle_hours": VIP_TIERS[next_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(next_vip),
            "avatar_frame": get_avatar_frame(next_vip),
            "status": "locked",
            "unlock_hint": "Support Selene to unlock!"
        }
    
    # Next 2 tiers (if exists)
    if current_vip < 14:
        next2_vip = current_vip + 2
        comparison["tiers"]["next2"] = {
            "level": next2_vip,
            "idle_hours": VIP_TIERS[next2_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(next2_vip),
            "avatar_frame": get_avatar_frame(next2_vip),
            "status": "future"
        }
    
    return comparison

@api_router.post("/vip/purchase")
async def vip_purchase(username: str, amount_usd: float):
    """Process VIP purchase (in production, integrate with payment processor)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="Invalid purchase amount")
    
    old_vip_level = calculate_vip_level(user.get("total_spent", 0))
    
    # Update total spent and VIP level
    new_total_spent = user.get("total_spent", 0) + amount_usd
    new_vip_level = calculate_vip_level(new_total_spent)
    new_avatar_frame = get_avatar_frame(new_vip_level)
    
    # Convert USD to crystals (example: $1 = 100 crystals)
    crystals_purchased = int(amount_usd * 100)
    
    await db.users.update_one(
        {"username": username},
        {
            "$set": {
                "total_spent": new_total_spent,
                "vip_level": new_vip_level,
                "avatar_frame": new_avatar_frame
            },
            "$inc": {"crystals": crystals_purchased}
        }
    )
    
    # Response hides monetary details, shows benefits only
    response = {
        "crystals_received": crystals_purchased,
        "new_vip_level": new_vip_level,
        "new_idle_cap_hours": get_idle_cap_hours(new_vip_level),
        "new_idle_rate": get_idle_gold_rate(new_vip_level),
        "new_avatar_frame": new_avatar_frame
    }
    
    # Add level up celebration if VIP increased
    if new_vip_level > old_vip_level:
        response["vip_level_up"] = True
        response["message"] = f"Congratulations! You've reached VIP {new_vip_level}!"
    
    return response

@api_router.get("/vip/packages/{username}")
async def get_vip_packages(username: str):
    """Get available VIP packages for user's current VIP level"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    
    if vip_level not in VIP_PACKAGES:
        raise HTTPException(status_code=404, detail="No packages available for this VIP level")
    
    packages = VIP_PACKAGES[vip_level]
    
    # Add package IDs and daily purchase tracking
    result = {}
    for tier, package_data in packages.items():
        result[tier] = {
            **package_data,
            "daily_limit": 3,
            "purchases_today": 0  # TODO: Track daily purchases in database
        }
    
    return {
        "vip_level": vip_level,
        "packages": result
    }

@api_router.post("/vip/package/purchase")
async def purchase_vip_package(username: str, package_tier: str):
    """Purchase a VIP package with crystals"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    
    if vip_level not in VIP_PACKAGES:
        raise HTTPException(status_code=404, detail="No packages available for this VIP level")
    
    if package_tier not in VIP_PACKAGES[vip_level]:
        raise HTTPException(status_code=404, detail="Package tier not found")
    
    package = VIP_PACKAGES[vip_level][package_tier]
    crystal_cost = package["crystal_cost"]
    rewards = package["rewards"]
    
    # Check if user has enough crystals
    if user.get("crystals", 0) < crystal_cost:
        raise HTTPException(status_code=400, detail=f"Not enough crystals. Need {crystal_cost}")
    
    # TODO: Check daily purchase limit (for now, allow unlimited)
    
    # Deduct crystals and give rewards
    update_dict = {"crystals": user.get("crystals", 0) - crystal_cost}
    
    for reward_type, amount in rewards.items():
        if reward_type in ["coins", "gold", "crystals"]:
            current_amount = user.get(reward_type, 0)
            update_dict[reward_type] = current_amount + amount
    
    await db.users.update_one(
        {"username": username},
        {"$set": update_dict}
    )
    
    return {
        "package_tier": package_tier,
        "crystal_cost": crystal_cost,
        "rewards": rewards,
        "remaining_crystals": update_dict["crystals"]
    }

@api_router.get("/store/crystal-packages")
async def get_crystal_packages():
    """Get all available crystal packages"""
    return {"packages": CRYSTAL_PACKAGES}

@api_router.post("/store/purchase-crystals")
async def purchase_crystals(username: str, package_id: str):
    """Purchase crystal package with real money (simulated)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_readonly(username)  # Includes frozen check
    
    if package_id not in CRYSTAL_PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")
    
    package = CRYSTAL_PACKAGES[package_id]
    crystals_to_award = package["crystals"]
    
    # Check if this is the user's first purchase
    is_first_purchase = not user.get("first_purchase_used", False)
    
    if is_first_purchase:
        # Double crystals for first purchase
        crystals_to_award *= 2
    
    # Update user
    update_dict = {
        "crystals": user.get("crystals", 0) + crystals_to_award,
        "total_spent": user.get("total_spent", 0.0) + package["price_usd"],
        "first_purchase_used": True
    }
    
    # Recalculate VIP level
    new_vip_level = calculate_vip_level(update_dict["total_spent"])
    update_dict["vip_level"] = new_vip_level
    update_dict["avatar_frame"] = get_avatar_frame(new_vip_level)
    
    await db.users.update_one(
        {"username": username},
        {"$set": update_dict}
    )
    
    return {
        "package_id": package_id,
        "package_name": package["display_name"],
        "price_usd": package["price_usd"],
        "crystals_received": crystals_to_award,
        "was_first_purchase": is_first_purchase,
        "bonus_applied": is_first_purchase,
        "new_crystal_total": update_dict["crystals"],
        "new_vip_level": new_vip_level,
        "new_total_spent": update_dict["total_spent"]
    }

@api_router.get("/store/divine-packages")
async def get_divine_packages(username: str):
    """Get Divine Package availability for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Check if monthly reset is needed
    now = datetime.utcnow()
    last_reset = user.get("divine_pack_last_reset")
    
    # Reset if never reset or if more than 30 days have passed
    needs_reset = False
    if last_reset is None:
        needs_reset = True
    else:
        if isinstance(last_reset, str):
            last_reset = datetime.fromisoformat(last_reset.replace('Z', '+00:00'))
        days_since_reset = (now - last_reset).days
        if days_since_reset >= 30:
            needs_reset = True
    
    if needs_reset:
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "divine_pack_49_purchased": 0,
                "divine_pack_99_purchased": 0,
                "divine_pack_last_reset": now
            }}
        )
        user = await db.users.find_one({"username": username})
    
    # Calculate days until reset
    last_reset = user.get("divine_pack_last_reset", now)
    if isinstance(last_reset, str):
        last_reset = datetime.fromisoformat(last_reset.replace('Z', '+00:00'))
    days_until_reset = 30 - (now - last_reset).days
    
    return {
        "packages": DIVINE_PACKAGES,
        "user_purchases": {
            "divine_49": {
                "purchased": user.get("divine_pack_49_purchased", 0),
                "limit": 3,
                "remaining": 3 - user.get("divine_pack_49_purchased", 0)
            },
            "divine_99": {
                "purchased": user.get("divine_pack_99_purchased", 0),
                "limit": 3,
                "remaining": 3 - user.get("divine_pack_99_purchased", 0)
            }
        },
        "days_until_reset": max(0, days_until_reset),
        "user_divine_essence": user.get("divine_essence", 0)
    }

@api_router.post("/store/purchase-divine")
async def purchase_divine_package(username: str, package_id: str):
    """Purchase Divine Package (limited 3 per month per tier)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    if package_id not in DIVINE_PACKAGES:
        raise HTTPException(status_code=404, detail="Package not found")
    
    package = DIVINE_PACKAGES[package_id]
    
    # Check monthly limit
    purchase_field = f"divine_pack_{'49' if package_id == 'divine_49' else '99'}_purchased"
    current_purchases = user.get(purchase_field, 0)
    
    if current_purchases >= 3:
        raise HTTPException(status_code=400, detail="Monthly limit reached for this package")
    
    # Award resources
    update_dict = {
        "divine_essence": user.get("divine_essence", 0) + package["divine_essence"],
        "crystals": user.get("crystals", 0) + package["crystals"],
        "total_spent": user.get("total_spent", 0.0) + package["price_usd"],
        purchase_field: current_purchases + 1
    }
    
    # Recalculate VIP level
    new_vip_level = calculate_vip_level(update_dict["total_spent"])
    update_dict["vip_level"] = new_vip_level
    update_dict["avatar_frame"] = get_avatar_frame(new_vip_level)
    
    await db.users.update_one(
        {"username": username},
        {"$set": update_dict}
    )
    
    return {
        "package_id": package_id,
        "package_name": package["display_name"],
        "price_usd": package["price_usd"],
        "divine_essence_received": package["divine_essence"],
        "crystals_received": package["crystals"],
        "new_divine_essence_total": update_dict["divine_essence"],
        "new_crystal_total": update_dict["crystals"],
        "new_vip_level": new_vip_level,
        "purchases_remaining": 3 - update_dict[purchase_field]
    }

@api_router.get("/user/{username}/cr")
async def get_character_rating(username: str):
    """Calculate and return user's Character Rating (CR)"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get all user heroes
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    total_cr = 0
    for hero in user_heroes:
        # CR calculation: HP + (ATK * 2) + DEF + (rank * 500) + (level * 100)
        hero_cr = (
            hero["current_hp"] + 
            (hero["current_atk"] * 2) + 
            hero["current_def"] + 
            (hero["rank"] * 500) + 
            (hero["level"] * 100)
        )
        total_cr += hero_cr
    
    return {"cr": total_cr, "hero_count": len(user_heroes)}

@api_router.get("/story/islands")
async def get_islands():
    """Get all story islands"""
    islands = await db.islands.find().sort("order", 1).to_list(100)
    return [convert_objectid(island) for island in islands]

@api_router.get("/story/chapters")
async def get_all_chapters():
    """Get all story chapters"""
    chapters = await db.chapters.find().sort("chapter_number", 1).to_list(100)
    return [convert_objectid(chapter) for chapter in chapters]

# LEGACY: Simplified story progress endpoint - superseded by /story/progress/{username} at line ~6738
# which uses story_progress collection with stage-level tracking.
# Keeping commented for reference but removing from active routes to prevent duplicate endpoint issues.
# @api_router.get("/story/progress/{username}")
# async def get_user_progress_legacy(username: str):
#     """Get user's story progress (LEGACY - use enhanced version instead)"""
#     user = await db.users.find_one({"username": username})
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")
#     progress = await db.user_progress.find_one({"user_id": user["id"]})
#     if not progress:
#         progress = UserProgress(user_id=user["id"])
#         await db.user_progress.insert_one(progress.dict())
#         progress = await db.user_progress.find_one({"user_id": user["id"]})
#     return convert_objectid(progress)

@api_router.post("/story/battle/{username}/{chapter_number}")
async def battle_chapter(username: str, chapter_number: int):
    """Battle a story chapter - server-side combat simulation"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get user progress
    progress = await db.user_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = UserProgress(user_id=user["id"])
        await db.user_progress.insert_one(progress.dict())
    
    # Check if chapter is unlocked (previous chapter must be completed)
    if chapter_number > 1 and (chapter_number - 1) not in progress.get("completed_chapters", []):
        raise HTTPException(status_code=400, detail="Previous chapter must be completed first")
    
    # Get chapter data
    chapter = await db.chapters.find_one({"chapter_number": chapter_number})
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Calculate user's team power (CR)
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    # Get user's active team or use top 6 heroes by power
    team = await db.teams.find_one({"user_id": user["id"], "is_active": True})
    if team and team.get("hero_ids"):
        team_heroes = [h for h in user_heroes if h["id"] in team["hero_ids"]]
    else:
        # Use top 6 heroes by power
        team_heroes = sorted(
            user_heroes, 
            key=lambda h: h["current_hp"] + h["current_atk"] * 2 + h["current_def"],
            reverse=True
        )[:6]
    
    if not team_heroes:
        raise HTTPException(status_code=400, detail="You need at least 1 hero to battle")
    
    # Calculate team power
    user_power = sum(
        h["current_hp"] + (h["current_atk"] * 2) + h["current_def"] 
        for h in team_heroes
    )
    
    enemy_power = chapter["enemy_power"]
    
    # Combat simulation with RNG
    power_ratio = user_power / enemy_power
    
    # Base win chance based on power ratio
    # At equal power (1.0 ratio): 50% win chance
    # At 1.5x power: ~85% win chance
    # At 0.7x power: ~15% win chance (F2P struggle point)
    base_win_chance = min(0.95, max(0.05, 0.5 + (power_ratio - 1.0) * 0.7))
    
    # Add some RNG
    import random
    roll = random.random()
    victory = roll < base_win_chance
    
    # Calculate damage
    if victory:
        damage_dealt = int(enemy_power * 0.9)
        damage_taken = int(user_power * random.uniform(0.2, 0.4))
    else:
        damage_dealt = int(enemy_power * random.uniform(0.4, 0.7))
        damage_taken = int(user_power * random.uniform(0.6, 0.9))
    
    rewards = {}
    if victory:
        # Check if first clear
        is_first_clear = chapter_number not in progress.get("completed_chapters", [])
        
        # Give rewards
        rewards = chapter["rewards"].copy()
        if is_first_clear:
            # Add first clear bonus
            for key, value in chapter["first_clear_bonus"].items():
                rewards[key] = rewards.get(key, 0) + value
        
        # Update user resources
        update_dict = {}
        if "crystals" in rewards:
            update_dict["crystals"] = user.get("crystals", 0) + rewards["crystals"]
        if "coins" in rewards:
            update_dict["coins"] = user.get("coins", 0) + rewards["coins"]
        if "gold" in rewards:
            update_dict["gold"] = user.get("gold", 0) + rewards["gold"]
        
        await db.users.update_one({"username": username}, {"$set": update_dict})
        
        # Update progress
        if is_first_clear:
            await db.user_progress.update_one(
                {"user_id": user["id"]},
                {
                    "$addToSet": {"completed_chapters": chapter_number},
                    "$set": {"current_chapter": max(progress.get("current_chapter", 1), chapter_number + 1)}
                }
            )
    
    return BattleResult(
        victory=victory,
        rewards=rewards,
        user_power=user_power,
        enemy_power=enemy_power,
        damage_dealt=damage_dealt,
        damage_taken=damage_taken
    )

@api_router.get("/")
async def root():
    return {"message": "Gacha Game API", "version": "1.0"}

# ==================== FEATURE FLAGS (Remote Config) ====================

# Feature flag configuration - update this to change feature availability
# Supported shapes:
# - boolean: hard on/off
# - { "enabled": bool, "rollout": float }: percentage rollout (0..1)
FEATURE_FLAGS_CONFIG = {
    # Version number - increment when flags change
    "version": 1,
    # TTL in seconds (how long clients should cache)
    "ttlSeconds": 3600,  # 1 hour
    # Feature flags
    "flags": {
        # Awakening Preview UI (tiers 7★-10★)
        "AWAKENING_PREVIEW_UI": False,
        # Enhanced pity display in gacha
        "GACHA_PITY_UI": True,
        # Redesigned authentication screens
        "NEW_LOGIN_FLOW": False,
        # Maintenance mode (shows maintenance screen)
        "MAINTENANCE_MODE": False,
        # Multi-sweep cleared stages
        "CAMPAIGN_SWEEP": True,
        # 5+ star hero video previews (PAID FEATURE - disabled)
        "HERO_CINEMATICS": False,
        # Hero progression screen
        "HERO_PROGRESSION_ENABLED": True,
        # Example rollout: 15% of users
        # "NEW_FEATURE": {"enabled": True, "rollout": 0.15},
    }
}

@api_router.get("/v1/features")
async def get_feature_flags():
    """
    Get remote feature flag configuration.
    
    Returns:
        {
            "version": int,           # Config version (for cache invalidation)
            "ttlSeconds": int,        # How long to cache (seconds)
            "flags": {                # Feature flags
                "FLAG_NAME": bool | {"enabled": bool, "rollout": float}
            }
        }
    
    Clients should:
    1. Cache this response for ttlSeconds
    2. Use version to detect changes
    3. Apply flags client-side with rollout computed per-user
    """
    return FEATURE_FLAGS_CONFIG

# ==================== SUPPORT SYSTEM ====================
@api_router.post("/support/ticket")
async def create_support_ticket(username: str, subject: str, message: str):
    """Create a support ticket"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    ticket = SupportTicket(
        user_id=user["id"],
        username=username,
        subject=subject,
        message=message
    )
    
    await db.support_tickets.insert_one(ticket.dict())
    return convert_objectid(ticket.dict())

@api_router.get("/support/tickets/{username}")
async def get_user_tickets(username: str):
    """Get all support tickets for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    tickets = await db.support_tickets.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [convert_objectid(ticket) for ticket in tickets]

# ==================== MAIL SYSTEM ====================
# Phase 3.23: Mail system for rewards, messages, and gifts
# Phase 3.23.2.P: Security patch - server derives user from auth token

@api_router.get("/mail/summary")
async def get_mail_summary(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get mail badge counts for UI (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    # Count unclaimed rewards from DB
    rewards_count = await db.mail_rewards.count_documents({
        "user_id": user["id"],
        "claimed": False
    })
    
    # Count unread messages (system messages)
    unread_messages = await db.mail_messages.count_documents({
        "to_user_id": user["id"],
        "read": False
    })
    
    # Count unclaimed gifts
    gifts_available = await db.mail_gifts.count_documents({
        "to_user_id": user["id"],
        "claimed": False
    })
    
    # Phase 3.26: Count unclaimed receipts (fallback queue)
    receipts_available = await db.mail_receipts.count_documents({
        "user_id": user["id"],
        "claimed": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    return {
        "rewardsAvailable": rewards_count,
        "unreadMessages": unread_messages,
        "giftsAvailable": gifts_available,
        "receiptsAvailable": receipts_available  # Phase 3.26
    }

# Legacy route for backwards compatibility (ignores username, uses auth)
@api_router.get("/mail/summary/{username}")
async def get_mail_summary_legacy(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get mail badge counts - legacy route (ignores username param, uses auth token)"""
    return await get_mail_summary(credentials)

@api_router.get("/mail/rewards")
async def get_mail_rewards(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get list of claimable rewards (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    rewards = await db.mail_rewards.find({
        "user_id": user["id"],
        "claimed": False
    }).to_list(50)
    
    return [convert_objectid(r) for r in rewards]

@api_router.get("/mail/rewards/{username}")
async def get_mail_rewards_legacy(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await get_mail_rewards(credentials)

@api_router.get("/mail/messages")
async def get_mail_messages(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get system messages (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    messages = await db.mail_messages.find({
        "to_user_id": user["id"]
    }).sort("timestamp", -1).to_list(50)
    
    return [convert_objectid(m) for m in messages]

@api_router.get("/mail/messages/{username}")
async def get_mail_messages_legacy(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await get_mail_messages(credentials)

@api_router.get("/mail/gifts")
async def get_mail_gifts(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get gifts from friends/system (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    gifts = await db.mail_gifts.find({
        "to_user_id": user["id"],
        "claimed": False
    }).to_list(50)
    
    return [convert_objectid(g) for g in gifts]

@api_router.get("/mail/gifts/{username}")
async def get_mail_gifts_legacy(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await get_mail_gifts(credentials)

@api_router.post("/mail/rewards/{reward_id}/claim")
async def claim_mail_reward(reward_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Claim a specific reward (idempotent - already claimed returns canonical receipt)
    
    Phase 3.24: Returns canonical receipt shape:
    { source, sourceId, items, balances, alreadyClaimed }
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Check if reward exists and belongs to user
    reward = await db.mail_rewards.find_one({
        "id": reward_id,
        "user_id": user["id"]
    })
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Idempotent: if already claimed, return canonical receipt with alreadyClaimed=True
    if reward.get("claimed"):
        return await grant_rewards_canonical(
            user=user,
            source="mail_reward_claim",
            source_id=reward_id,
            rewards=[],  # Empty items for already claimed
            already_claimed=True,
            message="Reward already claimed"
        )
    
    # Mark as claimed (atomic check)
    result = await db.mail_rewards.update_one(
        {"id": reward_id, "user_id": user["id"], "claimed": False},
        {"$set": {"claimed": True, "claimed_at": datetime.utcnow()}}
    )
    
    # Double-check atomic update succeeded (race condition protection)
    if result.modified_count == 0:
        return await grant_rewards_canonical(
            user=user,
            source="mail_reward_claim",
            source_id=reward_id,
            rewards=[],
            already_claimed=True,
            message="Reward already claimed"
        )
    
    # Extract rewards from the mail reward record
    reward_items = reward.get("rewards", [])
    if not reward_items:
        # Legacy fallback: single reward format
        reward_type = reward.get("reward_type", "gold")
        reward_amount = reward.get("reward_amount", 100)
        reward_items = [{"type": reward_type, "amount": reward_amount}]
    
    # Grant rewards using canonical helper
    return await grant_rewards_canonical(
        user=user,
        source="mail_reward_claim",
        source_id=reward_id,
        rewards=reward_items,
        already_claimed=False,
        message="Reward claimed"
    )

# Legacy route for backwards compatibility
@api_router.post("/mail/rewards/{username}/{reward_id}/claim")
async def claim_mail_reward_legacy(username: str, reward_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await claim_mail_reward(reward_id, credentials)

@api_router.post("/mail/gifts/{gift_id}/claim")
async def claim_mail_gift(gift_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Claim a gift (idempotent - already claimed returns canonical receipt)
    
    Phase 3.24: Returns canonical receipt shape:
    { source, sourceId, items, balances, alreadyClaimed }
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Check if gift exists and belongs to user
    gift = await db.mail_gifts.find_one({
        "id": gift_id,
        "to_user_id": user["id"]
    })
    
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")
    
    # Idempotent: if already claimed, return canonical receipt with alreadyClaimed=True
    if gift.get("claimed"):
        return await grant_rewards_canonical(
            user=user,
            source="mail_gift_claim",
            source_id=gift_id,
            rewards=[],  # Empty items for already claimed
            already_claimed=True,
            message="Gift already claimed"
        )
    
    # Mark as claimed (atomic check)
    result = await db.mail_gifts.update_one(
        {"id": gift_id, "to_user_id": user["id"], "claimed": False},
        {"$set": {"claimed": True, "claimed_at": datetime.utcnow()}}
    )
    
    # Double-check atomic update succeeded (race condition protection)
    if result.modified_count == 0:
        return await grant_rewards_canonical(
            user=user,
            source="mail_gift_claim",
            source_id=gift_id,
            rewards=[],
            already_claimed=True,
            message="Gift already claimed"
        )
    
    # Extract gift rewards
    gift_items = gift.get("items", [])
    if not gift_items:
        # Legacy fallback: single item format
        gift_type = gift.get("item_type", gift.get("item", "gold"))
        gift_amount = gift.get("quantity", 1)
        gift_items = [{"type": gift_type, "amount": gift_amount}]
    
    # Grant rewards using canonical helper
    return await grant_rewards_canonical(
        user=user,
        source="mail_gift_claim",
        source_id=gift_id,
        rewards=gift_items,
        already_claimed=False,
        message="Gift claimed"
    )

# Legacy route for backwards compatibility
@api_router.post("/mail/gifts/{username}/{gift_id}/claim")
async def claim_mail_gift_legacy(username: str, gift_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await claim_mail_gift(gift_id, credentials)


# ==================== MAIL RECEIPTS FALLBACK QUEUE (Phase 3.26) ====================
# When rewards cannot be granted instantly, queue them to mail_receipts for later claim.
# Uses canonical receipt shape for consistency with Phase 3.24.

async def queue_receipt_to_mail(
    user_id: str,
    source: str,
    source_id: str,
    rewards: List[Dict[str, any]],
    description: str = "Queued reward",
    expires_in_days: int = 30
) -> str:
    """
    Queue a reward receipt to mail for later claim (Phase 3.26).
    
    Use when:
    - Reward grant fails due to transient error
    - Offline/disconnected user should receive rewards
    - System-generated rewards that need mail delivery
    
    Args:
        user_id: Target user ID
        source: Original reward source (for tracking)
        source_id: Original source ID (for idempotency)
        rewards: List of {type, amount, hero_id?, item_id?}
        description: Human-readable description for mail UI
        expires_in_days: Days until receipt expires (default 30)
    
    Returns:
        Receipt ID (for tracking)
    """
    receipt_id = str(uuid4())
    
    await db.mail_receipts.insert_one({
        "id": receipt_id,
        "user_id": user_id,
        "original_source": source,
        "original_source_id": source_id,
        "rewards": rewards,
        "description": description,
        "claimed": False,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=expires_in_days),
    })
    
    if __debug__:
        print(f"[MAIL_RECEIPT_QUEUED] user={user_id} receipt={receipt_id} source={source}")
    
    return receipt_id


@api_router.get("/mail/receipts")
async def get_mail_receipts(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get queued receipts waiting to be claimed (auth required)
    
    Phase 3.26: Returns receipts that were queued via queue_receipt_to_mail().
    Each receipt contains the rewards that will be granted on claim.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    receipts = await db.mail_receipts.find({
        "user_id": user["id"],
        "claimed": False,
        "expires_at": {"$gt": datetime.utcnow()}
    }).sort("created_at", -1).to_list(50)
    
    return [convert_objectid(r) for r in receipts]


@api_router.post("/mail/receipts/{receipt_id}/claim")
async def claim_mail_receipt(receipt_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Claim a queued receipt (idempotent - already claimed returns canonical receipt)
    
    Phase 3.26: Returns canonical receipt shape:
    { source, sourceId, items, balances, alreadyClaimed }
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Check if receipt exists and belongs to user
    receipt = await db.mail_receipts.find_one({
        "id": receipt_id,
        "user_id": user["id"]
    })
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    # Check expiration
    if receipt.get("expires_at") and receipt["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Receipt has expired")
    
    # Idempotent: if already claimed, return canonical receipt with alreadyClaimed=True
    if receipt.get("claimed"):
        return await grant_rewards_canonical(
            user=user,
            source="mail_receipt_claim",
            source_id=receipt_id,
            rewards=[],  # Empty items for already claimed
            already_claimed=True,
            message="Receipt already claimed"
        )
    
    # Mark as claimed (atomic check)
    result = await db.mail_receipts.update_one(
        {"id": receipt_id, "user_id": user["id"], "claimed": False},
        {"$set": {"claimed": True, "claimed_at": datetime.utcnow()}}
    )
    
    # Double-check atomic update succeeded (race condition protection)
    if result.modified_count == 0:
        return await grant_rewards_canonical(
            user=user,
            source="mail_receipt_claim",
            source_id=receipt_id,
            rewards=[],
            already_claimed=True,
            message="Receipt already claimed"
        )
    
    # Extract rewards from the receipt
    reward_items = receipt.get("rewards", [])
    
    # Grant rewards using canonical helper
    return await grant_rewards_canonical(
        user=user,
        source="mail_receipt_claim",
        source_id=receipt_id,
        rewards=reward_items,
        already_claimed=False,
        message=receipt.get("description", "Reward claimed")
    )

# ==================== FRIENDS SYSTEM ====================
# Phase 3.23.2.P: Security patch - server derives user from auth token

@api_router.get("/friends/summary")
async def get_friends_summary(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get friends badge counts for UI (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    # Count pending requests
    pending_requests = await db.friend_requests.count_documents({
        "to_user_id": user["id"],
        "status": "pending"
    })
    
    # Count total friends
    total_friends = await db.friendships.count_documents({
        "$or": [
            {"user_id": user["id"]},
            {"friend_id": user["id"]}
        ]
    })
    
    return {
        "pendingRequests": pending_requests,
        "totalFriends": total_friends
    }

# Legacy route for backwards compatibility
@api_router.get("/friends/summary/{username}")
async def get_friends_summary_legacy(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await get_friends_summary(credentials)

@api_router.get("/friends/search")
async def search_players(q: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Search for players by username (auth required, rate limited)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    # Sanitize and validate query
    q = q.strip().lower() if q else ""
    if len(q) < 3:
        return []  # Minimum 3 chars
    if len(q) > 50:
        q = q[:50]  # Max 50 chars
    
    # Case-insensitive prefix search
    query_pattern = {"$regex": f"^{re.escape(q)}", "$options": "i"}
    users = await db.users.find(
        {"username": query_pattern},
        {"id": 1, "username": 1, "vip_level": 1}
    ).limit(20).to_list(20)
    
    results = []
    for u in users:
        # Skip current user
        if u["id"] == user["id"]:
            continue
        
        # Check if already friends
        friendship = await db.friendships.find_one({
            "$or": [
                {"user_id": user["id"], "friend_id": u["id"]},
                {"user_id": u["id"], "friend_id": user["id"]}
            ]
        })
        is_friend = friendship is not None
        
        # Check pending request
        pending = await db.friend_requests.find_one({
            "$or": [
                {"from_user_id": user["id"], "to_user_id": u["id"], "status": "pending"},
                {"from_user_id": u["id"], "to_user_id": user["id"], "status": "pending"}
            ]
        })
        has_pending_request = pending is not None
        
        results.append({
            "id": u["id"],
            "username": u["username"],
            "level": u.get("vip_level", 0) + 1,
            "isFriend": is_friend,
            "hasPendingRequest": has_pending_request
        })
    
    return results

@api_router.post("/friends/requests/send")
async def send_friend_request_v2(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Send a friend request (auth required)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    body = await request.json()
    to_username = body.get("to")
    
    if not to_username:
        raise HTTPException(status_code=400, detail="Missing target username")
    
    to_user = await db.users.find_one({"username": to_username})
    if not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["id"] == to_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    # Check if already friends
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user_id": user["id"], "friend_id": to_user["id"]},
            {"user_id": to_user["id"], "friend_id": user["id"]}
        ]
    })
    
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already exists
    existing_request = await db.friend_requests.find_one({
        "from_user_id": user["id"],
        "to_user_id": to_user["id"],
        "status": "pending"
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    friend_request = FriendRequest(
        from_user_id=user["id"],
        to_user_id=to_user["id"]
    )
    
    await db.friend_requests.insert_one(friend_request.dict())
    return convert_objectid(friend_request.dict())

@api_router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request_v2(request_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Accept a friend request (auth required, idempotent)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    friend_request = await db.friend_requests.find_one({"id": request_id})
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friend_request["to_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your friend request")
    
    # Idempotent: if already accepted, return success
    if friend_request.get("status") == "accepted":
        return {"message": "Friend request accepted", "alreadyAccepted": True}
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id, "status": "pending"},  # Atomic check
        {"$set": {"status": "accepted"}}
    )
    
    # Check if friendship already exists
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user_id": friend_request["from_user_id"], "friend_id": user["id"]},
            {"user_id": user["id"], "friend_id": friend_request["from_user_id"]}
        ]
    })
    
    if not existing_friendship:
        # Create friendship
        friendship = Friendship(
            user_id=friend_request["from_user_id"],
            friend_id=friend_request["to_user_id"]
        )
        await db.friendships.insert_one(friendship.dict())
    
    return {"message": "Friend request accepted", "alreadyAccepted": False}

# Legacy route for backwards compatibility
@api_router.post("/friends/requests/{username}/{request_id}/accept")
async def accept_friend_request_legacy(username: str, request_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await accept_friend_request_v2(request_id, credentials)

@api_router.post("/friends/requests/{request_id}/decline")
async def decline_friend_request(request_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Decline a friend request (auth required, idempotent)"""
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    friend_request = await db.friend_requests.find_one({"id": request_id})
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friend_request["to_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your friend request")
    
    # Idempotent: if already declined/rejected, return success
    if friend_request.get("status") in ["rejected", "declined"]:
        return {"message": "Friend request declined", "alreadyDeclined": True}
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id, "status": "pending"},  # Atomic check
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Friend request declined", "alreadyDeclined": False}

# Legacy route for backwards compatibility
@api_router.post("/friends/requests/{username}/{request_id}/decline")
async def decline_friend_request_legacy(username: str, request_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Legacy route - ignores username, uses auth"""
    return await decline_friend_request(request_id, credentials)

@api_router.post("/friends/request")
async def send_friend_request(from_username: str, to_username: str):
    """Send a friend request"""
    from_user = await db.users.find_one({"username": from_username})
    to_user = await db.users.find_one({"username": to_username})
    
    if not from_user or not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if from_user["id"] == to_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    # Check if already friends
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user_id": from_user["id"], "friend_id": to_user["id"]},
            {"user_id": to_user["id"], "friend_id": from_user["id"]}
        ]
    })
    
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already exists
    existing_request = await db.friend_requests.find_one({
        "from_user_id": from_user["id"],
        "to_user_id": to_user["id"],
        "status": "pending"
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    friend_request = FriendRequest(
        from_user_id=from_user["id"],
        to_user_id=to_user["id"]
    )
    
    await db.friend_requests.insert_one(friend_request.dict())
    return convert_objectid(friend_request.dict())

@api_router.get("/friends/requests/{username}")
async def get_friend_requests(username: str):
    """Get pending friend requests for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    requests = await db.friend_requests.find({
        "to_user_id": user["id"],
        "status": "pending"
    }).to_list(100)
    
    # Enrich with sender info
    enriched = []
    for req in requests:
        sender = await db.users.find_one({"id": req["from_user_id"]})
        if sender:
            enriched.append({
                **convert_objectid(req),
                "from_username": sender["username"]
            })
    
    return enriched

@api_router.post("/friends/accept/{request_id}")
async def accept_friend_request(request_id: str, username: str):
    """Accept a friend request"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    friend_request = await db.friend_requests.find_one({"id": request_id})
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friend_request["to_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your friend request")
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted"}}
    )
    
    # Create friendship
    friendship = Friendship(
        user_id=friend_request["from_user_id"],
        friend_id=friend_request["to_user_id"]
    )
    
    await db.friendships.insert_one(friendship.dict())
    
    return {"message": "Friend request accepted"}

@api_router.get("/friends/list/{username}")
async def get_friends_list(username: str):
    """Get list of friends with collection status"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get all friendships
    friendships = await db.friendships.find({
        "$or": [
            {"user_id": user["id"]},
            {"friend_id": user["id"]}
        ]
    }).to_list(1000)
    
    friends_list = []
    for friendship in friendships:
        friend_id = friendship["friend_id"] if friendship["user_id"] == user["id"] else friendship["user_id"]
        friend = await db.users.find_one({"id": friend_id})
        
        if friend:
            # Check if can collect (24 hour cooldown)
            can_collect = True
            if friendship.get("last_collected"):
                time_since_collect = (datetime.utcnow() - friendship["last_collected"]).total_seconds()
                can_collect = time_since_collect >= 86400  # 24 hours
            
            friends_list.append({
                "friend_id": friend["id"],
                "friend_username": friend["username"],
                "friendship_id": friendship["id"],
                "can_collect": can_collect,
                "last_collected": friendship.get("last_collected")
            })
    
    return friends_list

@api_router.post("/friends/collect/{friendship_id}")
async def collect_friend_currency(friendship_id: str, username: str):
    """Collect friendship points from a friend (24hr cooldown)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    friendship = await db.friendships.find_one({"id": friendship_id})
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    # Verify user is part of this friendship
    if friendship["user_id"] != user["id"] and friendship["friend_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your friendship")
    
    # Check cooldown
    if friendship.get("last_collected"):
        time_since_collect = (datetime.utcnow() - friendship["last_collected"]).total_seconds()
        if time_since_collect < 86400:  # 24 hours
            remaining = 86400 - time_since_collect
            raise HTTPException(status_code=400, detail=f"Cooldown active. {int(remaining/3600)} hours remaining")
    
    # Award friendship points
    friendship_points_gained = 50
    
    await db.users.update_one(
        {"username": username},
        {"$inc": {"friendship_points": friendship_points_gained}}
    )
    
    await db.friendships.update_one(
        {"id": friendship_id},
        {"$set": {"last_collected": datetime.utcnow()}}
    )
    
    return {"friendship_points_gained": friendship_points_gained}


# ==================== FRIEND GIFTS (Phase 3.28) ====================
# Send gifts to friends - creates mail gift for recipient

# Gift types and their values
FRIEND_GIFT_TYPES = {
    "gold": {"amount": 100, "daily_limit": 5},
    "stamina": {"amount": 10, "daily_limit": 3},
    "gems": {"amount": 5, "daily_limit": 1},
}

@api_router.post("/friends/gifts/send")
async def send_friend_gift(
    friend_id: str,
    gift_type: str = "gold",
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Send a gift to a friend (creates mail gift for recipient)
    
    Phase 3.28: Friend gifts use canonical receipt system.
    Returns confirmation receipt to sender.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Validate gift type
    if gift_type not in FRIEND_GIFT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid gift type. Valid types: {list(FRIEND_GIFT_TYPES.keys())}")
    
    gift_config = FRIEND_GIFT_TYPES[gift_type]
    
    # Verify friendship exists
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_id": user["id"], "friend_id": friend_id},
            {"user_id": friend_id, "friend_id": user["id"]}
        ]
    })
    
    if not friendship:
        raise HTTPException(status_code=403, detail="Not friends with this user")
    
    # Check daily gift limit (per sender, per recipient, per type)
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)
    
    gifts_sent_today = await db.friend_gifts_log.count_documents({
        "sender_id": user["id"],
        "recipient_id": friend_id,
        "gift_type": gift_type,
        "sent_at": {"$gte": today_start}
    })
    
    if gifts_sent_today >= gift_config["daily_limit"]:
        raise HTTPException(
            status_code=429, 
            detail=f"Daily gift limit reached for {gift_type}. Limit: {gift_config['daily_limit']}"
        )
    
    # Get recipient user info
    recipient = await db.users.find_one({"id": friend_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Friend not found")
    
    # Create mail gift for recipient
    gift_id = str(uuid4())
    await db.mail_gifts.insert_one({
        "id": gift_id,
        "to_user_id": friend_id,
        "from_user_id": user["id"],
        "from_username": user["username"],
        "gift_type": gift_type,
        "rewards": [{"type": gift_type, "amount": gift_config["amount"]}],
        "title": f"Gift from {user['username']}",
        "description": f"{user['username']} sent you a {gift_type} gift!",
        "claimed": False,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=7),
    })
    
    # Log the gift for limit tracking
    await db.friend_gifts_log.insert_one({
        "id": str(uuid4()),
        "sender_id": user["id"],
        "recipient_id": friend_id,
        "gift_type": gift_type,
        "gift_id": gift_id,
        "sent_at": datetime.utcnow(),
    })
    
    if __debug__:
        print(f"[FRIEND_GIFT_SENT] sender={user['username']} recipient={recipient['username']} type={gift_type}")
    
    # Return confirmation receipt to sender
    return {
        "success": True,
        "message": f"Gift sent to {recipient['username']}!",
        "gift_id": gift_id,
        "gift_type": gift_type,
        "amount": gift_config["amount"],
        "recipient_username": recipient["username"],
    }


@api_router.get("/friends/gifts/status")
async def get_friend_gift_status(
    friend_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get gift sending status for a specific friend
    
    Returns remaining gifts that can be sent today by type.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)
    
    status = {}
    for gift_type, config in FRIEND_GIFT_TYPES.items():
        gifts_sent = await db.friend_gifts_log.count_documents({
            "sender_id": user["id"],
            "recipient_id": friend_id,
            "gift_type": gift_type,
            "sent_at": {"$gte": today_start}
        })
        
        status[gift_type] = {
            "sent_today": gifts_sent,
            "daily_limit": config["daily_limit"],
            "remaining": max(0, config["daily_limit"] - gifts_sent),
            "amount": config["amount"],
        }
    
    return status


# ==================== EVENTS/QUESTS SYSTEM (Phase 3.29) ====================
# Events scaffold with canonical receipt system

# Sample active events (in production, this would be from database/admin)
SAMPLE_EVENTS = [
    {
        "id": "welcome_2024",
        "title": "Welcome Bonus",
        "description": "Claim your welcome gift!",
        "type": "one_time",
        "rewards": [{"type": "gold", "amount": 500}, {"type": "gems", "amount": 10}],
        "ends_at": None,  # Never expires
    },
    {
        "id": "daily_check_in",
        "title": "Daily Check-in",
        "description": "Log in today for rewards",
        "type": "daily",
        "rewards": [{"type": "stamina", "amount": 20}],
        "ends_at": None,
    },
]


@api_router.get("/events/active")
async def get_active_events(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get list of active events with claimable count
    
    Phase 3.29: Returns events the user can interact with.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    events = []
    claimable_count = 0
    
    for event in SAMPLE_EVENTS:
        # Check if user already claimed this event
        claim = await db.event_claims.find_one({
            "user_id": user["id"],
            "event_id": event["id"]
        })
        
        # For daily events, check if claimed today
        is_claimable = False
        if event["type"] == "one_time":
            is_claimable = not claim
        elif event["type"] == "daily":
            if claim:
                last_claim = claim.get("claimed_at")
                if last_claim:
                    today = datetime.utcnow().date()
                    is_claimable = last_claim.date() < today
                else:
                    is_claimable = True
            else:
                is_claimable = True
        
        if is_claimable:
            claimable_count += 1
        
        events.append({
            "id": event["id"],
            "title": event["title"],
            "description": event["description"],
            "type": event["type"],
            "rewards_preview": [f"{r['amount']} {r['type']}" for r in event["rewards"]],
            "is_claimable": is_claimable,
            "ends_at": event.get("ends_at"),
        })
    
    return {
        "events": events,
        "claimable_count": claimable_count,
    }


@api_router.post("/events/{event_id}/claim")
async def claim_event_reward(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Claim event reward (idempotent - returns canonical receipt)
    
    Phase 3.29: Uses canonical receipt system.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Find event
    event = next((e for e in SAMPLE_EVENTS if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check existing claim
    claim = await db.event_claims.find_one({
        "user_id": user["id"],
        "event_id": event_id
    })
    
    # Idempotency check
    already_claimed = False
    if claim:
        if event["type"] == "one_time":
            already_claimed = True
        elif event["type"] == "daily":
            last_claim = claim.get("claimed_at")
            if last_claim and last_claim.date() >= datetime.utcnow().date():
                already_claimed = True
    
    if already_claimed:
        return await grant_rewards_canonical(
            user=user,
            source="event_claim",
            source_id=f"{event_id}_{user['id']}",
            rewards=[],
            already_claimed=True,
            message="Already claimed"
        )
    
    # Record or update claim
    if claim:
        await db.event_claims.update_one(
            {"_id": claim["_id"]},
            {"$set": {"claimed_at": datetime.utcnow()}}
        )
    else:
        await db.event_claims.insert_one({
            "id": str(uuid4()),
            "user_id": user["id"],
            "event_id": event_id,
            "claimed_at": datetime.utcnow(),
        })
    
    if __debug__:
        print(f"[EVENT_CLAIMED] user={user['username']} event={event_id}")
    
    # Grant rewards using canonical system
    return await grant_rewards_canonical(
        user=user,
        source="event_claim",
        source_id=f"{event_id}_{user['id']}",
        rewards=event["rewards"],
        already_claimed=False,
        message=f"Claimed: {event['title']}"
    )


# ==================== STORE & ECONOMY SYSTEM (Phase 3.30) ====================
# Store scaffold with purchase intent plumbing (no real billing)

# Static catalog (in production, this would be from database/admin)
STORE_CATALOG = [
    {
        "sku": "gem_pack_small",
        "name": "Gem Pack (Small)",
        "desc": "100 Gems to fuel your journey",
        "priceText": "$0.99",
        "currency": "USD",
        "price": 99,  # cents
        "tag": "STARTER",
        "rewards": [{"type": "gems", "amount": 100}],
    },
    {
        "sku": "gem_pack_medium",
        "name": "Gem Pack (Medium)",
        "desc": "500 Gems + 50 bonus",
        "priceText": "$4.99",
        "currency": "USD",
        "price": 499,
        "tag": "POPULAR",
        "rewards": [{"type": "gems", "amount": 550}],
    },
    {
        "sku": "gem_pack_large",
        "name": "Gem Pack (Large)",
        "desc": "1200 Gems + 200 bonus",
        "priceText": "$9.99",
        "currency": "USD",
        "price": 999,
        "tag": "BEST VALUE",
        "rewards": [{"type": "gems", "amount": 1400}],
    },
    {
        "sku": "gold_pack",
        "name": "Gold Chest",
        "desc": "10,000 Gold for upgrades",
        "priceText": "$1.99",
        "currency": "USD",
        "price": 199,
        "rewards": [{"type": "gold", "amount": 10000}],
    },
    {
        "sku": "stamina_pack",
        "name": "Stamina Refill",
        "desc": "Full stamina + 50 bonus",
        "priceText": "$0.99",
        "currency": "USD",
        "price": 99,
        "rewards": [{"type": "stamina", "amount": 150}],
    },
]


@api_router.get("/store/catalog")
async def get_store_catalog(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get store catalog (auth required for personalization)
    
    Phase 3.30: Returns static catalog list.
    """
    # Auth optional - just for personalization if needed later
    try:
        user, _ = await authenticate_request(credentials, require_auth=False)
    except:
        user = None
    
    # Return catalog without internal fields
    catalog = []
    for item in STORE_CATALOG:
        catalog.append({
            "sku": item["sku"],
            "name": item["name"],
            "desc": item.get("desc"),
            "priceText": item["priceText"],
            "currency": item["currency"],
            "tag": item.get("tag"),
        })
    
    return {"catalog": catalog}


@api_router.post("/store/purchase-intent")
async def create_purchase_intent(
    sku: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create purchase intent (prepares for payment, no real charge)
    
    Phase 3.30: Returns intent for client to process.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Find item in catalog
    item = next((i for i in STORE_CATALOG if i["sku"] == sku), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in catalog")
    
    # Create intent record
    intent_id = str(uuid4())
    await db.store_intents.insert_one({
        "id": intent_id,
        "user_id": user["id"],
        "sku": sku,
        "price": item["price"],
        "currency": item["currency"],
        "rewards": item["rewards"],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24),
    })
    
    if __debug__:
        print(f"[STORE_INTENT_CREATED] user={user['username']} sku={sku} intent={intent_id}")
    
    return {
        "intentId": intent_id,
        "sku": sku,
        "price": item["price"],
        "priceText": item["priceText"],
        "currency": item["currency"],
        "createdAt": datetime.utcnow().isoformat(),
    }


# DEV-ONLY: Redeem intent without payment (for testing)
@api_router.post("/store/redeem-intent")
async def redeem_store_intent(
    intent_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """DEV-ONLY: Redeem purchase intent without payment (canonical receipt)
    
    Phase 3.30: Returns canonical receipt. Idempotent.
    Only available in dev mode.
    """
    # Check dev mode
    if not os.getenv("SERVER_DEV_MODE", "").upper() == "TRUE":
        raise HTTPException(status_code=403, detail="Not available in production")
    
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Find intent
    intent = await db.store_intents.find_one({
        "id": intent_id,
        "user_id": user["id"]
    })
    
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")
    
    # Check expiration
    if intent.get("expires_at") and intent["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Intent has expired")
    
    # Idempotent: if already redeemed, return alreadyClaimed
    if intent.get("status") == "redeemed":
        return await grant_rewards_canonical(
            user=user,
            source="store_redeem",
            source_id=intent_id,
            rewards=[],
            already_claimed=True,
            message="Already redeemed"
        )
    
    # Mark as redeemed (atomic)
    result = await db.store_intents.update_one(
        {"id": intent_id, "user_id": user["id"], "status": "pending"},
        {"$set": {"status": "redeemed", "redeemed_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        # Race condition or already redeemed
        return await grant_rewards_canonical(
            user=user,
            source="store_redeem",
            source_id=intent_id,
            rewards=[],
            already_claimed=True,
            message="Already redeemed"
        )
    
    if __debug__:
        print(f"[STORE_INTENT_REDEEMED] user={user['username']} intent={intent_id}")
    
    # Grant rewards
    return await grant_rewards_canonical(
        user=user,
        source="store_redeem",
        source_id=intent_id,
        rewards=intent.get("rewards", []),
        already_claimed=False,
        message="Purchase complete!"
    )


# ==================== PLAYER CHARACTER SYSTEM ====================


# ==================== DAILY LOGIN SYSTEM (Phase 3.32) ====================
# 7-day calendar loop with canonical receipts

DAILY_CALENDAR = [
    {"day": 1, "rewards": [{"type": "gold", "amount": 500}]},
    {"day": 2, "rewards": [{"type": "stamina", "amount": 30}]},
    {"day": 3, "rewards": [{"type": "gold", "amount": 1000}]},
    {"day": 4, "rewards": [{"type": "stamina", "amount": 50}]},
    {"day": 5, "rewards": [{"type": "gold", "amount": 2000}]},
    {"day": 6, "rewards": [{"type": "stamina", "amount": 80}]},
    {"day": 7, "rewards": [{"type": "gold", "amount": 5000}, {"type": "gems", "amount": 50}]},  # Bonus day
]


@api_router.get("/daily/status")
async def get_daily_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get daily login calendar status (auth-token identity)
    
    Phase 3.32: Returns 7-day calendar loop info:
    - currentDay: 1-7 (which day in the cycle)
    - claimedToday: boolean
    - nextResetAt: ISO timestamp for next UTC midnight
    - calendar: array of day rewards with claimed status
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    
    # Get or create daily login record
    daily_data = await db.daily_login.find_one({"user_id": user["id"]})
    if not daily_data:
        daily_data = {
            "user_id": user["id"],
            "current_day": 1,
            "last_claim_date": None,
            "streak": 0,
        }
        await db.daily_login.insert_one(daily_data)
    
    # Check if claimed today
    today = datetime.utcnow().date().isoformat()
    claimed_today = daily_data.get("last_claim_date") == today
    
    # Current day in cycle (1-7)
    current_day = daily_data.get("current_day", 1)
    if current_day < 1 or current_day > 7:
        current_day = 1
    
    # Calculate next reset (UTC midnight)
    now = datetime.utcnow()
    next_reset = datetime(now.year, now.month, now.day) + timedelta(days=1)
    
    # Build calendar with today's reward highlighted
    calendar = []
    for day_info in DAILY_CALENDAR:
        day_num = day_info["day"]
        calendar.append({
            "day": day_num,
            "rewards": day_info["rewards"],
            "isCurrent": day_num == current_day,
            "isClaimable": day_num == current_day and not claimed_today,
            "isClaimed": day_num < current_day or (day_num == current_day and claimed_today),
        })
    
    return {
        "currentDay": current_day,
        "claimedToday": claimed_today,
        "nextResetAt": next_reset.isoformat() + "Z",
        "streak": daily_data.get("streak", 0),
        "calendar": calendar,
    }


@api_router.post("/daily/claim")
async def claim_daily_reward(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Claim today's daily login reward (canonical receipt, idempotent)
    
    Phase 3.32: Returns canonical receipt.
    """
    user, _ = await authenticate_request(credentials, require_auth=True)
    assert_account_active(user)
    
    # Get daily login record
    daily_data = await db.daily_login.find_one({"user_id": user["id"]})
    if not daily_data:
        daily_data = {
            "user_id": user["id"],
            "current_day": 1,
            "last_claim_date": None,
            "streak": 0,
        }
        await db.daily_login.insert_one(daily_data)
    
    today = datetime.utcnow().date().isoformat()
    
    # Idempotent: already claimed today
    if daily_data.get("last_claim_date") == today:
        return await grant_rewards_canonical(
            user=user,
            source="daily_claim",
            source_id=f"daily_{user['id']}_{today}",
            rewards=[],
            already_claimed=True,
            message="Already claimed today"
        )
    
    # Get current day rewards
    current_day = daily_data.get("current_day", 1)
    if current_day < 1 or current_day > 7:
        current_day = 1
    
    day_info = DAILY_CALENDAR[current_day - 1]
    
    # Calculate next day (cycle back to 1 after 7)
    next_day = (current_day % 7) + 1
    
    # Calculate streak
    yesterday = (datetime.utcnow() - timedelta(days=1)).date().isoformat()
    if daily_data.get("last_claim_date") == yesterday:
        new_streak = daily_data.get("streak", 0) + 1
    else:
        new_streak = 1  # Reset streak if missed a day
    
    # Update daily record (atomic)
    result = await db.daily_login.update_one(
        {"user_id": user["id"], "last_claim_date": {"$ne": today}},
        {
            "$set": {
                "current_day": next_day,
                "last_claim_date": today,
                "streak": new_streak,
            }
        }
    )
    
    # Race condition check
    if result.modified_count == 0:
        return await grant_rewards_canonical(
            user=user,
            source="daily_claim",
            source_id=f"daily_{user['id']}_{today}",
            rewards=[],
            already_claimed=True,
            message="Already claimed today"
        )
    
    if __debug__:
        print(f"[DAILY_CLAIMED] user={user['username']} day={current_day} streak={new_streak}")
    
    # Grant rewards using canonical system
    return await grant_rewards_canonical(
        user=user,
        source="daily_claim",
        source_id=f"daily_{user['id']}_{today}",
        rewards=day_info["rewards"],
        already_claimed=False,
        message=f"Day {current_day} claimed!"
    )


# =============================================================================
# PHASE 3.33: GACHA SUMMON (CANONICAL RECEIPT)
# =============================================================================
# Server-authoritative RNG + pity system.
# Returns canonical receipt with full results.
# NO CLIENT-SIDE RNG ALLOWED.
# =============================================================================

class GachaSummonRequest(BaseModel):
    """Request body for canonical gacha summon"""
    banner_id: str  # standard, premium, divine
    count: int = Field(ge=1, le=10)  # 1 for single, 10 for multi
    source_id: Optional[str] = None  # Client-generated ID for idempotency

class GachaPullResult(BaseModel):
    """Individual pull result"""
    rarity: str  # SR, SSR, SSR+, UR, UR+
    heroDataId: str  # Hero pool ID
    heroName: str  # Display name
    outcome: str  # "new" or "dupe"
    shardsGranted: Optional[int] = None  # Shards if dupe
    imageUrl: Optional[str] = None
    element: Optional[str] = None
    heroClass: Optional[str] = None
    isPityReward: bool = False
    isFiller: bool = False
    fillerType: Optional[str] = None
    fillerAmount: Optional[int] = None

class GachaReceipt(BaseModel):
    """Canonical gacha receipt"""
    source: str  # summon_single or summon_multi
    sourceId: str
    bannerId: str
    pullCount: int
    results: List[GachaPullResult]
    pityBefore: int
    pityAfter: int
    pityTriggered: bool
    currencySpent: Dict[str, Any]
    balances: Dict[str, int]
    items: List[Dict[str, Any]]  # Canonical items array
    alreadyClaimed: bool = False


# Gacha banner configuration
GACHA_BANNERS = {
    "standard": {
        "id": "standard",
        "name": "Coin Summon",
        "description": "Standard pool with SSR+ heroes",
        "currency": "coins",
        "cost_single": 1000,
        "cost_multi": 9000,
        "rates": {"SR": 0.908, "SSR": 0.080, "SSR+": 0.012},
        "pity": 50,
        "guaranteed": "SSR+"
    },
    "premium": {
        "id": "premium",
        "name": "Crystal Summon",
        "description": "Premium pool with UR heroes",
        "currency": "crystals",
        "cost_single": 300,
        "cost_multi": 2700,
        "rates": {"SR": 0.85, "SSR": 0.12, "UR": 0.02, "SSR+": 0.01},
        "pity": 50,
        "guaranteed": "UR"
    },
    "divine": {
        "id": "divine",
        "name": "Divine Summon",
        "description": "Ultimate pool with UR+ heroes and filler rewards",
        "currency": "divine_essence",
        "cost_single": 1,
        "cost_multi": 10,
        "rates": {"UR+": 0.008, "UR": 0.027, "crystal_8k": 0.005, "crystal_5k": 0.010, "crystal_3k": 0.020, "filler": 0.930},
        "pity": 40,
        "guaranteed": "UR+"
    }
}

def _gacha_roll_rarity(rates: Dict[str, float]) -> str:
    """Roll for rarity using server-side RNG"""
    roll = random.random()
    cumulative = 0.0
    for rarity, rate in rates.items():
        cumulative += rate
        if roll <= cumulative:
            return rarity
    return list(rates.keys())[0]

def _gacha_rarity_rank(rarity: str) -> int:
    """Numeric rank for rarity comparison"""
    ranks = {"N": 0, "R": 1, "SR": 2, "SSR": 3, "SSR+": 4, "UR": 5, "UR+": 6}
    return ranks.get(rarity, 0)

async def _get_gacha_hero(rarity: str) -> Optional[Dict]:
    """Get a random hero of specified rarity from DB"""
    heroes = await db.heroes.find({"rarity": rarity}).to_list(100)
    if not heroes:
        # Fallback placeholder
        return {
            "id": f"hero_{rarity}_{random.randint(1000, 9999)}",
            "name": f"Divine {rarity} Hero",
            "rarity": rarity,
            "element": random.choice(["Fire", "Water", "Earth", "Wind", "Light", "Dark"]),
            "hero_class": random.choice(["Warrior", "Mage", "Archer"]),
            "image_url": None
        }
    hero = random.choice(heroes)
    return {
        "id": hero.get("id"),
        "name": hero.get("name"),
        "rarity": hero.get("rarity"),
        "element": hero.get("element"),
        "hero_class": hero.get("hero_class"),
        "image_url": hero.get("image_url")
    }


@api_router.get("/gacha/banners")
async def get_gacha_banners_canonical(request: Request):
    """Get all available gacha banners + user pity state (Phase 3.33)"""
    # Auth optional for banner info, required for pity
    user = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            username = payload.get("sub") or payload.get("username")
            if username:
                user = await db.users.find_one({"username": username})
        except:
            pass
    
    banners = []
    for banner_id, config in GACHA_BANNERS.items():
        banners.append({
            "id": config["id"],
            "name": config["name"],
            "description": config["description"],
            "currency": config["currency"],
            "cost_single": config["cost_single"],
            "cost_multi": config["cost_multi"],
            "rates": config["rates"],
            "pity": config["pity"],
            "guaranteed": config["guaranteed"]
        })
    
    # Include pity state if authenticated
    pity = {}
    if user:
        pity = {
            "standard": {
                "bannerId": "standard",
                "current": user.get("pity_counter", 0),
                "threshold": 50,
                "guaranteed": "SSR+"
            },
            "premium": {
                "bannerId": "premium",
                "current": user.get("pity_counter_premium", 0),
                "threshold": 50,
                "guaranteed": "UR"
            },
            "divine": {
                "bannerId": "divine",
                "current": user.get("pity_counter_divine", 0),
                "threshold": 40,
                "guaranteed": "UR+"
            }
        }
    
    return {"banners": banners, "pity": pity}


@api_router.get("/gacha/pity")
async def get_gacha_pity(request: Request):
    """Get user's pity counters for all banners (Phase 3.33)"""
    # Auth required
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub") or payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "standard": {
            "bannerId": "standard",
            "current": user.get("pity_counter", 0),
            "threshold": 50,
            "guaranteed": "SSR+"
        },
        "premium": {
            "bannerId": "premium",
            "current": user.get("pity_counter_premium", 0),
            "threshold": 50,
            "guaranteed": "UR"
        },
        "divine": {
            "bannerId": "divine",
            "current": user.get("pity_counter_divine", 0),
            "threshold": 40,
            "guaranteed": "UR+"
        }
    }


@api_router.post("/gacha/summon")
async def gacha_summon_canonical(request: Request, body: GachaSummonRequest):
    """
    Perform gacha summon with canonical receipt (Phase 3.33).
    
    Server-authoritative RNG. Returns canonical receipt.
    Handles pity, duplicates -> shards, currency deduction.
    """
    # Auth required
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub") or payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Phase 3.35: Validate banner exists and is active
    banner_id = body.banner_id
    if banner_id not in GACHA_BANNERS:
        raise HTTPException(
            status_code=400, 
            detail={
                "code": "INVALID_BANNER",
                "message": f"Banner '{banner_id}' does not exist or is inactive",
                "valid_banners": list(GACHA_BANNERS.keys())
            }
        )
    
    banner = GACHA_BANNERS[banner_id]
    count = body.count if body.count in [1, 10] else 1
    
    # Phase 3.35: Validate odds sum to ~1.0 (allow small float errors)
    total_odds = sum(banner["rates"].values())
    if abs(total_odds - 1.0) > 0.001:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INVALID_BANNER_CONFIG",
                "message": f"Banner rates do not sum to 1.0 (got {total_odds})"
            }
        )
    
    # Calculate cost
    cost = banner["cost_single"] if count == 1 else banner["cost_multi"]
    currency_field = banner["currency"]
    
    # Map currency to user field
    currency_map = {
        "coins": "coins",
        "crystals": "crystals", 
        "divine_essence": "divine_essence"
    }
    user_field = currency_map.get(currency_field, currency_field)
    
    # Phase 3.35: Enhanced affordability check with structured error
    user_balance = user.get(user_field, 0)
    if user_balance < cost:
        raise HTTPException(
            status_code=400, 
            detail={
                "code": "INSUFFICIENT_FUNDS",
                "message": f"Not enough {currency_field}",
                "currency": currency_field,
                "required": cost,
                "available": user_balance,
                "deficit": cost - user_balance
            }
        )
    
    # Phase 3.35: Require sourceId for idempotency
    if not body.source_id:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SOURCE_ID_REQUIRED",
                "message": "sourceId is required for summon requests"
            }
        )
    
    source_id = body.source_id
    
    # Check idempotency
    existing = await db.gacha_receipts.find_one({"sourceId": source_id})
    if existing:
        # Return existing receipt (idempotent)
        balances = await get_user_balances(user)
        existing["alreadyClaimed"] = True
        existing["balances"] = balances
        return existing
    
    # Get pity counter
    pity_field_map = {
        "standard": "pity_counter",
        "premium": "pity_counter_premium",
        "divine": "pity_counter_divine"
    }
    pity_field = pity_field_map.get(banner_id, "pity_counter")
    pity_before = user.get(pity_field, 0)
    pity_current = pity_before
    pity_threshold = banner["pity"]
    guaranteed_rarity = banner["guaranteed"]
    
    # Perform pulls (server-side RNG)
    results = []
    items = []  # Canonical items
    pity_triggered = False
    filler_totals = {"crystals": 0, "gold": 0, "coins": 0, "divine_essence": 0, "hero_shards": 0}
    
    for _ in range(count):
        pity_current += 1
        is_pity_pull = pity_current >= pity_threshold
        
        if is_pity_pull:
            # Pity triggered - get guaranteed rarity
            rarity = guaranteed_rarity
            pity_triggered = True
            pity_current = 0  # Reset
        else:
            # Normal roll
            rarity = _gacha_roll_rarity(banner["rates"])
        
        # Handle filler rewards (divine banner special)
        if rarity in ["filler", "crystal_8k", "crystal_5k", "crystal_3k"]:
            filler_result = {"isFiller": True, "heroDataId": "", "heroName": "", "rarity": rarity, "outcome": "new"}
            
            if rarity == "crystal_8k":
                filler_result["fillerType"] = "crystals"
                filler_result["fillerAmount"] = 8000
                filler_result["heroName"] = "8,000 Crystals"
                filler_totals["crystals"] += 8000
            elif rarity == "crystal_5k":
                filler_result["fillerType"] = "crystals"
                filler_result["fillerAmount"] = 5000
                filler_result["heroName"] = "5,000 Crystals"
                filler_totals["crystals"] += 5000
            elif rarity == "crystal_3k":
                filler_result["fillerType"] = "crystals"
                filler_result["fillerAmount"] = 3000
                filler_result["heroName"] = "3,000 Crystals"
                filler_totals["crystals"] += 3000
            else:
                # Generic filler
                filler_options = [
                    {"type": "gold", "amount": 500000, "name": "500K Gold"},
                    {"type": "gold", "amount": 250000, "name": "250K Gold"},
                    {"type": "coins", "amount": 50000, "name": "50K Coins"},
                    {"type": "hero_shards", "amount": 50, "name": "50 Hero Shards"},
                    {"type": "hero_shards", "amount": 25, "name": "25 Hero Shards"},
                    {"type": "divine_essence", "amount": 5, "name": "5 Divine Essence"}
                ]
                filler = random.choice(filler_options)
                filler_result["fillerType"] = filler["type"]
                filler_result["fillerAmount"] = filler["amount"]
                filler_result["heroName"] = filler["name"]
                filler_totals[filler["type"]] = filler_totals.get(filler["type"], 0) + filler["amount"]
            
            filler_result["isPityReward"] = is_pity_pull
            results.append(filler_result)
            continue
        
        # Get hero from pool
        hero = await _get_gacha_hero(rarity)
        if not hero:
            continue
        
        # Check if user already owns this hero
        existing_hero = await db.user_heroes.find_one({
            "user_id": user["id"],
            "hero_id": hero["id"]
        })
        
        is_dupe = existing_hero is not None
        shards_granted = 0
        
        if is_dupe:
            # Duplicate -> shards
            shard_map = {"SR": 10, "SSR": 20, "SSR+": 30, "UR": 50, "UR+": 100}
            shards_granted = shard_map.get(rarity, 10)
            await db.user_heroes.update_one(
                {"_id": existing_hero["_id"]},
                {"$inc": {"shards": shards_granted, "duplicates": 1}}
            )
            items.append({"type": "hero_shard", "amount": shards_granted, "hero_id": hero["id"]})
        else:
            # New hero unlock
            new_hero = {
                "user_id": user["id"],
                "hero_id": hero["id"],
                "hero_name": hero["name"],
                "rarity": hero["rarity"],
                "element": hero.get("element"),
                "hero_class": hero.get("hero_class"),
                "level": 1,
                "stars": 1,
                "rank": 1,
                "shards": 0,
                "duplicates": 0,
                "obtained_at": datetime.utcnow().isoformat(),
                "current_hp": 1000,
                "current_atk": 100,
                "current_def": 50
            }
            await db.user_heroes.insert_one(new_hero)
            items.append({"type": "hero_unlock", "amount": 1, "hero_id": hero["id"]})
        
        results.append({
            "rarity": rarity,
            "heroDataId": hero["id"],
            "heroName": hero["name"],
            "outcome": "dupe" if is_dupe else "new",
            "shardsGranted": shards_granted if is_dupe else None,
            "imageUrl": hero.get("image_url"),
            "element": hero.get("element"),
            "heroClass": hero.get("hero_class"),
            "isPityReward": is_pity_pull,
            "isFiller": False
        })
    
    # Apply filler rewards
    inc_ops = {user_field: -cost}  # Deduct cost
    if filler_totals["crystals"] > 0:
        inc_ops["crystals"] = inc_ops.get("crystals", 0) + filler_totals["crystals"]
        items.append({"type": "crystals", "amount": filler_totals["crystals"]})
    if filler_totals["gold"] > 0:
        inc_ops["gold"] = inc_ops.get("gold", 0) + filler_totals["gold"]
        items.append({"type": "gold", "amount": filler_totals["gold"]})
    if filler_totals["coins"] > 0:
        inc_ops["coins"] = inc_ops.get("coins", 0) + filler_totals["coins"]
        items.append({"type": "coins", "amount": filler_totals["coins"]})
    if filler_totals["divine_essence"] > 0:
        inc_ops["divine_essence"] = inc_ops.get("divine_essence", 0) + filler_totals["divine_essence"]
        items.append({"type": "divine_essence", "amount": filler_totals["divine_essence"]})
    if filler_totals["hero_shards"] > 0:
        inc_ops["hero_shards"] = inc_ops.get("hero_shards", 0) + filler_totals["hero_shards"]
        items.append({"type": "hero_shards", "amount": filler_totals["hero_shards"]})
    
    # Update pity counter
    set_ops = {pity_field: pity_current}
    
    # Apply DB updates
    await db.users.update_one(
        {"username": username},
        {"$inc": inc_ops, "$set": set_ops}
    )
    
    # Fetch updated balances
    updated_user = await db.users.find_one({"username": username})
    balances = await get_user_balances(updated_user)
    
    # Build receipt
    receipt = {
        "source": "summon_single" if count == 1 else "summon_multi",
        "sourceId": source_id,
        "bannerId": banner_id,
        "pullCount": count,
        "results": results,
        "pityBefore": pity_before,
        "pityAfter": pity_current,
        "pityTriggered": pity_triggered,
        "currencySpent": {"type": currency_field, "amount": cost},
        "balances": balances,
        "items": items,
        "alreadyClaimed": False
    }
    
    # Store receipt for idempotency
    await db.gacha_receipts.insert_one({
        **receipt,
        "username": username,
        "createdAt": datetime.utcnow()
    })
    
    return receipt


# =============================================================================
# PHASE 3.35: GACHA HISTORY
# =============================================================================

@api_router.get("/gacha/history")
async def get_gacha_history(request: Request, limit: int = 50):
    """
    Get user's gacha summon history (Phase 3.35).
    
    Returns: bannerId, at, pulls summary, pityBefore/After, sourceId.
    """
    # Auth required
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub") or payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Limit range
    limit = min(max(1, limit), 100)
    
    # Fetch history from gacha_receipts
    cursor = db.gacha_receipts.find(
        {"username": username}
    ).sort("createdAt", -1).limit(limit)
    
    history = []
    async for receipt in cursor:
        # Summarize pulls by rarity
        rarity_counts = {}
        for result in receipt.get("results", []):
            rarity = result.get("rarity", "unknown")
            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
        
        # Count new vs dupe
        new_count = sum(1 for r in receipt.get("results", []) if r.get("outcome") == "new" and not r.get("isFiller"))
        dupe_count = sum(1 for r in receipt.get("results", []) if r.get("outcome") == "dupe")
        filler_count = sum(1 for r in receipt.get("results", []) if r.get("isFiller"))
        
        history.append({
            "sourceId": receipt.get("sourceId"),
            "bannerId": receipt.get("bannerId"),
            "pullCount": receipt.get("pullCount", 1),
            "at": receipt.get("createdAt").isoformat() if receipt.get("createdAt") else None,
            "pityBefore": receipt.get("pityBefore", 0),
            "pityAfter": receipt.get("pityAfter", 0),
            "pityTriggered": receipt.get("pityTriggered", False),
            "summary": {
                "rarities": rarity_counts,
                "newHeroes": new_count,
                "duplicates": dupe_count,
                "fillers": filler_count
            },
            "currencySpent": receipt.get("currencySpent", {}),
            "results": [
                {
                    "heroDataId": r.get("heroDataId"),
                    "heroName": r.get("heroName"),
                    "rarity": r.get("rarity"),
                    "outcome": r.get("outcome"),
                    "isFiller": r.get("isFiller", False)
                }
                for r in receipt.get("results", [])
            ]
        })
    
    return {"history": history, "count": len(history)}


# =============================================================================
# PHASE 3.39-3.41: HERO STAR PROGRESSION SYSTEM
# =============================================================================
# Server-authoritative hero star progression.
# All shard deductions go through canonical receipts.
# NO CLIENT-SIDE STAR/STAT MUTATIONS.
# =============================================================================

# LOCKED: Star progression table (1★ → 6★)
STAR_TABLE = {
    1: {"shardCost": 0, "statMultiplier": 1.0},      # Base
    2: {"shardCost": 20, "statMultiplier": 1.15},    # +15%
    3: {"shardCost": 40, "statMultiplier": 1.35},    # +20%
    4: {"shardCost": 80, "statMultiplier": 1.60},    # +25%
    5: {"shardCost": 160, "statMultiplier": 1.90},   # +30%
    6: {"shardCost": 320, "statMultiplier": 2.25},   # +35%
}

MAX_STAR = 6

# LOCKED: Base stats by rarity
BASE_STATS_BY_RARITY = {
    "N":    {"hp": 500, "atk": 50, "def": 30},
    "R":    {"hp": 750, "atk": 75, "def": 45},
    "SR":   {"hp": 1000, "atk": 100, "def": 60},
    "SSR":  {"hp": 1500, "atk": 150, "def": 90},
    "SSR+": {"hp": 2000, "atk": 200, "def": 120},
    "UR":   {"hp": 2500, "atk": 250, "def": 150},
    "UR+":  {"hp": 3000, "atk": 300, "def": 180},
}

# Affinity multiplier by tier
AFFINITY_MULTIPLIERS = {
    0: 1.0,
    1: 1.05,
    2: 1.10,
    3: 1.15,
    4: 1.20,
    5: 1.30,
}

class HeroPromotionRequest(BaseModel):
    """Request body for hero star promotion"""
    hero_id: str
    source_id: str

class HeroPromotionReceipt(BaseModel):
    """Canonical receipt for hero promotion"""
    source: str = "hero_promotion"
    sourceId: str
    heroId: str
    heroDelta: Dict[str, int]  # starBefore, starAfter
    shardsSpent: int
    items: List[Dict[str, Any]]
    balances: Dict[str, int]
    alreadyClaimed: bool = False


def derive_hero_stats(rarity: str, star: int, affinity_tier: int = 0) -> Dict:
    """
    Server-side stat derivation (Phase 3.41).
    
    finalStat = baseStat × starMultiplier × affinityMultiplier
    """
    base = BASE_STATS_BY_RARITY.get(rarity, BASE_STATS_BY_RARITY["SR"])
    star_mult = STAR_TABLE.get(star, STAR_TABLE[1])["statMultiplier"]
    affinity_mult = AFFINITY_MULTIPLIERS.get(affinity_tier, 1.0)
    
    return {
        "baseStats": base,
        "starMultiplier": star_mult,
        "affinityMultiplier": affinity_mult,
        "starBonus": {
            "hp": int(base["hp"] * (star_mult - 1)),
            "atk": int(base["atk"] * (star_mult - 1)),
            "def": int(base["def"] * (star_mult - 1)),
        },
        "affinityBonus": {
            "hp": int(base["hp"] * star_mult * (affinity_mult - 1)),
            "atk": int(base["atk"] * star_mult * (affinity_mult - 1)),
            "def": int(base["def"] * star_mult * (affinity_mult - 1)),
        },
        "finalStats": {
            "hp": int(base["hp"] * star_mult * affinity_mult),
            "atk": int(base["atk"] * star_mult * affinity_mult),
            "def": int(base["def"] * star_mult * affinity_mult),
        },
    }


@api_router.get("/hero/progression-table")
async def get_hero_progression_table():
    """Get the locked star progression table (read-only)"""
    return {
        "starTable": STAR_TABLE,
        "maxStar": MAX_STAR,
        "baseStatsByRarity": BASE_STATS_BY_RARITY,
        "affinityMultipliers": AFFINITY_MULTIPLIERS,
    }


@api_router.get("/hero/{hero_id}/stats")
async def get_hero_derived_stats(request: Request, hero_id: str):
    """
    Get server-derived stats for a hero (Phase 3.41).
    Returns read-only stats computed server-side.
    """
    # Auth required
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub") or payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find user's hero
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found in your collection")
    
    # Get hero definition
    hero_def = await db.heroes.find_one({"id": hero_id})
    rarity = hero_def.get("rarity", "SR") if hero_def else user_hero.get("rarity", "SR")
    star = user_hero.get("stars", 1)
    affinity_tier = user_hero.get("affinity_tier", 0)
    
    # Derive stats
    stats = derive_hero_stats(rarity, star, affinity_tier)
    
    # Get promotion eligibility
    next_star = star + 1
    can_promote = star < MAX_STAR
    promotion_cost = STAR_TABLE.get(next_star, {}).get("shardCost", 0) if can_promote else 0
    current_shards = user_hero.get("shards", 0)
    
    return {
        "heroId": hero_id,
        "rarity": rarity,
        "star": star,
        "affinityTier": affinity_tier,
        "shards": current_shards,
        "stats": stats,
        "promotion": {
            "canPromote": can_promote,
            "nextStar": next_star if can_promote else None,
            "shardCost": promotion_cost,
            "hasEnoughShards": current_shards >= promotion_cost,
            "maxStarReached": star >= MAX_STAR,
        }
    }


@api_router.post("/hero/promote")
async def promote_hero(request: Request, body: HeroPromotionRequest):
    """
    Promote hero to next star level (Phase 3.39).
    
    - Checks hero exists
    - Checks star < maxStar
    - Checks shard balance
    - Deducts shards
    - Increments star
    - Returns canonical receipt
    
    Idempotent by sourceId.
    """
    # Auth required
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub") or payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check idempotency
    existing = await db.promotion_receipts.find_one({"sourceId": body.source_id})
    if existing:
        balances = await get_user_balances(user)
        return {
            **existing,
            "balances": balances,
            "alreadyClaimed": True,
        }
    
    # Find user's hero
    user_hero = await db.user_heroes.find_one({
        "user_id": user["id"],
        "hero_id": body.hero_id
    })
    
    if not user_hero:
        raise HTTPException(
            status_code=404,
            detail={"code": "INVALID_HERO", "message": "Hero not found in your collection"}
        )
    
    current_star = user_hero.get("stars", 1)
    
    # Check max star
    if current_star >= MAX_STAR:
        raise HTTPException(
            status_code=400,
            detail={"code": "STAR_MAX_REACHED", "message": f"Hero already at max star ({MAX_STAR}★)"}
        )
    
    next_star = current_star + 1
    shard_cost = STAR_TABLE[next_star]["shardCost"]
    current_shards = user_hero.get("shards", 0)
    
    # Check shards
    if current_shards < shard_cost:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSUFFICIENT_SHARDS",
                "message": "Not enough shards",
                "required": shard_cost,
                "available": current_shards,
                "deficit": shard_cost - current_shards,
            }
        )
    
    # Apply promotion
    await db.user_heroes.update_one(
        {"_id": user_hero["_id"]},
        {
            "$inc": {"shards": -shard_cost},
            "$set": {"stars": next_star}
        }
    )
    
    # Get updated balances
    updated_user = await db.users.find_one({"username": username})
    balances = await get_user_balances(updated_user)
    
    # Build receipt
    receipt = {
        "source": "hero_promotion",
        "sourceId": body.source_id,
        "heroId": body.hero_id,
        "heroDelta": {
            "starBefore": current_star,
            "starAfter": next_star,
        },
        "shardsSpent": shard_cost,
        "items": [{"type": "shards_spent", "amount": -shard_cost, "hero_id": body.hero_id}],
        "balances": balances,
        "alreadyClaimed": False,
    }
    
    # Store for idempotency
    await db.promotion_receipts.insert_one({
        **receipt,
        "username": username,
        "createdAt": datetime.utcnow(),
    })
    
    return receipt


# ==================== PLAYER CHARACTER SYSTEM (Original) ====================
@api_router.get("/player-character/{username}")
async def get_player_character(username: str):
    """Get or create player character"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    player_char = await db.player_characters.find_one({"user_id": user["id"]})
    
    if not player_char:
        # Create default player character
        player_char = PlayerCharacter(user_id=user["id"])
        await db.player_characters.insert_one(player_char.dict())
        player_char = await db.player_characters.find_one({"user_id": user["id"]})
    
    return convert_objectid(player_char)

@api_router.post("/player-character/upgrade/{username}")
async def upgrade_player_character(username: str, upgrade_type: str):
    """Upgrade player character (costs crystals, takes time or instant with crystals)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    player_char = await db.player_characters.find_one({"user_id": user["id"]})
    if not player_char:
        raise HTTPException(status_code=404, detail="Player character not found")
    
    # Calculate upgrade cost
    base_cost = 100
    cost = base_cost * (player_char["level"] + 1)
    
    if user["crystals"] < cost:
        raise HTTPException(status_code=400, detail=f"Not enough crystals. Need {cost}")
    
    # Deduct crystals
    await db.users.update_one(
        {"username": username},
        {"$inc": {"crystals": -cost}}
    )
    
    # Upgrade buffs based on type
    buff_increase = 0.02  # 2% per upgrade
    update_dict = {"level": player_char["level"] + 1}
    
    if upgrade_type == "atk":
        update_dict["atk_buff"] = player_char.get("atk_buff", 0.0) + buff_increase
    elif upgrade_type == "def":
        update_dict["def_buff"] = player_char.get("def_buff", 0.0) + buff_increase
    elif upgrade_type == "hp":
        update_dict["hp_buff"] = player_char.get("hp_buff", 0.0) + buff_increase
    elif upgrade_type == "crit":
        update_dict["crit_buff"] = player_char.get("crit_buff", 0.0) + buff_increase
    else:
        # General upgrade - increase all buffs slightly
        update_dict["atk_buff"] = player_char.get("atk_buff", 0.0) + buff_increase * 0.5
        update_dict["def_buff"] = player_char.get("def_buff", 0.0) + buff_increase * 0.5
        update_dict["hp_buff"] = player_char.get("hp_buff", 0.0) + buff_increase * 0.5
    
    await db.player_characters.update_one(
        {"user_id": user["id"]},
        {"$set": update_dict}
    )
    
    updated_char = await db.player_characters.find_one({"user_id": user["id"]})
    return convert_objectid(updated_char)

# ==================== LEADERBOARDS ====================
@api_router.get("/leaderboard/cr")
async def get_cr_leaderboard(limit: int = 100):
    """Get CR leaderboard - top players by total character rating"""
    # Get all users with their heroes
    users = await db.users.find().to_list(1000)
    
    leaderboard = []
    for user in users:
        user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
        
        total_cr = 0
        for hero in user_heroes:
            hero_cr = (
                hero["current_hp"] + 
                (hero["current_atk"] * 2) + 
                hero["current_def"] + 
                (hero["rank"] * 500) + 
                (hero["level"] * 100)
            )
            total_cr += hero_cr
        
        if total_cr > 0:
            leaderboard.append({
                "username": user["username"],
                "user_id": user["id"],
                "cr": total_cr,
                "hero_count": len(user_heroes)
            })
    
    # Sort by CR descending
    leaderboard.sort(key=lambda x: x["cr"], reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard[:limit]):
        entry["rank"] = i + 1
    
    return leaderboard[:limit]

@api_router.get("/leaderboard/power")
async def get_power_leaderboard(limit: int = 100):
    """Get Power leaderboard - top players by total power"""
    users = await db.users.find().sort("total_power", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, user in enumerate(users):
        leaderboard.append({
            "rank": i + 1,
            "username": user.get("username"),
            "power": user.get("total_power", 0),
            "level": user.get("level", 1),
            "vip_level": user.get("vip_level", 0),
            "avatar_frame": user.get("avatar_frame", "default")
        })
    
    return leaderboard

@api_router.get("/leaderboard/arena")
async def get_arena_leaderboard(limit: int = 100):
    """Get Arena leaderboard - top players by rating"""
    arena_records = await db.arena_records.find().sort("rating", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, record in enumerate(arena_records):
        leaderboard.append({
            **convert_objectid(record),
            "rank": i + 1,
            "win_rate": (record["wins"] / max(record["wins"] + record["losses"], 1)) * 100
        })
    
    return leaderboard

@api_router.get("/leaderboard/abyss")
async def get_abyss_leaderboard(limit: int = 100):
    """Get Abyss leaderboard - top players by highest level"""
    abyss_records = await db.abyss_progress.find().sort("highest_level", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, record in enumerate(abyss_records):
        user = await db.users.find_one({"id": record["user_id"]})
        if user:
            leaderboard.append({
                "rank": i + 1,
                "username": user["username"],
                "user_id": record["user_id"],
                "highest_level": record["highest_level"],
                "current_level": record["current_level"],
                "total_clears": record["total_clears"]
            })
    
    return leaderboard

@api_router.get("/leaderboard/campaign")
async def get_campaign_leaderboard(limit: int = 100):
    """Get Campaign leaderboard - top players by campaign progress"""
    # Get campaign progress from users
    users = await db.users.find().sort("campaign_stage", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, user in enumerate(users):
        campaign_stage = user.get("campaign_stage", 1)
        leaderboard.append({
            "rank": i + 1,
            "username": user.get("username"),
            "stage": campaign_stage,
            "power": user.get("total_power", 0),
            "vip_level": user.get("vip_level", 0)
        })
    
    return leaderboard

# ==================== ABYSS MODE ====================
# NOTE: /abyss/progress/{username} - LEGACY endpoint (basic)
# Prefer /abyss/{username}/status (line ~5456) which includes boss info, zone progression, etc.
# Keeping this for backwards compatibility with older UI code.
@api_router.get("/abyss/progress/{username}")
async def get_abyss_progress(username: str):
    """Get user's abyss progress (LEGACY - prefer /abyss/{username}/status)"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not progress:
        # Create initial progress
        progress = AbyssProgress(user_id=user["id"])
        await db.abyss_progress.insert_one(progress.dict())
        progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    
    return convert_objectid(progress)

# NOTE: /abyss/battle/{username}/{level} - LEGACY battle endpoint (complex multi-team)
# Prefer /abyss/{username}/attack (line ~5549) which is simpler and used by UI
@api_router.post("/abyss/battle/{username}/{level}")
async def battle_abyss(username: str, level: int, request: AbyssBattleRequest):
    """Battle an abyss level - requires multiple teams for higher levels"""
    team_ids = request.team_ids
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get abyss progress
    progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = AbyssProgress(user_id=user["id"])
        await db.abyss_progress.insert_one(progress.dict())
        progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    
    # Check if level is unlocked (must be current level or replay cleared level)
    if level > progress["current_level"] and level > progress["highest_level"]:
        raise HTTPException(status_code=400, detail="Level not unlocked")
    
    # Determine required teams based on level
    required_teams = 1
    if level > 1000:
        required_teams = 3
    elif level > 200:
        required_teams = 2
    
    # Get all user heroes
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    # If no teams provided, use all heroes (simplified battle mode)
    all_team_heroes = []
    if not team_ids or len(team_ids) == 0:
        # Use all user's heroes
        all_team_heroes = user_heroes
    else:
        if len(team_ids) != required_teams:
            raise HTTPException(status_code=400, detail=f"Level {level} requires exactly {required_teams} teams")
        
        # Collect all heroes from teams
        for tid in team_ids:
            team = await db.teams.find_one({"id": tid, "user_id": user["id"]})
            if not team:
                raise HTTPException(status_code=404, detail=f"Team {tid} not found")
            
            team_heroes = [h for h in user_heroes if h["id"] in team.get("hero_ids", [])]
            all_team_heroes.extend(team_heroes)
        
        if len(all_team_heroes) < required_teams * 6:
            raise HTTPException(status_code=400, detail=f"Not enough heroes. Need {required_teams * 6} heroes in {required_teams} teams")
    
    # Get player character buffs
    player_char = await db.player_characters.find_one({"user_id": user["id"]})
    
    # Calculate total team power with buffs
    user_power = 0
    for hero in all_team_heroes:
        base_power = hero["current_hp"] + (hero["current_atk"] * 2) + hero["current_def"]
        
        # Apply player character buffs
        if player_char:
            base_power *= (1 + player_char.get("hp_buff", 0))
            base_power *= (1 + player_char.get("atk_buff", 0) * 2)  # ATK weighted 2x
            base_power *= (1 + player_char.get("def_buff", 0))
        
        user_power += base_power
    
    # Calculate enemy power - scales exponentially with level
    base_enemy_power = 5000
    # Exponential scaling: harder as you progress
    level_multiplier = 1.0 + (level * 0.05)  # 5% increase per level
    
    # Additional difficulty spikes at team requirement thresholds
    if level > 1000:
        level_multiplier *= 3.0  # 3x harder at 3-team levels
    elif level > 200:
        level_multiplier *= 2.0  # 2x harder at 2-team levels
    
    enemy_power = int(base_enemy_power * level_multiplier)
    
    # Combat simulation
    power_ratio = user_power / enemy_power
    
    # Win chance calculation (harder than story mode)
    base_win_chance = min(0.90, max(0.01, 0.4 + (power_ratio - 1.0) * 0.6))
    
    import random
    roll = random.random()
    victory = roll < base_win_chance
    
    # Calculate rewards based on level
    rewards = {}
    if victory:
        rewards = {
            "coins": level * 100,
            "gold": level * 50,
            "crystals": level // 10 if level % 10 == 0 else 0  # Crystals every 10 levels
        }
        
        # Update user resources
        await db.users.update_one(
            {"username": username},
            {
                "$inc": {
                    "coins": rewards["coins"],
                    "gold": rewards["gold"],
                    "crystals": rewards["crystals"]
                }
            }
        )
        
        # Update progress
        new_current = level + 1 if level == progress["current_level"] else progress["current_level"]
        new_highest = max(progress["highest_level"], level)
        
        await db.abyss_progress.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "current_level": new_current,
                    "highest_level": new_highest,
                    "last_attempt": datetime.utcnow()
                },
                "$inc": {"total_clears": 1}
            }
        )
    
    return {
        "victory": victory,
        "level": level,
        "user_power": int(user_power),
        "enemy_power": enemy_power,
        "power_ratio": power_ratio,
        "required_teams": required_teams,
        "rewards": rewards,
        "next_level": level + 1 if victory else level
    }

# ==================== ARENA MODE ====================
@api_router.get("/arena/record/{username}")
async def get_arena_record(username: str):
    """Get user's arena record"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    record = await db.arena_records.find_one({"user_id": user["id"]})
    if not record:
        # Create initial record
        record = ArenaRecord(user_id=user["id"], username=username)
        await db.arena_records.insert_one(record.dict())
        record = await db.arena_records.find_one({"user_id": user["id"]})
    
    return convert_objectid(record)

# Phase 3.59: Arena opponents endpoint with DEV NPC fallback
@api_router.get("/arena/opponents/{username}")
async def get_arena_opponents(username: str):
    """
    Get list of potential arena opponents for a user.
    
    Phase 3.59: DEV fallback returns 5 deterministic NPC opponents
    when no real opponents are available (unblocks UI/tests).
    
    NPCs are marked with isNpc: true and offer no rewards advantage.
    """
    user = await get_user_readonly(username)
    
    # Get user's arena record for rating-based matchmaking
    user_record = await db.arena_records.find_one({"user_id": user["id"]})
    user_rating = user_record.get("rating", 1000) if user_record else 1000
    
    # Calculate user's power for NPC scaling
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    user_power = sum(
        h.get("current_hp", 1000) + (h.get("current_atk", 100) * 2) + h.get("current_def", 100)
        for h in user_heroes[:6]
    ) if user_heroes else 30000  # Default power if no heroes
    
    # Find real opponents with similar rating
    rating_range = 300
    real_opponents = await db.arena_records.find({
        "user_id": {"$ne": user["id"]},
        "rating": {
            "$gte": user_rating - rating_range,
            "$lte": user_rating + rating_range
        }
    }).limit(5).to_list(5)
    
    # If not enough, expand search
    if len(real_opponents) < 3:
        real_opponents = await db.arena_records.find(
            {"user_id": {"$ne": user["id"]}}
        ).limit(5).to_list(5)
    
    opponents = []
    
    # Add real opponents
    for opp_record in real_opponents:
        opp_heroes = await db.user_heroes.find({"user_id": opp_record["user_id"]}).to_list(6)
        opp_power = sum(
            h.get("current_hp", 1000) + (h.get("current_atk", 100) * 2) + h.get("current_def", 100)
            for h in opp_heroes
        )
        
        opponents.append({
            "id": opp_record["user_id"],
            "username": opp_record.get("username", "Unknown"),
            "power": opp_power,
            "rank": opp_record.get("season_rank", 999),
            "rating": opp_record.get("rating", 1000),
            "isNpc": False,
            "team_preview": [
                {"hero_name": h.get("hero_name", "Hero"), "rarity": h.get("rarity", "SR")}
                for h in opp_heroes[:3]
            ]
        })
    
    # Phase 3.59: DEV fallback - add NPC opponents if pool is empty
    # These are deterministic and marked isNpc: true
    if len(opponents) < 5:
        npc_templates = [
            {"id": "npc_1", "name": "Practice A", "power_mult": 0.85},
            {"id": "npc_2", "name": "Practice B", "power_mult": 0.95},
            {"id": "npc_3", "name": "Practice C", "power_mult": 1.00},
            {"id": "npc_4", "name": "Practice D", "power_mult": 1.10},
            {"id": "npc_5", "name": "Practice E", "power_mult": 1.25},
        ]
        
        for template in npc_templates:
            if len(opponents) >= 5:
                break
            
            npc_power = int(user_power * template["power_mult"])
            opponents.append({
                "id": template["id"],
                "username": template["name"],
                "power": npc_power,
                "rank": 999,
                "rating": int(user_rating * template["power_mult"]),
                "isNpc": True,
                "team_preview": [
                    {"hero_name": "Training Dummy", "rarity": "SR"}
                ]
            })
    
    return opponents

# Phase 3.59: PvP Match execution endpoint
@api_router.post("/pvp/match")
async def execute_pvp_match(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Execute a PvP match with server-side, deterministic resolution.
    
    Phase 3.59 Requirements:
    - Server-authoritative: outcome computed server-side
    - Ticket consumption: deducts 1 arena ticket
    - Idempotency: uses sourceId to prevent double-spending
    - No monetization hooks
    
    Request body:
    {
        "opponent_id": str,  # ID of opponent (can be NPC id like "npc_1")
        "source_id": str     # Client-generated idempotency key
    }
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    assert_account_active(current_user)
    
    body = await request.json()
    opponent_id = body.get("opponent_id")
    source_id = body.get("source_id")
    
    if not opponent_id:
        raise HTTPException(status_code=400, detail="opponent_id required")
    if not source_id:
        raise HTTPException(status_code=400, detail="source_id required for idempotency")
    
    user_id = current_user.get("id")
    username = current_user.get("username")
    
    # Idempotency check: prevent double-spending
    existing_match = await db.pvp_matches.find_one({"source_id": source_id})
    if existing_match:
        # Return cached result
        return existing_match.get("result", {"error": "duplicate"})
    
    # Check arena tickets
    user = await db.users.find_one({"id": user_id})
    arena_tickets = user.get("arena_tickets", 5)
    if arena_tickets <= 0:
        raise HTTPException(status_code=400, detail="No arena tickets available")
    
    # Get user's arena record
    user_record = await db.arena_records.find_one({"user_id": user_id})
    if not user_record:
        user_record = ArenaRecord(user_id=user_id, username=username)
        await db.arena_records.insert_one(user_record.dict())
        user_record = await db.arena_records.find_one({"user_id": user_id})
    
    # Calculate user power
    user_heroes = await db.user_heroes.find({"user_id": user_id}).to_list(1000)
    user_power = sum(
        h.get("current_hp", 1000) + (h.get("current_atk", 100) * 2) + h.get("current_def", 100)
        for h in user_heroes[:6]
    ) if user_heroes else 30000
    
    # Get opponent info
    is_npc = opponent_id.startswith("npc_")
    
    if is_npc:
        # NPC opponent: deterministic power based on user
        npc_multipliers = {
            "npc_1": 0.85, "npc_2": 0.95, "npc_3": 1.00,
            "npc_4": 1.10, "npc_5": 1.25
        }
        mult = npc_multipliers.get(opponent_id, 1.0)
        opponent_power = int(user_power * mult)
        opponent_rating = int(user_record.get("rating", 1000) * mult)
        opponent_username = f"Practice {opponent_id[-1].upper()}"
    else:
        # Real opponent
        opponent_record = await db.arena_records.find_one({"user_id": opponent_id})
        if not opponent_record:
            raise HTTPException(status_code=404, detail="Opponent not found")
        
        opponent_heroes = await db.user_heroes.find({"user_id": opponent_id}).to_list(6)
        opponent_power = sum(
            h.get("current_hp", 1000) + (h.get("current_atk", 100) * 2) + h.get("current_def", 100)
            for h in opponent_heroes
        )
        opponent_rating = opponent_record.get("rating", 1000)
        opponent_username = opponent_record.get("username", "Unknown")
    
    # Server-side deterministic combat resolution
    # Use source_id as seed for determinism (same sourceId = same result)
    import hashlib
    seed = int(hashlib.sha256(source_id.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    
    power_ratio = user_power / max(opponent_power, 1)
    base_win_chance = min(0.85, max(0.15, 0.5 + (power_ratio - 1.0) * 0.5))
    
    roll = random.random()
    victory = roll < base_win_chance
    
    # Reset random seed
    random.seed()
    
    # Calculate rating change (ELO-style)
    k_factor = 32
    expected_score = 1 / (1 + 10 ** ((opponent_rating - user_record.get("rating", 1000)) / 400))
    actual_score = 1 if victory else 0
    rating_change = int(k_factor * (actual_score - expected_score))
    
    # Deduct arena ticket
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"arena_tickets": -1}}
    )
    
    # Update user's arena record
    new_rating = user_record.get("rating", 1000) + rating_change
    if not victory:
        new_rating = max(0, new_rating)
    
    await db.arena_records.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "rating": new_rating,
                "win_streak": (user_record.get("win_streak", 0) + 1) if victory else 0,
                "highest_rating": max(user_record.get("highest_rating", 1000), new_rating) if victory else user_record.get("highest_rating", 1000)
            },
            "$inc": {"wins": 1 if victory else 0, "losses": 0 if victory else 1}
        }
    )
    
    # Update real opponent's record (not NPCs)
    if not is_npc:
        if victory:
            await db.arena_records.update_one(
                {"user_id": opponent_id},
                {
                    "$set": {"win_streak": 0},
                    "$inc": {"rating": -abs(rating_change) // 2, "losses": 1}
                }
            )
        else:
            await db.arena_records.update_one(
                {"user_id": opponent_id},
                {
                    "$inc": {"rating": abs(rating_change) // 2, "wins": 1}
                }
            )
    
    # Calculate rewards (no rewards advantage from NPCs)
    rewards = {
        "pvp_medals": 50 if victory else 10,
        "gold": 5000 if victory else 1000
    }
    
    # Award rewards
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"pvp_medals": rewards["pvp_medals"], "gold": rewards["gold"]}}
    )
    
    result = {
        "victory": victory,
        "opponent_id": opponent_id,
        "opponent_username": opponent_username,
        "opponent_power": opponent_power,
        "user_power": user_power,
        "rating_change": rating_change,
        "new_rating": new_rating,
        "win_streak": (user_record.get("win_streak", 0) + 1) if victory else 0,
        "rewards": rewards,
        "is_npc_match": is_npc,
        "tickets_remaining": arena_tickets - 1
    }
    
    # Store match for idempotency
    await db.pvp_matches.insert_one({
        "source_id": source_id,
        "user_id": user_id,
        "opponent_id": opponent_id,
        "created_at": datetime.now(timezone.utc),
        "result": result
    })
    
    return result

@api_router.post("/arena/battle/{username}")
async def arena_battle(username: str, request: ArenaBattleRequest):
    """Battle in arena against another player"""
    team_id = request.team_id
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get user's arena record
    user_record = await db.arena_records.find_one({"user_id": user["id"]})
    if not user_record:
        user_record = ArenaRecord(user_id=user["id"], username=username)
        await db.arena_records.insert_one(user_record.dict())
        user_record = await db.arena_records.find_one({"user_id": user["id"]})
    
    # Get all user heroes
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    # Get user's team or use all heroes if team_id is "default" or not found
    team_heroes = []
    if team_id and team_id != "default":
        team = await db.teams.find_one({"id": team_id, "user_id": user["id"]})
        if team:
            team_heroes = [h for h in user_heroes if h["id"] in team.get("hero_ids", [])]
    
    # If no specific team found, use all user's heroes (simplified battle mode)
    if not team_heroes:
        team_heroes = user_heroes
    
    if len(team_heroes) == 0:
        raise HTTPException(status_code=400, detail="No heroes available for battle")
    
    # Calculate user power with player buffs
    player_char = await db.player_characters.find_one({"user_id": user["id"]})
    user_power = 0
    for hero in team_heroes:
        base_power = hero["current_hp"] + (hero["current_atk"] * 2) + hero["current_def"]
        if player_char:
            base_power *= (1 + player_char.get("hp_buff", 0))
            base_power *= (1 + player_char.get("atk_buff", 0) * 2)
            base_power *= (1 + player_char.get("def_buff", 0))
        user_power += base_power
    
    # Find opponent with similar rating
    rating_range = 200
    opponents = await db.arena_records.find({
        "user_id": {"$ne": user["id"]},
        "rating": {
            "$gte": user_record["rating"] - rating_range,
            "$lte": user_record["rating"] + rating_range
        }
    }).to_list(10)
    
    if not opponents:
        # Fallback to any opponent
        opponents = await db.arena_records.find({"user_id": {"$ne": user["id"]}}).limit(10).to_list(10)
    
    if not opponents:
        raise HTTPException(status_code=404, detail="No opponents available")
    
    import random
    opponent_record = random.choice(opponents)
    
    # Calculate opponent power (simplified - use their CR)
    opponent_heroes = await db.user_heroes.find({"user_id": opponent_record["user_id"]}).to_list(1000)
    opponent_power = sum(
        h["current_hp"] + (h["current_atk"] * 2) + h["current_def"]
        for h in opponent_heroes[:6]  # Use top 6 heroes
    )
    
    # Combat simulation
    power_ratio = user_power / max(opponent_power, 1)
    base_win_chance = min(0.85, max(0.15, 0.5 + (power_ratio - 1.0) * 0.5))
    
    roll = random.random()
    victory = roll < base_win_chance
    
    # Calculate rating change (ELO-style)
    k_factor = 32
    expected_score = 1 / (1 + 10 ** ((opponent_record["rating"] - user_record["rating"]) / 400))
    actual_score = 1 if victory else 0
    rating_change = int(k_factor * (actual_score - expected_score))
    
    # Update records
    if victory:
        new_rating = user_record["rating"] + rating_change
        new_streak = user_record["win_streak"] + 1
        
        await db.arena_records.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "rating": new_rating,
                    "win_streak": new_streak,
                    "highest_rating": max(user_record.get("highest_rating", 1000), new_rating)
                },
                "$inc": {"wins": 1}
            }
        )
        
        # Opponent loses rating
        await db.arena_records.update_one(
            {"user_id": opponent_record["user_id"]},
            {
                "$set": {"win_streak": 0},
                "$inc": {
                    "rating": -abs(rating_change) // 2,  # Lose half
                    "losses": 1
                }
            }
        )
    else:
        new_rating = max(0, user_record["rating"] + rating_change)
        
        await db.arena_records.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "rating": new_rating,
                    "win_streak": 0
                },
                "$inc": {"losses": 1}
            }
        )
        
        # Opponent gains rating
        await db.arena_records.update_one(
            {"user_id": opponent_record["user_id"]},
            {
                "$inc": {
                    "rating": abs(rating_change) // 2,
                    "wins": 1
                },
                "$set": {"win_streak": opponent_record.get("win_streak", 0) + 1}
            }
        )
    
    return {
        "victory": victory,
        "opponent_username": opponent_record["username"],
        "opponent_rating": opponent_record["rating"],
        "user_power": int(user_power),
        "opponent_power": int(opponent_power),
        "rating_change": rating_change,
        "new_rating": user_record["rating"] + rating_change if victory else max(0, user_record["rating"] + rating_change),
        "win_streak": user_record["win_streak"] + 1 if victory else 0
    }

# ==================== CHAT SYSTEM (SERVER-AUTHORITATIVE) ====================

# Pydantic models for chat payloads
class ChatSendPayload(BaseModel):
    message: str
    channel_type: str = "world"
    channel_id: Optional[str] = None
    language: str = "en"
    client_msg_id: Optional[str] = None
    server_region: str = "global"

class ChatReportPayload(BaseModel):
    reported_username: str
    reason: str
    message_id: Optional[str] = None
    details: Optional[str] = None

@api_router.post("/chat/send")
@limiter.limit("10/minute")
async def send_chat_message(
    payload: ChatSendPayload,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a chat message (SERVER-AUTHORITATIVE)
    
    Security features:
    - Server-authoritative: sender derived from JWT, NOT client
    - Rate limited: 10 messages/minute per IP + per-user
    - Input validation: length, characters, PII, URLs
    - Profanity filtering
    - Moderation checks: mute/ban/shadowban
    - Prohibited token detection with permanent ban
    - Idempotency via client_msg_id
    - Frozen account check
    """
    # CRITICAL: Require authentication
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # SECURITY: Frozen accounts cannot send messages
    assert_account_active(current_user)
    
    # Derive sender from JWT - NEVER trust client
    sender_username = current_user.get("username")
    sender_id = str(current_user.get("id") or current_user.get("_id") or "")
    
    if not sender_username or not sender_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check rate limit (per-user)
    is_allowed, retry_after = check_chat_rate_limit(sender_id)
    if not is_allowed:
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limited. Try again in {retry_after} seconds",
            headers={"Retry-After": str(retry_after)}
        )
    
    # Check moderation status (mute/ban)
    is_restricted, restriction_reason = await is_user_chat_restricted(sender_id)
    if is_restricted:
        raise HTTPException(status_code=403, detail=restriction_reason)
    
    # Check shadowban (silently accept but don't broadcast)
    is_shadow = await is_user_shadowbanned(sender_id)
    
    # Validate channel type
    if payload.channel_type not in ["world", "local", "guild", "private"]:
        raise HTTPException(status_code=400, detail="Invalid channel type")
    
    # Validate language
    language = payload.language if payload.language in SUPPORTED_LANGUAGES else "en"
    
    # Sanitize message
    sanitized_message = sanitize_chat_message(payload.message)
    
    # Validate message length
    if len(sanitized_message) < CHAT_CONFIG["min_message_length"]:
        raise HTTPException(status_code=400, detail="Message too short")
    
    if len(sanitized_message) > CHAT_CONFIG["max_message_length"]:
        raise HTTPException(status_code=400, detail=f"Message too long (max {CHAT_CONFIG['max_message_length']} characters)")
    
    # Block URLs
    if detect_url(sanitized_message):
        raise HTTPException(status_code=400, detail="URLs are not allowed in chat")
    
    # Block PII
    pii_type = detect_pii(sanitized_message)
    if pii_type:
        raise HTTPException(status_code=400, detail="Personal information (emails, phone numbers) not allowed in chat")
    
    # Check for prohibited tokens (PERMANENT BAN)
    prohibited_key = check_prohibited_tokens(sanitized_message)
    if prohibited_key:
        # Issue permanent ban - do NOT log message content
        await issue_permanent_ban(sender_id, sender_username, prohibited_key)
        raise HTTPException(status_code=403, detail="Banned")
    
    # Censor profanity (lesser offenses)
    censored_message = censor_message(sanitized_message)
    
    # Idempotency check
    if payload.client_msg_id:
        existing = await db.chat_messages.find_one({
            "sender_id": sender_id,
            "client_msg_id": payload.client_msg_id
        })
        if existing:
            return convert_objectid(existing)
    
    # Create chat message
    chat_msg = ChatMessage(
        sender_id=sender_id,
        sender_username=sender_username,
        channel_type=payload.channel_type,
        channel_id=payload.channel_id,
        message=censored_message,
        language=language,
        server_region=payload.server_region
    )
    
    msg_dict = chat_msg.dict()
    if payload.client_msg_id:
        msg_dict["client_msg_id"] = payload.client_msg_id
    
    # If shadowbanned, store but mark as hidden
    if is_shadow:
        msg_dict["is_shadowbanned"] = True
    
    await db.chat_messages.insert_one(msg_dict)
    
    return convert_objectid(msg_dict)


@api_router.get("/chat/messages")
@limiter.limit("30/minute")
async def get_chat_messages(
    request: Request,
    channel_type: str,
    channel_id: Optional[str] = None,
    server_region: str = "global",
    limit: int = 50,
    before_timestamp: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get chat messages for a channel (SERVER-AUTHORITATIVE)
    
    Security features:
    - Rate limited: 30 requests/minute per IP
    - Max limit capped to prevent scraping
    - Shadowbanned messages only visible to sender
    - Blocked users filtered
    - User identity from JWT for filtering
    """
    # Cap limit to prevent scraping
    limit = min(limit, CHAT_CONFIG["max_fetch_limit"])
    
    query = {"channel_type": channel_type}
    
    # Filter shadowbanned messages (only show to the sender)
    if current_user:
        user_id = str(current_user.get("id") or current_user.get("_id") or "")
        
        if user_id:
            # Get user's blocked list
            user_status = await get_user_chat_status(user_id)
            blocked_users = user_status.get("blocked_users", []) if user_status else []
            
            # Complex query: show non-shadowbanned OR own shadowbanned messages
            query["$or"] = [
                {"is_shadowbanned": {"$ne": True}},
                {"sender_id": user_id, "is_shadowbanned": True}
            ]
            
            # Filter out messages from blocked users
            if blocked_users:
                query["sender_id"] = {"$nin": blocked_users}
    else:
        # Anonymous/no auth - only show non-shadowbanned
        query["is_shadowbanned"] = {"$ne": True}
    
    if channel_type == "local":
        query["server_region"] = server_region
    elif channel_type in ["guild", "private"]:
        if not channel_id:
            raise HTTPException(status_code=400, detail="channel_id required for guild/private chat")
        query["channel_id"] = channel_id
    
    # Pagination support
    if before_timestamp:
        try:
            query["timestamp"] = {"$lt": datetime.fromisoformat(before_timestamp.replace('Z', '+00:00'))}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp format")
    
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    # Remove internal fields before returning
    result = []
    for msg in messages:
        msg_clean = convert_objectid(msg)
        msg_clean.pop("is_shadowbanned", None)
        msg_clean.pop("client_msg_id", None)
        result.append(msg_clean)
    
    return result


# ==================== CHAT MODERATION ENDPOINTS (SERVER-AUTHORITATIVE) ====================

@api_router.post("/chat/report")
async def report_chat_message(
    payload: ChatReportPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Report a chat message or user (SERVER-AUTHORITATIVE)
    
    Reporter is derived from JWT, NOT client.
    Reasons: spam, harassment, hate_speech, inappropriate, other
    """
    # CRITICAL: Require authentication
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Derive reporter from JWT
    reporter_username = current_user.get("username")
    reporter_id = str(current_user.get("id") or current_user.get("_id") or "")
    
    if not reporter_username or not reporter_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Validate reported user
    reported = await db.users.find_one({"username": payload.reported_username})
    if not reported:
        raise HTTPException(status_code=404, detail="Reported user not found")
    
    # Can't report yourself
    if reported.get("username") == reporter_username:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    
    # Validate reason
    valid_reasons = ["spam", "harassment", "hate_speech", "inappropriate", "other"]
    if payload.reason not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"Invalid reason. Must be one of: {', '.join(valid_reasons)}")
    
    # Check if message exists (if provided)
    if payload.message_id:
        message = await db.chat_messages.find_one({"id": payload.message_id})
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
    
    # Create report
    report = ChatReport(
        reporter_id=reporter_id,
        reporter_username=reporter_username,
        reported_user_id=reported["id"],
        reported_username=payload.reported_username,
        message_id=payload.message_id,
        reason=payload.reason,
        details=payload.details[:500] if payload.details else None  # Limit details length
    )
    
    await db.chat_reports.insert_one(report.dict())
    
    # Increment report count on user status
    await db.chat_user_status.update_one(
        {"user_id": reported["id"]},
        {
            "$set": {"user_id": reported["id"], "username": payload.reported_username},
            "$inc": {"report_count": 1}
        },
        upsert=True
    )
    
    # Auto-action: If user gets 5+ reports, auto-mute for review
    user_status = await get_user_chat_status(reported["id"])
    if user_status and user_status.get("report_count", 0) >= 5:
        if not user_status.get("is_muted"):
            await db.chat_user_status.update_one(
                {"user_id": reported["id"]},
                {
                    "$set": {
                        "is_muted": True,
                        "mute_expires_at": datetime.utcnow() + timedelta(hours=1)
                    }
                }
            )
            await log_moderation_action(
                user_id=reported["id"],
                username=payload.reported_username,
                action_type="mute",
                reason="Auto-muted due to multiple reports",
                issued_by="system",
                duration_minutes=60
            )
    
    return {"success": True, "report_id": report.id, "message": "Report submitted successfully"}


@api_router.post("/chat/block-user")
async def block_user(
    blocked_username: str,
    current_user: dict = Depends(get_current_user),
):
    """Block a user from appearing in your chat (SERVER-AUTHORITATIVE)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    username = current_user.get("username")
    
    if not user_id or not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    blocked = await db.users.find_one({"username": blocked_username})
    if not blocked:
        raise HTTPException(status_code=404, detail="User to block not found")
    
    if username == blocked_username:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    await db.chat_user_status.update_one(
        {"user_id": user_id},
        {
            "$set": {"user_id": user_id, "username": username},
            "$addToSet": {"blocked_users": blocked["id"]}
        },
        upsert=True
    )
    
    return {"success": True, "message": f"Blocked {blocked_username}"}


@api_router.post("/chat/unblock-user")
async def unblock_user(
    blocked_username: str,
    current_user: dict = Depends(get_current_user),
):
    """Unblock a user (SERVER-AUTHORITATIVE)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    blocked = await db.users.find_one({"username": blocked_username})
    if not blocked:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.chat_user_status.update_one(
        {"user_id": user_id},
        {"$pull": {"blocked_users": blocked["id"]}}
    )
    
    return {"success": True, "message": f"Unblocked {blocked_username}"}


@api_router.get("/chat/blocked-users")
async def get_blocked_users(
    current_user: dict = Depends(get_current_user),
):
    """Get list of blocked users (SERVER-AUTHORITATIVE)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    status = await get_user_chat_status(user_id)
    blocked_ids = status.get("blocked_users", []) if status else []
    
    # Get usernames for blocked IDs
    blocked_users = []
    for blocked_id in blocked_ids:
        blocked_user = await db.users.find_one({"id": blocked_id})
        if blocked_user:
            blocked_users.append({
                "id": blocked_id,
                "username": blocked_user["username"]
            })
    
    return {"blocked_users": blocked_users}


# ==================== ADMIN MODERATION ENDPOINTS (JWT-BOUND, ADAM-ONLY) ====================

@api_router.post("/admin/chat/mute")
async def admin_mute_user(
    request: Request,
    target_username: str,
    duration_minutes: int,
    reason: str,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Mute a user (ADAM-ONLY, JWT-BOUND)"""
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    target_id = get_user_id(target)
    expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes) if duration_minutes > 0 else None
    
    await db.chat_user_status.update_one(
        {"user_id": target_id},
        {
            "$set": {
                "user_id": target_id,
                "username": target_username,
                "is_muted": True,
                "mute_expires_at": expires_at
            }
        },
        upsert=True
    )
    
    await log_admin_action(
        admin_user=admin_user,
        action_type="mute",
        target_user_id=target_id,
        target_username=target_username,
        reason=reason,
        request=request,
        duration_minutes=duration_minutes if duration_minutes > 0 else None
    )
    
    return {"success": True, "message": f"Muted {target_username} for {duration_minutes} minutes"}


@api_router.post("/admin/chat/unmute")
async def admin_unmute_user(
    request: Request,
    target_username: str,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Unmute a user (ADAM-ONLY, JWT-BOUND)"""
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    target_id = get_user_id(target)
    
    await db.chat_user_status.update_one(
        {"user_id": target_id},
        {"$set": {"is_muted": False, "mute_expires_at": None}}
    )
    
    await log_admin_action(
        admin_user=admin_user,
        action_type="unmute",
        target_user_id=target_id,
        target_username=target_username,
        reason="Admin action",
        request=request
    )
    
    return {"success": True, "message": f"Unmuted {target_username}"}


@api_router.post("/admin/chat/ban")
async def admin_ban_user(
    request: Request,
    target_username: str,
    duration_minutes: Optional[int] = None,  # None = permanent
    reason: str = "Violation of community guidelines",
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Ban a user from chat (ADAM-ONLY, JWT-BOUND)"""
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    target_id = get_user_id(target)
    expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes) if duration_minutes else None
    
    await db.chat_user_status.update_one(
        {"user_id": target_id},
        {
            "$set": {
                "user_id": target_id,
                "username": target_username,
                "is_banned": True,
                "ban_expires_at": expires_at
            }
        },
        upsert=True
    )
    
    await log_admin_action(
        admin_user=admin_user,
        action_type="ban",
        target_user_id=target_id,
        target_username=target_username,
        reason=reason,
        request=request,
        duration_minutes=duration_minutes
    )
    
    duration_str = f"{duration_minutes} minutes" if duration_minutes else "permanently"
    return {"success": True, "message": f"Banned {target_username} from chat {duration_str}"}


@api_router.post("/admin/chat/unban")
async def admin_unban_user(
    request: Request,
    target_username: str,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Unban a user from chat (ADAM-ONLY, JWT-BOUND)"""
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    target_id = get_user_id(target)
    
    await db.chat_user_status.update_one(
        {"user_id": target_id},
        {"$set": {"is_banned": False, "ban_expires_at": None}}
    )
    
    await log_admin_action(
        admin_user=admin_user,
        action_type="unban",
        target_user_id=target_id,
        target_username=target_username,
        reason="Admin action",
        request=request
    )
    
    return {"success": True, "message": f"Unbanned {target_username}"}


@api_router.post("/admin/chat/shadowban")
async def admin_shadowban_user(
    request: Request,
    target_username: str,
    duration_minutes: Optional[int] = None,
    reason: str = "Suspicious activity",
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Shadowban a user (ADAM-ONLY, JWT-BOUND)"""
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    target_id = get_user_id(target)
    expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes) if duration_minutes else None
    
    await db.chat_user_status.update_one(
        {"user_id": target_id},
        {
            "$set": {
                "user_id": target_id,
                "username": target_username,
                "is_shadowbanned": True,
                "shadowban_expires_at": expires_at
            }
        },
        upsert=True
    )
    
    await log_admin_action(
        admin_user=admin_user,
        action_type="shadowban",
        target_user_id=target_id,
        target_username=target_username,
        reason=reason,
        request=request,
        duration_minutes=duration_minutes
    )
    
    return {"success": True, "message": f"Shadowbanned {target_username}"}


@api_router.get("/admin/chat/reports")
async def admin_get_reports(
    report_status: str = "pending",
    limit: int = 50,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Get chat reports (ADAM-ONLY, JWT-BOUND)"""
    query = {}
    if report_status != "all":
        query["status"] = report_status
    
    reports = await db.chat_reports.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [convert_objectid(r) for r in reports]


@api_router.post("/admin/chat/review-report")
async def admin_review_report(
    request: Request,
    report_id: str,
    action: str,  # dismiss, warn, mute, ban
    notes: Optional[str] = None,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Review and action a report (ADAM-ONLY, JWT-BOUND)"""
    report = await db.chat_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    valid_actions = ["dismiss", "warn", "mute", "ban"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}")
    
    admin_username = admin_user.get("username")
    
    # Update report status
    await db.chat_reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "status": "actioned" if action != "dismiss" else "dismissed",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": admin_username,
                "action_taken": action
            }
        }
    )
    
    # Apply action if not dismissed
    if action == "warn":
        await db.chat_user_status.update_one(
            {"user_id": report["reported_user_id"]},
            {"$inc": {"warning_count": 1}},
            upsert=True
        )
        await log_admin_action(
            admin_user=admin_user,
            action_type="warn",
            target_user_id=report["reported_user_id"],
            target_username=report["reported_username"],
            reason=f"Report #{report_id}: {report['reason']}",
            request=request,
            notes=notes
        )
    elif action == "mute":
        # Call the mute endpoint directly (already JWT-bound)
        target = await db.users.find_one({"username": report["reported_username"]})
        if target:
            target_id = get_user_id(target)
            await db.chat_user_status.update_one(
                {"user_id": target_id},
                {"$set": {"is_muted": True, "mute_expires_at": datetime.utcnow() + timedelta(hours=1)}},
                upsert=True
            )
            await log_admin_action(
                admin_user=admin_user,
                action_type="mute",
                target_user_id=target_id,
                target_username=report["reported_username"],
                reason=f"Report #{report_id}",
                request=request,
                duration_minutes=60
            )
    elif action == "ban":
        target = await db.users.find_one({"username": report["reported_username"]})
        if target:
            target_id = get_user_id(target)
            await db.chat_user_status.update_one(
                {"user_id": target_id},
                {"$set": {"is_banned": True, "ban_expires_at": datetime.utcnow() + timedelta(hours=24)}},
                upsert=True
            )
            await log_admin_action(
                admin_user=admin_user,
                action_type="ban",
                target_user_id=target_id,
                target_username=report["reported_username"],
                reason=f"Report #{report_id}",
                request=request,
                duration_minutes=1440
            )
    
    return {"success": True, "message": f"Report reviewed with action: {action}"}


@api_router.get("/admin/chat/moderation-log")
async def admin_get_moderation_log(
    target_username: Optional[str] = None,
    limit: int = 100,
    admin_user: dict = Depends(require_super_admin),
):
    """Admin: Get moderation action log (ADAM-ONLY, JWT-BOUND)"""
    query = {}
    if target_username:
        query["username"] = target_username
    
    logs = await db.chat_moderation_log.find(query).sort("issued_at", -1).limit(limit).to_list(limit)
    
    return [convert_objectid(log) for log in logs]


# =============================================================================
# GOD MODE ADMIN ENDPOINTS (ADAM-ONLY, JWT-BOUND, FULLY AUDITED)
# =============================================================================
# These endpoints give ADAM complete control over the game.
# Every action is logged with full audit trail for security and rollback.

# Pydantic models for GOD MODE requests
class SetCurrenciesRequest(BaseModel):
    target_username: str
    coins: Optional[int] = None
    gold: Optional[int] = None
    crystals: Optional[int] = None
    divine_essence: Optional[int] = None
    hero_shards: Optional[int] = None
    friendship_points: Optional[int] = None
    soul_dust: Optional[int] = None
    skill_essence: Optional[int] = None
    star_crystals: Optional[int] = None
    divine_gems: Optional[int] = None
    guild_coins: Optional[int] = None
    pvp_medals: Optional[int] = None
    enhancement_stones: Optional[int] = None
    hero_exp: Optional[int] = None
    stamina: Optional[int] = None
    reason: Optional[str] = "Admin adjustment"

class SetVIPRequest(BaseModel):
    target_username: str
    vip_level: int
    total_spent: Optional[float] = None
    reason: Optional[str] = "Admin adjustment"

class UnlockFeatureRequest(BaseModel):
    target_username: str
    feature_key: str  # chat_unlocked, tutorial_completed, etc.
    reason: Optional[str] = "Admin unlock"

class ResetUserRequest(BaseModel):
    target_username: str
    scope: str  # "progress", "chat", "currencies", "all"
    reason: Optional[str] = "Admin reset"

class RevokeTokensRequest(BaseModel):
    target_username: str
    reason: Optional[str] = "Security action"


@api_router.get("/admin/user/{target_username}")
async def admin_get_user(
    request: Request,
    target_username: str,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Get full server-truth view of any user.
    
    Returns complete user data (password_hash redacted).
    Useful for debugging, support, and verification.
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Redact sensitive fields
    user_data = convert_objectid(target.copy())
    user_data.pop("password_hash", None)
    
    # Add chat moderation status (properly serialized)
    chat_status = await get_user_chat_status(get_user_id(target))
    if chat_status:
        user_data["_chat_status"] = convert_objectid(chat_status)
    else:
        user_data["_chat_status"] = None
    
    # Add hero count
    heroes = await db.user_heroes.find({"username": {"$regex": f"^{re.escape(target_username)}$", "$options": "i"}}).to_list(1000)
    user_data["_hero_count"] = len(heroes)
    
    # Log the view action
    await log_god_action(
        admin_user=admin_user,
        action_type="view_user",
        target_username=target_username,
        target_user_id=get_user_id(target),
        fields_changed={},
        reason="Admin viewed user data",
        request=request,
    )
    
    return user_data


@api_router.post("/admin/user/set-currencies")
async def admin_set_currencies(
    request: Request,
    payload: SetCurrenciesRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Set any currency value for any user.
    
    Only specified fields are updated. Unspecified fields remain unchanged.
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Build update dict and track changes
    update_fields = {}
    fields_changed = {}
    
    currency_fields = [
        "coins", "gold", "crystals", "divine_essence", "hero_shards",
        "friendship_points", "soul_dust", "skill_essence", "star_crystals",
        "divine_gems", "guild_coins", "pvp_medals", "enhancement_stones",
        "hero_exp", "stamina"
    ]
    
    for field in currency_fields:
        new_value = getattr(payload, field, None)
        if new_value is not None:
            old_value = target.get(field, 0)
            update_fields[field] = new_value
            fields_changed[field] = {"old": old_value, "new": new_value}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No currency fields specified")
    
    # Apply update
    await db.users.update_one(
        {"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}},
        {"$set": update_fields}
    )
    
    # Log the action
    await log_god_action(
        admin_user=admin_user,
        action_type="set_currencies",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed=fields_changed,
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Updated currencies for {payload.target_username}",
        "changes": fields_changed
    }


@api_router.post("/admin/user/set-vip")
async def admin_set_vip(
    request: Request,
    payload: SetVIPRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Set VIP level and total spent for any user.
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Validate VIP level
    if payload.vip_level < 0 or payload.vip_level > 15:
        raise HTTPException(status_code=400, detail="VIP level must be 0-15")
    
    update_fields = {"vip_level": payload.vip_level}
    fields_changed = {
        "vip_level": {"old": target.get("vip_level", 0), "new": payload.vip_level}
    }
    
    if payload.total_spent is not None:
        update_fields["total_spent"] = payload.total_spent
        fields_changed["total_spent"] = {"old": target.get("total_spent", 0), "new": payload.total_spent}
    
    await db.users.update_one(
        {"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}},
        {"$set": update_fields}
    )
    
    await log_god_action(
        admin_user=admin_user,
        action_type="set_vip",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed=fields_changed,
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Set VIP level {payload.vip_level} for {payload.target_username}",
        "changes": fields_changed
    }


@api_router.post("/admin/user/unlock-feature")
async def admin_unlock_feature(
    request: Request,
    payload: UnlockFeatureRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Unlock features for any user.
    
    Supported features:
    - chat_unlocked: Enable chat access
    - tutorial_completed: Mark tutorial as done
    - first_purchase_used: Mark first purchase bonus as claimed
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Validate feature key
    valid_features = ["chat_unlocked", "tutorial_completed", "first_purchase_used"]
    if payload.feature_key not in valid_features:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Must be one of: {', '.join(valid_features)}")
    
    old_value = target.get(payload.feature_key, False)
    
    await db.users.update_one(
        {"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}},
        {"$set": {payload.feature_key: True}}
    )
    
    await log_god_action(
        admin_user=admin_user,
        action_type="unlock_feature",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed={payload.feature_key: {"old": old_value, "new": True}},
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Unlocked {payload.feature_key} for {payload.target_username}"
    }


@api_router.post("/admin/user/reset")
async def admin_reset_user(
    request: Request,
    payload: ResetUserRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Reset user data by scope.
    
    Scopes:
    - currencies: Reset all currencies to defaults
    - chat: Clear chat status (unmute, unban, clear blocks)
    - progress: Reset VIP, login days, pity counters
    - all: Full reset (keeps username/password)
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    valid_scopes = ["currencies", "chat", "progress", "all"]
    if payload.scope not in valid_scopes:
        raise HTTPException(status_code=400, detail=f"Invalid scope. Must be one of: {', '.join(valid_scopes)}")
    
    fields_changed = {}
    
    if payload.scope in ["currencies", "all"]:
        currency_defaults = {
            "crystals": 300, "coins": 10000, "gold": 5000,
            "divine_essence": 0, "hero_shards": 0, "friendship_points": 0,
            "soul_dust": 0, "skill_essence": 0, "star_crystals": 0,
            "divine_gems": 100, "guild_coins": 0, "pvp_medals": 0,
            "enhancement_stones": 0, "hero_exp": 0, "stamina": 100
        }
        for field, default in currency_defaults.items():
            fields_changed[field] = {"old": target.get(field, 0), "new": default}
        
        await db.users.update_one(
            {"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}},
            {"$set": currency_defaults}
        )
    
    if payload.scope in ["chat", "all"]:
        # Clear chat status
        await db.chat_user_status.delete_one({"user_id": target_id})
        fields_changed["chat_status"] = {"old": "various", "new": "cleared"}
    
    if payload.scope in ["progress", "all"]:
        progress_defaults = {
            "vip_level": 0, "total_spent": 0, "login_days": 0,
            "pity_counter": 0, "pity_counter_premium": 0, "pity_counter_divine": 0,
            "total_pulls": 0, "arena_rank": 0
        }
        for field, default in progress_defaults.items():
            fields_changed[field] = {"old": target.get(field, 0), "new": default}
        
        await db.users.update_one(
            {"username": {"$regex": f"^{re.escape(payload.target_username)}$", "$options": "i"}},
            {"$set": progress_defaults}
        )
    
    await log_god_action(
        admin_user=admin_user,
        action_type=f"reset_user_{payload.scope}",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed=fields_changed,
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Reset {payload.scope} for {payload.target_username}",
        "scope": payload.scope
    }


@api_router.post("/admin/auth/revoke-tokens")
async def admin_revoke_tokens(
    request: Request,
    payload: RevokeTokensRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Revoke all tokens for a user instantly.
    
    Sets tokens_valid_after to current time, which invalidates
    all tokens issued before this timestamp.
    """
    target = await db.users.find_one({"username_canon": canonicalize_username(payload.target_username)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    old_tokens_valid_after = target.get("tokens_valid_after")
    
    # Set tokens_valid_after to now - all prior tokens become invalid
    new_tokens_valid_after = datetime.utcnow()
    await db.users.update_one(
        {"username_canon": canonicalize_username(payload.target_username)},
        {"$set": {"tokens_valid_after": new_tokens_valid_after}}
    )
    
    audit_entry = await log_god_action(
        admin_user=admin_user,
        action_type="revoke_tokens",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed={
            "tokens_valid_after": {
                "old": str(old_tokens_valid_after) if old_tokens_valid_after else None, 
                "new": str(new_tokens_valid_after)
            }
        },
        reason=payload.reason,
        request=request,
        auth_jti=admin_user.get("_auth_jti"),
    )
    
    return {
        "success": True,
        "request_id": audit_entry.request_id,
        "message": f"Revoked all tokens for {payload.target_username}",
        "tokens_valid_after": new_tokens_valid_after.isoformat()
    }


@api_router.get("/admin/audit-log")
async def admin_get_audit_log(
    request: Request,
    target_username: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: View admin audit log.
    
    Shows all GOD MODE actions with full details.
    """
    query = {}
    if target_username:
        query["target_username"] = {"$regex": f"^{re.escape(target_username)}$", "$options": "i"}
    if action_type:
        query["action_type"] = action_type
    
    logs = await db.admin_audit_log.find(query).sort("issued_at", -1).limit(limit).to_list(limit)
    
    return [convert_objectid(log) for log in logs]


@api_router.post("/admin/user/give-hero")
async def admin_give_hero(
    request: Request,
    target_username: str,
    hero_id: str,
    stars: int = 1,
    level: int = 1,
    reason: Optional[str] = "Admin gift",
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Give a hero to any user.
    """
    target = await db.users.find_one({"username": {"$regex": f"^{re.escape(target_username)}$", "$options": "i"}})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Validate hero exists
    hero_data = await db.heroes.find_one({"id": hero_id})
    if not hero_data:
        raise HTTPException(status_code=404, detail="Hero not found in game data")
    
    # Check if user already has this hero
    existing = await db.user_heroes.find_one({
        "username": target["username"],
        "hero_data.id": hero_id
    })
    
    if existing:
        # Upgrade existing hero
        new_stars = min(existing.get("stars", 1) + stars, 7)
        await db.user_heroes.update_one(
            {"_id": existing["_id"]},
            {"$set": {"stars": new_stars}}
        )
        action_desc = f"Upgraded {hero_id} to {new_stars} stars"
    else:
        # Create new hero
        user_hero = UserHero(
            username=target["username"],
            hero_data=hero_data,
            stars=min(stars, 7),
            level=level
        )
        await db.user_heroes.insert_one(user_hero.dict())
        action_desc = f"Gave {hero_id} at {stars} stars, level {level}"
    
    await log_god_action(
        admin_user=admin_user,
        action_type="give_hero",
        target_username=target_username,
        target_user_id=target_id,
        fields_changed={"hero": {"hero_id": hero_id, "stars": stars, "level": level}},
        reason=reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": action_desc
    }


# =============================================================================
# GOD MODE: HERO MANAGEMENT
# =============================================================================

class SetHeroStateRequest(BaseModel):
    target_username: str
    hero_id: str
    stars: Optional[int] = None  # 1-7
    level: Optional[int] = None  # 1-300
    awakening_level: Optional[int] = None  # 0-5
    skill_levels: Optional[dict] = None  # {"skill_1": 5, "skill_2": 3}
    reason: str = "Admin adjustment"

@api_router.post("/admin/hero/set-state")
async def admin_set_hero_state(
    request: Request,
    payload: SetHeroStateRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Set specific hero state for a user's hero.
    
    Only specified fields are updated. Unspecified fields remain unchanged.
    """
    target = await db.users.find_one({"username_canon": canonicalize_username(payload.target_username)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Find user's hero
    user_hero = await db.user_heroes.find_one({
        "username": target["username"],
        "hero_data.id": payload.hero_id
    })
    
    if not user_hero:
        raise HTTPException(status_code=404, detail="User does not own this hero")
    
    # Build update and track changes
    update_fields = {}
    fields_changed = {}
    
    if payload.stars is not None:
        if not 1 <= payload.stars <= 7:
            raise HTTPException(status_code=400, detail="Stars must be 1-7")
        fields_changed["stars"] = {"old": user_hero.get("stars", 1), "new": payload.stars}
        update_fields["stars"] = payload.stars
    
    if payload.level is not None:
        if not 1 <= payload.level <= 300:
            raise HTTPException(status_code=400, detail="Level must be 1-300")
        fields_changed["level"] = {"old": user_hero.get("level", 1), "new": payload.level}
        update_fields["level"] = payload.level
    
    if payload.awakening_level is not None:
        if not 0 <= payload.awakening_level <= 5:
            raise HTTPException(status_code=400, detail="Awakening level must be 0-5")
        fields_changed["awakening_level"] = {"old": user_hero.get("awakening_level", 0), "new": payload.awakening_level}
        update_fields["awakening_level"] = payload.awakening_level
    
    if payload.skill_levels is not None:
        fields_changed["skill_levels"] = {"old": user_hero.get("skill_levels", {}), "new": payload.skill_levels}
        update_fields["skill_levels"] = payload.skill_levels
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.user_heroes.update_one(
        {"_id": user_hero["_id"]},
        {"$set": update_fields}
    )
    
    await log_god_action(
        admin_user=admin_user,
        action_type="set_hero_state",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed={"hero_id": payload.hero_id, **fields_changed},
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Updated {payload.hero_id} for {payload.target_username}",
        "changes": fields_changed
    }


class RevokeHeroRequest(BaseModel):
    target_username: str
    hero_id: str
    reason: str = "Admin revocation"

@api_router.post("/admin/hero/revoke")
async def admin_revoke_hero(
    request: Request,
    payload: RevokeHeroRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Remove a hero from a user's roster.
    """
    target = await db.users.find_one({"username_canon": canonicalize_username(payload.target_username)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Find and remove hero
    result = await db.user_heroes.delete_one({
        "username": target["username"],
        "hero_data.id": payload.hero_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User does not own this hero")
    
    await log_god_action(
        admin_user=admin_user,
        action_type="revoke_hero",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed={"hero_id": payload.hero_id, "action": "removed"},
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Revoked {payload.hero_id} from {payload.target_username}"
    }


# =============================================================================
# GOD MODE: ACCOUNT MANAGEMENT
# =============================================================================

class FreezeAccountRequest(BaseModel):
    target_username: str
    freeze: bool = True
    reason: str = "Admin action"

@api_router.post("/admin/account/freeze")
async def admin_freeze_account(
    request: Request,
    payload: FreezeAccountRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Freeze/unfreeze a user account.
    
    Frozen accounts cannot:
    - Login (existing JWTs are invalidated via tokens_valid_after)
    - Perform any game actions
    """
    # SECURITY: Cannot freeze the super admin
    if canonicalize_username(payload.target_username) == SUPER_ADMIN_CANON:
        raise HTTPException(status_code=403, detail="Cannot freeze super admin account")
    
    target = await db.users.find_one({"username_canon": canonicalize_username(payload.target_username)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    old_frozen = target.get("account_frozen", False)
    
    # Update freeze status and revoke all tokens
    update_data = {
        "account_frozen": payload.freeze,
        "frozen_at": datetime.utcnow() if payload.freeze else None,
        "frozen_reason": payload.reason if payload.freeze else None,
    }
    
    # When freezing, also revoke all existing tokens
    if payload.freeze:
        update_data["tokens_valid_after"] = datetime.utcnow()
    
    await db.users.update_one(
        {"username_canon": canonicalize_username(payload.target_username)},
        {"$set": update_data}
    )
    
    audit_entry = await log_god_action(
        admin_user=admin_user,
        action_type="freeze_account" if payload.freeze else "unfreeze_account",
        target_username=payload.target_username,
        target_user_id=target_id,
        fields_changed={
            "account_frozen": {"old": old_frozen, "new": payload.freeze},
            "tokens_revoked": payload.freeze,
        },
        reason=payload.reason,
        request=request,
        auth_jti=admin_user.get("_auth_jti"),
    )
    
    return {
        "success": True,
        "request_id": audit_entry.request_id,
        "message": f"{'Froze' if payload.freeze else 'Unfroze'} account {payload.target_username}"
    }


# =============================================================================
# GOD MODE: CHAT MESSAGE MANAGEMENT
# =============================================================================

class DeleteMessageRequest(BaseModel):
    message_id: str
    reason: str = "Admin deletion"

@api_router.post("/admin/chat/delete-message")
async def admin_delete_message(
    request: Request,
    payload: DeleteMessageRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Soft-delete a chat message.
    
    Message is marked as deleted but retained for audit purposes.
    """
    message = await db.chat_messages.find_one({"id": payload.message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Soft delete
    await db.chat_messages.update_one(
        {"id": payload.message_id},
        {"$set": {
            "deleted": True,
            "deleted_at": datetime.utcnow(),
            "deleted_by": admin_user.get("username"),
            "deletion_reason": payload.reason,
            "original_message": message.get("message", "")  # Preserve for audit
        }}
    )
    
    # Clear the visible message
    await db.chat_messages.update_one(
        {"id": payload.message_id},
        {"$set": {"message": "[Message deleted by admin]"}}
    )
    
    await log_god_action(
        admin_user=admin_user,
        action_type="delete_message",
        target_username=message.get("sender_username", "unknown"),
        target_user_id=message.get("sender_id", "unknown"),
        fields_changed={"message_id": payload.message_id, "original_preview": message.get("message", "")[:100]},
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "message": f"Deleted message {payload.message_id}"
    }


# =============================================================================
# GOD MODE: LIVE-OPS
# =============================================================================

class BroadcastAnnouncementRequest(BaseModel):
    title: str
    message: str
    priority: str = "normal"  # normal, important, urgent
    expires_at: Optional[str] = None  # ISO datetime string
    target_audience: str = "all"  # all, vip, new_users

@api_router.post("/admin/liveops/announcement")
async def admin_broadcast_announcement(
    request: Request,
    payload: BroadcastAnnouncementRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Broadcast an in-game announcement to all users.
    """
    announcement = {
        "id": str(uuid.uuid4()),
        "title": payload.title,
        "message": payload.message,
        "priority": payload.priority,
        "target_audience": payload.target_audience,
        "created_at": datetime.utcnow(),
        "created_by": admin_user.get("username"),
        "expires_at": datetime.fromisoformat(payload.expires_at) if payload.expires_at else None,
        "active": True
    }
    
    await db.announcements.insert_one(announcement)
    
    await log_god_action(
        admin_user=admin_user,
        action_type="broadcast_announcement",
        target_username="*",
        target_user_id="*",
        fields_changed={"announcement_id": announcement["id"], "title": payload.title},
        reason=f"Broadcast: {payload.title}",
        request=request,
    )
    
    return {
        "success": True,
        "announcement_id": announcement["id"],
        "message": f"Announcement '{payload.title}' broadcasted"
    }


@api_router.get("/admin/liveops/announcements")
async def admin_get_announcements(
    active_only: bool = True,
    limit: int = 50,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: View all announcements.
    """
    query = {"active": True} if active_only else {}
    announcements = await db.announcements.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [convert_objectid(a) for a in announcements]


@api_router.delete("/admin/liveops/announcement/{announcement_id}")
async def admin_delete_announcement(
    request: Request,
    announcement_id: str,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Deactivate an announcement.
    """
    result = await db.announcements.update_one(
        {"id": announcement_id},
        {"$set": {"active": False, "deactivated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    await log_god_action(
        admin_user=admin_user,
        action_type="delete_announcement",
        target_username="*",
        target_user_id="*",
        fields_changed={"announcement_id": announcement_id},
        reason="Deactivated announcement",
        request=request,
    )
    
    return {"success": True, "message": "Announcement deactivated"}


class FeatureFlagRequest(BaseModel):
    flag_name: str
    enabled: bool
    reason: str = "Admin toggle"

@api_router.post("/admin/liveops/feature-flag")
async def admin_toggle_feature_flag(
    request: Request,
    payload: FeatureFlagRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Toggle a feature flag.
    
    Feature flags control runtime behavior without code deployment.
    """
    # Get current state
    existing = await db.feature_flags.find_one({"name": payload.flag_name})
    old_value = existing.get("enabled", False) if existing else False
    
    await db.feature_flags.update_one(
        {"name": payload.flag_name},
        {"$set": {
            "name": payload.flag_name,
            "enabled": payload.enabled,
            "updated_at": datetime.utcnow(),
            "updated_by": admin_user.get("username")
        }},
        upsert=True
    )
    
    await log_god_action(
        admin_user=admin_user,
        action_type="toggle_feature_flag",
        target_username="*",
        target_user_id="*",
        fields_changed={"flag": payload.flag_name, "old": old_value, "new": payload.enabled},
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "flag": payload.flag_name,
        "enabled": payload.enabled
    }


@api_router.get("/admin/liveops/feature-flags")
async def admin_get_feature_flags(
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: View all feature flags.
    """
    flags = await db.feature_flags.find().to_list(100)
    return [convert_objectid(f) for f in flags]


# Safety constants for GOD MODE operations
SPAWN_GIFT_MAX_AMOUNT = 1_000_000  # Maximum currency gift per operation
SPAWN_GIFT_MAX_USERS = 10_000  # Maximum users for batch operations
ALLOWED_GIFT_TYPES = {"crystals", "coins", "gold", "divine_essence", "hero"}
ALLOWED_BANNER_TYPES = {"common", "premium", "divine", "limited", "event"}

class SpawnGiftRequest(BaseModel):
    target_username: Optional[str] = None  # None = all users (requires confirm_all)
    gift_type: str  # crystals, coins, gold, divine_essence, hero
    amount: Optional[int] = None  # For currency gifts (must be positive)
    hero_id: Optional[str] = None  # For hero gift
    reason: str  # REQUIRED with min length for batch operations
    confirm_all: bool = False  # Must be True when targeting all users
    max_users: int = 10000  # Cap for batch operations

@api_router.post("/admin/liveops/spawn-gift")
async def admin_spawn_gift(
    request: Request,
    payload: SpawnGiftRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Spawn gifts/compensation for users.
    
    Can target specific user or all users (requires confirm_all=true).
    All operations are logged with batch_id for traceability.
    """
    # Generate batch_id for traceability
    batch_id = str(uuid.uuid4())
    
    # Validate gift_type
    if payload.gift_type not in ALLOWED_GIFT_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid gift_type. Must be one of: {', '.join(ALLOWED_GIFT_TYPES)}"
        )
    
    # Validate reason for batch operations
    if payload.target_username is None:
        if not payload.confirm_all:
            raise HTTPException(
                status_code=400, 
                detail="confirm_all=true required when targeting all users"
            )
        if not payload.reason or len(payload.reason) < 20:
            raise HTTPException(
                status_code=400, 
                detail="Detailed reason required (min 20 chars) for batch gifts"
            )
    
    # Validate amount for currency gifts
    if payload.gift_type in ["crystals", "coins", "gold", "divine_essence"]:
        if payload.amount is None:
            raise HTTPException(status_code=400, detail="Amount required for currency gifts")
        if payload.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be a positive integer")
        if payload.amount > SPAWN_GIFT_MAX_AMOUNT:
            raise HTTPException(
                status_code=400, 
                detail=f"Amount exceeds safety limit of {SPAWN_GIFT_MAX_AMOUNT:,}"
            )
    
    # Get targets
    if payload.target_username:
        # Single user gift
        target = await db.users.find_one({"username_canon": canonicalize_username(payload.target_username)})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        targets = [target]
    else:
        # All users - with safety cap
        limit = min(payload.max_users, SPAWN_GIFT_MAX_USERS)
        targets = await db.users.find().limit(limit).to_list(limit)
    
    affected_count = 0
    affected_user_ids = []
    
    for target in targets:
        if payload.gift_type in ["crystals", "coins", "gold", "divine_essence"]:
            await db.users.update_one(
                {"_id": target["_id"]},
                {"$inc": {payload.gift_type: payload.amount}}
            )
            affected_count += 1
            affected_user_ids.append(get_user_id(target))
        
        elif payload.gift_type == "hero":
            if not payload.hero_id:
                raise HTTPException(status_code=400, detail="hero_id required for hero gifts")
            
            hero_data = await db.heroes.find_one({"id": payload.hero_id})
            if not hero_data:
                raise HTTPException(status_code=404, detail="Hero not found")
            
            # Check if already owned
            existing = await db.user_heroes.find_one({
                "username": target["username"],
                "hero_data.id": payload.hero_id
            })
            
            if existing:
                # Add shards instead
                await db.user_heroes.update_one(
                    {"_id": existing["_id"]},
                    {"$inc": {"shards": 30}}
                )
            else:
                user_hero = UserHero(
                    username=target["username"],
                    hero_data=hero_data,
                    stars=1,
                    level=1
                )
                await db.user_heroes.insert_one(user_hero.dict())
            affected_count += 1
            affected_user_ids.append(get_user_id(target))
    
    audit_entry = await log_god_action(
        admin_user=admin_user,
        action_type="spawn_gift",
        target_username=payload.target_username or "*",
        target_user_id="*" if not payload.target_username else get_user_id(targets[0]),
        fields_changed={
            "gift_type": payload.gift_type,
            "amount": payload.amount,
            "hero_id": payload.hero_id,
            "affected_users": affected_count,
            "is_batch": payload.target_username is None,
        },
        reason=payload.reason,
        request=request,
        batch_id=batch_id,
        auth_jti=admin_user.get("_auth_jti"),
    )
    
    return {
        "success": True,
        "request_id": audit_entry.request_id,
        "batch_id": batch_id,
        "affected_users": affected_count,
        "gift_type": payload.gift_type,
        "amount": payload.amount
    }


class AdjustDropRateRequest(BaseModel):
    banner_type: str  # common, premium, divine, limited, event
    rate_adjustments: dict  # {"SSR": 0.05, "SR": 0.15, ...}
    reason: str  # REQUIRED - must explain why (min 10 chars)
    confirm_large_change: bool = False  # Required if any rate changes by >50%

@api_router.post("/admin/liveops/adjust-drop-rates")
async def admin_adjust_drop_rates(
    request: Request,
    payload: AdjustDropRateRequest,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Adjust gacha drop rates. HEAVILY AUDITED.
    
    This is a sensitive operation that affects game economy.
    All changes are logged with full detail.
    
    Validation:
    - banner_type must be in allowed set
    - Each rate must be 0 <= rate <= 1
    - Sum of all rates must equal 1.0
    - Large changes (>50% delta) require confirm_large_change=true
    """
    # Validate reason
    if not payload.reason or len(payload.reason) < 10:
        raise HTTPException(status_code=400, detail="Detailed reason required (min 10 chars)")
    
    # Validate banner_type
    if payload.banner_type not in ALLOWED_BANNER_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid banner_type. Must be one of: {', '.join(ALLOWED_BANNER_TYPES)}"
        )
    
    # Validate rate_adjustments structure
    rates = payload.rate_adjustments
    if not isinstance(rates, dict) or not rates:
        raise HTTPException(status_code=400, detail="rate_adjustments must be a non-empty object")
    
    # Validate each rate
    for tier, rate in rates.items():
        if not isinstance(rate, (int, float)):
            raise HTTPException(status_code=400, detail=f"Rate for '{tier}' must be numeric")
        if rate < 0 or rate > 1:
            raise HTTPException(status_code=400, detail=f"Rate for '{tier}' must be between 0 and 1 (got {rate})")
    
    # Validate sum of rates equals 1.0
    total = sum(float(v) for v in rates.values())
    if abs(total - 1.0) > 1e-6:
        raise HTTPException(
            status_code=400, 
            detail=f"Rates must sum to 1.0 (got {total:.6f})"
        )
    
    # Get current rates for comparison
    current_rates = await db.drop_rates.find_one({"banner_type": payload.banner_type})
    old_rates = current_rates.get("rates", {}) if current_rates else {}
    
    # Check for large changes (>50% relative change)
    has_large_change = False
    for tier, new_rate in rates.items():
        old_rate = old_rates.get(tier, 0)
        if old_rate > 0:
            change_pct = abs(new_rate - old_rate) / old_rate
            if change_pct > 0.5:  # >50% change
                has_large_change = True
                break
        elif new_rate > 0.1:  # New tier with significant rate
            has_large_change = True
            break
    
    if has_large_change and not payload.confirm_large_change:
        raise HTTPException(
            status_code=400,
            detail="Large rate change detected (>50%). Set confirm_large_change=true to proceed."
        )
    
    # Update rates
    await db.drop_rates.update_one(
        {"banner_type": payload.banner_type},
        {"$set": {
            "banner_type": payload.banner_type,
            "rates": payload.rate_adjustments,
            "updated_at": datetime.utcnow(),
            "updated_by": admin_user.get("username")
        }},
        upsert=True
    )
    
    # HEAVY audit logging for drop rate changes
    await log_god_action(
        admin_user=admin_user,
        action_type="adjust_drop_rates",
        target_username="*",
        target_user_id="*",
        fields_changed={
            "banner_type": payload.banner_type,
            "old_rates": old_rates,
            "new_rates": payload.rate_adjustments,
            "had_large_change": has_large_change,
            "AUDIT_SENSITIVE": True
        },
        reason=payload.reason,
        request=request,
    )
    
    return {
        "success": True,
        "banner_type": payload.banner_type,
        "old_rates": old_rates,
        "new_rates": payload.rate_adjustments,
        "warning": "Drop rate change logged with high audit priority"
    }


# =============================================================================
# GOD MODE: OVERSIGHT - Suspicious Activity & Logs
# =============================================================================

@api_router.get("/admin/oversight/user-activity/{target_username}")
async def admin_get_user_activity(
    request: Request,
    target_username: str,
    limit: int = 100,
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: View detailed activity log for a user.
    
    Shows recent actions, login history, purchases, etc.
    """
    target = await db.users.find_one({"username_canon": canonicalize_username(target_username)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_id = get_user_id(target)
    
    # Gather activity from various sources
    activity = {
        "user_info": {
            "username": target.get("username"),
            "created_at": str(target.get("created_at")),
            "last_login": str(target.get("last_login_date")),
            "login_days": target.get("login_days", 0),
            "vip_level": target.get("vip_level", 0),
            "total_spent": target.get("total_spent", 0),
            "account_frozen": target.get("account_frozen", False),
        },
        "chat_status": await get_user_chat_status(target_id),
        "recent_chat_messages": await db.chat_messages.find(
            {"sender_id": target_id}
        ).sort("timestamp", -1).limit(20).to_list(20),
        "chat_reports_against": await db.chat_reports.find(
            {"reported_user_id": target_id}
        ).sort("created_at", -1).limit(20).to_list(20),
        "moderation_history": await db.chat_moderation_log.find(
            {"user_id": target_id}
        ).sort("issued_at", -1).limit(20).to_list(20),
    }
    
    # Log the oversight action
    await log_god_action(
        admin_user=admin_user,
        action_type="view_user_activity",
        target_username=target_username,
        target_user_id=target_id,
        fields_changed={},
        reason="Admin oversight",
        request=request,
    )
    
    return convert_objectid(activity)


@api_router.get("/admin/oversight/suspicious-patterns")
async def admin_get_suspicious_patterns(
    admin_user: dict = Depends(require_super_admin),
):
    """
    GOD MODE: Detect potentially suspicious activity patterns.
    
    Checks for:
    - Rapid currency gains
    - Unusual login patterns
    - Multiple reports
    """
    suspicious = []
    
    # Users with multiple reports against them
    pipeline = [
        {"$group": {"_id": "$reported_user_id", "report_count": {"$sum": 1}}},
        {"$match": {"report_count": {"$gte": 3}}},
        {"$sort": {"report_count": -1}},
        {"$limit": 20}
    ]
    multi_reported = await db.chat_reports.aggregate(pipeline).to_list(20)
    
    for item in multi_reported:
        user = await db.users.find_one({"id": item["_id"]})
        if user:
            suspicious.append({
                "type": "multiple_reports",
                "username": user.get("username"),
                "user_id": item["_id"],
                "report_count": item["report_count"]
            })
    
    # Users with very high currency (potential exploits)
    high_currency = await db.users.find({
        "$or": [
            {"crystals": {"$gte": 100000}},
            {"coins": {"$gte": 10000000}}
        ]
    }).limit(20).to_list(20)
    
    for user in high_currency:
        suspicious.append({
            "type": "high_currency",
            "username": user.get("username"),
            "crystals": user.get("crystals", 0),
            "coins": user.get("coins", 0)
        })
    
    return suspicious


# ==================== DATA RETENTION & DELETION (SERVER-AUTHORITATIVE) ====================

@api_router.delete("/chat/user-data")
async def delete_user_chat_data(
    confirm: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete all chat data for the authenticated user (SELF-ONLY)
    
    Requires confirm=true to proceed.
    User can only delete their own data.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    if not confirm:
        raise HTTPException(status_code=400, detail="Must set confirm=true to delete data")
    
    username = current_user.get("username")
    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Delete all messages by this user
    msg_result = await db.chat_messages.delete_many({"sender_id": user_id})
    
    # Delete user's chat status
    await db.chat_user_status.delete_one({"user_id": user_id})
    
    # Delete reports made by this user
    await db.chat_reports.delete_many({"reporter_id": user_id})
    
    # Keep reports AGAINST this user but anonymize
    await db.chat_reports.update_many(
        {"reported_user_id": user_id},
        {"$set": {"reported_username": "[Deleted User]"}}
    )
    
    return {
        "success": True,
        "deleted_messages": msg_result.deleted_count,
        "message": "Chat data deleted successfully"
    }

@api_router.get("/chat/translate")
async def translate_message(message: str, from_lang: str, to_lang: str):
    """Simple translation API - returns original message with language codes
    In production, integrate with Google Translate API or similar"""
    
    # Basic translation map for common phrases (MVP)
    translations = {
        ("en", "es"): {
            "hello": "hola",
            "goodbye": "adiós",
            "thank you": "gracias",
            "yes": "sí",
            "no": "no"
        },
        ("en", "fr"): {
            "hello": "bonjour",
            "goodbye": "au revoir",
            "thank you": "merci",
            "yes": "oui",
            "no": "non"
        },
        ("en", "zh-CN"): {
            "hello": "你好",
            "goodbye": "再见",
            "thank you": "谢谢",
            "yes": "是",
            "no": "不"
        }
    }
    
    # For MVP, return original with note
    # In production, use proper translation API
    translated = message.lower()
    translation_key = (from_lang, to_lang)
    
    if translation_key in translations:
        for eng, target in translations[translation_key].items():
            translated = translated.replace(eng, target)
    
    return {
        "original": message,
        "translated": translated,
        "from_language": from_lang,
        "to_language": to_lang,
        "note": "Using basic translation. Integrate Google Translate API for production."
    }

# ==================== GUILD SYSTEM ====================
@api_router.post("/guild/create")
async def create_guild(username: str, guild_name: str):
    """Create a new guild"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
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

@api_router.post("/guild/join")
async def join_guild(username: str, guild_id: str):
    """Join a guild"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
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

@api_router.get("/guild/{username}")
async def get_user_guild(username: str):
    """Get user's guild"""
    user = await get_user_readonly(username)  # Includes frozen check
    
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

@api_router.get("/guilds")
async def list_guilds(limit: int = 20, skip: int = 0):
    """List available guilds to join"""
    guilds = await db.guilds.find().skip(skip).limit(limit).to_list(length=limit)
    
    result = []
    for guild in guilds:
        guild_data = convert_objectid(guild)
        guild_data["member_count"] = len(guild.get("member_ids", []))
        result.append(guild_data)
    
    return result

@api_router.post("/guild/leave")
async def leave_guild(username: str):
    """Leave current guild"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
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

# ==================== HERO UPGRADE SYSTEM ====================

class HeroUpgradeRequest(BaseModel):
    upgrade_type: str  # "level", "star", "awakening", "skill"
    amount: int = 1
    skill_id: Optional[str] = None

@api_router.get("/hero/{user_hero_id}/details")
async def get_hero_details(user_hero_id: str, username: str):
    """Get detailed hero info including skills and equipment"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    user_hero = await db.user_heroes.find_one({"id": user_hero_id, "user_id": user["id"]})
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    # Get base hero data
    hero_data = await db.heroes.find_one({"id": user_hero["hero_id"]})
    
    # Calculate current stats based on upgrades
    level_mult = 1 + (user_hero.get("level", 1) - 1) * 0.05
    star_mult = 1 + user_hero.get("stars", 0) * 0.1
    awakening_mult = 1 + user_hero.get("awakening_level", 0) * 0.2
    total_mult = level_mult * star_mult * awakening_mult
    
    result = convert_objectid(user_hero)
    result["hero_data"] = convert_objectid(hero_data) if hero_data else None
    result["calculated_stats"] = {
        "hp": int(hero_data["base_hp"] * total_mult) if hero_data else 0,
        "atk": int(hero_data["base_atk"] * total_mult) if hero_data else 0,
        "def": int(hero_data["base_def"] * total_mult) if hero_data else 0,
        "speed": hero_data.get("base_speed", 100) if hero_data else 100,
    }
    result["exp_to_next_level"] = get_exp_required(user_hero.get("level", 1) + 1)
    result["level_up_cost"] = get_level_up_cost(user_hero.get("level", 1))
    result["shards_for_next_star"] = STAR_SHARD_COSTS.get(user_hero.get("stars", 0) + 1, 999)
    
    return result

@api_router.post("/hero/{user_hero_id}/level-up")
async def level_up_hero(user_hero_id: str, username: str, levels: int = 1):
    """Level up a hero using gold"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    user_hero = await db.user_heroes.find_one({"id": user_hero_id, "user_id": user["id"]})
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    current_level = user_hero.get("level", 1)
    max_level = user_hero.get("max_level", 100)
    
    if current_level >= max_level:
        raise HTTPException(status_code=400, detail="Hero is at max level")
    
    # Calculate total cost
    total_cost = 0
    for i in range(levels):
        if current_level + i >= max_level:
            break
        total_cost += get_level_up_cost(current_level + i)
    
    if user["gold"] < total_cost:
        raise HTTPException(status_code=400, detail=f"Not enough gold. Need {total_cost}")
    
    new_level = min(current_level + levels, max_level)
    
    # Update hero and user
    await db.user_heroes.update_one(
        {"id": user_hero_id},
        {"$set": {"level": new_level}}
    )
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gold": -total_cost}}
    )
    
    return {
        "success": True,
        "new_level": new_level,
        "gold_spent": total_cost,
        "remaining_gold": user["gold"] - total_cost
    }

@api_router.post("/hero/{user_hero_id}/promote-star")
async def promote_hero_star(user_hero_id: str, username: str):
    """Promote hero to next star using shards (duplicates)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    user_hero = await db.user_heroes.find_one({"id": user_hero_id, "user_id": user["id"]})
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    current_stars = user_hero.get("stars", 0)
    if current_stars >= 6:
        raise HTTPException(status_code=400, detail="Hero is at max stars")
    
    shards_needed = STAR_SHARD_COSTS.get(current_stars + 1, 999)
    current_shards = user_hero.get("duplicates", 0)
    
    if current_shards < shards_needed:
        raise HTTPException(status_code=400, detail=f"Need {shards_needed} shards, have {current_shards}")
    
    # Update hero
    await db.user_heroes.update_one(
        {"id": user_hero_id},
        {
            "$set": {"stars": current_stars + 1},
            "$inc": {"duplicates": -shards_needed}
        }
    )
    
    return {
        "success": True,
        "new_stars": current_stars + 1,
        "shards_used": shards_needed,
        "remaining_shards": current_shards - shards_needed
    }

@api_router.post("/hero/{user_hero_id}/awaken")
async def awaken_hero(user_hero_id: str, username: str):
    """Awaken hero to unlock max potential"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    user_hero = await db.user_heroes.find_one({"id": user_hero_id, "user_id": user["id"]})
    if not user_hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    
    current_awakening = user_hero.get("awakening_level", 0)
    if current_awakening >= 5:
        raise HTTPException(status_code=400, detail="Hero is fully awakened")
    
    # Check requirements
    cost = AWAKENING_COSTS.get(current_awakening + 1)
    if not cost:
        raise HTTPException(status_code=400, detail="Invalid awakening level")
    
    shards_needed = cost["shards"]
    gold_needed = cost["gold"]
    
    if user_hero.get("duplicates", 0) < shards_needed:
        raise HTTPException(status_code=400, detail=f"Need {shards_needed} shards")
    if user["gold"] < gold_needed:
        raise HTTPException(status_code=400, detail=f"Need {gold_needed} gold")
    
    # Update hero and user
    await db.user_heroes.update_one(
        {"id": user_hero_id},
        {
            "$set": {"awakening_level": current_awakening + 1},
            "$inc": {"duplicates": -shards_needed}
        }
    )
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gold": -gold_needed}}
    )
    
    return {
        "success": True,
        "new_awakening_level": current_awakening + 1,
        "shards_used": shards_needed,
        "gold_used": gold_needed
    }

# ==================== TEAM BUILDER SYSTEM ====================

class TeamSlotUpdate(BaseModel):
    slot_1: Optional[str] = None
    slot_2: Optional[str] = None
    slot_3: Optional[str] = None
    slot_4: Optional[str] = None
    slot_5: Optional[str] = None
    slot_6: Optional[str] = None

@api_router.post("/team/create-full")
async def create_team_full(username: str, team_name: str, slots: TeamSlotUpdate):
    """Create a new team with positioned heroes"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Calculate team power
    slot_heroes = [slots.slot_1, slots.slot_2, slots.slot_3, slots.slot_4, slots.slot_5, slots.slot_6]
    hero_ids = [h for h in slot_heroes if h]
    
    team_power = 0
    for hero_id in hero_ids:
        hero = await db.user_heroes.find_one({"id": hero_id, "user_id": user["id"]})
        if hero:
            hero_data = await db.heroes.find_one({"id": hero["hero_id"]})
            if hero_data:
                level_mult = 1 + (hero.get("level", 1) - 1) * 0.05
                star_mult = 1 + hero.get("stars", 0) * 0.1
                power = (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult * star_mult
                team_power += int(power)
    
    team = Team(
        user_id=user["id"],
        name=team_name,
        slot_1=slots.slot_1,
        slot_2=slots.slot_2,
        slot_3=slots.slot_3,
        slot_4=slots.slot_4,
        slot_5=slots.slot_5,
        slot_6=slots.slot_6,
        hero_ids=hero_ids,
        team_power=team_power
    )
    
    await db.teams.insert_one(team.dict())
    return convert_objectid(team.dict())

@api_router.put("/team/{team_id}/slots")
async def update_team_slots(team_id: str, username: str, slots: TeamSlotUpdate):
    """Update team hero positions"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    team = await db.teams.find_one({"id": team_id, "user_id": user["id"]})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Calculate new team power
    slot_heroes = [slots.slot_1, slots.slot_2, slots.slot_3, slots.slot_4, slots.slot_5, slots.slot_6]
    hero_ids = [h for h in slot_heroes if h]
    
    team_power = 0
    for hero_id in hero_ids:
        hero = await db.user_heroes.find_one({"id": hero_id, "user_id": user["id"]})
        if hero:
            hero_data = await db.heroes.find_one({"id": hero["hero_id"]})
            if hero_data:
                level_mult = 1 + (hero.get("level", 1) - 1) * 0.05
                star_mult = 1 + hero.get("stars", 0) * 0.1
                power = (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult * star_mult
                team_power += int(power)
    
    await db.teams.update_one(
        {"id": team_id},
        {"$set": {
            "slot_1": slots.slot_1,
            "slot_2": slots.slot_2,
            "slot_3": slots.slot_3,
            "slot_4": slots.slot_4,
            "slot_5": slots.slot_5,
            "slot_6": slots.slot_6,
            "hero_ids": hero_ids,
            "team_power": team_power
        }}
    )
    
    updated_team = await db.teams.find_one({"id": team_id})
    return convert_objectid(updated_team)

@api_router.get("/team/{username}/full")
async def get_user_teams_full(username: str):
    """Get all teams with full hero data"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    teams = await db.teams.find({"user_id": user["id"]}).to_list(100)
    
    result = []
    for team in teams:
        team_data = convert_objectid(team)
        
        # Get hero data for each slot
        for slot_name in ["slot_1", "slot_2", "slot_3", "slot_4", "slot_5", "slot_6"]:
            hero_id = team.get(slot_name)
            if hero_id:
                user_hero = await db.user_heroes.find_one({"id": hero_id})
                if user_hero:
                    hero_data = await db.heroes.find_one({"id": user_hero["hero_id"]})
                    team_data[f"{slot_name}_data"] = {
                        "user_hero": convert_objectid(user_hero),
                        "hero_data": convert_objectid(hero_data) if hero_data else None
                    }
        
        result.append(team_data)
    
    return result

@api_router.put("/team/{team_id}/set-active")
async def set_active_team(team_id: str, username: str):
    """Set a team as the active team"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Deactivate all teams first
    await db.teams.update_many(
        {"user_id": user["id"]},
        {"$set": {"is_active": False}}
    )
    
    # Activate the selected team
    await db.teams.update_one(
        {"id": team_id, "user_id": user["id"]},
        {"$set": {"is_active": True}}
    )
    
    return {"success": True, "active_team_id": team_id}

# ==================== COMBAT SIMULATOR ====================

def calculate_class_advantage(attacker_class: str, defender_class: str) -> float:
    """Calculate damage multiplier based on class advantage"""
    advantage = CLASS_ADVANTAGES.get(attacker_class, {})
    if advantage.get("strong_against") == defender_class:
        return 1.3  # 30% bonus damage
    elif advantage.get("weak_against") == defender_class:
        return 0.7  # 30% less damage
    return 1.0

def calculate_element_advantage(attacker_element: str, defender_element: str) -> float:
    """Calculate damage multiplier based on element advantage"""
    advantage = ELEMENT_ADVANTAGES.get(attacker_element, {})
    if advantage.get("strong_against") == defender_element:
        return 1.2  # 20% bonus damage
    elif advantage.get("weak_against") == defender_element:
        return 0.8  # 20% less damage
    return 1.0

@api_router.post("/combat/simulate")
async def simulate_combat(username: str, enemy_power: int = 1000):
    """Simulate a combat encounter and return detailed results"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get active team or top heroes
    team = await db.teams.find_one({"user_id": user["id"], "is_active": True})
    
    if team:
        hero_ids = [team.get(f"slot_{i}") for i in range(1, 7) if team.get(f"slot_{i}")]
    else:
        # Use top 6 heroes by power
        user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
        hero_powers = []
        for uh in user_heroes:
            hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
            if hero_data:
                level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
                power = (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult
                hero_powers.append((uh["id"], power))
        hero_powers.sort(key=lambda x: x[1], reverse=True)
        hero_ids = [hp[0] for hp in hero_powers[:6]]
    
    # Calculate team stats
    team_hp = 0
    team_atk = 0
    team_def = 0
    team_speed = 0
    heroes_in_battle = []
    
    for hero_id in hero_ids:
        user_hero = await db.user_heroes.find_one({"id": hero_id})
        if user_hero:
            hero_data = await db.heroes.find_one({"id": user_hero["hero_id"]})
            if hero_data:
                level_mult = 1 + (user_hero.get("level", 1) - 1) * 0.05
                star_mult = 1 + user_hero.get("stars", 0) * 0.1
                awakening_mult = 1 + user_hero.get("awakening_level", 0) * 0.2
                total_mult = level_mult * star_mult * awakening_mult
                
                hero_hp = int(hero_data["base_hp"] * total_mult)
                hero_atk = int(hero_data["base_atk"] * total_mult)
                hero_def = int(hero_data["base_def"] * total_mult)
                hero_speed = hero_data.get("base_speed", 100)
                
                team_hp += hero_hp
                team_atk += hero_atk
                team_def += hero_def
                team_speed += hero_speed
                
                heroes_in_battle.append({
                    "name": hero_data["name"],
                    "class": hero_data["hero_class"],
                    "element": hero_data["element"],
                    "hp": hero_hp,
                    "atk": hero_atk,
                    "def": hero_def,
                    "speed": hero_speed
                })
    
    num_heroes = max(len(heroes_in_battle), 1)
    team_power = team_hp + team_atk * 3 + team_def * 2
    
    # Simple combat simulation
    # Higher power team has advantage, but random factor matters
    power_ratio = team_power / max(enemy_power, 1)
    base_win_chance = min(max(power_ratio * 0.5, 0.1), 0.95)  # 10% to 95%
    
    # Add some randomness
    roll = random.random()
    victory = roll < base_win_chance
    
    # Calculate damage dealt/taken
    if victory:
        damage_dealt = int(enemy_power * random.uniform(0.8, 1.2))
        damage_taken = int(team_hp * random.uniform(0.2, 0.5))
    else:
        damage_dealt = int(enemy_power * random.uniform(0.3, 0.6))
        damage_taken = int(team_hp * random.uniform(0.7, 1.0))
    
    return {
        "victory": victory,
        "team_power": team_power,
        "enemy_power": enemy_power,
        "power_ratio": round(power_ratio, 2),
        "win_chance": round(base_win_chance * 100, 1),
        "damage_dealt": damage_dealt,
        "damage_taken": damage_taken,
        "heroes_used": heroes_in_battle,
        "turns_taken": random.randint(5, 15)
    }

# ==================== ENHANCED COMBAT WITH AI NARRATION ====================

class CombatAction(BaseModel):
    turn: int
    actor: str
    actor_class: str
    target: str
    action_type: str  # "attack", "skill", "heal", "buff"
    damage: int = 0
    healing: int = 0
    skill_name: Optional[str] = None
    is_critical: bool = False
    remaining_hp_actor: int = 0
    remaining_hp_target: int = 0

class DetailedCombatResult(BaseModel):
    victory: bool
    team_power: int
    enemy_power: int
    turns: List[CombatAction]
    total_damage_dealt: int
    total_damage_taken: int
    hero_final_states: List[Dict]
    enemy_final_states: List[Dict]
    battle_duration_seconds: float
    narration: Optional[str] = None
    rewards: Dict = {}

async def generate_battle_narration(heroes: List[Dict], enemy_name: str, victory: bool, turns: List[Dict]) -> str:
    """Generate AI-powered battle narration"""
    if not AI_ENABLED:
        return None
    
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return None
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"battle-{uuid.uuid4()}",
            system_message="You are a dramatic battle narrator for an anime gacha game. Create exciting, concise battle narration in 2-3 sentences. Use dramatic language fitting the heroes' classes and abilities. Keep it under 100 words."
        ).with_model("openai", "gpt-4.1-mini")
        
        hero_names = [h["name"] for h in heroes[:3]]
        hero_summary = ", ".join(hero_names)
        outcome = "emerged victorious" if victory else "were defeated"
        
        prompt = f"Narrate a battle: Heroes {hero_summary} fought against {enemy_name}. They {outcome} after {len(turns)} rounds of combat."
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        print(f"AI narration error: {e}")
        return None

@api_router.post("/combat/detailed")
async def detailed_combat(username: str, enemy_name: str = "Dark Lord", enemy_power: int = 1500):
    """Enhanced combat simulation with turn-by-turn details and AI narration"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get heroes for battle
    team = await db.teams.find_one({"user_id": user["id"], "is_active": True})
    
    if team:
        frontline = team.get("frontline", [])
        backline = team.get("backline", [])
        hero_ids = frontline + backline
        hero_ids = [h for h in hero_ids if h]
    else:
        user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
        hero_powers = []
        for uh in user_heroes:
            hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
            if hero_data:
                level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
                power = (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult
                hero_powers.append((uh["id"], power))
        hero_powers.sort(key=lambda x: x[1], reverse=True)
        hero_ids = [hp[0] for hp in hero_powers[:6]]
    
    # Build hero battle states
    heroes_battle = []
    team_power = 0
    
    for idx, hero_id in enumerate(hero_ids):
        user_hero = await db.user_heroes.find_one({"id": hero_id})
        if not user_hero:
            continue
        hero_data = await db.heroes.find_one({"id": user_hero["hero_id"]})
        if not hero_data:
            continue
        
        level_mult = 1 + (user_hero.get("level", 1) - 1) * 0.05
        star_mult = 1 + user_hero.get("stars", 0) * 0.1
        
        hero_hp = int(hero_data["base_hp"] * level_mult * star_mult)
        hero_atk = int(hero_data["base_atk"] * level_mult * star_mult)
        hero_def = int(hero_data["base_def"] * level_mult * star_mult)
        hero_speed = hero_data.get("base_speed", 100) + random.randint(-10, 10)
        
        heroes_battle.append({
            "id": hero_id,
            "name": hero_data["name"],
            "class": hero_data["hero_class"],
            "element": hero_data["element"],
            "max_hp": hero_hp,
            "current_hp": hero_hp,
            "atk": hero_atk,
            "def": hero_def,
            "speed": hero_speed,
            "position": "frontline" if idx < 3 else "backline",
            "skills": hero_data.get("skills", ["Basic Attack"])
        })
        team_power += hero_hp + hero_atk * 3 + hero_def * 2
    
    if not heroes_battle:
        raise HTTPException(status_code=400, detail="No heroes available for battle")
    
    # Create enemies
    enemies_battle = []
    num_enemies = min(3, max(1, enemy_power // 1000))
    enemy_hp_each = enemy_power // num_enemies
    
    enemy_types = ["Shadow Knight", "Dark Mage", "Corrupted Archer", "Demon Lord", "Fallen Angel"]
    for i in range(num_enemies):
        enemy_name_i = f"{random.choice(enemy_types)}" if i > 0 else enemy_name
        enemies_battle.append({
            "id": f"enemy_{i}",
            "name": enemy_name_i,
            "class": random.choice(["Warrior", "Mage", "Archer"]),
            "max_hp": enemy_hp_each,
            "current_hp": enemy_hp_each,
            "atk": enemy_power // (num_enemies * 3),
            "def": enemy_power // (num_enemies * 5),
            "speed": 80 + random.randint(0, 40)
        })
    
    # Simulate turn-by-turn combat
    turns = []
    turn_number = 0
    max_turns = 20
    
    while turn_number < max_turns:
        turn_number += 1
        
        # Get all alive combatants sorted by speed
        all_combatants = []
        for h in heroes_battle:
            if h["current_hp"] > 0:
                all_combatants.append(("hero", h))
        for e in enemies_battle:
            if e["current_hp"] > 0:
                all_combatants.append(("enemy", e))
        
        if not all_combatants:
            break
        
        all_combatants.sort(key=lambda x: x[1]["speed"], reverse=True)
        
        for combatant_type, combatant in all_combatants:
            if combatant["current_hp"] <= 0:
                continue
            
            # Determine target
            if combatant_type == "hero":
                alive_enemies = [e for e in enemies_battle if e["current_hp"] > 0]
                if not alive_enemies:
                    break
                target = random.choice(alive_enemies)
                target_type = "enemy"
            else:
                # Enemies prefer frontline targets
                frontline_heroes = [h for h in heroes_battle if h["current_hp"] > 0 and h["position"] == "frontline"]
                backline_heroes = [h for h in heroes_battle if h["current_hp"] > 0 and h["position"] == "backline"]
                
                if frontline_heroes:
                    target = random.choice(frontline_heroes)
                elif backline_heroes:
                    target = random.choice(backline_heroes)
                else:
                    break
                target_type = "hero"
            
            # Calculate damage
            is_critical = random.random() < 0.15
            base_damage = max(1, combatant["atk"] - target.get("def", 0) // 2)
            damage = int(base_damage * (1.5 if is_critical else 1) * random.uniform(0.9, 1.1))
            
            # Determine action type
            action_type = "attack"
            skill_name = None
            if random.random() < 0.3 and combatant_type == "hero":
                skills = combatant.get("skills", ["Basic Attack"])
                if skills:
                    skill_name = random.choice(skills)
                    action_type = "skill"
                    damage = int(damage * 1.3)
            
            target["current_hp"] = max(0, target["current_hp"] - damage)
            
            turns.append({
                "turn": turn_number,
                "actor": combatant["name"],
                "actor_class": combatant["class"],
                "target": target["name"],
                "action_type": action_type,
                "damage": damage,
                "skill_name": skill_name,
                "is_critical": is_critical,
                "remaining_hp_actor": combatant["current_hp"],
                "remaining_hp_target": target["current_hp"]
            })
        
        # Check win/lose conditions
        heroes_alive = any(h["current_hp"] > 0 for h in heroes_battle)
        enemies_alive = any(e["current_hp"] > 0 for e in enemies_battle)
        
        if not enemies_alive:
            break
        if not heroes_alive:
            break
    
    # Determine outcome
    victory = any(h["current_hp"] > 0 for h in heroes_battle) and not any(e["current_hp"] > 0 for e in enemies_battle)
    
    total_damage_dealt = sum(t["damage"] for t in turns if t["actor"] in [h["name"] for h in heroes_battle])
    total_damage_taken = sum(t["damage"] for t in turns if t["actor"] not in [h["name"] for h in heroes_battle])
    
    # Generate AI narration
    narration = await generate_battle_narration(heroes_battle, enemy_name, victory, turns)
    
    # Calculate rewards
    rewards = {}
    if victory:
        rewards = {
            "gold": int(enemy_power * random.uniform(0.5, 1.0)),
            "exp": int(enemy_power * 0.1),
            "coins": int(enemy_power * random.uniform(0.1, 0.3))
        }
        # Award rewards
        await db.users.update_one(
            {"username": username},
            {"$inc": {"gold": rewards["gold"], "coins": rewards["coins"]}}
        )
    
    return {
        "victory": victory,
        "team_power": team_power,
        "enemy_power": enemy_power,
        "turns": turns,
        "total_damage_dealt": total_damage_dealt,
        "total_damage_taken": total_damage_taken,
        "hero_final_states": [{"name": h["name"], "hp": h["current_hp"], "max_hp": h["max_hp"]} for h in heroes_battle],
        "enemy_final_states": [{"name": e["name"], "hp": e["current_hp"], "max_hp": e["max_hp"]} for e in enemies_battle],
        "battle_duration_seconds": len(turns) * 0.8,
        "narration": narration,
        "rewards": rewards
    }

# ==================== GUILD BOSS FIGHT SYSTEM (EXPANDED) ====================

GUILD_BOSSES = [
    # Tier 1 - Easy (Levels 1-5)
    {"id": "shadow_knight", "name": "Shadow Knight", "tier": 1, "base_hp": 500000, "base_atk": 2500, "element": "Dark", "rewards": {"crystals": 200, "gold": 25000, "coins": 50000}},
    {"id": "flame_golem", "name": "Flame Golem", "tier": 1, "base_hp": 600000, "base_atk": 2000, "element": "Fire", "rewards": {"crystals": 250, "gold": 30000, "coins": 60000}},
    {"id": "frost_wyrm", "name": "Frost Wyrm", "tier": 1, "base_hp": 550000, "base_atk": 2200, "element": "Water", "rewards": {"crystals": 220, "gold": 28000, "coins": 55000}},
    
    # Tier 2 - Medium (Levels 6-10)
    {"id": "dragon_ancient", "name": "Ancient Dragon", "tier": 2, "base_hp": 1000000, "base_atk": 5000, "element": "Fire", "rewards": {"crystals": 500, "gold": 50000, "divine_essence": 3}},
    {"id": "titan_storm", "name": "Storm Titan", "tier": 2, "base_hp": 1200000, "base_atk": 4500, "element": "Lightning", "rewards": {"crystals": 600, "gold": 60000, "divine_essence": 4}},
    {"id": "sea_leviathan", "name": "Sea Leviathan", "tier": 2, "base_hp": 1100000, "base_atk": 4800, "element": "Water", "rewards": {"crystals": 550, "gold": 55000, "divine_essence": 3}},
    
    # Tier 3 - Hard (Levels 11-15)
    {"id": "void_emperor", "name": "Void Emperor", "tier": 3, "base_hp": 2000000, "base_atk": 7000, "element": "Dark", "rewards": {"crystals": 1000, "gold": 100000, "divine_essence": 10}},
    {"id": "celestial_guardian", "name": "Celestial Guardian", "tier": 3, "base_hp": 2200000, "base_atk": 6500, "element": "Light", "rewards": {"crystals": 1100, "gold": 110000, "divine_essence": 12}},
    {"id": "chaos_demon", "name": "Chaos Demon", "tier": 3, "base_hp": 2500000, "base_atk": 7500, "element": "Dark", "rewards": {"crystals": 1200, "gold": 120000, "divine_essence": 15}},
    
    # Tier 4 - Nightmare (Levels 16+)
    {"id": "world_serpent", "name": "World Serpent Jörmungandr", "tier": 4, "base_hp": 5000000, "base_atk": 10000, "element": "Water", "rewards": {"crystals": 2500, "gold": 250000, "divine_essence": 30}},
    {"id": "fallen_seraph", "name": "Fallen Seraph Lucifer", "tier": 4, "base_hp": 6000000, "base_atk": 12000, "element": "Dark", "rewards": {"crystals": 3000, "gold": 300000, "divine_essence": 40}},
    {"id": "primordial_titan", "name": "Primordial Titan Kronos", "tier": 4, "base_hp": 8000000, "base_atk": 15000, "element": "Fire", "rewards": {"crystals": 4000, "gold": 400000, "divine_essence": 50}},
]

def get_boss_for_guild_level(guild_level: int):
    """Select appropriate boss based on guild level"""
    if guild_level <= 5:
        tier = 1
    elif guild_level <= 10:
        tier = 2
    elif guild_level <= 15:
        tier = 3
    else:
        tier = 4
    
    tier_bosses = [b for b in GUILD_BOSSES if b["tier"] == tier]
    return random.choice(tier_bosses) if tier_bosses else random.choice(GUILD_BOSSES)

@api_router.get("/guild/{username}/boss")
async def get_guild_boss(username: str):
    """Get current guild boss status"""
    user = await get_user_readonly(username)  # Includes frozen check
    
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

@api_router.post("/guild/{username}/boss/attack")
async def attack_guild_boss(username: str):
    """Attack the guild boss (limited daily attacks based on VIP level)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
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
    
    # Get user's team power - look up hero data from heroes collection
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
    total_power = 0
    heroes_used = []
    
    # Find valid heroes (those with matching hero data)
    for uh in user_heroes:
        if len(heroes_used) >= 6:  # Max 6 heroes in attack
            break
        # Look up hero data from heroes collection
        hero_data = await db.heroes.find_one({"id": uh.get("hero_id")})
        if hero_data:
            level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
            power = (hero_data.get("base_hp", 1000) + hero_data.get("base_atk", 200) * 3 + hero_data.get("base_def", 100) * 2) * level_mult
            total_power += power
            heroes_used.append(hero_data.get("name", "Unknown Hero"))
    
    if total_power == 0:
        raise HTTPException(status_code=400, detail="No valid heroes to attack with. Please summon more heroes!")
    
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

# ==================== GUILD DONATION SYSTEM ====================

@api_router.post("/guild/{username}/donate")
async def donate_to_guild(username: str, currency_type: str = "coins", amount: int = 1000):
    """Donate currency to guild"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
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

@api_router.get("/guild/{username}/donations")
async def get_guild_donations(username: str, limit: int = 20):
    """Get recent guild donations"""
    user = await get_user_readonly(username)  # Includes frozen check
    
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

# ==================== RESOURCE BAG SYSTEM ====================

@api_router.get("/resource-bag/{username}")
async def get_resource_bag(username: str):
    """Get user's resource bag (farming tracker)"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get or initialize resource bag
    resource_bag = user.get("resource_bag", {
        "coins_collected": 0,
        "gold_collected": 0,
        "crystals_collected": 0,
        "exp_collected": 0,
        "materials_collected": 0,
        "last_updated": None
    })
    
    # Calculate VIP bonus multipliers
    vip_level = user.get("vip_level", 0)
    vip_bonus = 1.0 + (vip_level * 0.05)  # 5% per VIP level
    
    # Get daily limits
    daily_coin_limit = int(50000 * vip_bonus)
    daily_gold_limit = int(25000 * vip_bonus)
    daily_exp_limit = int(10000 * vip_bonus)
    
    return {
        "resource_bag": resource_bag,
        "vip_level": vip_level,
        "vip_bonus_percent": int((vip_bonus - 1) * 100),
        "daily_limits": {
            "coins": daily_coin_limit,
            "gold": daily_gold_limit,
            "exp": daily_exp_limit
        },
        "current_totals": {
            "coins": user.get("coins", 0),
            "gold": user.get("gold", 0),
            "crystals": user.get("crystals", 0),
            "divine_essence": user.get("divine_essence", 0)
        }
    }

@api_router.post("/resource-bag/{username}/collect")
async def collect_resources(username: str, resource_type: str, amount: int):
    """Add collected resources to bag and update totals"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    valid_types = ["coins", "gold", "crystals", "exp", "materials"]
    if resource_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid resource type. Must be one of: {valid_types}")
    
    # Get resource bag
    resource_bag = user.get("resource_bag", {
        "coins_collected": 0,
        "gold_collected": 0,
        "crystals_collected": 0,
        "exp_collected": 0,
        "materials_collected": 0,
        "last_updated": None
    })
    
    # Update collected amount
    bag_key = f"{resource_type}_collected"
    resource_bag[bag_key] = resource_bag.get(bag_key, 0) + amount
    resource_bag["last_updated"] = datetime.utcnow().isoformat()
    
    # Update user's actual currency (except for exp and materials)
    update_query = {"$set": {"resource_bag": resource_bag}}
    if resource_type in ["coins", "gold", "crystals"]:
        update_query["$inc"] = {resource_type: amount}
    
    await db.users.update_one({"username": username}, update_query)
    
    return {
        "success": True,
        "resource_type": resource_type,
        "amount_added": amount,
        "new_bag_total": resource_bag[bag_key],
        "resource_bag": resource_bag
    }

@api_router.post("/resource-bag/{username}/reset")
async def reset_resource_bag(username: str):
    """Reset resource bag counters (typically called at daily reset)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Reset bag counters
    new_bag = {
        "coins_collected": 0,
        "gold_collected": 0,
        "crystals_collected": 0,
        "exp_collected": 0,
        "materials_collected": 0,
        "last_updated": datetime.utcnow().isoformat()
    }
    
    await db.users.update_one(
        {"username": username},
        {"$set": {"resource_bag": new_bag}}
    )
    
    return {"success": True, "message": "Resource bag reset", "resource_bag": new_bag}

# ==================== REDEMPTION CODE SYSTEM ====================

# 12 unique codes for the year - moderate rewards to keep players engaged
# All codes never expire (expires set to None)
REDEMPTION_CODES = {
    # Q1 - New Year & Valentines
    "NEWYEAR2025": {
        "rewards": {"crystals": 500, "coins": 50000, "gold": 25000},
        "description": "New Year 2025 Celebration",
        "max_uses": None,  # Unlimited
        "expires": None  # Never expires
    },
    "VALENTINE25": {
        "rewards": {"crystals": 300, "divine_essence": 5, "gold": 30000},
        "description": "Valentine's Day Special",
        "max_uses": None,
        "expires": None
    },
    "SPRING2025": {
        "rewards": {"coins": 100000, "gold": 50000, "crystals": 200},
        "description": "Spring Festival Rewards",
        "max_uses": None,
        "expires": None
    },
    
    # Q2 - Spring & Summer
    "HEROLAUNCH": {
        "rewards": {"crystals": 1000, "coins": 75000},
        "description": "Thank you for playing Divine Heroes!",
        "max_uses": None,
        "expires": None
    },
    "SUMMERVIBES": {
        "rewards": {"gold": 75000, "divine_essence": 3, "coins": 50000},
        "description": "Summer Event Code",
        "max_uses": None,
        "expires": None
    },
    "GUILDPOWER": {
        "rewards": {"crystals": 400, "gold": 40000, "coins": 40000},
        "description": "Guild Wars Launch Celebration",
        "max_uses": None,
        "expires": None
    },
    
    # Q3 - Summer & Fall
    "BOSSRUSH25": {
        "rewards": {"divine_essence": 10, "crystals": 300, "gold": 35000},
        "description": "Boss Rush Event Code",
        "max_uses": None,
        "expires": None
    },
    "AUTUMN2025": {
        "rewards": {"coins": 80000, "crystals": 250, "gold": 30000},
        "description": "Autumn Harvest Festival",
        "max_uses": None,
        "expires": None
    },
    "HALLOWEEN25": {
        "rewards": {"divine_essence": 8, "crystals": 500, "coins": 25000},
        "description": "Halloween Spooky Rewards",
        "max_uses": None,
        "expires": None
    },
    
    # Q4 - Winter & Holidays
    "THANKFUL25": {
        "rewards": {"gold": 60000, "coins": 60000, "crystals": 300},
        "description": "Thanksgiving Special",
        "max_uses": None,
        "expires": None
    },
    "XMAS2025": {
        "rewards": {"crystals": 800, "divine_essence": 12, "gold": 50000, "coins": 50000},
        "description": "Christmas Holiday Rewards",
        "max_uses": None,
        "expires": None
    },
    "YEAREND25": {
        "rewards": {"divine_essence": 15, "crystals": 600, "gold": 40000, "coins": 40000},
        "description": "Year End Celebration",
        "max_uses": None,
        "expires": None
    },
}

@api_router.get("/codes/list")
async def list_redemption_codes():
    """Get list of active redemption codes (for admin)"""
    now = datetime.utcnow()
    active_codes = []
    for code, data in REDEMPTION_CODES.items():
        expires = datetime.strptime(data["expires"], "%Y-%m-%d") if data.get("expires") else None
        if not expires or expires > now:
            active_codes.append({
                "code": code,
                "description": data["description"],
                "expires": data["expires"],
                "rewards": data["rewards"]
            })
    return {"codes": active_codes}

@api_router.post("/codes/redeem")
async def redeem_code(username: str, code: str):
    """Redeem a code for rewards"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Normalize code (uppercase)
    code = code.strip().upper()
    
    # Check if code exists
    if code not in REDEMPTION_CODES:
        raise HTTPException(status_code=400, detail="Invalid redemption code")
    
    code_data = REDEMPTION_CODES[code]
    
    # Check expiration
    if code_data.get("expires"):
        expires = datetime.strptime(code_data["expires"], "%Y-%m-%d")
        if datetime.utcnow() > expires:
            raise HTTPException(status_code=400, detail="This code has expired")
    
    # Check if user already redeemed this code
    redeemed_codes = user.get("redeemed_codes", [])
    if code in redeemed_codes:
        raise HTTPException(status_code=400, detail="You have already redeemed this code")
    
    # Check max uses (global limit)
    if code_data.get("max_uses"):
        use_count = await db.code_redemptions.count_documents({"code": code})
        if use_count >= code_data["max_uses"]:
            raise HTTPException(status_code=400, detail="This code has reached its maximum redemptions")
    
    # Apply rewards
    rewards = code_data["rewards"]
    update_fields = {}
    for reward_type, amount in rewards.items():
        update_fields[reward_type] = amount
    
    # Update user with rewards and mark code as redeemed
    await db.users.update_one(
        {"username": username},
        {
            "$inc": update_fields,
            "$push": {"redeemed_codes": code}
        }
    )
    
    # Log redemption
    await db.code_redemptions.insert_one({
        "code": code,
        "username": username,
        "user_id": user["id"],
        "rewards": rewards,
        "redeemed_at": datetime.utcnow()
    })
    
    return {
        "success": True,
        "message": f"Code redeemed successfully! {code_data['description']}",
        "rewards": rewards
    }

@api_router.get("/codes/history/{username}")
async def get_redemption_history(username: str):
    """Get user's code redemption history"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    history = await db.code_redemptions.find({"username": username}).sort("redeemed_at", -1).to_list(50)
    
    return {
        "redeemed_codes": user.get("redeemed_codes", []),
        "history": [{
            "code": h["code"],
            "rewards": h["rewards"],
            "redeemed_at": h["redeemed_at"].isoformat() if h.get("redeemed_at") else None
        } for h in history]
    }

# ==================== ABYSS SYSTEM (1000 Levels) ====================

ABYSS_CONFIG = {
    "total_levels": 1000,
    "milestone_levels": 50,  # Every 50th level gives server-wide 100 crystals for first clear
    "base_boss_hp": 5000,
    "hp_scaling_per_level": 1.08,  # 8% HP increase per level
    "base_boss_atk": 100,
    "atk_scaling_per_level": 1.05,
    "rewards_per_level": {
        "coins": 1000,  # Base coins per level
        "gold": 500,
        "exp": 100,
    }
}

def generate_abyss_boss(level: int) -> dict:
    """Generate boss stats for an abyss level"""
    # Boss names based on level tiers
    boss_tiers = [
        (1, 100, ["Shadow Imp", "Dark Sprite", "Cursed Wisp", "Void Wraith", "Night Stalker"]),
        (101, 200, ["Flame Demon", "Frost Giant", "Thunder Beast", "Stone Golem", "Wind Elemental"]),
        (201, 300, ["Blood Knight", "Bone Dragon", "Soul Reaper", "Plague Bearer", "Doom Bringer"]),
        (301, 400, ["Abyssal Lord", "Chaos Titan", "Void Monarch", "Shadow Emperor", "Death Sovereign"]),
        (401, 500, ["Infernal King", "Celestial Fallen", "Primordial Beast", "Elder God", "Cosmic Horror"]),
        (501, 600, ["World Eater", "Reality Breaker", "Time Devourer", "Dimension Walker", "Entropy Lord"]),
        (601, 700, ["Oblivion Knight", "Armageddon Angel", "Apocalypse Rider", "Extinction Beast", "Annihilation Sage"]),
        (701, 800, ["Universal Tyrant", "Infinite Darkness", "Eternal Flame", "Absolute Zero", "Perfect Storm"]),
        (801, 900, ["Divine Nemesis", "Sacred Destroyer", "Holy Corruptor", "Blessed Curse", "Heaven's Fall"]),
        (901, 1000, ["Final Judgment", "Ultimate End", "Supreme Void", "Absolute Chaos", "The Last One"]),
    ]
    
    # Find appropriate tier
    boss_names = ["Unknown Boss"]
    for min_lvl, max_lvl, names in boss_tiers:
        if min_lvl <= level <= max_lvl:
            boss_names = names
            break
    
    # Pick boss name based on level within tier
    boss_index = (level - 1) % len(boss_names)
    boss_name = boss_names[boss_index]
    
    # Add level suffix for uniqueness
    if level % 50 == 0:
        boss_name = f"🔥 {boss_name} the Unstoppable"  # Milestone boss
    elif level % 10 == 0:
        boss_name = f"⚔️ {boss_name} Elite"  # Mini-boss
    
    # Calculate scaled stats
    hp = int(ABYSS_CONFIG["base_boss_hp"] * (ABYSS_CONFIG["hp_scaling_per_level"] ** (level - 1)))
    atk = int(ABYSS_CONFIG["base_boss_atk"] * (ABYSS_CONFIG["atk_scaling_per_level"] ** (level - 1)))
    
    # Element based on level
    elements = ["Fire", "Water", "Earth", "Wind", "Light", "Dark"]
    element = elements[(level - 1) % len(elements)]
    
    return {
        "level": level,
        "name": boss_name,
        "element": element,
        "max_hp": hp,
        "current_hp": hp,
        "atk": atk,
        "is_milestone": level % ABYSS_CONFIG["milestone_levels"] == 0
    }

def calculate_abyss_rewards(level: int, is_first_clear: bool = False) -> dict:
    """Calculate rewards for clearing an abyss level"""
    base = ABYSS_CONFIG["rewards_per_level"]
    multiplier = 1 + (level * 0.01)  # 1% increase per level
    
    rewards = {
        "coins": int(base["coins"] * multiplier),
        "gold": int(base["gold"] * multiplier),
        "exp": int(base["exp"] * multiplier),
    }
    
    # Bonus rewards for milestone levels
    if level % 50 == 0:
        rewards["crystals"] = 50 + (level // 50) * 10
        rewards["divine_essence"] = level // 100
    elif level % 10 == 0:
        rewards["crystals"] = 10 + (level // 10)
    
    return rewards

@api_router.get("/abyss/{username}/status")
async def get_abyss_status(username: str):
    """Get user's abyss progress"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get user's abyss progress
    abyss_progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    
    if not abyss_progress:
        # Initialize abyss progress for new user
        abyss_progress = {
            "user_id": user["id"],
            "username": username,
            "server_id": user.get("server_id", "server_1"),
            "current_level": 1,
            "highest_cleared": 0,
            "total_damage_dealt": 0,
            "clear_history": []  # Will store {level, cleared_at, heroes_used, power_rating}
        }
        await db.abyss_progress.insert_one(abyss_progress)
    
    # Get current boss info
    current_level = abyss_progress.get("highest_cleared", 0) + 1
    if current_level > ABYSS_CONFIG["total_levels"]:
        current_level = ABYSS_CONFIG["total_levels"]
        boss = None  # Completed all levels
    else:
        boss = generate_abyss_boss(current_level)
    
    # Get first clears for milestones
    server_id = user.get("server_id", "server_1")
    first_clears = await db.abyss_first_clears.find(
        {"server_id": server_id}
    ).sort("level", 1).to_list(100)
    
    return {
        "current_level": current_level,
        "highest_cleared": abyss_progress.get("highest_cleared", 0),
        "total_levels": ABYSS_CONFIG["total_levels"],
        "total_damage_dealt": abyss_progress.get("total_damage_dealt", 0),
        "current_boss": boss,
        "rewards_preview": calculate_abyss_rewards(current_level) if boss else None,
        "is_completed": current_level > ABYSS_CONFIG["total_levels"],
        "milestone_first_clears": [{
            "level": fc["level"],
            "cleared_by": fc["username"],
            "cleared_at": fc["cleared_at"].isoformat() if fc.get("cleared_at") else None
        } for fc in first_clears if fc["level"] % 50 == 0]
    }

@api_router.get("/abyss/{username}/records")
async def get_abyss_records(username: str, level: int = None):
    """Get clear records for abyss levels"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    server_id = user.get("server_id", "server_1")
    
    if level:
        # Get records for specific level
        first_clear = await db.abyss_first_clears.find_one({"server_id": server_id, "level": level})
        recent_clears = await db.abyss_clears.find(
            {"server_id": server_id, "level": level}
        ).sort("cleared_at", -1).limit(2).to_list(2)
        
        return {
            "level": level,
            "first_clear": {
                "username": first_clear["username"],
                "heroes_used": first_clear.get("heroes_used", []),
                "power_rating": first_clear.get("power_rating", 0),
                "cleared_at": first_clear["cleared_at"].isoformat() if first_clear.get("cleared_at") else None
            } if first_clear else None,
            "recent_clears": [{
                "username": rc["username"],
                "heroes_used": rc.get("heroes_used", []),
                "power_rating": rc.get("power_rating", 0),
                "cleared_at": rc["cleared_at"].isoformat() if rc.get("cleared_at") else None
            } for rc in recent_clears]
        }
    else:
        # Get user's own clear history
        abyss_progress = await db.abyss_progress.find_one({"user_id": user["id"]})
        clear_history = abyss_progress.get("clear_history", []) if abyss_progress else []
        
        return {
            "total_cleared": abyss_progress.get("highest_cleared", 0) if abyss_progress else 0,
            "clear_history": clear_history[-20:]  # Last 20 clears
        }

@api_router.post("/abyss/{username}/attack")
async def attack_abyss_boss(username: str):
    """Attack the current abyss boss"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get user's abyss progress
    abyss_progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not abyss_progress:
        # Initialize
        abyss_progress = {
            "user_id": user["id"],
            "username": username,
            "server_id": user.get("server_id", "server_1"),
            "current_level": 1,
            "highest_cleared": 0,
            "total_damage_dealt": 0,
            "clear_history": []
        }
        await db.abyss_progress.insert_one(abyss_progress)
    
    current_level = abyss_progress.get("highest_cleared", 0) + 1
    
    if current_level > ABYSS_CONFIG["total_levels"]:
        raise HTTPException(status_code=400, detail="You have conquered all 1000 levels of the Abyss!")
    
    # Get user's heroes for battle
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
    if not user_heroes:
        raise HTTPException(status_code=400, detail="No heroes to battle with")
    
    # Calculate team power
    total_power = 0
    heroes_used = []
    for uh in user_heroes[:5]:  # Use up to 5 heroes
        hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
        if hero_data:
            power = (uh.get("current_hp", 1000) + uh.get("current_atk", 100) * 5 + uh.get("current_def", 50) * 3)
            power *= (1 + uh.get("level", 1) * 0.1)
            total_power += power
            heroes_used.append({
                "name": hero_data.get("name"),
                "level": uh.get("level", 1),
                "rarity": hero_data.get("rarity")
            })
    
    # Generate boss
    boss = generate_abyss_boss(current_level)
    
    # Calculate damage (simplified battle)
    base_damage = int(total_power * random.uniform(0.8, 1.2))
    is_critical = random.random() < 0.15
    if is_critical:
        base_damage = int(base_damage * 1.5)
    
    # Check if boss is defeated
    boss_defeated = base_damage >= boss["max_hp"]
    
    result = {
        "level": current_level,
        "boss_name": boss["name"],
        "damage_dealt": base_damage,
        "is_critical": is_critical,
        "boss_max_hp": boss["max_hp"],
        "boss_defeated": boss_defeated,
        "heroes_used": heroes_used,
        "power_rating": int(total_power)
    }
    
    if boss_defeated:
        # Calculate rewards
        server_id = user.get("server_id", "server_1")
        
        # Check if this is the server's first clear of this level
        existing_first_clear = await db.abyss_first_clears.find_one({
            "server_id": server_id,
            "level": current_level
        })
        
        is_first_clear = existing_first_clear is None
        rewards = calculate_abyss_rewards(current_level, is_first_clear)
        
        # Record the clear
        clear_record = {
            "user_id": user["id"],
            "username": username,
            "server_id": server_id,
            "level": current_level,
            "heroes_used": heroes_used,
            "power_rating": int(total_power),
            "damage_dealt": base_damage,
            "cleared_at": datetime.utcnow()
        }
        await db.abyss_clears.insert_one(clear_record)
        
        # If first clear, record it and give server-wide rewards for milestones
        if is_first_clear:
            await db.abyss_first_clears.insert_one(clear_record.copy())
            
            # Milestone first clear - give 100 crystals to ALL players on server
            if current_level % ABYSS_CONFIG["milestone_levels"] == 0:
                await db.users.update_many(
                    {"server_id": server_id},
                    {"$inc": {"crystals": 100}}
                )
                result["milestone_reward"] = {
                    "message": f"🎉 FIRST CLEAR! All players on your server received 100 crystals!",
                    "level": current_level
                }
        
        # Update user progress
        await db.abyss_progress.update_one(
            {"user_id": user["id"]},
            {
                "$set": {"highest_cleared": current_level},
                "$inc": {"total_damage_dealt": base_damage},
                "$push": {
                    "clear_history": {
                        "$each": [{
                            "level": current_level,
                            "cleared_at": datetime.utcnow().isoformat(),
                            "heroes_used": heroes_used,
                            "power_rating": int(total_power)
                        }],
                        "$slice": -50  # Keep last 50 clears
                    }
                }
            }
        )
        
        # Give rewards to user
        await db.users.update_one(
            {"username": username},
            {"$inc": rewards}
        )
        
        result["rewards"] = rewards
        result["is_first_server_clear"] = is_first_clear
        result["next_level"] = current_level + 1 if current_level < ABYSS_CONFIG["total_levels"] else None
    else:
        # Boss not defeated - record damage dealt
        await db.abyss_progress.update_one(
            {"user_id": user["id"]},
            {"$inc": {"total_damage_dealt": base_damage}}
        )
        result["boss_remaining_hp"] = boss["max_hp"] - base_damage
        result["damage_needed"] = boss["max_hp"] - base_damage
    
    return result

@api_router.get("/abyss/leaderboard/{server_id}")
async def get_abyss_leaderboard(server_id: str = "server_1"):
    """Get abyss leaderboard for a server"""
    # Get top players by highest cleared level
    top_players = await db.abyss_progress.find(
        {"server_id": server_id}
    ).sort("highest_cleared", -1).limit(50).to_list(50)
    
    # Get milestone first clears
    first_clears = await db.abyss_first_clears.find(
        {"server_id": server_id, "level": {"$mod": [50, 0]}}
    ).sort("level", 1).to_list(20)
    
    return {
        "server_id": server_id,
        "leaderboard": [{
            "rank": i + 1,
            "username": p["username"],
            "highest_cleared": p["highest_cleared"],
            "total_damage": p.get("total_damage_dealt", 0)
        } for i, p in enumerate(top_players)],
        "milestone_first_clears": [{
            "level": fc["level"],
            "username": fc["username"],
            "cleared_at": fc["cleared_at"].isoformat() if fc.get("cleared_at") else None
        } for fc in first_clears]
    }

# ==================== GUILD WAR SYSTEM ====================

GUILD_WAR_SEASONS = {
    "duration_days": 7,
    "matchmaking_power_range": 0.3,  # Match guilds within 30% power difference
    "rewards_per_rank": {
        1: {"crystals": 5000, "divine_essence": 50, "gold": 500000},
        2: {"crystals": 3000, "divine_essence": 30, "gold": 300000},
        3: {"crystals": 2000, "divine_essence": 20, "gold": 200000},
        "top_10": {"crystals": 1000, "divine_essence": 10, "gold": 100000},
        "participation": {"crystals": 200, "gold": 20000},
    }
}

@api_router.get("/guild-war/status")
async def get_guild_war_status():
    """Get current guild war season status"""
    current_war = await db.guild_wars.find_one({"status": "active"})
    
    if not current_war:
        # Check if we should start a new war
        last_war = await db.guild_wars.find_one(
            {"status": "completed"},
            sort=[("end_time", -1)]
        )
        
        # Start new war if none exists or last one ended
        current_war = {
            "id": str(uuid.uuid4()),
            "season": (last_war.get("season", 0) + 1) if last_war else 1,
            "status": "active",
            "start_time": datetime.utcnow().isoformat(),
            "end_time": (datetime.utcnow() + timedelta(days=GUILD_WAR_SEASONS["duration_days"])).isoformat(),
            "participating_guilds": [],
            "matches": [],
            "leaderboard": []
        }
        await db.guild_wars.insert_one(current_war)
    
    return convert_objectid(current_war)

@api_router.post("/guild-war/register/{username}")
async def register_guild_for_war(username: str):
    """Register guild for current war season"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    # Check if user is guild leader
    if guild.get("leader_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only guild leader can register")
    
    current_war = await db.guild_wars.find_one({"status": "active"})
    if not current_war:
        raise HTTPException(status_code=400, detail="No active guild war")
    
    # Check if already registered
    if guild["id"] in current_war.get("participating_guilds", []):
        raise HTTPException(status_code=400, detail="Guild already registered")
    
    # Calculate guild power
    member_count = len(guild.get("member_ids", []))
    guild_power = guild.get("total_power", 0) or member_count * 1000
    
    # Register guild
    await db.guild_wars.update_one(
        {"id": current_war["id"]},
        {
            "$push": {
                "participating_guilds": guild["id"],
                "leaderboard": {
                    "guild_id": guild["id"],
                    "guild_name": guild["name"],
                    "power": guild_power,
                    "wins": 0,
                    "losses": 0,
                    "points": 0,
                    "damage_dealt": 0
                }
            }
        }
    )
    
    return {"success": True, "message": "Guild registered for war!", "season": current_war["season"]}

@api_router.get("/guild-war/leaderboard")
async def get_guild_war_leaderboard(limit: int = 50):
    """Get guild war leaderboard"""
    current_war = await db.guild_wars.find_one({"status": "active"})
    if not current_war:
        return {"leaderboard": [], "season": 0}
    
    leaderboard = sorted(
        current_war.get("leaderboard", []),
        key=lambda x: (-x.get("points", 0), -x.get("wins", 0), -x.get("damage_dealt", 0))
    )[:limit]
    
    # Add ranks
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return {
        "leaderboard": leaderboard,
        "season": current_war["season"],
        "end_time": current_war.get("end_time"),
        "total_guilds": len(current_war.get("participating_guilds", []))
    }

@api_router.post("/guild-war/attack/{username}")
async def guild_war_attack(username: str, target_guild_id: str):
    """Attack another guild in the war"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    guild = await db.guilds.find_one({"member_ids": user["id"]})
    if not guild:
        raise HTTPException(status_code=400, detail="Not in a guild")
    
    current_war = await db.guild_wars.find_one({"status": "active"})
    if not current_war:
        raise HTTPException(status_code=400, detail="No active guild war")
    
    # Check if guild is registered
    if guild["id"] not in current_war.get("participating_guilds", []):
        raise HTTPException(status_code=400, detail="Guild not registered for war")
    
    # Check if target is registered
    if target_guild_id not in current_war.get("participating_guilds", []):
        raise HTTPException(status_code=400, detail="Target guild not in war")
    
    if guild["id"] == target_guild_id:
        raise HTTPException(status_code=400, detail="Cannot attack your own guild")
    
    # Get user's combat power
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
    user_power = 0
    for uh in user_heroes[:6]:
        hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
        if hero_data:
            level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
            user_power += (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult
    
    # Calculate damage
    base_damage = int(user_power * random.uniform(0.8, 1.2))
    is_critical = random.random() < 0.15
    damage = int(base_damage * (1.8 if is_critical else 1.0))
    
    # Points earned
    points_earned = damage // 1000
    
    # Update attacker stats
    await db.guild_wars.update_one(
        {"id": current_war["id"], "leaderboard.guild_id": guild["id"]},
        {
            "$inc": {
                "leaderboard.$.damage_dealt": damage,
                "leaderboard.$.points": points_earned
            }
        }
    )
    
    # Record the attack
    attack_record = {
        "id": str(uuid.uuid4()),
        "war_id": current_war["id"],
        "attacker_guild_id": guild["id"],
        "attacker_user_id": user["id"],
        "attacker_username": username,
        "target_guild_id": target_guild_id,
        "damage": damage,
        "is_critical": is_critical,
        "points_earned": points_earned,
        "timestamp": datetime.utcnow().isoformat()
    }
    await db.guild_war_attacks.insert_one(attack_record)
    
    return {
        "success": True,
        "damage": damage,
        "is_critical": is_critical,
        "points_earned": points_earned,
        "total_points": 0  # Would need to query to get updated total
    }

@api_router.get("/guild-war/history/{username}")
async def get_guild_war_history(username: str, limit: int = 20):
    """Get user's guild war attack history"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    attacks = await db.guild_war_attacks.find(
        {"attacker_user_id": user["id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"attacks": [convert_objectid(a) for a in attacks]}

# ==================== REVENUECAT PURCHASE VERIFICATION ====================

class PurchaseVerification(BaseModel):
    username: str
    product_id: str
    transaction_id: str
    platform: str

PRODUCT_REWARDS = {
    "battle_pass_standard": {"type": "battle_pass", "tier": "standard", "crystals": 0},
    "battle_pass_premium": {"type": "battle_pass", "tier": "premium", "bonus_levels": 10, "crystals": 500},
    "crystal_pack_100": {"type": "crystals", "amount": 100},
    "crystal_pack_500": {"type": "crystals", "amount": 500},
    "crystal_pack_1000": {"type": "crystals", "amount": 1000},
    "divine_pack_starter": {"type": "divine_essence", "amount": 10},
    "divine_pack_deluxe": {"type": "divine_essence", "amount": 50},
}

@api_router.post("/purchase/verify")
async def verify_purchase_legacy(purchase: PurchaseVerification):
    """
    DEPRECATED: Legacy purchase verification endpoint.
    Use /api/purchases/verify with RevenueCat integration instead.
    """
    raise HTTPException(
        status_code=410,
        detail="Deprecated. Use /api/purchases/verify with proper receipt verification."
    )

@api_router.get("/purchase/history/{username}")
async def get_purchase_history(username: str, limit: int = 20):
    """Get user's purchase history"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    purchases = await db.purchases.find(
        {"user_id": user["id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "purchases": [convert_objectid(p) for p in purchases],
        "total_purchases": len(purchases)
    }

DAILY_QUESTS = [
    {"id": "summon_5", "name": "Summoner", "description": "Perform 5 summons", "target": 5, "reward_type": "crystals", "reward_amount": 50},
    {"id": "arena_3", "name": "Arena Fighter", "description": "Win 3 Arena battles", "target": 3, "reward_type": "crystals", "reward_amount": 30},
    {"id": "level_hero", "name": "Trainer", "description": "Level up any hero 10 times", "target": 10, "reward_type": "gold", "reward_amount": 5000},
    {"id": "collect_idle", "name": "Collector", "description": "Collect idle rewards", "target": 1, "reward_type": "coins", "reward_amount": 2000},
    {"id": "story_battle", "name": "Adventurer", "description": "Complete 3 story battles", "target": 3, "reward_type": "crystals", "reward_amount": 20},
]

@api_router.get("/daily-quests/{username}")
async def get_daily_quests(username: str):
    """Get daily quest progress for user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get or create daily quest progress
    today = datetime.utcnow().date().isoformat()
    progress = await db.daily_quest_progress.find_one({"user_id": user["id"], "date": today})
    
    if not progress:
        progress = {
            "user_id": user["id"],
            "date": today,
            "quests": {q["id"]: {"progress": 0, "claimed": False} for q in DAILY_QUESTS}
        }
        await db.daily_quest_progress.insert_one(progress)
    
    # Build response with quest details
    result = []
    for quest in DAILY_QUESTS:
        quest_progress = progress["quests"].get(quest["id"], {"progress": 0, "claimed": False})
        result.append({
            **quest,
            "progress": quest_progress["progress"],
            "claimed": quest_progress["claimed"],
            "completed": quest_progress["progress"] >= quest["target"]
        })
    
    return result

@api_router.post("/daily-quests/{username}/claim/{quest_id}")
async def claim_daily_quest(username: str, quest_id: str):
    """Claim reward for completed daily quest"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    today = datetime.utcnow().date().isoformat()
    progress = await db.daily_quest_progress.find_one({"user_id": user["id"], "date": today})
    
    if not progress:
        raise HTTPException(status_code=400, detail="No quest progress found")
    
    quest = next((q for q in DAILY_QUESTS if q["id"] == quest_id), None)
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    quest_progress = progress["quests"].get(quest_id, {"progress": 0, "claimed": False})
    
    if quest_progress["claimed"]:
        raise HTTPException(status_code=400, detail="Already claimed")
    
    if quest_progress["progress"] < quest["target"]:
        raise HTTPException(status_code=400, detail="Quest not completed")
    
    # Grant reward
    reward_field = quest["reward_type"]
    reward_amount = quest["reward_amount"]
    
    await db.users.update_one(
        {"username": username},
        {"$inc": {reward_field: reward_amount}}
    )
    
    # Mark as claimed
    await db.daily_quest_progress.update_one(
        {"user_id": user["id"], "date": today},
        {"$set": {f"quests.{quest_id}.claimed": True}}
    )
    
    return {
        "success": True,
        "reward_type": reward_field,
        "reward_amount": reward_amount
    }

# ==================== DAILY LOGIN REWARDS (6 MONTHS - 180 DAYS) ====================

def generate_daily_login_rewards():
    """Generate 180 days of login rewards with escalating values"""
    rewards = []
    
    for day in range(1, 181):
        month = (day - 1) // 30 + 1  # 1-6
        day_in_month = (day - 1) % 30 + 1  # 1-30
        
        # Determine if this is a bonus day
        is_weekly_bonus = day % 7 == 0
        is_monthly_bonus = day % 30 == 0
        is_90_day_milestone = day == 90
        is_180_day_milestone = day == 180
        is_bonus = is_weekly_bonus or is_monthly_bonus or is_90_day_milestone or is_180_day_milestone
        
        # Base multiplier increases each month
        month_multiplier = 1 + (month - 1) * 0.5  # 1.0, 1.5, 2.0, 2.5, 3.0, 3.5
        
        # Determine reward type and amount based on day pattern
        if is_180_day_milestone:
            # Final reward - massive divine essence
            reward_type = "divine_essence"
            reward_amount = 50
        elif is_90_day_milestone:
            # 3-month milestone - large divine essence
            reward_type = "divine_essence"
            reward_amount = 25
        elif is_monthly_bonus:
            # Monthly bonus (day 30, 60, 90, 120, 150, 180) - divine essence
            reward_type = "divine_essence"
            reward_amount = int(10 * month_multiplier)
        elif is_weekly_bonus:
            # Weekly bonus (day 7, 14, 21, 28, etc.) - crystals
            reward_type = "crystals"
            reward_amount = int(200 * month_multiplier)
        else:
            # Regular days - cycle through coins, crystals, gold
            day_cycle = day_in_month % 5
            if day_cycle == 1:
                reward_type = "coins"
                reward_amount = int(5000 * month_multiplier * (1 + day_in_month * 0.05))
            elif day_cycle == 2:
                reward_type = "crystals"
                reward_amount = int(50 * month_multiplier * (1 + day_in_month * 0.03))
            elif day_cycle == 3:
                reward_type = "gold"
                reward_amount = int(3000 * month_multiplier * (1 + day_in_month * 0.05))
            elif day_cycle == 4:
                reward_type = "coins"
                reward_amount = int(8000 * month_multiplier * (1 + day_in_month * 0.05))
            else:  # day_cycle == 0
                reward_type = "crystals"
                reward_amount = int(80 * month_multiplier * (1 + day_in_month * 0.03))
        
        rewards.append({
            "day": day,
            "reward_type": reward_type,
            "reward_amount": int(reward_amount),
            "bonus": is_bonus
        })
    
    return rewards

DAILY_LOGIN_REWARDS = generate_daily_login_rewards()

@api_router.get("/login-rewards/{username}")
async def get_login_rewards(username: str):
    """Get daily login reward status for user (6-month / 180-day system)"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    login_days = user.get("login_days", 0)
    today = datetime.utcnow().date().isoformat()
    
    # Get claimed rewards
    login_data = await db.login_rewards.find_one({"user_id": user["id"]})
    if not login_data:
        login_data = {
            "user_id": user["id"],
            "claimed_days": [],
            "last_claim_date": None,
            "current_streak": 0
        }
        await db.login_rewards.insert_one(login_data)
    
    claimed_days = login_data.get("claimed_days", [])
    last_claim_date = login_data.get("last_claim_date")
    
    # Check if can claim today
    can_claim_today = last_claim_date != today and login_days > 0
    
    # Build rewards calendar (all 180 days)
    rewards = []
    for reward in DAILY_LOGIN_REWARDS:
        day = reward["day"]
        rewards.append({
            **reward,
            "claimed": day in claimed_days,
            "available": day <= login_days and day not in claimed_days,
            "locked": day > login_days
        })
    
    return {
        "login_days": login_days,
        "rewards": rewards,
        "can_claim_today": can_claim_today,
        "last_claim_date": last_claim_date,
        "current_streak": login_data.get("current_streak", 0),
        "total_days": 180
    }

@api_router.post("/login-rewards/{username}/claim/{day}")
async def claim_login_reward(username: str, day: int):
    """Claim a specific day's login reward"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    login_days = user.get("login_days", 0)
    
    if day > login_days:
        raise HTTPException(status_code=400, detail="Day not yet reached")
    
    if day < 1 or day > 180:
        raise HTTPException(status_code=400, detail="Invalid day (must be 1-180)")
    
    login_data = await db.login_rewards.find_one({"user_id": user["id"]})
    if not login_data:
        login_data = {"user_id": user["id"], "claimed_days": [], "last_claim_date": None}
        await db.login_rewards.insert_one(login_data)
    
    if day in login_data.get("claimed_days", []):
        raise HTTPException(status_code=400, detail="Already claimed this day")
    
    # Get reward from the generated list
    reward = DAILY_LOGIN_REWARDS[day - 1]
    
    # Grant reward
    await db.users.update_one(
        {"username": username},
        {"$inc": {reward["reward_type"]: reward["reward_amount"]}}
    )
    
    # Mark as claimed
    today = datetime.utcnow().date().isoformat()
    await db.login_rewards.update_one(
        {"user_id": user["id"]},
        {
            "$push": {"claimed_days": day},
            "$set": {"last_claim_date": today}
        }
    )
    
    return {
        "success": True,
        "day": day,
        "reward_type": reward["reward_type"],
        "reward_amount": reward["reward_amount"],
        "is_bonus": reward["bonus"]
    }

# ==================== BATTLE PASS SYSTEM ====================

BATTLE_PASS_REWARDS = {
    "free": [
        {"level": 1, "reward_type": "coins", "reward_amount": 5000},
        {"level": 3, "reward_type": "crystals", "reward_amount": 50},
        {"level": 5, "reward_type": "gold", "reward_amount": 5000},
        {"level": 7, "reward_type": "coins", "reward_amount": 10000},
        {"level": 10, "reward_type": "crystals", "reward_amount": 100},
        {"level": 13, "reward_type": "gold", "reward_amount": 10000},
        {"level": 15, "reward_type": "crystals", "reward_amount": 150},
        {"level": 18, "reward_type": "coins", "reward_amount": 20000},
        {"level": 20, "reward_type": "crystals", "reward_amount": 200},
        {"level": 23, "reward_type": "gold", "reward_amount": 20000},
        {"level": 25, "reward_type": "crystals", "reward_amount": 250},
        {"level": 28, "reward_type": "coins", "reward_amount": 30000},
        {"level": 30, "reward_type": "crystals", "reward_amount": 300},
    ],
    "premium": [
        {"level": 1, "reward_type": "crystals", "reward_amount": 100},
        {"level": 2, "reward_type": "gold", "reward_amount": 5000},
        {"level": 3, "reward_type": "crystals", "reward_amount": 100},
        {"level": 4, "reward_type": "coins", "reward_amount": 15000},
        {"level": 5, "reward_type": "crystals", "reward_amount": 150},
        {"level": 6, "reward_type": "gold", "reward_amount": 8000},
        {"level": 7, "reward_type": "crystals", "reward_amount": 150},
        {"level": 8, "reward_type": "coins", "reward_amount": 20000},
        {"level": 9, "reward_type": "crystals", "reward_amount": 200},
        {"level": 10, "reward_type": "divine_essence", "reward_amount": 5},
        {"level": 12, "reward_type": "crystals", "reward_amount": 200},
        {"level": 14, "reward_type": "gold", "reward_amount": 15000},
        {"level": 16, "reward_type": "crystals", "reward_amount": 250},
        {"level": 18, "reward_type": "coins", "reward_amount": 30000},
        {"level": 20, "reward_type": "divine_essence", "reward_amount": 10},
        {"level": 22, "reward_type": "crystals", "reward_amount": 300},
        {"level": 24, "reward_type": "gold", "reward_amount": 25000},
        {"level": 26, "reward_type": "crystals", "reward_amount": 350},
        {"level": 28, "reward_type": "coins", "reward_amount": 50000},
        {"level": 30, "reward_type": "divine_essence", "reward_amount": 20},
    ]
}

BATTLE_PASS_XP_PER_LEVEL = 1000
BATTLE_PASS_PRICE = 9.99  # USD
BATTLE_PASS_PREMIUM_PLUS_PRICE = 19.99  # Includes 10 level skips

@api_router.get("/battle-pass/{username}")
async def get_battle_pass(username: str):
    """Get battle pass progress for user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    bp_data = await db.battle_pass.find_one({"user_id": user["id"]})
    if not bp_data:
        bp_data = {
            "user_id": user["id"],
            "season": 1,
            "xp": 0,
            "level": 1,
            "is_premium": False,
            "claimed_free": [],
            "claimed_premium": []
        }
        await db.battle_pass.insert_one(bp_data)
    
    # Calculate level from XP
    level = min(30, 1 + bp_data.get("xp", 0) // BATTLE_PASS_XP_PER_LEVEL)
    xp_in_level = bp_data.get("xp", 0) % BATTLE_PASS_XP_PER_LEVEL
    
    # Build rewards list
    free_rewards = []
    for reward in BATTLE_PASS_REWARDS["free"]:
        free_rewards.append({
            **reward,
            "claimed": reward["level"] in bp_data.get("claimed_free", []),
            "available": reward["level"] <= level and reward["level"] not in bp_data.get("claimed_free", []),
            "locked": reward["level"] > level
        })
    
    premium_rewards = []
    for reward in BATTLE_PASS_REWARDS["premium"]:
        premium_rewards.append({
            **reward,
            "claimed": reward["level"] in bp_data.get("claimed_premium", []),
            "available": bp_data.get("is_premium", False) and reward["level"] <= level and reward["level"] not in bp_data.get("claimed_premium", []),
            "locked": reward["level"] > level or not bp_data.get("is_premium", False)
        })
    
    return {
        "season": bp_data.get("season", 1),
        "level": level,
        "xp": bp_data.get("xp", 0),
        "xp_in_level": xp_in_level,
        "xp_to_next_level": BATTLE_PASS_XP_PER_LEVEL,
        "is_premium": bp_data.get("is_premium", False),
        "free_rewards": free_rewards,
        "premium_rewards": premium_rewards,
        "premium_price": BATTLE_PASS_PRICE,
        "premium_plus_price": BATTLE_PASS_PREMIUM_PLUS_PRICE
    }

@api_router.post("/battle-pass/{username}/claim/{track}/{level}")
async def claim_battle_pass_reward(username: str, track: str, level: int):
    """Claim a battle pass reward"""
    if track not in ["free", "premium"]:
        raise HTTPException(status_code=400, detail="Invalid track")
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # For premium track, enforce PREMIUM entitlement (server-authoritative)
    if track == "premium":
        await require_entitlement(username, "PREMIUM")
    
    bp_data = await db.battle_pass.find_one({"user_id": user["id"]})
    if not bp_data:
        raise HTTPException(status_code=400, detail="Battle pass data not found")
    
    current_level = min(30, 1 + bp_data.get("xp", 0) // BATTLE_PASS_XP_PER_LEVEL)
    
    if level > current_level:
        raise HTTPException(status_code=400, detail="Level not yet reached")
    
    if track == "premium" and not bp_data.get("is_premium", False):
        raise HTTPException(status_code=400, detail="Premium pass required")
    
    claimed_key = f"claimed_{track}"
    if level in bp_data.get(claimed_key, []):
        raise HTTPException(status_code=400, detail="Already claimed")
    
    # Find reward
    reward = next((r for r in BATTLE_PASS_REWARDS[track] if r["level"] == level), None)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Grant reward
    await db.users.update_one(
        {"username": username},
        {"$inc": {reward["reward_type"]: reward["reward_amount"]}}
    )
    
    # Mark as claimed
    await db.battle_pass.update_one(
        {"user_id": user["id"]},
        {"$push": {claimed_key: level}}
    )
    
    return {
        "success": True,
        "track": track,
        "level": level,
        "reward_type": reward["reward_type"],
        "reward_amount": reward["reward_amount"]
    }

@api_router.post("/battle-pass/{username}/purchase")
async def purchase_battle_pass(username: str, tier: str = "premium"):
    """Purchase battle pass (simulated)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    bp_data = await db.battle_pass.find_one({"user_id": user["id"]})
    if not bp_data:
        bp_data = {
            "user_id": user["id"],
            "season": 1,
            "xp": 0,
            "is_premium": False,
            "claimed_free": [],
            "claimed_premium": []
        }
        await db.battle_pass.insert_one(bp_data)
    
    if bp_data.get("is_premium", False):
        raise HTTPException(status_code=400, detail="Already have premium pass")
    
    # Grant premium status
    update = {"$set": {"is_premium": True}}
    
    # If premium plus, add 10 levels worth of XP
    if tier == "premium_plus":
        update["$inc"] = {"xp": 10 * BATTLE_PASS_XP_PER_LEVEL}
    
    await db.battle_pass.update_one({"user_id": user["id"]}, update)
    
    # Add VIP XP
    vip_xp = 9.99 if tier == "premium" else 19.99
    await db.users.update_one(
        {"username": username},
        {"$inc": {"total_spent": vip_xp}}
    )
    
    return {
        "success": True,
        "tier": tier,
        "price": BATTLE_PASS_PRICE if tier == "premium" else BATTLE_PASS_PREMIUM_PLUS_PRICE
    }

@api_router.post("/battle-pass/{username}/add-xp")
async def add_battle_pass_xp(username: str, xp: int = 100):
    """Add XP to battle pass (called by various game actions)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    await db.battle_pass.update_one(
        {"user_id": user["id"]},
        {"$inc": {"xp": xp}},
        upsert=True
    )
    
    return {"success": True, "xp_added": xp}

# ==================== EVENT BANNERS ====================

# Active event banners - in production, this would be database-driven
EVENT_BANNERS = [
    {
        "id": "celestial_ascension",
        "name": "Celestial Ascension",
        "description": "Limited time! Increased rates for Light element heroes!",
        "banner_type": "premium",  # Uses crystals
        "start_date": "2025-01-01",
        "end_date": "2025-01-15",
        "featured_heroes": ["Seraphiel the Radiant", "Leon the Paladin", "Lucian the Divine"],
        "rate_boosts": {"Light": 2.0},  # 2x rate for Light heroes
        "guaranteed_featured_pity": 80,  # Guaranteed featured hero at 80 pulls
        "is_active": True
    },
    {
        "id": "shadow_realm",
        "name": "Shadow Realm",
        "description": "Exclusive Dark element heroes with boosted rates!",
        "banner_type": "premium",
        "start_date": "2025-01-10",
        "end_date": "2025-01-24",
        "featured_heroes": ["Apollyon the Fallen", "Morgana the Shadow", "Selene the Moonbow"],
        "rate_boosts": {"Dark": 2.0},
        "guaranteed_featured_pity": 80,
        "is_active": True
    },
    {
        "id": "divine_collection",
        "name": "Divine Collection",
        "description": "Triple UR+ rate! Get your UR+ heroes now!",
        "banner_type": "divine",  # Uses Divine Essence
        "start_date": "2025-01-05",
        "end_date": "2025-01-12",
        "featured_heroes": ["Raphael the Eternal", "Michael the Archangel", "Apollyon the Fallen"],
        "rate_boosts": {"UR+": 1.0},  # Already 100% for divine
        "guaranteed_featured_pity": 20,  # Shorter pity for events
        "is_active": True
    }
]

@api_router.get("/event-banners")
async def get_event_banners():
    """Get all active event banners"""
    today = datetime.utcnow().date().isoformat()
    
    active_banners = []
    for banner in EVENT_BANNERS:
        if banner["is_active"]:
            # Check if within date range (simplified check)
            days_remaining = 7  # Placeholder
            active_banners.append({
                **banner,
                "days_remaining": days_remaining
            })
    
    return {"banners": active_banners}

@api_router.get("/event-banners/{banner_id}")
async def get_event_banner_details(banner_id: str, username: str):
    """Get detailed info for a specific event banner"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    banner = next((b for b in EVENT_BANNERS if b["id"] == banner_id), None)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    # Get user's pity for this banner
    event_pity = await db.event_pity.find_one({"user_id": user["id"], "banner_id": banner_id})
    pity_count = event_pity.get("pity_count", 0) if event_pity else 0
    
    return {
        **banner,
        "pity_count": pity_count,
        "pity_threshold": banner["guaranteed_featured_pity"]
    }

@api_router.post("/event-banners/{banner_id}/pull")
async def pull_event_banner(banner_id: str, username: str, multi: bool = False):
    """Pull on an event banner"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    banner = next((b for b in EVENT_BANNERS if b["id"] == banner_id), None)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    # Determine currency and cost
    if banner["banner_type"] == "divine":
        currency = "divine_essence"
        cost = DIVINE_ESSENCE_COST_MULTI if multi else DIVINE_ESSENCE_COST_SINGLE
    else:
        currency = "gems"
        cost = CRYSTAL_COST_MULTI if multi else CRYSTAL_COST_SINGLE
    
    if user.get(currency, 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough {currency}")
    
    # Get/update pity
    event_pity = await db.event_pity.find_one({"user_id": user["id"], "banner_id": banner_id})
    pity_count = event_pity.get("pity_count", 0) if event_pity else 0
    
    num_pulls = 10 if multi else 1
    results = []
    
    # Get featured hero pool
    featured_heroes = []
    for hero_name in banner["featured_heroes"]:
        hero = await db.heroes.find_one({"name": hero_name})
        if hero:
            featured_heroes.append(hero)
    
    for i in range(num_pulls):
        pity_count += 1
        
        # Check if guaranteed featured
        if pity_count >= banner["guaranteed_featured_pity"] and featured_heroes:
            pulled_hero = random.choice(featured_heroes)
            pulled_hero_name = pulled_hero.get("name") if isinstance(pulled_hero, dict) else pulled_hero.name
            pity_count = 0  # Reset pity
        else:
            # Normal pull with boosted rates for featured element
            if banner["banner_type"] == "divine":
                pool = [h for h in HERO_POOL if h.rarity == "UR+"]
            else:
                pool = [h for h in HERO_POOL if h.rarity in ["SR", "SSR", "UR"]]
            
            # Apply element boost
            weighted_pool = []
            for hero in pool:
                weight = banner["rate_boosts"].get(hero.element, 1.0)
                weighted_pool.extend([hero] * int(weight * 10))
            
            if weighted_pool:
                pulled_hero = random.choice(weighted_pool)
            else:
                pulled_hero = random.choice(pool) if pool else HERO_POOL[0]
            pulled_hero_name = pulled_hero.name if hasattr(pulled_hero, 'name') else pulled_hero.get("name", "Unknown")
        
        # Find in database
        hero_doc = await db.heroes.find_one({"name": pulled_hero_name})
        if hero_doc:
            # Add to user's collection
            existing = await db.user_heroes.find_one({
                "user_id": user["id"],
                "hero_id": hero_doc["id"]
            })
            
            if existing:
                await db.user_heroes.update_one(
                    {"id": existing["id"]},
                    {"$inc": {"duplicates": 1}}
                )
                results.append({
                    "hero": convert_objectid(hero_doc),
                    "is_new": False,
                    "duplicates": existing.get("duplicates", 0) + 1,
                    "is_featured": pulled_hero_name in banner["featured_heroes"]
                })
            else:
                new_hero = UserHero(
                    user_id=user["id"],
                    hero_id=hero_doc["id"],
                    current_hp=hero_doc["base_hp"],
                    current_atk=hero_doc["base_atk"],
                    current_def=hero_doc["base_def"]
                )
                await db.user_heroes.insert_one(new_hero.dict())
                results.append({
                    "hero": convert_objectid(hero_doc),
                    "is_new": True,
                    "duplicates": 0,
                    "is_featured": pulled_hero_name in banner["featured_heroes"]
                })
    
    # Deduct currency and update pity
    await db.users.update_one(
        {"username": username},
        {"$inc": {currency: -cost, "total_pulls": num_pulls}}
    )
    
    await db.event_pity.update_one(
        {"user_id": user["id"], "banner_id": banner_id},
        {"$set": {"pity_count": pity_count}},
        upsert=True
    )
    
    return {
        "results": results,
        "currency_spent": cost,
        "new_pity": pity_count,
        "pity_threshold": banner["guaranteed_featured_pity"]
    }

# ==================== STORY/CAMPAIGN MODE ====================

STORY_CHAPTERS = [
    {
        "chapter": 1,
        "name": "The Awakening",
        "stages": [
            {"stage": 1, "name": "Village Outskirts", "enemy_power": 500, "rewards": {"coins": 500, "gold": 200, "xp": 100}},
            {"stage": 2, "name": "Dark Forest", "enemy_power": 700, "rewards": {"coins": 600, "gold": 250, "xp": 120}},
            {"stage": 3, "name": "Goblin Camp", "enemy_power": 900, "rewards": {"coins": 700, "gold": 300, "xp": 150}},
            {"stage": 4, "name": "Ancient Ruins", "enemy_power": 1200, "rewards": {"coins": 800, "gold": 350, "xp": 180}},
            {"stage": 5, "name": "BOSS: Shadow Knight", "enemy_power": 1500, "is_boss": True, "rewards": {"coins": 1500, "gold": 500, "crystals": 50, "xp": 300}},
        ]
    },
    {
        "chapter": 2,
        "name": "Rising Darkness",
        "stages": [
            {"stage": 1, "name": "Haunted Valley", "enemy_power": 1800, "rewards": {"coins": 1000, "gold": 400, "xp": 200}},
            {"stage": 2, "name": "Cursed Swamp", "enemy_power": 2200, "rewards": {"coins": 1200, "gold": 450, "xp": 220}},
            {"stage": 3, "name": "Bandit Fortress", "enemy_power": 2600, "rewards": {"coins": 1400, "gold": 500, "xp": 250}},
            {"stage": 4, "name": "Dragon's Lair", "enemy_power": 3000, "rewards": {"coins": 1600, "gold": 550, "xp": 280}},
            {"stage": 5, "name": "BOSS: Dragon Lord", "enemy_power": 4000, "is_boss": True, "rewards": {"coins": 3000, "gold": 1000, "crystals": 100, "xp": 500}},
        ]
    },
    {
        "chapter": 3,
        "name": "Divine Conflict",
        "stages": [
            {"stage": 1, "name": "Sacred Temple", "enemy_power": 4500, "rewards": {"coins": 2000, "gold": 600, "xp": 300}},
            {"stage": 2, "name": "Angel's Path", "enemy_power": 5500, "rewards": {"coins": 2400, "gold": 700, "xp": 350}},
            {"stage": 3, "name": "Demon Gate", "enemy_power": 6500, "rewards": {"coins": 2800, "gold": 800, "xp": 400}},
            {"stage": 4, "name": "Celestial Bridge", "enemy_power": 7500, "rewards": {"coins": 3200, "gold": 900, "xp": 450}},
            {"stage": 5, "name": "BOSS: Fallen Archangel", "enemy_power": 10000, "is_boss": True, "rewards": {"coins": 5000, "gold": 2000, "crystals": 200, "divine_essence": 5, "xp": 800}},
        ]
    }
]

@api_router.get("/story/progress/{username}")
async def get_story_progress(username: str):
    """Get user's story/campaign progress"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    progress = await db.story_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "current_chapter": 1,
            "current_stage": 1,
            "completed_stages": [],
            "stars_earned": {}
        }
        await db.story_progress.insert_one(progress)
    
    # Build chapter data with unlocks
    chapters = []
    for chapter_data in STORY_CHAPTERS:
        chapter_num = chapter_data["chapter"]
        is_unlocked = chapter_num <= progress.get("current_chapter", 1) or \
                      any(f"{chapter_num-1}-5" in str(s) for s in progress.get("completed_stages", []))
        
        stages = []
        for stage in chapter_data["stages"]:
            stage_key = f"{chapter_num}-{stage['stage']}"
            stages.append({
                **stage,
                "completed": stage_key in [str(s) for s in progress.get("completed_stages", [])],
                "stars": progress.get("stars_earned", {}).get(stage_key, 0),
                "unlocked": is_unlocked and (stage["stage"] == 1 or 
                           f"{chapter_num}-{stage['stage']-1}" in [str(s) for s in progress.get("completed_stages", [])])
            })
        
        chapters.append({
            "chapter": chapter_num,
            "name": chapter_data["name"],
            "unlocked": is_unlocked,
            "stages": stages
        })
    
    return {
        "current_chapter": progress.get("current_chapter", 1),
        "current_stage": progress.get("current_stage", 1),
        "total_stars": sum(progress.get("stars_earned", {}).values()),
        "chapters": chapters
    }

@api_router.post("/story/battle/{username}/{chapter}/{stage}")
async def story_battle(username: str, chapter: int, stage: int):
    """Battle a story stage"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Find stage data
    chapter_data = next((c for c in STORY_CHAPTERS if c["chapter"] == chapter), None)
    if not chapter_data:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    stage_data = next((s for s in chapter_data["stages"] if s["stage"] == stage), None)
    if not stage_data:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    # Get user's team power
    team = await db.teams.find_one({"user_id": user["id"], "is_active": True})
    if not team:
        # Use top heroes
        user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(100)
        team_power = 0
        for uh in user_heroes[:6]:
            hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
            if hero_data:
                level_mult = 1 + (uh.get("level", 1) - 1) * 0.05
                team_power += (hero_data["base_hp"] + hero_data["base_atk"] * 3 + hero_data["base_def"] * 2) * level_mult
    else:
        team_power = team.get("team_power", 0)
    
    enemy_power = stage_data["enemy_power"]
    
    # Calculate battle result
    power_ratio = team_power / max(enemy_power, 1)
    base_win_chance = min(max(power_ratio * 0.5, 0.1), 0.95)
    
    victory = random.random() < base_win_chance
    
    # Calculate stars (3 = overwhelming, 2 = normal, 1 = barely won)
    stars = 0
    if victory:
        if power_ratio >= 1.5:
            stars = 3
        elif power_ratio >= 1.0:
            stars = 2
        else:
            stars = 1
    
    result = {
        "victory": victory,
        "team_power": int(team_power),
        "enemy_power": enemy_power,
        "stars": stars,
        "is_boss": stage_data.get("is_boss", False),
        "rewards": {}
    }
    
    if victory:
        # Grant rewards
        rewards = stage_data["rewards"]
        for reward_type, amount in rewards.items():
            if reward_type == "xp":
                # Add battle pass XP
                await db.battle_pass.update_one(
                    {"user_id": user["id"]},
                    {"$inc": {"xp": amount}},
                    upsert=True
                )
            else:
                await db.users.update_one(
                    {"username": username},
                    {"$inc": {reward_type: amount}}
                )
            result["rewards"][reward_type] = amount
        
        # Update progress
        stage_key = f"{chapter}-{stage}"
        progress = await db.story_progress.find_one({"user_id": user["id"]})
        current_stars = progress.get("stars_earned", {}).get(stage_key, 0) if progress else 0
        
        update = {
            "$addToSet": {"completed_stages": stage_key},
            "$set": {f"stars_earned.{stage_key}": max(stars, current_stars)}
        }
        
        # If completed chapter boss, unlock next chapter
        if stage == 5:
            update["$set"]["current_chapter"] = chapter + 1
            update["$set"]["current_stage"] = 1
        else:
            update["$set"]["current_stage"] = stage + 1
        
        await db.story_progress.update_one(
            {"user_id": user["id"]},
            update,
            upsert=True
        )
    
    return result

# ==================== CRIMSON ECLIPSE EVENT BANNER ====================

@api_router.get("/event/crimson-eclipse")
async def get_crimson_eclipse_banner():
    """Get the Crimson Eclipse limited-time banner details"""
    banner = get_active_event_banner()
    if not banner:
        return {"active": False, "message": "Event has ended"}
    
    return {
        "banner": banner,
        "featured_hero": CRIMSON_ECLIPSE_BANNER["featured_hero"],
        "rates": CRIMSON_ECLIPSE_BANNER["rates"],
        "milestones": EVENT_MILESTONES.get("crimson_eclipse_2026_01", []),
    }

@api_router.get("/event/crimson-eclipse/shop")
async def get_event_shop(username: str):
    """Get event shop items with user's purchase history"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get user's event purchases
    purchases = await db.event_purchases.find_one({"user_id": user["id"], "banner_id": "crimson_eclipse_2026_01"})
    purchased_items = purchases.get("items", {}) if purchases else {}
    
    # Get user's blood crystals
    blood_crystals = user.get("blood_crystals", 0)
    
    return {
        "blood_crystals": blood_crystals,
        "items": get_shop_items(purchased_items),
    }

@api_router.post("/event/crimson-eclipse/pull")
async def pull_crimson_eclipse(username: str, multi: bool = False):
    """Pull on the Crimson Eclipse banner (SERVER-AUTHORITATIVE)"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Check if banner is active
    banner = get_active_event_banner()
    if not banner:
        raise HTTPException(status_code=400, detail="Event banner is not active")
    
    # Determine cost
    cost = CRIMSON_ECLIPSE_BANNER["pull_cost"]["crystals_multi" if multi else "crystals_single"]
    num_pulls = 10 if multi else 1
    
    # Verify currency
    if user.get("crystals", 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough crystals. Need {cost}, have {user.get('crystals', 0)}")
    
    # Get user's pity
    pity_data = await db.event_pity.find_one({"user_id": user["id"], "banner_id": "crimson_eclipse_2026_01"})
    pity_counter = pity_data.get("pity_count", 0) if pity_data else 0
    total_pulls = pity_data.get("total_pulls", 0) if pity_data else 0
    
    # Perform pulls (SERVER-AUTHORITATIVE RNG)
    results = []
    blood_crystals_earned = 0
    
    for _ in range(num_pulls):
        result_type, result_data, new_pity, event_currency = perform_event_pull(pity_counter, "crimson_eclipse_2026_01")
        
        pity_counter = new_pity
        blood_crystals_earned += event_currency
        
        if result_type == "featured_ur":
            # Add Seraphina to user's heroes
            hero_data = CRIMSON_ECLIPSE_BANNER["featured_hero"]
            new_hero = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "hero_id": hero_data["id"],
                "name": hero_data["name"],
                "rarity": hero_data["rarity"],
                "level": 1,
                "rank": 1,
                "awakening_level": 0,
                "hero_data": hero_data,
                "obtained_at": datetime.utcnow().isoformat(),
                "obtained_from": "crimson_eclipse_banner",
            }
            await db.user_heroes.insert_one(new_hero)
            results.append({
                "type": "featured_ur",
                "hero": hero_data,
                "is_new": True,
                "message": "🎉 JACKPOT! Seraphina, Blood Queen!"
            })
        else:
            # Generate regular hero from pool
            rarity = result_data.get("rarity", "R")
            hero = await get_random_hero_from_db(pity_counter, "common")
            if hero:
                results.append({
                    "type": result_type,
                    "hero": hero,
                    "rarity": rarity,
                })
    
    # Bonus blood crystals for 10-pull
    if multi:
        blood_crystals_earned += CRIMSON_ECLIPSE_BANNER["event_currency"]["bonus_for_10x"]
    
    # Update user currencies
    await db.users.update_one(
        {"username": username},
        {
            "$inc": {
                "crystals": -cost,
                "blood_crystals": blood_crystals_earned,
            }
        }
    )
    
    # Update pity counter
    await db.event_pity.update_one(
        {"user_id": user["id"], "banner_id": "crimson_eclipse_2026_01"},
        {
            "$set": {"pity_count": pity_counter},
            "$inc": {"total_pulls": num_pulls}
        },
        upsert=True
    )
    
    # Check milestone rewards
    new_total_pulls = total_pulls + num_pulls
    available_milestones = get_milestone_rewards(new_total_pulls, pity_data.get("claimed_milestones", []) if pity_data else [])
    
    # Audit log
    await create_audit_log(
        db, user["id"], "event_pull", "crimson_eclipse", 
        "crimson_eclipse_2026_01",
        {"pulls": num_pulls, "cost": cost, "results": [r["type"] for r in results]}
    )
    
    return {
        "results": results,
        "crystals_spent": cost,
        "blood_crystals_earned": blood_crystals_earned,
        "new_pity": pity_counter,
        "total_pulls": new_total_pulls,
        "available_milestones": available_milestones,
    }

@api_router.post("/event/crimson-eclipse/claim-milestone")
async def claim_event_milestone(username: str, milestone_pulls: int):
    """Claim a milestone reward"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    pity_data = await db.event_pity.find_one({"user_id": user["id"], "banner_id": "crimson_eclipse_2026_01"})
    if not pity_data:
        raise HTTPException(status_code=400, detail="No pulls on this banner")
    
    total_pulls = pity_data.get("total_pulls", 0)
    claimed = pity_data.get("claimed_milestones", [])
    
    if milestone_pulls > total_pulls:
        raise HTTPException(status_code=400, detail="Milestone not reached")
    
    if milestone_pulls in claimed:
        raise HTTPException(status_code=400, detail="Milestone already claimed")
    
    # Find milestone
    milestones = EVENT_MILESTONES.get("crimson_eclipse_2026_01", [])
    milestone = next((m for m in milestones if m["pulls"] == milestone_pulls), None)
    
    if not milestone:
        raise HTTPException(status_code=400, detail="Invalid milestone")
    
    # Grant rewards
    rewards = milestone["rewards"]
    update_ops = {}
    for key, value in rewards.items():
        if key in ["crystals", "gold", "blood_crystals", "enhancement_stones", "skill_essence"]:
            update_ops[key] = value
    
    if update_ops:
        await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Mark as claimed
    await db.event_pity.update_one(
        {"user_id": user["id"], "banner_id": "crimson_eclipse_2026_01"},
        {"$push": {"claimed_milestones": milestone_pulls}}
    )
    
    return {"success": True, "rewards": rewards}

# ==================== PLAYER JOURNEY SYSTEM ====================

@api_router.get("/journey/{username}")
async def get_player_journey(username: str):
    """Get player's first 7-day journey progress"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Calculate account age
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    elif not created_at:
        created_at = datetime.utcnow()
    
    account_age = (datetime.utcnow() - created_at.replace(tzinfo=None)).days + 1
    current_day = min(account_age, 7)
    
    # Get claimed milestones
    journey_progress = await db.journey_progress.find_one({"user_id": user["id"]})
    claimed_milestones = journey_progress.get("claimed_milestones", []) if journey_progress else []
    claimed_login_days = journey_progress.get("claimed_login_days", []) if journey_progress else []
    
    # Build journey response
    days = {}
    for day in range(1, 8):
        day_config = FIRST_WEEK_JOURNEY.get(day, {})
        days[day] = {
            **day_config,
            "day": day,
            "is_unlocked": account_age >= day,
            "is_current": current_day == day,
            "login_claimed": day in claimed_login_days,
        }
    
    return {
        "account_age_days": account_age,
        "current_day": current_day,
        "days": days,
        "claimed_milestones": claimed_milestones,
        "total_journey_crystals": sum(d.get("total_milestone_crystals", 0) for d in FIRST_WEEK_JOURNEY.values()),
    }

@api_router.post("/journey/{username}/claim-login")
async def claim_login_reward(username: str, day: int):
    """Claim daily login reward for first 7 days"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Validate day
    if day < 1 or day > 7:
        raise HTTPException(status_code=400, detail="Invalid day")
    
    day_config = FIRST_WEEK_JOURNEY.get(day)
    if not day_config:
        raise HTTPException(status_code=400, detail="Day not configured")
    
    # Check account age
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    elif not created_at:
        created_at = datetime.utcnow()
    
    account_age = (datetime.utcnow() - created_at.replace(tzinfo=None)).days + 1
    
    if account_age < day:
        raise HTTPException(status_code=400, detail="Day not yet unlocked")
    
    # Check if already claimed
    progress = await db.journey_progress.find_one({"user_id": user["id"]})
    claimed_days = progress.get("claimed_login_days", []) if progress else []
    
    if day in claimed_days:
        raise HTTPException(status_code=400, detail="Already claimed")
    
    # Grant rewards
    rewards = day_config["login_reward"]
    update_ops = {}
    for key, value in rewards.items():
        if key in ["crystals", "gold", "coins", "stamina", "divine_essence", "skill_essence", 
                   "guild_coins", "arena_tickets", "blood_crystals"]:
            update_ops[key] = value
    
    if update_ops:
        await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Special Day 7 reward - SSR selector
    granted_hero = None
    if day == 7 and "guaranteed_ssr_selector" in rewards:
        # Grant a random SSR hero
        ssr_heroes = [h for h in HERO_POOL if h.rarity == "SSR"]
        if ssr_heroes:
            selected = random.choice(ssr_heroes)
            new_hero = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "hero_id": selected.id,
                "name": selected.name,
                "rarity": selected.rarity,
                "level": 1,
                "rank": 1,
                "hero_data": selected.dict(),
                "obtained_at": datetime.utcnow().isoformat(),
                "obtained_from": "day_7_reward",
            }
            await db.user_heroes.insert_one(new_hero)
            granted_hero = selected.name
    
    # Update progress
    await db.journey_progress.update_one(
        {"user_id": user["id"]},
        {"$push": {"claimed_login_days": day}},
        upsert=True
    )
    
    return {
        "success": True,
        "day": day,
        "rewards": rewards,
        "granted_hero": granted_hero,
    }

@api_router.get("/journey/{username}/beginner-missions")
async def get_beginner_missions(username: str):
    """Get beginner missions progress"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get claimed missions
    progress = await db.journey_progress.find_one({"user_id": user["id"]})
    claimed_missions = progress.get("claimed_beginner_missions", []) if progress else []
    
    # Categorize missions
    result = {
        "immediate": [],
        "early": [],
        "progress": [],
        "advanced": [],
        "mastery": [],
    }
    
    for mission in BEGINNER_MISSIONS:
        mission_data = {
            **mission,
            "claimed": mission["id"] in claimed_missions,
        }
        result[mission["category"]].append(mission_data)
    
    return {
        "missions": result,
        "total_claimed": len(claimed_missions),
        "total_missions": len(BEGINNER_MISSIONS),
    }

@api_router.get("/starter-packs")
async def get_starter_packs(username: str):
    """Get available starter packs for user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Calculate account age
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    elif not created_at:
        created_at = datetime.utcnow()
    
    account_age = (datetime.utcnow() - created_at.replace(tzinfo=None)).days + 1
    
    # Get purchased packs
    purchases = await db.user_purchases.find({"user_id": user["id"]}).to_list(100)
    purchased_packs = [p["pack_id"] for p in purchases]
    
    # Filter available packs
    available = []
    for pack_id, pack in STARTER_PACKS.items():
        if pack_id in purchased_packs:
            continue
        
        # Check availability window
        if pack.get("available_days") and account_age > pack["available_days"]:
            continue
        
        available.append({
            "id": pack_id,
            **pack,
            "days_remaining": max(0, pack.get("available_days", 30) - account_age) if pack.get("available_days") else None,
        })
    
    return {"packs": available}

# ============================================================================
# LAUNCH EXCLUSIVE BANNER SYSTEM
# ============================================================================

# Import launch banner module
from core.launch_banner import (
    EXCLUSIVE_HERO, LAUNCH_EXCLUSIVE_BANNER, LAUNCH_BUNDLES,
    FREE_LAUNCH_CURRENCY, TOTAL_FREE_PULLS_DAY1, PULLS_SHORT_OF_GUARANTEE,
    calculate_launch_banner_rate, perform_launch_banner_pull,
    get_bundle_triggers, check_banner_unlock, get_banner_time_remaining,
    calculate_pulls_from_bundle, get_monetization_summary, track_banner_interaction
)

@api_router.get("/launch-banner/status/{username}")
async def get_launch_banner_status(username: str):
    """Get launch exclusive banner status for a user"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get or create launch banner progress
    progress = await db.launch_banner_progress.find_one({"user_id": user["id"]})
    
    if not progress:
        # Initialize banner progress when user first views it
        progress = {
            "user_id": user["id"],
            "username": username,
            "pity_counter": 0,
            "total_pulls": 0,
            "has_featured_hero": False,
            "first_unlock_time": None,
            "purchased_bundles": [],
            "created_at": datetime.utcnow().isoformat(),
        }
        await db.launch_banner_progress.insert_one(progress)
    
    # Check unlock status (requires stage 2-10)
    user_progress = await db.user_progress.find_one({"user_id": user["id"]})
    completed_stages = user_progress.get("completed_chapters", []) if user_progress else []
    
    # For demo purposes, consider banner unlocked for all users
    is_unlocked = True  # In production: "2-10" in completed_stages
    
    # If unlocked and no first unlock time, set it now
    if is_unlocked and not progress.get("first_unlock_time"):
        first_unlock = datetime.utcnow()
        await db.launch_banner_progress.update_one(
            {"user_id": user["id"]},
            {"$set": {"first_unlock_time": first_unlock.isoformat()}}
        )
        progress["first_unlock_time"] = first_unlock.isoformat()
    
    # Calculate time remaining
    time_info = {"is_active": False, "expired": True}
    if progress.get("first_unlock_time"):
        unlock_time = progress["first_unlock_time"]
        if isinstance(unlock_time, str):
            unlock_time = datetime.fromisoformat(unlock_time.replace("Z", "+00:00")).replace(tzinfo=None)
        time_info = get_banner_time_remaining(unlock_time)
    
    # Calculate pity rate
    pity_counter = progress.get("pity_counter", 0)
    current_rate, rate_type = calculate_launch_banner_rate(pity_counter)
    
    # Get monetization summary
    monetization = get_monetization_summary(pity_counter)
    
    return {
        "banner": {
            "id": LAUNCH_EXCLUSIVE_BANNER["id"],
            "name": LAUNCH_EXCLUSIVE_BANNER["name"],
            "subtitle": LAUNCH_EXCLUSIVE_BANNER["subtitle"],
            "featured_hero": EXCLUSIVE_HERO,
            "rates": LAUNCH_EXCLUSIVE_BANNER["rates"],
            "pity": LAUNCH_EXCLUSIVE_BANNER["pity"],
            "pull_cost": LAUNCH_EXCLUSIVE_BANNER["pull_cost"],
        },
        "user_progress": {
            "pity_counter": pity_counter,
            "total_pulls": progress.get("total_pulls", 0),
            "has_featured_hero": progress.get("has_featured_hero", False),
            "purchased_bundles": progress.get("purchased_bundles", []),
        },
        "time_remaining": time_info,
        "is_unlocked": is_unlocked,
        "current_rate": {
            "featured_rate": round(current_rate * 100, 2),
            "rate_type": rate_type,
        },
        "monetization": monetization,
    }

@api_router.post("/launch-banner/pull/{username}")
async def pull_launch_banner(username: str, multi: bool = False):
    """Pull on the launch exclusive banner"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get progress
    progress = await db.launch_banner_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "username": username,
            "pity_counter": 0,
            "total_pulls": 0,
            "has_featured_hero": False,
            "first_unlock_time": datetime.utcnow().isoformat(),
            "purchased_bundles": [],
        }
        await db.launch_banner_progress.insert_one(progress)
    
    # Check time remaining
    if progress.get("first_unlock_time"):
        unlock_time = progress["first_unlock_time"]
        if isinstance(unlock_time, str):
            unlock_time = datetime.fromisoformat(unlock_time.replace("Z", "+00:00")).replace(tzinfo=None)
        time_info = get_banner_time_remaining(unlock_time)
        if time_info.get("expired"):
            raise HTTPException(status_code=400, detail="Banner has expired for your account")
    
    # Calculate cost
    num_pulls = 10 if multi else 1
    cost = LAUNCH_EXCLUSIVE_BANNER["pull_cost"]["crystals_multi" if multi else "crystals_single"]
    
    # Check currency
    user_crystals = user.get("gems", 0)  # gems = crystals in this game
    if user_crystals < cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient crystals. Need {cost}, have {user_crystals}"
        )
    
    # Deduct currency
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gems": -cost}}
    )
    
    # Perform pulls
    results = []
    pity_counter = progress.get("pity_counter", 0)
    got_featured = progress.get("has_featured_hero", False)
    
    for _ in range(num_pulls):
        result = perform_launch_banner_pull(pity_counter)
        results.append(result)
        pity_counter = result["new_pity"]
        
        if result.get("is_featured"):
            got_featured = True
            
            # Add hero to user's collection
            hero_data = result["hero"]
            new_hero = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "hero_id": hero_data["id"],
                "name": hero_data["name"],
                "rarity": hero_data["rarity"],
                "element": hero_data["element"],
                "hero_class": hero_data["hero_class"],
                "level": 1,
                "rank": 1,
                "duplicates": 0,
                "current_hp": hero_data["base_hp"],
                "current_atk": hero_data["base_atk"],
                "current_def": hero_data["base_def"],
                "hero_data": hero_data,
                "obtained_at": datetime.utcnow().isoformat(),
                "obtained_from": "launch_exclusive_banner",
            }
            await db.user_heroes.insert_one(new_hero)
    
    # Update progress
    total_pulls = progress.get("total_pulls", 0) + num_pulls
    await db.launch_banner_progress.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "pity_counter": pity_counter,
            "total_pulls": total_pulls,
            "has_featured_hero": got_featured,
            "last_pull_at": datetime.utcnow().isoformat(),
        }}
    )
    
    # Get triggered bundles after pull
    triggered_bundles = get_bundle_triggers(
        pity_counter, total_pulls, got_featured,
        progress.get("purchased_bundles", [])
    )
    
    return {
        "results": results,
        "cost": cost,
        "new_pity": pity_counter,
        "total_pulls": total_pulls,
        "has_featured_hero": got_featured,
        "triggered_bundles": triggered_bundles[:2],  # Show top 2 bundles
    }

@api_router.get("/launch-banner/bundles/{username}")
async def get_launch_bundles(username: str):
    """Get available bundles for the launch banner"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    progress = await db.launch_banner_progress.find_one({"user_id": user["id"]})
    if not progress:
        return {"bundles": list(LAUNCH_BUNDLES.values())}
    
    # Get triggered bundles
    bundles = get_bundle_triggers(
        progress.get("pity_counter", 0),
        progress.get("total_pulls", 0),
        progress.get("has_featured_hero", False),
        progress.get("purchased_bundles", [])
    )
    
    return {"bundles": bundles, "all_bundles": list(LAUNCH_BUNDLES.values())}

@api_router.post("/launch-banner/purchase-bundle/{username}")
async def purchase_launch_bundle(username: str, bundle_id: str):
    """Purchase a bundle (simulated - in production would use RevenueCat)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get bundle info
    bundle = LAUNCH_BUNDLES.get(bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # Get progress
    progress = await db.launch_banner_progress.find_one({"user_id": user["id"]})
    purchased_bundles = progress.get("purchased_bundles", []) if progress else []
    
    # Check limit
    purchase_count = purchased_bundles.count(bundle_id)
    if purchase_count >= bundle.get("limit_per_user", 1):
        raise HTTPException(status_code=400, detail="Bundle purchase limit reached")
    
    # Grant rewards (SIMULATED - in production, verify payment first)
    contents = bundle.get("contents", {})
    update_ops = {}
    
    if contents.get("summon_tickets"):
        # Convert tickets to direct pity progress or currency
        update_ops["launch_tickets"] = contents["summon_tickets"]
    if contents.get("crystals"):
        update_ops["gems"] = contents["crystals"]
    if contents.get("gold"):
        update_ops["gold"] = contents["gold"]
    if contents.get("enhancement_stones"):
        update_ops["enhancement_stones"] = contents["enhancement_stones"]
    if contents.get("skill_essence"):
        update_ops["skill_essence"] = contents["skill_essence"]
    
    if update_ops:
        await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Track purchase
    if progress:
        await db.launch_banner_progress.update_one(
            {"user_id": user["id"]},
            {"$push": {"purchased_bundles": bundle_id}}
        )
    
    # Track spending (for VIP)
    await db.users.update_one(
        {"username": username},
        {"$inc": {"total_spent": bundle["price_usd"]}}
    )
    
    return {
        "success": True,
        "bundle": bundle,
        "rewards_granted": contents,
        "message": f"Successfully purchased {bundle['name']}!"
    }

@api_router.get("/launch-banner/hero")
async def get_featured_hero():
    """Get the featured hero details for the launch banner"""
    return {
        "hero": EXCLUSIVE_HERO,
        "banner": {
            "name": LAUNCH_EXCLUSIVE_BANNER["name"],
            "subtitle": LAUNCH_EXCLUSIVE_BANNER["subtitle"],
            "duration_hours": LAUNCH_EXCLUSIVE_BANNER["duration_hours"],
        }
    }

# ============================================================================
# CHRONO-ARCHANGEL SELENE MONETIZATION SYSTEM
# ============================================================================

from core.selene_monetization import (
    CHAR_SELENE_SSR, BANNER_LIMITED_SELENE, INITIAL_PLAYER_RESOURCES,
    DYNAMIC_BUNDLES, PLAYER_JOURNEY_EVENT,
    calculate_selene_banner_rate, perform_selene_banner_pull,
    get_triggered_bundles as get_selene_bundles,
    get_selene_banner_time_remaining, calculate_monetization_metrics,
    calculate_gap_to_guarantee, simulate_player_journey
)

@api_router.get("/selene-banner/status/{username}")
async def get_selene_banner_status(username: str):
    """Get Selene banner status - triggers after Stage 2-10"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    # Get or create banner progress
    progress = await db.selene_banner_progress.find_one({"user_id": user["id"]})
    
    if not progress:
        progress = {
            "user_id": user["id"],
            "username": username,
            "pity_counter": 0,
            "total_pulls": 0,
            "has_selene": False,
            "unlock_timestamp": None,
            "purchased_bundles": [],
            "total_spent_usd": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
        await db.selene_banner_progress.insert_one(progress)
    
    # Check if unlocked (Stage 2-10 cleared or auto-unlock for testing)
    stage_progress = await db.stage_progress.find_one({"user_id": user["id"]})
    is_unlocked = True  # For testing - in production: check stage_progress for "2-10"
    
    # Set unlock time if first unlock
    if is_unlocked and not progress.get("unlock_timestamp"):
        unlock_time = datetime.utcnow()
        await db.selene_banner_progress.update_one(
            {"user_id": user["id"]},
            {"$set": {"unlock_timestamp": unlock_time.isoformat()}}
        )
        progress["unlock_timestamp"] = unlock_time.isoformat()
    
    # Calculate time remaining
    time_info = {"is_active": False, "expired": True, "urgency_level": "EXPIRED"}
    if progress.get("unlock_timestamp"):
        unlock_time = progress["unlock_timestamp"]
        if isinstance(unlock_time, str):
            unlock_time = datetime.fromisoformat(unlock_time.replace("Z", "+00:00")).replace(tzinfo=None)
        time_info = get_selene_banner_time_remaining(unlock_time)
    
    # Calculate current rate
    pity_counter = progress.get("pity_counter", 0)
    current_rate, rate_type = calculate_selene_banner_rate(pity_counter)
    
    # Get monetization metrics
    metrics = calculate_monetization_metrics(
        pity_counter,
        progress.get("total_pulls", 0),
        progress.get("has_selene", False),
        progress.get("total_spent_usd", 0)
    )
    
    # Get triggered bundles
    bundles = get_selene_bundles(
        pity_counter,
        progress.get("total_pulls", 0),
        progress.get("has_selene", False),
        progress.get("purchased_bundles", [])
    )
    
    return {
        "banner": {
            "id": BANNER_LIMITED_SELENE["banner_id"],
            "name": BANNER_LIMITED_SELENE["name"],
            "subtitle": BANNER_LIMITED_SELENE["subtitle"],
            "duration_hours": BANNER_LIMITED_SELENE["duration_hours"],
            "featured_character": CHAR_SELENE_SSR,
            "rates": {
                "base_ssr": BANNER_LIMITED_SELENE["base_SSR_rate"] * 100,
                "featured": BANNER_LIMITED_SELENE["base_SSR_rate"] * BANNER_LIMITED_SELENE["featured_rate_share"] * 100,
            },
            "pity": {
                "soft_start": BANNER_LIMITED_SELENE["soft_pity_start"],
                "hard_max": BANNER_LIMITED_SELENE["pity_counter_max"],
            },
        },
        "user_progress": {
            "pity_counter": pity_counter,
            "total_pulls": progress.get("total_pulls", 0),
            "has_selene": progress.get("has_selene", False),
            "purchased_bundles": progress.get("purchased_bundles", []),
        },
        "time_remaining": time_info,
        "is_unlocked": is_unlocked,
        "current_rate": {
            "featured_rate": round(current_rate * 100, 2),
            "rate_type": rate_type,
        },
        "monetization": metrics,
        "triggered_bundles": bundles[:2],
        "journey_event": PLAYER_JOURNEY_EVENT,
    }

@api_router.post("/selene-banner/pull/{username}")
async def pull_selene_banner(username: str, multi: bool = False):
    """Pull on the Selene banner with soft/hard pity"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    # Get progress
    progress = await db.selene_banner_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "pity_counter": 0,
            "total_pulls": 0,
            "has_selene": False,
            "unlock_timestamp": datetime.utcnow().isoformat(),
            "purchased_bundles": [],
        }
        await db.selene_banner_progress.insert_one(progress)
    
    # Check time
    if progress.get("unlock_timestamp"):
        unlock_time = progress["unlock_timestamp"]
        if isinstance(unlock_time, str):
            unlock_time = datetime.fromisoformat(unlock_time.replace("Z", "+00:00")).replace(tzinfo=None)
        time_info = get_selene_banner_time_remaining(unlock_time)
        if time_info.get("expired"):
            raise HTTPException(status_code=400, detail="Banner has expired!")
    
    # Calculate cost
    num_pulls = 10 if multi else 1
    cost = BANNER_LIMITED_SELENE["multi_pull_cost" if multi else "single_pull_cost"]
    
    # Check currency (gems = premium_currency)
    if user.get("gems", 0) < cost:
        raise HTTPException(status_code=400, detail=f"Need {cost} crystals, have {user.get('gems', 0)}")
    
    # Deduct currency
    await db.users.update_one({"username": username}, {"$inc": {"gems": -cost}})
    
    # Perform pulls
    results = []
    pity = progress.get("pity_counter", 0)
    got_selene = progress.get("has_selene", False)
    
    for _ in range(num_pulls):
        result = perform_selene_banner_pull(pity, got_selene)
        results.append(result)
        pity = result["new_pity"]
        
        if result["is_featured"]:
            got_selene = True
            # Add Selene to user's heroes
            selene_hero = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "hero_id": CHAR_SELENE_SSR["id"],
                "name": CHAR_SELENE_SSR["name"],
                "rarity": CHAR_SELENE_SSR["rarity"],
                "element": CHAR_SELENE_SSR["element"],
                "hero_class": CHAR_SELENE_SSR["hero_class"],
                "level": 1,
                "rank": 1,
                "duplicates": 0,
                "current_hp": CHAR_SELENE_SSR["base_hp"],
                "current_atk": CHAR_SELENE_SSR["base_atk"],
                "current_def": CHAR_SELENE_SSR["base_def"],
                "hero_data": CHAR_SELENE_SSR,
                "obtained_at": datetime.utcnow().isoformat(),
                "obtained_from": "banner_limited_selene",
            }
            await db.user_heroes.insert_one(selene_hero)
        
        # Log pull for analytics
        await db.player_gacha_log.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "banner_id": BANNER_LIMITED_SELENE["banner_id"],
            "pity_counter": pity,
            "pull_result": result["rarity"],
            "is_featured": result["is_featured"],
            "character_id": CHAR_SELENE_SSR["id"] if result["is_featured"] else None,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    # Update progress
    total_pulls = progress.get("total_pulls", 0) + num_pulls
    await db.selene_banner_progress.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "pity_counter": pity,
            "total_pulls": total_pulls,
            "has_selene": got_selene,
            "last_pull_at": datetime.utcnow().isoformat(),
        }}
    )
    
    # Get triggered bundles
    bundles = get_selene_bundles(pity, total_pulls, got_selene, progress.get("purchased_bundles", []))
    
    return {
        "results": results,
        "cost": cost,
        "new_pity": pity,
        "total_pulls": total_pulls,
        "has_selene": got_selene,
        "triggered_bundles": bundles[:2],
        "gap_to_guarantee": calculate_gap_to_guarantee(total_pulls, pity),
    }

@api_router.get("/selene-banner/bundles/{username}")
async def get_selene_bundles_endpoint(username: str):
    """Get available bundles based on player state"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    progress = await db.selene_banner_progress.find_one({"user_id": user["id"]})
    if not progress:
        return {"bundles": list(DYNAMIC_BUNDLES.values())}
    
    bundles = get_selene_bundles(
        progress.get("pity_counter", 0),
        progress.get("total_pulls", 0),
        progress.get("has_selene", False),
        progress.get("purchased_bundles", [])
    )
    
    return {
        "triggered_bundles": bundles,
        "all_bundles": list(DYNAMIC_BUNDLES.values()),
        "monetization": calculate_monetization_metrics(
            progress.get("pity_counter", 0),
            progress.get("total_pulls", 0),
            progress.get("has_selene", False),
        ),
    }

@api_router.post("/selene-banner/purchase-bundle/{username}")
async def purchase_selene_bundle(username: str, bundle_id: str):
    """Purchase a bundle (simulated - integrates with RevenueCat in production)"""
    # DEV-ONLY: Simulated purchases blocked in production
    require_dev_mode()
    
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    bundle = DYNAMIC_BUNDLES.get(bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    progress = await db.selene_banner_progress.find_one({"user_id": user["id"]})
    purchased = progress.get("purchased_bundles", []) if progress else []
    
    if purchased.count(bundle_id) >= bundle["limit_per_user"]:
        raise HTTPException(status_code=400, detail="Bundle purchase limit reached")
    
    # Grant rewards (SIMULATED - verify payment in production)
    contents = bundle["contents"]
    update_ops = {}
    if contents.get("summon_scrolls"):
        update_ops["summon_scrolls"] = contents["summon_scrolls"]
    if contents.get("premium_currency"):
        update_ops["gems"] = contents["premium_currency"]
    if contents.get("gold"):
        update_ops["gold"] = contents["gold"]
    if contents.get("enhancement_stones"):
        update_ops["enhancement_stones"] = contents["enhancement_stones"]
    
    if update_ops:
        await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Track purchase
    await db.selene_banner_progress.update_one(
        {"user_id": user["id"]},
        {
            "$push": {"purchased_bundles": bundle_id},
            "$inc": {"total_spent_usd": bundle["price_usd"]}
        }
    )
    
    return {
        "success": True,
        "bundle": bundle,
        "rewards_granted": contents,
        "message": f"Purchased {bundle['name']}!",
    }

@api_router.get("/selene-banner/character")
async def get_selene_character():
    """Get Selene character details"""
    return {
        "character": CHAR_SELENE_SSR,
        "banner": {
            "name": BANNER_LIMITED_SELENE["name"],
            "duration_hours": BANNER_LIMITED_SELENE["duration_hours"],
        },
        "journey_event": PLAYER_JOURNEY_EVENT,
    }

@api_router.get("/selene-banner/simulate")
async def simulate_monetization():
    """Run monetization simulation (10,000 players)"""
    results = simulate_player_journey(10000)
    return {
        "simulation_results": results,
        "target_validation": {
            "conversion_target": "≥15%",
            "arppu_target": "≥$35",
            "conversion_achieved": results["conversion_rate_percent"],
            "arppu_achieved": results["arppu"],
            "targets_met": results["targets_met"],
        }
    }

# ============================================================================
# OLD ADMIN SYSTEM - DISABLED (Security vulnerability)
# ============================================================================
# The following endpoints have been REMOVED due to security issues:
# - verify_admin_token: Used different JWT secret, could be random per restart
# - require_permission: Relied on is_admin flag only, not ADAM-specific
# - /admin/grant-resources: Replaced by /admin/user/set-currencies
# - /admin/set-vip: Replaced by /admin/user/set-vip
# - /admin/ban-user: Replaced by /admin/chat/ban
# - /admin/mute-user: Replaced by /admin/chat/mute
# - /admin/delete-account: Security risk, use /admin/user/reset instead
#
# ALL admin functionality is now in require_super_admin() which:
# - Uses single JWT SECRET_KEY
# - Requires username_canon == "adam" (case-insensitive, canonical)
# - Full audit logging
# ============================================================================

# Legacy endpoints return 410 Gone with redirect info
@api_router.post("/admin/grant-resources/{username}")
async def legacy_grant_resources(username: str):
    """DISABLED: Use POST /admin/user/set-currencies instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint has been removed. Use POST /admin/user/set-currencies with JWT auth."
    )

@api_router.post("/admin/set-vip/{username}")
async def legacy_set_vip(username: str):
    """DISABLED: Use POST /admin/user/set-vip instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint has been removed. Use POST /admin/user/set-vip with JWT auth."
    )

@api_router.post("/admin/ban-user/{username}")
async def legacy_ban_user(username: str):
    """DISABLED: Use POST /admin/chat/ban instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint has been removed. Use POST /admin/chat/ban with JWT auth."
    )

@api_router.post("/admin/mute-user/{username}")
async def legacy_mute_user(username: str):
    """DISABLED: Use POST /admin/chat/mute instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint has been removed. Use POST /admin/chat/mute with JWT auth."
    )

@api_router.delete("/admin/delete-account/{username}")
async def legacy_delete_account(username: str):
    """DISABLED: Use POST /admin/user/reset with scope='all' instead"""
    raise HTTPException(
        status_code=410, 
        detail="This endpoint has been removed. Use POST /admin/user/reset with scope='all' and JWT auth."
    )

# ============================================================================
# CAMPAIGN SYSTEM
# ============================================================================

from core.campaign import (
    CHAPTER_DATA, generate_stage_data, generate_stage_rewards,
    CHAPTER_DIALOGUES, CHAPTER_UNLOCKS, TUTORIAL_STAGES,
    calculate_stage_difficulty
)

@api_router.get("/campaign/chapters")
async def get_campaign_chapters(username: str):
    """Get all campaign chapters with unlock status"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    completed_chapters = progress.get("completed_chapters", []) if progress else []
    current_chapter = progress.get("current_chapter", 1) if progress else 1
    stage_progress = progress.get("stage_progress", {}) if progress else {}
    player_level = user.get("level", 1)
    
    chapters = []
    for ch_id, ch_data in CHAPTER_DATA.items():
        unlock_req = ch_data["unlock_requirements"]
        prev_chapter = unlock_req.get("previous_chapter")
        req_level = unlock_req.get("player_level", 1)
        
        is_unlocked = (prev_chapter is None or prev_chapter in completed_chapters) and player_level >= req_level
        is_completed = ch_id in completed_chapters
        
        # Count cleared stages for this chapter
        cleared_count = 0
        for stage_num in range(1, 22):
            stage_id = f"{ch_id}-{stage_num}"
            if stage_progress.get(stage_id, {}).get("cleared", False):
                cleared_count += 1
        
        chapters.append({
            "id": ch_id,
            "title": ch_data["title"],
            "subtitle": ch_data["subtitle"],
            "act": ch_data["act"],
            "act_name": ch_data["act_name"],
            "summary": ch_data["summary"],
            "is_unlocked": is_unlocked,
            "is_completed": is_completed,
            "is_current": ch_id == current_chapter,
            "unlock_requirements": unlock_req,
            "recommended_power": ch_data["recommended_power"],
            "theme_color": ch_data["theme_color"],
            "completion_unlock": ch_data.get("completion_unlock"),
            "total_stages": 21,  # 20 + boss
            "progress": {
                "cleared": cleared_count,
                "total": 21,
            },
        })
    
    return {
        "chapters": chapters,
        "current_chapter": current_chapter,
        "player_level": player_level,
        "completed_count": len(completed_chapters),
    }

@api_router.get("/campaign/chapter/{chapter_id}")
async def get_campaign_chapter(chapter_id: int, username: str):
    """Get detailed chapter data with all stages"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    if chapter_id not in CHAPTER_DATA:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    chapter = CHAPTER_DATA[chapter_id]
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    
    stage_progress = progress.get("stage_progress", {}) if progress else {}
    
    stages = []
    for stage_num in range(1, 22):  # 1-20 + boss (21)
        stage_data = generate_stage_data(chapter_id, stage_num)
        stage_id = f"{chapter_id}-{stage_num}"
        
        stage_info = stage_progress.get(stage_id, {})
        is_cleared = stage_info.get("cleared", False)
        
        # Determine if stage is unlocked
        # Stage 1 of chapter 1 is always unlocked, others require previous stage cleared
        if stage_num == 1:
            # First stage - unlocked if chapter is unlocked (handled by frontend)
            is_unlocked = True
        else:
            prev_stage_id = f"{chapter_id}-{stage_num - 1}"
            prev_stage_info = stage_progress.get(prev_stage_id, {})
            is_unlocked = prev_stage_info.get("cleared", False)
        
        stages.append({
            **stage_data,
            "is_cleared": is_cleared,
            "is_unlocked": is_unlocked,
            "stars": stage_info.get("stars", 0),
            "best_time": stage_info.get("best_time"),
            "clear_count": stage_info.get("clear_count", 0),
        })
    
    # Get dialogues
    dialogues = CHAPTER_DIALOGUES.get(chapter_id, {})
    
    return {
        "chapter": {
            "id": chapter_id,
            "title": chapter["title"],
            "subtitle": chapter["subtitle"],
            "summary": chapter["summary"],
            "story_heroes": chapter.get("story_heroes_introduced", []),
            "mechanics_introduced": chapter.get("mechanics_introduced", []),
            "boss": chapter.get("boss"),
            "special_stage": chapter.get("special_stage"),
            "branching_choice": chapter.get("branching_choice"),
        },
        "stages": stages,
        "dialogues": dialogues,
        "unlocks": CHAPTER_UNLOCKS.get(chapter_id, []),
    }

@api_router.get("/campaign/stage/{chapter_id}/{stage_num}")
async def get_campaign_stage(chapter_id: int, stage_num: int, username: str):
    """Get specific stage data with enemies and rewards"""
    user = await get_user_readonly(username)  # Includes frozen check
    
    stage_data = generate_stage_data(chapter_id, stage_num)
    if not stage_data:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    # Check for tutorial
    stage_id = f"{chapter_id}-{stage_num}"
    tutorial = TUTORIAL_STAGES.get(stage_id)
    
    # Get user's progress on this stage
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    stage_progress = {}
    if progress:
        stage_progress = progress.get("stage_progress", {}).get(stage_id, {})
    
    return {
        "stage": stage_data,
        "tutorial": tutorial,
        "user_progress": stage_progress,
        "difficulty": calculate_stage_difficulty(chapter_id, stage_num),
    }

@api_router.post("/campaign/stage/{chapter_id}/{stage_num}/complete")
async def complete_campaign_stage(
    chapter_id: int,
    stage_num: int,
    username: str,
    stars: int = 3,
    time_seconds: int = 60
):
    """Mark a stage as completed and grant rewards"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    stage_data = generate_stage_data(chapter_id, stage_num)
    if not stage_data:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    stage_id = f"{chapter_id}-{stage_num}"
    
    # Get or create campaign progress
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        progress = {
            "user_id": user["id"],
            "current_chapter": 1,
            "completed_chapters": [],
            "stage_progress": {},
            "total_stars": 0,
        }
        await db.campaign_progress.insert_one(progress)
    
    stage_progress = progress.get("stage_progress", {}).get(stage_id, {})
    is_first_clear = not stage_progress.get("cleared", False)
    prev_stars = stage_progress.get("stars", 0)
    
    # Calculate rewards
    rewards = {}
    if is_first_clear:
        rewards.update(stage_data["first_clear_rewards"])
    
    if stars == 3 and prev_stars < 3:
        rewards.update(stage_data["three_star_bonus"])
    
    # Grant rewards
    if rewards:
        update_ops = {}
        for key, value in rewards.items():
            if isinstance(value, (int, float)) and key in ["gold", "gems", "coins", "hero_exp", "enhancement_stones"]:
                update_ops[key] = value
        if update_ops:
            await db.users.update_one({"username": username}, {"$inc": update_ops})
    
    # Update stage progress
    new_stage_progress = {
        "cleared": True,
        "stars": max(stars, prev_stars),
        "best_time": min(time_seconds, stage_progress.get("best_time", 99999)),
        "clear_count": stage_progress.get("clear_count", 0) + 1,
        "last_cleared": datetime.utcnow().isoformat(),
    }
    
    star_diff = max(0, stars - prev_stars)
    
    # Check if chapter is now complete
    is_chapter_complete = stage_num == 21  # Boss stage
    chapter_unlock = None
    
    update_data = {
        f"stage_progress.{stage_id}": new_stage_progress,
    }
    
    if star_diff > 0:
        update_data["total_stars"] = progress.get("total_stars", 0) + star_diff
    
    if is_chapter_complete and chapter_id not in progress.get("completed_chapters", []):
        update_data["completed_chapters"] = progress.get("completed_chapters", []) + [chapter_id]
        update_data["current_chapter"] = chapter_id + 1
        chapter_unlock = CHAPTER_DATA.get(chapter_id, {}).get("completion_unlock")
        
        # Update user's campaign chapter for idle caps
        await db.stage_progress.update_one(
            {"user_id": user["id"]},
            {"$set": {"campaign_chapter": chapter_id}},
            upsert=True
        )
    
    await db.campaign_progress.update_one(
        {"user_id": user["id"]},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "stage_id": stage_id,
        "is_first_clear": is_first_clear,
        "stars": stars,
        "rewards": rewards,
        "is_chapter_complete": is_chapter_complete,
        "chapter_unlock": chapter_unlock,
        "star_diff": star_diff,
    }

@api_router.post("/campaign/stage/{chapter_id}/{stage_num}/sweep")
async def sweep_campaign_stage(chapter_id: int, stage_num: int, username: str, count: int = 1):
    """Sweep (auto-complete) a previously 3-starred stage"""
    user = await get_user_for_mutation(username)  # Includes frozen check
    
    progress = await db.campaign_progress.find_one({"user_id": user["id"]})
    if not progress:
        raise HTTPException(status_code=400, detail="No campaign progress")
    
    stage_id = f"{chapter_id}-{stage_num}"
    stage_progress = progress.get("stage_progress", {}).get(stage_id, {})
    
    if stage_progress.get("stars", 0) < 3:
        raise HTTPException(status_code=400, detail="Stage must be 3-starred to sweep")
    
    stage_data = generate_stage_data(chapter_id, stage_num)
    stamina_cost = stage_data["stamina_cost"] * count
    
    if user.get("stamina", 0) < stamina_cost:
        raise HTTPException(status_code=400, detail=f"Need {stamina_cost} stamina")
    
    # Deduct stamina and grant sweep rewards
    sweep_rewards = stage_data["sweep_rewards"]
    rewards = {
        "gold": int(sweep_rewards["gold"] * count),
        "hero_exp": int(sweep_rewards["hero_exp"] * count),
    }
    
    await db.users.update_one(
        {"username": username},
        {"$inc": {"stamina": -stamina_cost, **rewards}}
    )
    
    # Update clear count
    await db.campaign_progress.update_one(
        {"user_id": user["id"]},
        {"$inc": {f"stage_progress.{stage_id}.clear_count": count}}
    )
    
    return {
        "success": True,
        "sweep_count": count,
        "stamina_spent": stamina_cost,
        "rewards": rewards,
    }

# Include the router in the main app
app.include_router(api_router)

# Include modular routers
app.include_router(equipment_router.router, prefix="/api")
app.include_router(economy_router.router, prefix="/api")
app.include_router(stages_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")
app.include_router(campaign_router.router, prefix="/api")
app.include_router(battle_router.router, prefix="/api")
app.include_router(gacha_router.router, prefix="/api")
app.include_router(auth_router.router)
app.include_router(guild_router.router)
app.include_router(hero_progression_router.router)

# Set database references for modular routers
admin_router.set_database(db)
campaign_router.set_database(db)
battle_router.set_database(db)
gacha_router.set_database(db)
auth_router.set_database(db)
guild_router.set_database(db)
hero_progression_router.set_database(db)

# CORS Configuration - Restrict origins in production
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
# Add default development origins
DEV_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8081",
    "https://app.emergent.sh",
    "exp://",  # Expo Go
]
CORS_ORIGINS = ALLOWED_ORIGINS if ALLOWED_ORIGINS else DEV_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.emergent\.sh$|exp://.*",  # Allow Expo and Emergent subdomains
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ═══════════════════════════════════════════════════════════════════════════
# ENTITLEMENTS SYSTEM
# Server-authoritative entitlement state
# ═══════════════════════════════════════════════════════════════════════════

# Entitlement keys (must match frontend)
ENTITLEMENT_KEYS = {
    "PREMIUM": "PREMIUM",
    "PREMIUM_CINEMATICS_PACK": "PREMIUM_CINEMATICS_PACK", 
    "NO_ADS": "NO_ADS",
    "STARTER_PACK": "STARTER_PACK",
}

class EntitlementStatus(str, Enum):
    owned = "owned"
    not_owned = "not_owned"
    expired = "expired"
    pending = "pending"
    revoked = "revoked"

class ServerEntitlement(BaseModel):
    key: str
    status: EntitlementStatus
    granted_at: Optional[str] = None
    expires_at: Optional[str] = None
    transaction_id: Optional[str] = None
    product_id: Optional[str] = None
    reason: Optional[str] = None

class EntitlementsSnapshot(BaseModel):
    server_time: str
    version: int
    username: str
    entitlements: Dict[str, ServerEntitlement]
    ttl_seconds: Optional[int] = 300
    source: Optional[str] = "database"


# ═══════════════════════════════════════════════════════════════════════════
# SERVER-SIDE ENTITLEMENT GATING
# Use these helpers to enforce entitlements on premium endpoints
# ═══════════════════════════════════════════════════════════════════════════

def require_dev_mode():
    """
    Block endpoint in production. Use for simulated purchase endpoints.
    Raises 403 if SERVER_DEV_MODE is false.
    """
    if not SERVER_DEV_MODE:
        raise HTTPException(
            status_code=403,
            detail="Simulated purchases disabled in production. Set SERVER_DEV_MODE=true for development."
        )


import re
_VALID_HERO_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')
_MAX_ENTITLEMENT_KEY_LENGTH = 128

def validate_entitlement_key(key: str) -> str:
    """
    Validate and sanitize entitlement key.
    Raises 400 if key is invalid.
    Returns the validated key.
    """
    if not key or len(key) > _MAX_ENTITLEMENT_KEY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entitlement key length (max {_MAX_ENTITLEMENT_KEY_LENGTH})"
        )
    
    # For hero-specific keys, validate hero_id portion
    if key.startswith("PREMIUM_CINEMATIC_OWNED:"):
        hero_id = key[len("PREMIUM_CINEMATIC_OWNED:"):]
        if not _VALID_HERO_ID_PATTERN.match(hero_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid hero_id in entitlement key (alphanumeric, underscore, hyphen only)"
            )
    
    return key


async def require_entitlement(username: str, entitlement_key: str) -> bool:
    """
    Check if user has an active entitlement. Raises 403 if not.
    Use this as a guard on premium endpoints.
    
    Example:
        await require_entitlement(current_user["username"], "PREMIUM_CINEMATICS_PACK")
    """
    # Validate key format
    validate_entitlement_key(entitlement_key)
    
    user_doc = await get_user_readonly(username)
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    user_entitlements = user_doc.get("entitlements", {})
    
    # Check direct entitlement key
    ent = user_entitlements.get(entitlement_key)
    if not ent:
        raise HTTPException(
            status_code=403,
            detail=f"Entitlement required: {entitlement_key}"
        )
    
    if ent.get("status") != "owned":
        raise HTTPException(
            status_code=403,
            detail=f"Entitlement not active: {entitlement_key}"
        )
    
    # Check expiry
    expires_at = ent.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=403,
                    detail=f"Entitlement expired: {entitlement_key}"
                )
        except ValueError:
            pass  # Invalid date format, assume not expired
    
    return True


async def has_entitlement(username: str, entitlement_key: str) -> bool:
    """
    Check if user has an active entitlement. Returns bool (no exception).
    Use for conditional logic, not access control.
    """
    try:
        await require_entitlement(username, entitlement_key)
        return True
    except HTTPException:
        return False


async def require_cinematic_access(username: str, hero_id: str) -> bool:
    """
    Check if user can access a hero's premium cinematic.
    User needs either:
    - PREMIUM_CINEMATICS_PACK (full pack)
    - PREMIUM_CINEMATIC_OWNED:{hero_id} (individual purchase)
    
    Raises 403 if not entitled.
    """
    user_doc = await get_user_readonly(username)
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    user_entitlements = user_doc.get("entitlements", {})
    
    # Check for full pack
    pack_ent = user_entitlements.get("PREMIUM_CINEMATICS_PACK")
    if pack_ent and pack_ent.get("status") == "owned":
        # Check expiry
        expires_at = pack_ent.get("expires_at")
        if not expires_at:
            return True
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt >= datetime.now(timezone.utc):
                return True
        except ValueError:
            return True  # Invalid date, assume valid
    
    # Check for individual hero cinematic
    hero_key = f"PREMIUM_CINEMATIC_OWNED:{hero_id}"
    hero_ent = user_entitlements.get(hero_key)
    if hero_ent and hero_ent.get("status") == "owned":
        # Check expiry
        expires_at = hero_ent.get("expires_at")
        if not expires_at:
            return True
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt >= datetime.now(timezone.utc):
                return True
        except ValueError:
            return True
    
    raise HTTPException(
        status_code=403,
        detail=f"Premium cinematic access required for hero: {hero_id}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# PREMIUM CONTENT ENDPOINTS (Server-gated)
# These demonstrate the 403 enforcement pattern
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/hero/{hero_id}/cinematic/access")
async def check_cinematic_access(hero_id: str, current_user: dict = Depends(get_current_user)):
    """
    Check if user can access hero's premium cinematic.
    Returns 200 if entitled, 403 if not.
    
    Use this before streaming/downloading cinematic content.
    """
    # Validate hero_id format to prevent key pollution
    if not _VALID_HERO_ID_PATTERN.match(hero_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid hero_id format (alphanumeric, underscore, hyphen only, max 64 chars)"
        )
    
    await require_cinematic_access(current_user["username"], hero_id)
    return {"access": True, "hero_id": hero_id}


@app.get("/api/hero/{hero_id}/cinematic/url")
async def get_cinematic_url(hero_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get the cinematic video URL for a hero.
    Server-gated: returns 403 if user doesn't own the cinematic.
    
    In production, this would return a signed/time-limited URL.
    """
    # Validate hero_id format to prevent key pollution
    if not _VALID_HERO_ID_PATTERN.match(hero_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid hero_id format (alphanumeric, underscore, hyphen only, max 64 chars)"
        )
    
    # ENFORCE: User must have cinematic access
    await require_cinematic_access(current_user["username"], hero_id)
    
    # Return the video URL (in production, this would be a signed URL)
    # For now, return the static asset path
    return {
        "hero_id": hero_id,
        "video_url": f"/assets/videos/hero_5plus/{hero_id}_cinematic.mp4",
        "expires_in": 3600,  # URL valid for 1 hour (if using signed URLs)
    }


@app.get("/api/entitlements/snapshot")
async def get_entitlements_snapshot(current_user: dict = Depends(get_current_user)):
    """
    Get server-authoritative entitlements snapshot for authenticated user.
    Client should cache this but revalidate on startup and post-purchase.
    """
    user_doc = await get_user_readonly(current_user["username"])
    
    # Build entitlements map from user document
    user_entitlements = user_doc.get("entitlements", {})
    
    # Create snapshot with all known keys
    entitlements_map = {}
    
    # Fill all known keys (not_owned if not in user data)
    for key in ENTITLEMENT_KEYS.values():
        if key in user_entitlements:
            ent_data = user_entitlements[key]
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=EntitlementStatus(ent_data.get("status", "owned")),
                granted_at=ent_data.get("granted_at"),
                expires_at=ent_data.get("expires_at"),
                transaction_id=ent_data.get("transaction_id"),
                product_id=ent_data.get("product_id"),
                reason=ent_data.get("reason", "purchase"),
            )
        else:
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=EntitlementStatus.not_owned,
            )
    
    # Also include any per-hero cinematic entitlements
    for key, ent_data in user_entitlements.items():
        if key.startswith("PREMIUM_CINEMATIC_OWNED:"):
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=EntitlementStatus(ent_data.get("status", "owned")),
                granted_at=ent_data.get("granted_at"),
                expires_at=ent_data.get("expires_at"),
                transaction_id=ent_data.get("transaction_id"),
                product_id=ent_data.get("product_id"),
                reason=ent_data.get("reason", "purchase"),
            )
    
    # Get version from user doc (or use timestamp)
    version = user_doc.get("entitlements_version", int(datetime.now(timezone.utc).timestamp()))
    
    return EntitlementsSnapshot(
        server_time=datetime.now(timezone.utc).isoformat(),
        version=version,
        username=current_user["username"],
        entitlements=entitlements_map,
        ttl_seconds=300,
        source="database",
    )

# Purchase verification with idempotency
class PurchaseVerifyRequest(BaseModel):
    product_id: str
    entitlement_key: str
    idempotency_key: str
    platform: str
    transaction_id: Optional[str] = None
    receipt_data: Optional[str] = None

# RevenueCat configuration (read from environment)
REVENUECAT_SECRET_KEY = os.environ.get("REVENUECAT_SECRET_KEY")
REVENUECAT_PROJECT_ID = os.environ.get("REVENUECAT_PROJECT_ID", "")

async def verify_with_revenuecat(username: str, entitlement_key: str) -> dict:
    """
    Verify entitlement with RevenueCat API.
    Returns: {"active": bool, "expires_at": str|None, "product_id": str|None}
    """
    import httpx
    
    # RevenueCat uses app_user_id - we use username
    app_user_id = username
    
    url = f"https://api.revenuecat.com/v1/subscribers/{app_user_id}"
    headers = {
        "Authorization": f"Bearer {REVENUECAT_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, timeout=10.0)
        
        if resp.status_code == 404:
            # User not found in RevenueCat - no active entitlements
            return {"active": False, "expires_at": None, "product_id": None}
        
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"RevenueCat API error: {resp.status_code}"
            )
        
        data = resp.json()
        subscriber = data.get("subscriber", {})
        entitlements = subscriber.get("entitlements", {})
        
        # Check if the requested entitlement is active
        ent = entitlements.get(entitlement_key)
        if not ent:
            return {"active": False, "expires_at": None, "product_id": None}
        
        # Check expiration
        expires_at = ent.get("expires_date")
        is_active = ent.get("expires_date") is None or datetime.fromisoformat(expires_at.replace("Z", "+00:00")) > datetime.now(timezone.utc)
        
        return {
            "active": is_active,
            "expires_at": expires_at,
            "product_id": ent.get("product_identifier"),
        }

@app.post("/api/purchases/verify")
async def verify_purchase_endpoint(body: PurchaseVerifyRequest, current_user: dict = Depends(get_current_user)):
    """
    Verify a purchase and grant entitlement.
    Idempotent: same idempotency_key returns same result.
    
    STRICT: Requires REVENUECAT_SECRET_KEY to be configured.
    Without it, returns 503 Service Unavailable.
    """
    username = current_user["username"]
    
    # STRICT: Deny if RevenueCat not configured
    if not REVENUECAT_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Receipt verification not configured. Set REVENUECAT_SECRET_KEY in server environment."
        )
    
    # Check idempotency - if we've seen this key, return cached result
    purchase_cache = db.purchase_idempotency
    existing = await purchase_cache.find_one({
        "username": username,
        "idempotency_key": body.idempotency_key,
    })
    
    if existing:
        # Return cached result (idempotent)
        return existing["response"]
    
    # Verify with RevenueCat
    try:
        rc_result = await verify_with_revenuecat(username, body.entitlement_key)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"RevenueCat verification failed: {str(e)}"
        )
    
    now = datetime.now(timezone.utc)
    
    if not rc_result["active"]:
        # RevenueCat says NOT active - deny
        response = {
            "success": False,
            "message": f"Entitlement {body.entitlement_key} not active in RevenueCat",
            "entitlements_snapshot": None,
        }
        
        # Still cache the denial for idempotency
        try:
            await purchase_cache.insert_one({
                "username": username,
                "idempotency_key": body.idempotency_key,
                "response": response,
                "created_at": now,
                "expires_at": now + timedelta(hours=24),
            })
        except Exception:
            # Race condition - another request inserted first
            existing = await purchase_cache.find_one({
                "username": username,
                "idempotency_key": body.idempotency_key,
            })
            if existing:
                return existing["response"]
        
        return response
    
    # RevenueCat confirms active - grant entitlement
    entitlement_data = {
        "status": "owned",
        "granted_at": now.isoformat(),
        "expires_at": rc_result["expires_at"],
        "transaction_id": body.transaction_id,
        "product_id": rc_result["product_id"] or body.product_id,
        "reason": "purchase",
    }
    
    # Update user's entitlements
    await db.users.update_one(
        {"username": username},
        {
            "$set": {
                f"entitlements.{body.entitlement_key}": entitlement_data,
            },
            "$inc": {"entitlements_version": 1},
        }
    )
    
    # Get updated snapshot
    updated_user = await get_user_readonly(username)
    snapshot = await build_entitlements_snapshot(updated_user)
    
    response = {
        "success": True,
        "entitlements_snapshot": snapshot.model_dump(),
        "message": f"Entitlement {body.entitlement_key} granted",
    }
    
    # Cache the result for idempotency (TTL: 24 hours)
    # Handle race condition with duplicate key
    try:
        await purchase_cache.insert_one({
            "username": username,
            "idempotency_key": body.idempotency_key,
            "response": response,
            "created_at": now,
            "expires_at": now + timedelta(hours=24),
        })
    except Exception as e:
        # Duplicate key error - another request inserted first, fetch and return that
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            existing = await purchase_cache.find_one({
                "username": username,
                "idempotency_key": body.idempotency_key,
            })
            if existing:
                return existing["response"]
        # Other error - log but don't fail the purchase
        print(f"⚠️ Idempotency cache insert warning: {e}")
    
    return response


def normalize_entitlement_status(raw_status: str) -> EntitlementStatus:
    """
    Safely normalize entitlement status to a known enum value.
    Unknown statuses map to 'pending' to prevent frontend crashes.
    """
    try:
        return EntitlementStatus(raw_status)
    except ValueError:
        print(f"⚠️ Unknown entitlement status '{raw_status}' - mapping to 'pending'")
        return EntitlementStatus.pending


async def build_entitlements_snapshot(user_doc: dict) -> EntitlementsSnapshot:
    """Build entitlements snapshot from user document"""
    user_entitlements = user_doc.get("entitlements", {})
    entitlements_map = {}
    
    # Fill all known keys
    for key in ENTITLEMENT_KEYS.values():
        if key in user_entitlements:
            ent_data = user_entitlements[key]
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=normalize_entitlement_status(ent_data.get("status", "owned")),
                granted_at=ent_data.get("granted_at"),
                expires_at=ent_data.get("expires_at"),
                transaction_id=ent_data.get("transaction_id"),
                product_id=ent_data.get("product_id"),
                reason=ent_data.get("reason", "purchase"),
            )
        else:
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=EntitlementStatus.not_owned,
            )
    
    # Include per-hero cinematics
    for key, ent_data in user_entitlements.items():
        if key.startswith("PREMIUM_CINEMATIC_OWNED:"):
            entitlements_map[key] = ServerEntitlement(
                key=key,
                status=normalize_entitlement_status(ent_data.get("status", "owned")),
                granted_at=ent_data.get("granted_at"),
                expires_at=ent_data.get("expires_at"),
                transaction_id=ent_data.get("transaction_id"),
                product_id=ent_data.get("product_id"),
                reason=ent_data.get("reason", "purchase"),
            )
    
    version = user_doc.get("entitlements_version", int(datetime.now(timezone.utc).timestamp()))
    
    return EntitlementsSnapshot(
        server_time=datetime.now(timezone.utc).isoformat(),
        version=version,
        username=user_doc["username"],
        entitlements=entitlements_map,
        ttl_seconds=300,
        source="database",
    )

# Create TTL index for idempotency cache
@app.on_event("startup")
async def setup_purchase_idempotency_index():
    try:
        await db.purchase_idempotency.create_index("expires_at", expireAfterSeconds=0)
        await db.purchase_idempotency.create_index([("username", 1), ("idempotency_key", 1)], unique=True)
        print("✅ Created purchase_idempotency indexes")
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"⚠️ purchase_idempotency index warning: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# REVENUECAT WEBHOOK ENDPOINT
# Server-authoritative entitlement updates via RevenueCat webhooks
# https://www.revenuecat.com/docs/integrations/webhooks
# ═══════════════════════════════════════════════════════════════════════════

# Webhook authorization header name
REVENUECAT_WEBHOOK_AUTH_HEADER = os.environ.get("REVENUECAT_WEBHOOK_AUTH_HEADER", "X-RevenueCat-Webhook-Authorization")
REVENUECAT_WEBHOOK_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET")

# Event types we handle
RC_EVENT_INITIAL_PURCHASE = "INITIAL_PURCHASE"
RC_EVENT_RENEWAL = "RENEWAL"
RC_EVENT_CANCELLATION = "CANCELLATION"
RC_EVENT_UNCANCELLATION = "UNCANCELLATION"
RC_EVENT_EXPIRATION = "EXPIRATION"
RC_EVENT_PRODUCT_CHANGE = "PRODUCT_CHANGE"
RC_EVENT_BILLING_ISSUE = "BILLING_ISSUE"
RC_EVENT_TRANSFER = "TRANSFER"

# Mapping of RC entitlement IDs to our entitlement keys
RC_ENTITLEMENT_MAP = {
    "premium": "PREMIUM",
    "premium_cinematics": "PREMIUM_CINEMATICS_PACK",
    "no_ads": "NO_ADS",
    "starter_pack": "STARTER_PACK",
}


class RevenueCatWebhookEvent(BaseModel):
    """RevenueCat webhook event payload"""
    api_version: str = "1.0"
    event: dict


@app.post("/api/webhooks/revenuecat")
async def revenuecat_webhook(request: Request, event: RevenueCatWebhookEvent):
    """
    Handle RevenueCat webhook events.
    Updates entitlements based on subscription/purchase events.
    
    Must be idempotent (same event ID = same result).
    Returns 200 quickly to avoid RC retries.
    """
    # Verify webhook signature
    if REVENUECAT_WEBHOOK_SECRET:
        auth_header = request.headers.get(REVENUECAT_WEBHOOK_AUTH_HEADER, "")
        if auth_header != REVENUECAT_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook authorization")
    else:
        # No secret configured - log warning but allow in dev
        if not SERVER_DEV_MODE:
            raise HTTPException(
                status_code=503,
                detail="Webhook secret not configured. Set REVENUECAT_WEBHOOK_SECRET."
            )
        print("⚠️ RevenueCat webhook received without signature verification (dev mode)")
    
    event_data = event.event
    event_id = event_data.get("id")
    event_type = event_data.get("type")
    
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Missing event id or type")
    
    # Event type allowlist - reject unknown types
    ALLOWED_EVENT_TYPES = {
        RC_EVENT_INITIAL_PURCHASE,
        RC_EVENT_RENEWAL,
        RC_EVENT_CANCELLATION,
        RC_EVENT_UNCANCELLATION,
        RC_EVENT_EXPIRATION,
        RC_EVENT_PRODUCT_CHANGE,
        RC_EVENT_BILLING_ISSUE,
        RC_EVENT_TRANSFER,
    }
    if event_type not in ALLOWED_EVENT_TYPES:
        print(f"⚠️ RevenueCat webhook: Unknown event type '{event_type}' - rejected")
        raise HTTPException(status_code=400, detail=f"Unknown event type: {event_type}")
    
    # Idempotency check - have we processed this event?
    webhook_events = db.revenuecat_webhook_events
    existing = await webhook_events.find_one({"event_id": event_id})
    if existing:
        # Already processed - return success (idempotent)
        return {"status": "ok", "message": "Event already processed", "event_id": event_id}
    
    # Extract user info
    app_user_id = event_data.get("app_user_id")
    if not app_user_id:
        # Try subscriber info
        subscriber_info = event_data.get("subscriber_info", {})
        app_user_id = subscriber_info.get("original_app_user_id") or event_data.get("original_app_user_id")
    
    if not app_user_id:
        raise HTTPException(status_code=400, detail="Missing app_user_id")
    
    # app_user_id is the username in our system
    username = app_user_id
    
    # Get entitlement info
    entitlement_id = None
    product_id = event_data.get("product_id")
    
    # Try to get entitlement from entitlement_identifiers or subscriber info
    entitlement_ids = event_data.get("entitlement_ids") or event_data.get("entitlement_identifiers") or []
    if entitlement_ids:
        entitlement_id = entitlement_ids[0]  # Use first entitlement
    
    # Map RC entitlement to our key
    our_entitlement_key = RC_ENTITLEMENT_MAP.get(entitlement_id, entitlement_id)
    
    if not our_entitlement_key:
        # No entitlement to update - just log and return
        print(f"⚠️ RevenueCat webhook: No entitlement mapping for {entitlement_id}")
        await webhook_events.insert_one({
            "event_id": event_id,
            "event_type": event_type,
            "username": username,
            "processed_at": datetime.now(timezone.utc),
            "result": "skipped_no_mapping",
        })
        return {"status": "ok", "message": "No entitlement mapping", "event_id": event_id}
    
    # Validate entitlement key
    try:
        validate_entitlement_key(our_entitlement_key)
    except HTTPException:
        print(f"⚠️ RevenueCat webhook: Invalid entitlement key {our_entitlement_key}")
        return {"status": "error", "message": "Invalid entitlement key", "event_id": event_id}
    
    now = datetime.now(timezone.utc)
    result = "processed"
    
    # Process based on event type
    if event_type in [RC_EVENT_INITIAL_PURCHASE, RC_EVENT_RENEWAL, RC_EVENT_UNCANCELLATION]:
        # Grant or extend entitlement
        expires_at = event_data.get("expiration_at_ms")
        if expires_at:
            expires_at = datetime.fromtimestamp(expires_at / 1000, tz=timezone.utc).isoformat()
        
        entitlement_data = {
            "status": "owned",
            "granted_at": now.isoformat(),
            "expires_at": expires_at,
            "transaction_id": event_data.get("transaction_id") or event_data.get("store_transaction_id"),
            "product_id": product_id,
            "reason": event_type.lower(),
        }
        
        await db.users.update_one(
            {"username": username},
            {
                "$set": {f"entitlements.{our_entitlement_key}": entitlement_data},
                "$inc": {"entitlements_version": 1},
            }
        )
        result = "entitlement_granted"
        
    elif event_type in [RC_EVENT_CANCELLATION, RC_EVENT_EXPIRATION]:
        # Mark as expired (don't delete - keep history)
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    f"entitlements.{our_entitlement_key}.status": "expired",
                    f"entitlements.{our_entitlement_key}.expired_at": now.isoformat(),
                    f"entitlements.{our_entitlement_key}.reason": event_type.lower(),
                },
                "$inc": {"entitlements_version": 1},
            }
        )
        result = "entitlement_expired"
        
    elif event_type == RC_EVENT_BILLING_ISSUE:
        # Mark as grace period / billing issue
        await db.users.update_one(
            {"username": username},
            {
                "$set": {
                    f"entitlements.{our_entitlement_key}.billing_issue": True,
                    f"entitlements.{our_entitlement_key}.billing_issue_at": now.isoformat(),
                },
            }
        )
        result = "billing_issue_flagged"
    
    # Record that we processed this event (idempotency)
    await webhook_events.insert_one({
        "event_id": event_id,
        "event_type": event_type,
        "username": username,
        "entitlement_key": our_entitlement_key,
        "product_id": product_id,
        "processed_at": now,
        "result": result,
    })
    
    print(f"✅ RevenueCat webhook processed: {event_type} for {username} -> {our_entitlement_key} ({result})")
    
    return {"status": "ok", "event_id": event_id, "result": result}


# Create index for webhook event idempotency
@app.on_event("startup")
async def setup_webhook_event_index():
    try:
        await db.revenuecat_webhook_events.create_index("event_id", unique=True)
        await db.revenuecat_webhook_events.create_index("username")
        await db.revenuecat_webhook_events.create_index("processed_at")
        print("✅ Created revenuecat_webhook_events indexes")
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"⚠️ revenuecat_webhook_events index warning: {e}")
