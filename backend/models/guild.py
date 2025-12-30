"""Guild models"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import uuid

class GuildMember(BaseModel):
    user_id: str
    username: str
    role: str = "member"  # leader, officer, member
    contribution: int = 0
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class Guild(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    server_id: str
    level: int = 1
    experience: int = 0
    
    # Members
    leader_id: str
    members: List[GuildMember] = []
    max_members: int = 30
    
    # Resources
    guild_funds: int = 0
    
    # Boss System
    boss_level: int = 1
    boss_hp: int = 100000
    boss_max_hp: int = 100000
    boss_defeated_count: int = 0
    
    # War System
    war_points: int = 0
    war_wins: int = 0
    war_losses: int = 0
    
    # Flags
    is_recruiting: bool = True
    min_level_requirement: int = 1
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
