"""Equipment and Rune models"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import uuid

class Rune(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    rune_type: str  # power, vitality, precision, etc.
    rarity: str  # common to legendary
    tier: int = 1  # 1-5 determines stat value
    stat: str  # The stat it boosts
    value: float  # The percentage boost
    
    owner_id: Optional[str] = None  # User ID
    equipped_on: Optional[str] = None  # Equipment ID
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Equipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slot: str  # weapon, helmet, chestplate, gloves, boots, talisman
    rarity: str  # common, uncommon, rare, epic, legendary
    set_id: Optional[str] = None  # Equipment set ID (warrior, mage, etc.)
    
    # Level and enhancement
    level: int = 1
    max_level: int = 20
    
    # Stats
    primary_stat: str  # Main stat type (atk, def, hp, etc.)
    primary_value: int  # Base value before enhancement
    
    # Sub stats (rare+ equipment)
    sub_stats: Dict[str, float] = Field(default_factory=dict)
    
    # Sockets for runes (epic+ equipment)
    sockets: int = 0
    equipped_runes: List[str] = Field(default_factory=list)  # Rune IDs
    
    # Ownership
    owner_id: Optional[str] = None  # User ID
    equipped_by: Optional[str] = None  # UserHero ID
    
    # Flags
    is_locked: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EquipmentSet(BaseModel):
    id: str
    name: str
    description: str
    bonuses: Dict[int, Dict[str, float]]  # {2: {"atk_percent": 10}, 4: {...}}
