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
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import random
from bson import ObjectId
import re
import asyncio
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

# Security
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hash a password for storing"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token and return the payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        return None
    
    username = payload.get("sub")
    if not username:
        return None
    
    user = await db.users.find_one({"username": username})
    return user

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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

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
    password_hash: Optional[str] = None  # Hashed password for secure login
    server_id: str = "server_1"  # Server assignment with default
    
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

# Profanity filter - basic word list (expand as needed)
PROFANITY_LIST = [
    "fuck", "shit", "ass", "bitch", "damn", "hell", "crap",
    "bastard", "dick", "pussy", "cock", "fag", "nigger", "cunt",
    # Add more as needed for different languages
]

def censor_message(message: str) -> str:
    """Censor profanity in message"""
    censored = message
    for word in PROFANITY_LIST:
        # Case insensitive replacement
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        censored = pattern.sub("***", censored)
    return censored

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
         image_url="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400",
         description="A fallen angel seeking redemption through battle"),
    Hero(name="Marcus the Shield", rarity="SR", element="Earth", hero_class="Warrior",
         base_hp=1400, base_atk=130, base_def=120, base_speed=85, position="front",
         skills=create_warrior_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499073.jpg",
         description="A stalwart defender who never retreats"),
    Hero(name="Kane the Berserker", rarity="SR", element="Fire", hero_class="Warrior",
         base_hp=1100, base_atk=170, base_def=80, base_speed=95, position="front",
         skills=create_warrior_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-japanese-character_23-2151478202.jpg",
         description="Fury incarnate, dealing devastating blows"),
    
    # Mages (Back Line)
    Hero(name="Soren the Flame", rarity="SR", element="Fire", hero_class="Mage",
         base_hp=900, base_atk=180, base_def=70, base_speed=100, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-character-wearing-dynamic-action-pose_23-2151500236.jpg",
         description="A passionate sorcerer wielding infernal flames"),
    Hero(name="Lysander the Frost", rarity="SR", element="Water", hero_class="Mage",
         base_hp=950, base_atk=175, base_def=75, base_speed=95, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-character-with-blue-hair_23-2151499092.jpg",
         description="Master of ice who freezes enemies solid"),
    Hero(name="Theron the Storm", rarity="SR", element="Wind", hero_class="Mage",
         base_hp=880, base_atk=185, base_def=65, base_speed=110, position="back",
         skills=create_mage_skills("SR"),
         image_url="https://img.freepik.com/free-photo/intense-anime-fighter-with-energy-blade_23-2152031302.jpg",
         description="Commands lightning and thunder with ease"),
    
    # Archers (Back Line)
    Hero(name="Kai the Tempest", rarity="SR", element="Wind", hero_class="Archer",
         base_hp=1000, base_atk=170, base_def=80, base_speed=115, position="back",
         skills=create_archer_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-character-portrait-illustration_23-2151499104.jpg",
         description="Swift as the wind, deadly as the storm"),
    Hero(name="Robin the Hunter", rarity="SR", element="Earth", hero_class="Archer",
         base_hp=1050, base_atk=165, base_def=85, base_speed=105, position="back",
         skills=create_archer_skills("SR"),
         image_url="https://img.freepik.com/free-photo/anime-character-full-body-portrait_23-2151499069.jpg",
         description="Never misses his mark, ever"),
    
    # ========== SSR HEROES ==========
    # Warriors
    Hero(name="Darius the Void", rarity="SSR", element="Dark", hero_class="Warrior",
         base_hp=2000, base_atk=200, base_def=180, base_speed=88, position="front",
         skills=create_warrior_skills("SSR"),
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499067.jpg",
         description="A demonic guardian with impenetrable defense"),
    Hero(name="Leon the Paladin", rarity="SSR", element="Light", hero_class="Warrior",
         base_hp=1800, base_atk=220, base_def=160, base_speed=92, position="front",
         skills=create_warrior_skills("SSR"),
         image_url="https://img.freepik.com/free-photo/anime-knight-with-sword_23-2152013379.jpg",
         description="Holy warrior blessed by the divine"),
    
    # Mages
    Hero(name="Lucian the Divine", rarity="SSR", element="Light", hero_class="Mage",
         base_hp=1400, base_atk=260, base_def=120, base_speed=98, position="back",
         skills=create_mage_skills("SSR"),
         image_url="https://img.freepik.com/free-photo/anime-samurai-warrior-with-katana-pink-petals_23-2151995161.jpg",
         description="An angelic being with devastating magic"),
    Hero(name="Morgana the Shadow", rarity="SSR", element="Dark", hero_class="Mage",
         base_hp=1300, base_atk=280, base_def=100, base_speed=102, position="back",
         skills=create_mage_skills("SSR"),
         image_url="https://img.freepik.com/free-photo/portrait-anime-character_23-2151499119.jpg",
         description="Mistress of dark arts and forbidden spells"),
    
    # Archers
    Hero(name="Artemis the Swift", rarity="SSR", element="Wind", hero_class="Archer",
         base_hp=1500, base_atk=250, base_def=130, base_speed=120, position="back",
         skills=create_archer_skills("SSR"),
         image_url="https://img.freepik.com/free-photo/anime-character-ready-battle_23-2151499125.jpg",
         description="Goddess of the hunt, unmatched in speed"),
    
    # ========== SSR+ HEROES (Common Summon Exclusive) ==========
    Hero(name="Orion the Mystic", rarity="SSR+", element="Water", hero_class="Mage",
         base_hp=1700, base_atk=310, base_def=140, base_speed=105, position="back",
         skills=create_mage_skills("SSR+"),
         image_url="https://img.freepik.com/free-photo/anime-character-water-magic-effects_23-2151499138.jpg",
         description="A rare sorcerer who commands the tides"),
    Hero(name="Phoenix the Reborn", rarity="SSR+", element="Fire", hero_class="Warrior",
         base_hp=2100, base_atk=280, base_def=170, base_speed=95, position="front",
         skills=create_warrior_skills("SSR+"),
         image_url="https://img.freepik.com/free-photo/anime-warrior-flames-armor_23-2151499142.jpg",
         description="Rising from ashes, immortal in battle"),
    Hero(name="Gale the Windwalker", rarity="SSR+", element="Wind", hero_class="Archer",
         base_hp=1600, base_atk=300, base_def=130, base_speed=130, position="back",
         skills=create_archer_skills("SSR+"),
         image_url="https://img.freepik.com/free-photo/anime-character-wind-element_23-2151499156.jpg",
         description="Moves faster than the eye can see"),
    
    # ========== UR HEROES (Premium Crystal Exclusive) ==========
    Hero(name="Seraphiel the Radiant", rarity="UR", element="Light", hero_class="Mage",
         base_hp=2000, base_atk=380, base_def=180, base_speed=110, position="back",
         skills=create_mage_skills("UR"),
         image_url="https://cdn.pixabay.com/photo/2024/08/01/18/20/anime-8937912_1280.png",
         description="An archangel with power beyond mortal comprehension"),
    Hero(name="Malachi the Destroyer", rarity="UR", element="Fire", hero_class="Warrior",
         base_hp=2500, base_atk=350, base_def=200, base_speed=100, position="front",
         skills=create_warrior_skills("UR"),
         image_url="https://cdn.pixabay.com/photo/2023/06/02/15/42/ai-generated-8035982_1280.png",
         description="A god of war who revels in destruction"),
    Hero(name="Selene the Moonbow", rarity="UR", element="Dark", hero_class="Archer",
         base_hp=1900, base_atk=400, base_def=160, base_speed=125, position="back",
         skills=create_archer_skills("UR"),
         image_url="https://cdn.pixabay.com/photo/2024/11/21/09/29/ai-generated-9213316_1280.png",
         description="Huntress of the night, death from the shadows"),
    
    # ========== UR+ HEROES (Divine Summon Exclusive) ==========
    Hero(name="Raphael the Eternal", rarity="UR+", element="Light", hero_class="Mage",
         base_hp=2800, base_atk=500, base_def=220, base_speed=115, position="back",
         skills=create_mage_skills("UR+"),
         image_url="https://cdn.pixabay.com/photo/2024/11/15/22/10/ai-generated-9200292_1280.png",
         description="The supreme deity of magic and transcendence"),
    Hero(name="Michael the Archangel", rarity="UR+", element="Light", hero_class="Warrior",
         base_hp=3200, base_atk=450, base_def=280, base_speed=105, position="front",
         skills=create_warrior_skills("UR+"),
         image_url="https://cdn.pixabay.com/photo/2020/04/21/04/23/angel-5070736_1280.png",
         description="Commander of the heavenly host, invincible in combat"),
    Hero(name="Apollyon the Fallen", rarity="UR+", element="Dark", hero_class="Archer",
         base_hp=2600, base_atk=520, base_def=200, base_speed=135, position="back",
         skills=create_archer_skills("UR+"),
         image_url="https://cdn.pixabay.com/photo/2025/01/08/02/22/prince-9318043_1280.jpg",
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
    """Register a new user with password"""
    username = request.username.strip()
    password = request.password
    
    # Validate username
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be less than 20 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
    
    # Validate password
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if username exists
    existing = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user with hashed password
    user = User(
        username=username,
        password_hash=hash_password(password)
    )
    await db.users.insert_one(user.dict())
    
    # Create JWT token
    token = create_access_token(data={"sub": username})
    
    user_dict = user.dict()
    del user_dict["password_hash"]  # Don't send password hash to client
    
    return {
        "user": user_dict,
        "token": token,
        "message": "Account created successfully"
    }

@api_router.post("/auth/login")
async def auth_login(request: LoginRequest):
    """Authenticate user with password and return JWT token"""
    username = request.username.strip()
    password = request.password
    
    # Find user (case-insensitive)
    user = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
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
    
    # Create JWT token
    token = create_access_token(data={"sub": user["username"]})
    
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
    """Set password for a legacy account (users without passwords)"""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account already has a password")
    
    # Set the password
    await db.users.update_one(
        {"username": user["username"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Create JWT token
    token = create_access_token(data={"sub": user["username"]})
    
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

@api_router.get("/user/{username}")
async def get_user(username: str):
    """Get user data"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return convert_objectid(user)

@api_router.post("/user/{username}/login")
async def user_login(username: str):
    """Handle daily login tracking - NO rewards given here"""
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_heroes = await db.user_heroes.find({"user_id": user["id"]}).to_list(1000)
    
    # Enrich with hero data
    enriched_heroes = []
    for uh in user_heroes:
        hero_data = await db.heroes.find_one({"id": uh["hero_id"]})
        if hero_data:
            enriched_heroes.append({
                **convert_objectid(uh),
                "hero_data": convert_objectid(hero_data)
            })
    
    return enriched_heroes

@api_router.post("/user/{username}/heroes/{hero_instance_id}/upgrade")
async def upgrade_hero(username: str, hero_instance_id: str):
    """Upgrade hero rank using duplicates"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    team = Team(user_id=user["id"], name=team_name)
    await db.teams.insert_one(team.dict())
    return team

@api_router.get("/team/{username}")
async def get_user_teams(username: str):
    """Get all teams for a user"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get mode teams from user document
    mode_teams = user.get("mode_teams", {})
    return mode_teams

@api_router.post("/team/save-mode-team")
async def save_mode_team(username: str, mode: str, slot_1: str = None, slot_2: str = None, 
                         slot_3: str = None, slot_4: str = None, slot_5: str = None, slot_6: str = None):
    """Save a team for a specific game mode with full audit logging"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    logs = await db.team_change_logs.find(
        {"user_id": user["id"]}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [convert_objectid(log) for log in logs]

@api_router.get("/hero/{username}/change-logs")
async def get_hero_change_logs(username: str, hero_id: str = None, limit: int = 50):
    """Get hero modification audit logs"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    query = {"user_id": user["id"]}
    if hero_id:
        query["hero_id"] = hero_id
    
    logs = await db.hero_change_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return [convert_objectid(log) for log in logs]

@api_router.post("/idle/claim")
async def claim_idle_rewards(username: str):
    """
    Claim idle rewards with VIP-tiered rates and progression-based caps.
    
    VIP Rate Schedule:
    - VIP 0-6: 5% base rate
    - VIP 7: 15% rate
    - VIP 8+: +5% per level (20%, 25%, etc.)
    
    Resources: Gold, Coins, Enhancement Stones, Skill Essence, Stamina, Rune Stones
    Caps based on: Abyss floor, Dungeon tier, Campaign chapter
    """
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
        # First time - start collection
        await db.users.update_one(
            {"username": username},
            {"$set": {
                "idle_collection_started_at": datetime.utcnow(),
                "vip_level": vip_level
            }}
        )
        return {
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
    await db.users.find_one({"username": username})
    
    return {
        "resources": resources,
        "gold_earned": resources.get("gold", 0),  # Legacy compatibility
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
    """Get current idle collection status with VIP rates and progression caps"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    idle_max_hours = get_vip_idle_hours(vip_level)
    
    # Get progression data
    abyss_progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    abyss_floor = abyss_progress.get("highest_floor", 0) if abyss_progress else 0
    
    stage_progress = await db.stage_progress.find_one({"user_id": user["id"]})
    dungeon_tier = stage_progress.get("dungeon_tier", 0) if stage_progress else 0
    campaign_chapter = stage_progress.get("campaign_chapter", 0) if stage_progress else 0
    
    collection_started = user.get("idle_collection_started_at")
    if not collection_started:
        # Preview of potential earnings
        preview = calculate_idle_preview(
            vip_level=vip_level,
            abyss_floor=abyss_floor,
            dungeon_tier=dungeon_tier,
            campaign_chapter=campaign_chapter,
            hours=idle_max_hours
        )
        
        return {
            "is_collecting": False,
            "pending_resources": {},
            "gold_pending": 0,
            "time_elapsed": 0,
            "vip_level": vip_level,
            "vip_rate": get_vip_idle_rate_display(vip_level),
            "max_hours": idle_max_hours,
            "max_potential": preview["resources"],
            "caps": calculate_resource_caps(abyss_floor, dungeon_tier, campaign_chapter),
            "progression": {
                "abyss_floor": abyss_floor,
                "dungeon_tier": dungeon_tier,
                "campaign_chapter": campaign_chapter,
            }
        }
    
    # Calculate current pending
    now = datetime.utcnow()
    if isinstance(collection_started, str):
        collection_started = datetime.fromisoformat(collection_started.replace("Z", "+00:00")).replace(tzinfo=None)
    
    time_elapsed_seconds = (now - collection_started).total_seconds()
    hours_elapsed = time_elapsed_seconds / 3600
    
    # Calculate pending resources
    idle_result = calculate_idle_resources(
        hours_elapsed=hours_elapsed,
        vip_level=vip_level,
        abyss_floor=abyss_floor,
        dungeon_tier=dungeon_tier,
        campaign_chapter=campaign_chapter,
        max_hours=idle_max_hours
    )
    
    # Get next milestone info
    next_milestones = get_next_milestone_info(abyss_floor, dungeon_tier, campaign_chapter)
    vip_upgrade = get_vip_upgrade_info(vip_level)
    
    return {
        "is_collecting": True,
        "pending_resources": idle_result["resources"],
        "gold_pending": idle_result["resources"].get("gold", 0),
        "time_elapsed": int(time_elapsed_seconds),
        "hours_elapsed": round(hours_elapsed, 2),
        "is_capped": idle_result["is_time_capped"],
        "vip_level": vip_level,
        "vip_rate": idle_result["vip_rate_display"],
        "max_hours": idle_max_hours,
        "caps": calculate_resource_caps(abyss_floor, dungeon_tier, campaign_chapter),
        "progression": {
            "abyss_floor": abyss_floor,
            "dungeon_tier": dungeon_tier,
            "campaign_chapter": campaign_chapter,
        },
        "next_milestones": next_milestones,
        "vip_upgrade_info": vip_upgrade,
    }

@api_router.post("/idle/instant-collect/{username}")
async def instant_collect_idle(username: str):
    """
    VIP 1+ Instant Collect: Claim 2 hours of idle rewards instantly.
    Has a 4-hour cooldown between uses.
    """
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

@api_router.get("/story/progress/{username}")
async def get_user_progress(username: str):
    """Get user's story progress"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    progress = await db.user_progress.find_one({"user_id": user["id"]})
    if not progress:
        # Create initial progress
        progress = UserProgress(user_id=user["id"])
        await db.user_progress.insert_one(progress.dict())
        progress = await db.user_progress.find_one({"user_id": user["id"]})
    
    return convert_objectid(progress)

@api_router.post("/story/battle/{username}/{chapter_number}")
async def battle_chapter(username: str, chapter_number: int):
    """Battle a story chapter - server-side combat simulation"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

# ==================== SUPPORT SYSTEM ====================
@api_router.post("/support/ticket")
async def create_support_ticket(username: str, subject: str, message: str):
    """Create a support ticket"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tickets = await db.support_tickets.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [convert_objectid(ticket) for ticket in tickets]

# ==================== FRIENDS SYSTEM ====================
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

# ==================== PLAYER CHARACTER SYSTEM ====================
@api_router.get("/player-character/{username}")
async def get_player_character(username: str):
    """Get or create player character"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

# ==================== ABYSS MODE ====================
@api_router.get("/abyss/progress/{username}")
async def get_abyss_progress(username: str):
    """Get user's abyss progress"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    if not progress:
        # Create initial progress
        progress = AbyssProgress(user_id=user["id"])
        await db.abyss_progress.insert_one(progress.dict())
        progress = await db.abyss_progress.find_one({"user_id": user["id"]})
    
    return convert_objectid(progress)

@api_router.post("/abyss/battle/{username}/{level}")
async def battle_abyss(username: str, level: int, request: AbyssBattleRequest):
    """Battle an abyss level - requires multiple teams for higher levels"""
    team_ids = request.team_ids
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    record = await db.arena_records.find_one({"user_id": user["id"]})
    if not record:
        # Create initial record
        record = ArenaRecord(user_id=user["id"], username=username)
        await db.arena_records.insert_one(record.dict())
        record = await db.arena_records.find_one({"user_id": user["id"]})
    
    return convert_objectid(record)

@api_router.post("/arena/battle/{username}")
async def arena_battle(username: str, request: ArenaBattleRequest):
    """Battle in arena against another player"""
    team_id = request.team_id
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

# ==================== CHAT SYSTEM ====================
@api_router.post("/chat/send")
async def send_chat_message(
    username: str,
    channel_type: str,
    message: str,
    language: str = "en",
    channel_id: Optional[str] = None,
    server_region: str = "global"
):
    """Send a chat message"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate channel type
    if channel_type not in ["world", "local", "guild", "private"]:
        raise HTTPException(status_code=400, detail="Invalid channel type")
    
    # Validate language
    if language not in SUPPORTED_LANGUAGES:
        language = "en"  # Default to English
    
    # No photos or emojis allowed - check for special characters
    if any(char in message for char in ['📷', '🖼️', '📸']):
        raise HTTPException(status_code=400, detail="Photos not allowed in chat")
    
    # Limit message length
    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 characters)")
    
    # Censor profanity
    censored_message = censor_message(message)
    
    # Create chat message
    chat_msg = ChatMessage(
        sender_id=user["id"],
        sender_username=username,
        channel_type=channel_type,
        channel_id=channel_id,
        message=censored_message,
        language=language,
        server_region=server_region
    )
    
    await db.chat_messages.insert_one(chat_msg.dict())
    
    return convert_objectid(chat_msg.dict())

@api_router.get("/chat/messages")
async def get_chat_messages(
    channel_type: str,
    channel_id: Optional[str] = None,
    server_region: str = "global",
    limit: int = 50,
    before_timestamp: Optional[str] = None
):
    """Get chat messages for a channel"""
    query = {"channel_type": channel_type}
    
    if channel_type == "local":
        query["server_region"] = server_region
    elif channel_type in ["guild", "private"]:
        if not channel_id:
            raise HTTPException(status_code=400, detail="channel_id required for guild/private chat")
        query["channel_id"] = channel_id
    
    # Pagination support
    if before_timestamp:
        query["timestamp"] = {"$lt": datetime.fromisoformat(before_timestamp)}
    
    messages = await db.chat_messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    return [convert_objectid(msg) for msg in messages]

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

@api_router.post("/guild/join")
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

@api_router.get("/guild/{username}")
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

# ==================== HERO UPGRADE SYSTEM ====================

class HeroUpgradeRequest(BaseModel):
    upgrade_type: str  # "level", "star", "awakening", "skill"
    amount: int = 1
    skill_id: Optional[str] = None

@api_router.get("/hero/{user_hero_id}/details")
async def get_hero_details(user_hero_id: str, username: str):
    """Get detailed hero info including skills and equipment"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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

@api_router.post("/guild/{username}/boss/attack")
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

@api_router.get("/guild/{username}/donations")
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

# ==================== RESOURCE BAG SYSTEM ====================

@api_router.get("/resource-bag/{username}")
async def get_resource_bag(username: str):
    """Get user's resource bag (farming tracker)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
async def verify_purchase(purchase: PurchaseVerification):
    """Verify and process a RevenueCat purchase"""
    user = await db.users.find_one({"username": purchase.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if transaction already processed
    existing = await db.purchases.find_one({"transaction_id": purchase.transaction_id})
    if existing:
        return {"success": True, "message": "Purchase already processed", "duplicate": True}
    
    # Get product rewards
    rewards = PRODUCT_REWARDS.get(purchase.product_id)
    if not rewards:
        raise HTTPException(status_code=400, detail="Unknown product")
    
    # Process based on reward type
    result = {"success": True, "rewards": {}}
    
    if rewards["type"] == "crystals":
        await db.users.update_one(
            {"username": purchase.username},
            {"$inc": {"crystals": rewards["amount"]}}
        )
        result["rewards"]["crystals"] = rewards["amount"]
    
    elif rewards["type"] == "divine_essence":
        await db.users.update_one(
            {"username": purchase.username},
            {"$inc": {"divine_essence": rewards["amount"]}}
        )
        result["rewards"]["divine_essence"] = rewards["amount"]
    
    elif rewards["type"] == "battle_pass":
        # Update battle pass status
        await db.battle_pass_status.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "is_premium": True,
                    "tier": rewards["tier"],
                    "purchase_date": datetime.utcnow().isoformat()
                },
                "$inc": {"level": rewards.get("bonus_levels", 0)}
            },
            upsert=True
        )
        
        if rewards.get("crystals", 0) > 0:
            await db.users.update_one(
                {"username": purchase.username},
                {"$inc": {"crystals": rewards["crystals"]}}
            )
            result["rewards"]["crystals"] = rewards["crystals"]
        
        result["rewards"]["battle_pass"] = rewards["tier"]
        result["rewards"]["bonus_levels"] = rewards.get("bonus_levels", 0)
    
    # Record purchase
    await db.purchases.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": purchase.username,
        "product_id": purchase.product_id,
        "transaction_id": purchase.transaction_id,
        "platform": purchase.platform,
        "timestamp": datetime.utcnow().isoformat(),
        "rewards": result["rewards"]
    })
    
    # VIP level is calculated purely from total_spent USD
    # No separate VIP XP system - VIP is a purchase-only reward
    
    return result

