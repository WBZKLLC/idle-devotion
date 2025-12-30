"""API Request/Response models"""
from pydantic import BaseModel
from typing import Optional, List, Dict

# Auth
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

# Gacha
class PullRequest(BaseModel):
    pull_type: str = "single"  # "single" or "multi"
    currency_type: str = "coins"  # "coins", "crystals", or "divine_essence"

# Equipment
class EquipRequest(BaseModel):
    equipment_id: str
    hero_instance_id: str

class EnhanceEquipmentRequest(BaseModel):
    equipment_id: str
    levels: int = 1  # How many levels to enhance

class SocketRuneRequest(BaseModel):
    equipment_id: str
    rune_id: str
    socket_index: int = 0

# Hero
class LevelUpHeroRequest(BaseModel):
    hero_instance_id: str
    levels: int = 1

class PromoteHeroRequest(BaseModel):
    hero_instance_id: str

class UpgradeSkillRequest(BaseModel):
    hero_instance_id: str
    skill_id: str

class DismantleHeroRequest(BaseModel):
    hero_instance_ids: List[str]

# Battle
class BattleRequest(BaseModel):
    stage_type: str  # story, exp, gold, skill, equipment, boss
    stage_id: Optional[str] = None

class AbyssBattleRequest(BaseModel):
    team_ids: Optional[List[str]] = None

# Guild
class CreateGuildRequest(BaseModel):
    name: str
    description: str = ""

class GuildDonationRequest(BaseModel):
    currency: str = "coins"
    amount: int = 1000
