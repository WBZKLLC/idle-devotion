"""User and UserHero models"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import uuid
from ..core.config import DEFAULT_CURRENCIES, STAMINA_MAX

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: Optional[str] = None
    server_id: str = "server_1"
    
    # Currency System
    gold: int = DEFAULT_CURRENCIES["gold"]
    coins: int = DEFAULT_CURRENCIES["coins"]
    crystals: int = DEFAULT_CURRENCIES["crystals"]
    divine_essence: int = DEFAULT_CURRENCIES["divine_essence"]
    soul_dust: int = DEFAULT_CURRENCIES["soul_dust"]  # Hero EXP currency
    skill_essence: int = DEFAULT_CURRENCIES["skill_essence"]
    star_crystals: int = DEFAULT_CURRENCIES["star_crystals"]
    divine_gems: int = DEFAULT_CURRENCIES["divine_gems"]  # Premium currency
    guild_coins: int = DEFAULT_CURRENCIES["guild_coins"]
    pvp_medals: int = DEFAULT_CURRENCIES["pvp_medals"]
    enhancement_stones: int = DEFAULT_CURRENCIES["enhancement_stones"]
    hero_shards: int = DEFAULT_CURRENCIES["hero_shards"]
    
    # Stamina System
    stamina: int = STAMINA_MAX
    stamina_last_regen: Optional[datetime] = None
    
    # Legacy/Other currencies
    friendship_points: int = 0
    
    # Gacha Pity
    pity_counter: int = 0
    pity_counter_premium: int = 0
    pity_counter_divine: int = 0
    total_pulls: int = 0
    
    # Login tracking
    login_days: int = 0
    last_login: Optional[datetime] = None
    daily_summons_claimed: int = 0
    
    # Profile
    profile_picture_hero_id: Optional[str] = None
    
    # VIP System
    vip_level: int = 0
    total_spent: float = 0.0
    avatar_frame: str = "default"
    first_purchase_used: bool = False
    
    # Divine Package tracking
    divine_pack_49_purchased: int = 0
    divine_pack_99_purchased: int = 0
    divine_pack_last_reset: Optional[datetime] = None
    
    # Idle Collection
    idle_collection_started_at: Optional[datetime] = None
    idle_collection_last_claimed: Optional[datetime] = None
    active_uses_today: int = 0
    active_last_reset: Optional[datetime] = None
    
    # Guild Boss
    guild_boss_attacks_today: int = 0
    guild_boss_attack_last_reset: Optional[datetime] = None
    
    # Resource tracking
    resource_bag: dict = Field(default_factory=lambda: {
        "coins_collected": 0,
        "gold_collected": 0,
        "crystals_collected": 0,
        "exp_collected": 0,
        "materials_collected": 0,
        "last_updated": None
    })
    
    # Chat/Tutorial
    tutorial_completed: bool = False
    chat_unlock_time: Optional[datetime] = None
    chat_unlocked: bool = False
    
    # Abyss Progress
    abyss_highest_cleared: int = 0
    abyss_total_damage: int = 0
    
    # Arena
    arena_rank: int = 0
    arena_tickets_today: int = 5
    arena_last_reset: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserHero(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    hero_id: str
    level: int = 1
    rank: int = 0  # Star rank (0-6)
    stars: int = 0  # Awakening stars
    duplicates: int = 0
    
    # Current stats (can be modified by equipment, skills, etc.)
    current_hp: int = 1000
    current_atk: int = 100
    current_def: int = 50
    current_speed: int = 100
    current_crit_rate: float = 5.0
    current_crit_dmg: float = 150.0
    
    # Skill levels
    skill_levels: Dict[str, int] = Field(default_factory=lambda: {})
    
    # Equipment slots
    equipment: Dict[str, Optional[str]] = Field(default_factory=lambda: {
        "weapon": None,
        "helmet": None,
        "chestplate": None,
        "gloves": None,
        "boots": None,
        "talisman": None,
    })
    
    # Experience
    experience: int = 0
    
    # Flags
    is_locked: bool = False
    is_favorite: bool = False
    
    obtained_at: datetime = Field(default_factory=datetime.utcnow)
