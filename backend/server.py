from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

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

class HeroBase(BaseModel):
    name: str
    rarity: str  # SR, SSR, UR, UR+
    element: str  # Fire, Water, Earth, Wind, Light, Dark
    hero_class: str  # Warrior, Mage, Healer, Tank, Assassin, Support
    base_hp: int
    base_atk: int
    base_def: int
    image_url: str
    description: str

class Hero(HeroBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class UserHero(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    hero_id: str
    level: int = 1
    rank: int = 1  # 1-10
    star_level: int = 0  # After rank 10, star chart progression
    duplicates: int = 0
    current_hp: int
    current_atk: int
    current_def: int
    acquired_at: datetime = Field(default_factory=datetime.utcnow)

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    server_id: str = "server_1"  # Server assignment with default
    crystals: int = 300  # Premium currency (renamed from gems)
    coins: int = 10000  # Regular currency
    gold: int = 5000  # Idle resource
    divine_essence: int = 0  # Ultra-rare currency for UR+ summons
    friendship_points: int = 0  # Friend currency
    pity_counter: int = 0  # Counts towards guaranteed SSR at 50 (common)
    pity_counter_premium: int = 0  # Separate pity for premium summons (UR)
    pity_counter_divine: int = 0  # Pity for divine summons (UR+) - 40 pity
    total_pulls: int = 0
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
    hero_ids: List[str] = []  # Max 6 heroes
    is_active: bool = False

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

def get_idle_gold_rate(vip_level: int) -> float:
    """Get idle gold generation rate per minute based on VIP level"""
    base_rate = 100.0  # 100 gold per minute at VIP 0
    bonus_multiplier = 1.0 + (vip_level * 0.10)  # +10% per VIP level
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
    "SR": 65.0,    # 65%
    "SSR": 32.0,   # 32%
    "SSR+": 3.0,   # 3% - New tier exclusive to common summons
}

# Premium Summons (crystals) - UR is highest tier here (UR+ removed)
GACHA_RATES_PREMIUM = {
    "SR": 50.0,   # 50%
    "SSR": 40.0,  # 40%
    "UR": 10.0,   # 10% - Premium exclusive (UR+ moved to divine)
}

# Divine Summons (Divine Essence) - UR+ ONLY
GACHA_RATES_DIVINE = {
    "UR+": 100.0  # 100% UR+ only
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

# Initialize hero pool
HERO_POOL = [
    # SR Heroes
    Hero(name="Azrael the Fallen", rarity="SR", element="Dark", hero_class="Warrior", 
         base_hp=1200, base_atk=150, base_def=100, 
         image_url="https://img.freepik.com/free-photo/anime-knight-with-sword_23-2152013379.jpg",
         description="A fallen angel seeking redemption through battle"),
    Hero(name="Soren the Flame", rarity="SR", element="Fire", hero_class="Mage",
         base_hp=900, base_atk=180, base_def=70,
         image_url="https://img.freepik.com/free-photo/anime-samurai-warrior-with-katana-pink-petals_23-2151995161.jpg",
         description="A passionate sorcerer wielding infernal flames"),
    Hero(name="Kai the Tempest", rarity="SR", element="Wind", hero_class="Assassin",
         base_hp=1000, base_atk=170, base_def=80,
         image_url="https://img.freepik.com/free-photo/intense-anime-fighter-with-energy-blade_23-2152031302.jpg",
         description="Swift as the wind, deadly as the storm"),
    
    # SSR Heroes
    Hero(name="Lucian the Divine", rarity="SSR", element="Light", hero_class="Healer",
         base_hp=1400, base_atk=140, base_def=120,
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499113.jpg",
         description="An angelic being who mends wounds with holy magic"),
    Hero(name="Darius the Void", rarity="SSR", element="Dark", hero_class="Tank",
         base_hp=2000, base_atk=120, base_def=180,
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499073.jpg",
         description="A demonic guardian with impenetrable defense"),
    
    # SSR+ Heroes (Common Summon Exclusive - Top tier for free players)
    Hero(name="Orion the Mystic", rarity="SSR+", element="Water", hero_class="Mage",
         base_hp=1700, base_atk=210, base_def=130,
         image_url="https://img.freepik.com/free-photo/anime-character-with-blue-hair_23-2151499092.jpg",
         description="A rare sorcerer who commands the tides"),
    Hero(name="Phoenix the Reborn", rarity="SSR+", element="Fire", hero_class="Support",
         base_hp=1600, base_atk=190, base_def=150,
         image_url="https://img.freepik.com/free-photo/anime-character-portrait-illustration_23-2151499104.jpg",
         description="Rising from ashes, granting power to allies"),
    
    # UR Heroes (Premium Crystal Exclusive)
    Hero(name="Seraphiel the Radiant", rarity="UR", element="Light", hero_class="Support",
         base_hp=1600, base_atk=200, base_def=140,
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499067.jpg",
         description="An archangel with power beyond mortal comprehension"),
    Hero(name="Malachi the Destroyer", rarity="UR", element="Fire", hero_class="Warrior",
         base_hp=1800, base_atk=250, base_def=130,
         image_url="https://img.freepik.com/free-photo/anime-japanese-character_23-2151478202.jpg",
         description="A god of war who revels in destruction"),
    
    # UR+ Heroes (Premium Crystal Exclusive - Rarest)
    Hero(name="Raphael the Eternal", rarity="UR+", element="Light", hero_class="Mage",
         base_hp=2200, base_atk=300, base_def=160,
         image_url="https://img.itch.zone/aW1nLzgyOTQ5NTMucG5n/original/jCtJlk.png",
         description="The supreme deity of magic and transcendence")
]

async def init_heroes():
    """Initialize hero pool in database if not exists"""
    for hero in HERO_POOL:
        existing = await db.heroes.find_one({"name": hero.name})
        if not existing:
            await db.heroes.insert_one(hero.dict())

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

def get_random_hero(pity_counter: int, is_premium: bool = False) -> Hero:
    """Select a random hero based on gacha rates with pity system
    
    Args:
        pity_counter: Number of pulls since last high-tier hero
        is_premium: If True, use premium pool (includes UR/UR+), else common pool (SR/SSR/SSR+)
    """
    # Determine which pool and rates to use
    if is_premium:
        # Premium pool: All rarities including UR and UR+ (exclusive to premium)
        available_heroes = HERO_POOL
        rates = GACHA_RATES_PREMIUM
        pity_threshold = PITY_THRESHOLD_PREMIUM
    else:
        # Common pool: SR, SSR, and SSR+ heroes only (no UR/UR+)
        available_heroes = [h for h in HERO_POOL if h.rarity in ["SR", "SSR", "SSR+"]]
        rates = GACHA_RATES_COMMON
        pity_threshold = PITY_THRESHOLD_COMMON
    
    # Pity system: guarantee high tier at threshold
    if pity_counter >= pity_threshold:
        if is_premium:
            # Premium pity: weighted chance at SSR, UR, or UR+
            rarities = ["SSR", "UR", "UR+"]
            weights = [60, 30, 10]  # Better UR/UR+ chances at pity
        else:
            # Common pity: guaranteed SSR or SSR+
            rarities = ["SSR", "SSR+"]
            weights = [70, 30]  # SSR+ is rarer even at pity
    else:
        rarities = list(rates.keys())
        weights = list(rates.values())
    
    selected_rarity = random.choices(rarities, weights=weights)[0]
    
    # Get all heroes of selected rarity from available pool
    rarity_heroes = [h for h in available_heroes if h.rarity == selected_rarity]
    
    if not rarity_heroes:
        # Fallback to SR if no heroes found (shouldn't happen)
        rarity_heroes = [h for h in available_heroes if h.rarity == "SR"]
    
    return random.choice(rarity_heroes)

# API Routes
@api_router.post("/user/register")
async def register_user(username: str):
    """Register a new user"""
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(username=username)
    await db.users.insert_one(user.dict())
    return user

@api_router.get("/user/{username}")
async def get_user(username: str):
    """Get user data"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return convert_objectid(user)

@api_router.post("/user/{username}/login")
async def user_login(username: str):
    """Handle daily login and rewards"""
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_data)
    now = datetime.utcnow()
    
    # Check if it's a new day
    if user.last_login:
        last_login_date = user.last_login.date()
        today = now.date()
        if last_login_date < today:
            user.login_days += 1
    else:
        user.login_days = 1
    
    # Calculate login rewards
    reward = LoginReward(day_count=user.login_days)
    
    # Base daily rewards
    reward.coins = 1000
    reward.gold = 500
    
    # Milestone rewards
    if user.login_days % 7 == 0:
        reward.crystals = 50
    
    # Free summons schedule (10-15 per day over 250 days)
    # This gives roughly 3000 free summons over 250 days
    summons_per_day = random.randint(10, 15)
    if user.daily_summons_claimed < user.login_days * 12:  # Average 12 per day
        reward.free_summons = summons_per_day
    
    # Apply rewards
    user.coins += reward.coins
    user.gold += reward.gold
    user.crystals += reward.crystals
    user.last_login = now
    
    await db.users.update_one(
        {"username": username},
        {"$set": user.dict()}
    )
    
    return reward

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

@api_router.post("/gacha/pull")
async def pull_gacha(username: str, request: PullRequest):
    """Perform gacha pull - Premium (crystals) or Common (coins)"""
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_data)
    num_pulls = 10 if request.pull_type == "multi" else 1
    
    # Determine if premium or common summon
    is_premium = request.currency_type == "crystals"
    
    # Calculate cost
    if is_premium:
        cost = CRYSTAL_COST_MULTI if request.pull_type == "multi" else CRYSTAL_COST_SINGLE
        if user.crystals < cost:
            raise HTTPException(status_code=400, detail="Not enough crystals")
        user.crystals -= cost
        crystals_spent = cost
        coins_spent = 0
        pity_counter = user.pity_counter_premium
    else:
        cost = COIN_COST_MULTI if request.pull_type == "multi" else COIN_COST_SINGLE
        if user.coins < cost:
            raise HTTPException(status_code=400, detail="Not enough coins")
        user.coins -= cost
        crystals_spent = 0
        coins_spent = cost
        pity_counter = user.pity_counter
    
    # Perform pulls
    pulled_heroes = []
    for _ in range(num_pulls):
        pity_counter += 1
        hero = get_random_hero(pity_counter, is_premium)
        
        # Reset pity based on pool type
        if is_premium:
            # Premium: reset on SSR, UR, or UR+
            if hero.rarity in ["SSR", "UR", "UR+"]:
                pity_counter = 0
        else:
            # Common: reset on SSR or SSR+
            if hero.rarity in ["SSR", "SSR+"]:
                pity_counter = 0
        
        # Create user hero instance
        user_hero = UserHero(
            user_id=user.id,
            hero_id=hero.id,
            current_hp=hero.base_hp,
            current_atk=hero.base_atk,
            current_def=hero.base_def
        )
        
        # Check for duplicates and merge
        existing_heroes = await db.user_heroes.find(
            {"user_id": user.id, "hero_id": hero.id}
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
        
        pulled_heroes.append(user_hero)
    
    user.total_pulls += num_pulls
    
    # Update user with new pity counter
    if is_premium:
        user.pity_counter_premium = pity_counter
    else:
        user.pity_counter = pity_counter
    
    # Update user
    await db.users.update_one(
        {"username": username},
        {"$set": user.dict()}
    )
    
    return GachaResult(
        heroes=pulled_heroes,
        new_pity_counter=pity_counter,
        crystals_spent=crystals_spent,
        coins_spent=coins_spent
    )

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

@api_router.post("/idle/claim")
async def claim_idle_rewards(username: str):
    """Claim idle rewards - manual collection with VIP-based caps"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate VIP level
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    idle_cap_hours = get_idle_cap_hours(vip_level)
    
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
            "gold_earned": 0,
            "time_away": 0,
            "collection_started": True,
            "vip_level": vip_level,
            "max_hours": idle_cap_hours
        }
    
    # Calculate time since collection started
    now = datetime.utcnow()
    time_away = (now - collection_started).total_seconds()
    
    # Cap at VIP-based hours
    max_seconds = idle_cap_hours * 3600
    time_away = min(time_away, max_seconds)
    
    # Calculate gold earned with VIP rate bonus
    gold_per_minute = get_idle_gold_rate(vip_level)
    gold_per_second = gold_per_minute / 60
    gold_earned = int(gold_per_second * time_away)
    
    # Update user gold and restart collection
    await db.users.update_one(
        {"username": username},
        {
            "$inc": {"gold": gold_earned},
            "$set": {
                "idle_collection_started_at": now,
                "idle_collection_last_claimed": now,
                "vip_level": vip_level
            }
        }
    )
    
    return {
        "gold_earned": gold_earned,
        "time_away": int(time_away),
        "hours_away": time_away / 3600,
        "capped": time_away >= max_seconds,
        "vip_level": vip_level,
        "max_hours": idle_cap_hours
    }

@api_router.get("/idle/status/{username}")
async def get_idle_status(username: str):
    """Get current idle collection status"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    vip_level = calculate_vip_level(user.get("total_spent", 0))
    idle_cap_hours = get_idle_cap_hours(vip_level)
    
    collection_started = user.get("idle_collection_started_at")
    if not collection_started:
        return {
            "is_collecting": False,
            "gold_pending": 0,
            "time_elapsed": 0,
            "vip_level": vip_level,
            "max_hours": idle_cap_hours
        }
    
    now = datetime.utcnow()
    time_elapsed = (now - collection_started).total_seconds()
    max_seconds = idle_cap_hours * 3600
    
    # Calculate pending gold with VIP rate bonus
    capped_time = min(time_elapsed, max_seconds)
    gold_per_minute = get_idle_gold_rate(vip_level)
    gold_per_second = gold_per_minute / 60
    gold_pending = int(gold_per_second * capped_time)
    
    return {
        "is_collecting": True,
        "gold_pending": gold_pending,
        "time_elapsed": time_elapsed,
        "hours_elapsed": time_elapsed / 3600,
        "is_capped": time_elapsed >= max_seconds,
        "vip_level": vip_level,
        "max_hours": idle_cap_hours,
        "time_until_cap": max(0, max_seconds - time_elapsed)
    }

@api_router.get("/vip/info/{username}")
async def get_vip_info(username: str):
    """Get VIP information and benefits"""
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
    spend_needed = next_tier["spend"] - total_spent if next_vip > current_vip else 0
    
    return {
        "current_vip_level": current_vip,
        "total_spent": total_spent,
        "current_idle_hours": current_tier["idle_hours"],
        "current_idle_rate": get_idle_gold_rate(current_vip),
        "current_avatar_frame": get_avatar_frame(current_vip),
        "next_vip_level": next_vip if next_vip > current_vip else None,
        "next_idle_hours": next_tier["idle_hours"] if next_vip > current_vip else None,
        "next_idle_rate": get_idle_gold_rate(next_vip) if next_vip > current_vip else None,
        "next_avatar_frame": get_avatar_frame(next_vip) if next_vip > current_vip else None,
        "spend_needed_for_next": spend_needed,
        "all_tiers": VIP_TIERS
    }

@api_router.get("/vip/comparison/{username}")
async def get_vip_comparison(username: str):
    """Get VIP tier comparison for store display"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    total_spent = user.get("total_spent", 0)
    current_vip = calculate_vip_level(total_spent)
    
    # Build comparison data
    comparison = {
        "current_vip": current_vip,
        "total_spent": total_spent,
        "tiers": {}
    }
    
    # Previous tier (if exists)
    if current_vip > 0:
        prev_vip = current_vip - 1
        comparison["tiers"]["previous"] = {
            "level": prev_vip,
            "spend_required": VIP_TIERS[prev_vip]["spend"],
            "idle_hours": VIP_TIERS[prev_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(prev_vip),
            "avatar_frame": get_avatar_frame(prev_vip),
            "status": "completed"
        }
    
    # Current tier
    comparison["tiers"]["current"] = {
        "level": current_vip,
        "spend_required": VIP_TIERS[current_vip]["spend"],
        "idle_hours": VIP_TIERS[current_vip]["idle_hours"],
        "idle_rate": get_idle_gold_rate(current_vip),
        "avatar_frame": get_avatar_frame(current_vip),
        "status": "active"
    }
    
    # Next tier (if exists)
    if current_vip < 15:
        next_vip = current_vip + 1
        comparison["tiers"]["next"] = {
            "level": next_vip,
            "spend_required": VIP_TIERS[next_vip]["spend"],
            "idle_hours": VIP_TIERS[next_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(next_vip),
            "avatar_frame": get_avatar_frame(next_vip),
            "status": "locked",
            "spend_needed": VIP_TIERS[next_vip]["spend"] - total_spent
        }
    
    # Next 2 tiers (if exists)
    if current_vip < 14:
        next2_vip = current_vip + 2
        comparison["tiers"]["next2"] = {
            "level": next2_vip,
            "spend_required": VIP_TIERS[next2_vip]["spend"],
            "idle_hours": VIP_TIERS[next2_vip]["idle_hours"],
            "idle_rate": get_idle_gold_rate(next2_vip),
            "avatar_frame": get_avatar_frame(next2_vip),
            "status": "future",
            "spend_needed": VIP_TIERS[next2_vip]["spend"] - total_spent
        }
    
    return comparison

@api_router.post("/vip/purchase")
async def vip_purchase(username: str, amount_usd: float):
    """Simulate VIP purchase (in production, integrate with payment processor)"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="Invalid purchase amount")
    
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
    
    return {
        "purchase_amount": amount_usd,
        "crystals_received": crystals_purchased,
        "new_total_spent": new_total_spent,
        "new_vip_level": new_vip_level,
        "new_idle_cap_hours": get_idle_cap_hours(new_vip_level),
        "new_idle_rate": get_idle_gold_rate(new_vip_level),
        "new_avatar_frame": new_avatar_frame
    }

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
        member_ids=[user["id"]]
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
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