@api_router.get("/purchase/history/{username}")
async def get_purchase_history(username: str, limit: int = 20):
    """Get user's purchase history"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
# ADMIN SYSTEM - Secured with JWT Authentication
# ============================================================================

# Admin authentication dependency
async def verify_admin_token(authorization: str = Header(None)):
    """Verify admin JWT token and return admin user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        import jwt
        # Use the same secret from auth router
        JWT_SECRET = os.getenv("JWT_SECRET")
        if not JWT_SECRET:
            import secrets
            JWT_SECRET = secrets.token_hex(32)
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        admin_user = await db.users.find_one({"username": username})
        
        if not admin_user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not admin_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return admin_user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_permission(permission: str):
    """Decorator factory to require specific admin permission"""
    async def check_permission(admin_user: dict = Depends(verify_admin_token)):
        if permission not in admin_user.get("admin_permissions", []) and permission != "basic":
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return admin_user
    return check_permission


@api_router.post("/admin/grant-resources/{username}")
async def admin_grant_resources(
    username: str, 
    resources: Dict[str, int] = None,
    admin_user: dict = Depends(verify_admin_token)
):
    """Admin endpoint to grant resources to a user (requires JWT auth)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if resources:
        await db.users.update_one({"username": username}, {"$inc": resources})
    
    # Log admin action
    await db.admin_logs.insert_one({
        "admin": admin_user["username"],
        "action": "grant_resources",
        "target": username,
        "details": resources,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "granted": resources}

@api_router.post("/admin/set-vip/{username}")
async def admin_set_vip(
    username: str, 
    vip_level: int,
    admin_user: dict = Depends(verify_admin_token)
):
    """Admin endpoint to set VIP level (requires JWT auth)"""
    await db.users.update_one(
        {"username": username},
        {"$set": {"vip_level": vip_level, "is_admin_set_vip": True}}
    )
    
    await db.admin_logs.insert_one({
        "admin": admin_user["username"],
        "action": "set_vip",
        "target": username,
        "details": {"vip_level": vip_level},
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "vip_level": vip_level}

@api_router.post("/admin/ban-user/{username}")
async def admin_ban_user(
    username: str, 
    reason: str = "Violation of terms",
    admin_user: dict = Depends(require_permission("ban"))
):
    """Admin endpoint to ban a user (requires JWT auth + ban permission)"""
    await db.users.update_one(
        {"username": username},
        {"$set": {
            "is_banned": True, 
            "ban_reason": reason, 
            "banned_at": datetime.utcnow().isoformat(), 
            "banned_by": admin_user["username"]
        }}
    )
    
    await db.admin_logs.insert_one({
        "admin": admin_user["username"],
        "action": "ban_user",
        "target": username,
        "details": {"reason": reason},
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "banned": username, "reason": reason}

@api_router.post("/admin/mute-user/{username}")
async def admin_mute_user(
    username: str, 
    duration_hours: int = 24,
    admin_user: dict = Depends(require_permission("mute"))
):
    """Admin endpoint to mute a user in chat (requires JWT auth + mute permission)"""
    mute_until = datetime.utcnow() + timedelta(hours=duration_hours)
    await db.users.update_one(
        {"username": username},
        {"$set": {
            "is_muted": True, 
            "muted_until": mute_until.isoformat(), 
            "muted_by": admin_user["username"]
        }}
    )
    
    await db.admin_logs.insert_one({
        "admin": admin_user["username"],
        "action": "mute_user",
        "target": username,
        "details": {"duration_hours": duration_hours},
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "muted": username, "until": mute_until.isoformat()}

@api_router.delete("/admin/delete-account/{username}")
async def admin_delete_account(
    username: str,
    admin_user: dict = Depends(require_permission("delete_account"))
):
    """Admin endpoint to permanently delete an account (requires JWT auth + delete permission)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete from all collections
    user_id = user["id"]
    await db.users.delete_one({"username": username})
    await db.user_heroes.delete_many({"user_id": user_id})
    await db.user_equipment.delete_many({"owner_id": user_id})
    await db.abyss_progress.delete_many({"user_id": user_id})
    await db.stage_progress.delete_many({"user_id": user_id})
    await db.campaign_progress.delete_many({"user_id": user_id})
    
    await db.admin_logs.insert_one({
        "admin": admin_user["username"],
        "action": "delete_account",
        "target": username,
        "details": {"user_id": user_id},
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "deleted": username}

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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
