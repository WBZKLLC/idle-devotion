"""Hero models"""
from pydantic import BaseModel, Field
from typing import List, Optional
import hashlib

def generate_stable_hero_id(hero_name: str, rarity: str) -> str:
    """Generate a stable, deterministic hero ID based on name and rarity."""
    unique_string = f"{hero_name}_{rarity}_divine_heroes_v1"
    return hashlib.md5(unique_string.encode()).hexdigest()

class HeroSkill(BaseModel):
    id: str
    name: str
    description: str
    skill_type: str  # "active" or "passive"
    damage_multiplier: float = 1.0
    heal_percent: float = 0.0
    buff_type: Optional[str] = None
    buff_percent: float = 0.0
    cooldown: int = 0
    unlock_level: int = 1
    unlock_stars: int = 0

class HeroBase(BaseModel):
    name: str
    rarity: str  # N, R, SR, SSR, SSR+, UR, UR+
    element: str  # Fire, Water, Earth, Wind, Light, Dark
    hero_class: str  # Warrior, Mage, Archer
    base_hp: int
    base_atk: int
    base_def: int
    base_speed: int = 100
    image_url: str
    description: str
    skills: List[HeroSkill] = []
    position: str = "back"  # "front" or "back"

class Hero(HeroBase):
    id: str = ""
    
    def __init__(self, **data):
        if not data.get('id') or data.get('id') == '':
            name = data.get('name', '')
            rarity = data.get('rarity', '')
            data['id'] = generate_stable_hero_id(name, rarity)
        super().__init__(**data)
