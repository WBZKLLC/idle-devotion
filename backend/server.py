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
    gems: int = 300  # Premium currency
    coins: int = 10000  # Regular currency
    gold: int = 5000  # Idle resource
    pity_counter: int = 0  # Counts towards guaranteed SSR at 50
    total_pulls: int = 0
    login_days: int = 0
    last_login: Optional[datetime] = None
    daily_summons_claimed: int = 0  # Track daily free summons
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    hero_ids: List[str] = []  # Max 6 heroes
    is_active: bool = False

class GachaResult(BaseModel):
    heroes: List[UserHero]
    new_pity_counter: int
    gems_spent: int
    coins_spent: int

class PullRequest(BaseModel):
    pull_type: str  # "single" or "multi"
    currency_type: str  # "gems" or "coins"

class IdleRewards(BaseModel):
    gold_earned: int
    time_away: int  # seconds

class LoginReward(BaseModel):
    gems: int = 0
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
    rewards: Dict[str, int]  # {"gems": 50, "coins": 1000, "gold": 500}
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

# Gacha rates configuration
GACHA_RATES = {
    "SR": 60.0,   # 60%
    "SSR": 30.0,  # 30%
    "UR": 9.0,    # 9%
    "UR+": 1.0    # 1%
}

PITY_THRESHOLD = 50
GEM_COST_SINGLE = 100
GEM_COST_MULTI = 900  # 10 pulls, 100 gem discount
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
    
    # UR Heroes
    Hero(name="Seraphiel the Radiant", rarity="UR", element="Light", hero_class="Support",
         base_hp=1600, base_atk=200, base_def=140,
         image_url="https://img.freepik.com/free-photo/anime-style-portrait-traditional-japanese-samurai-character_23-2151499067.jpg",
         description="An archangel with power beyond mortal comprehension"),
    Hero(name="Malachi the Destroyer", rarity="UR", element="Fire", hero_class="Warrior",
         base_hp=1800, base_atk=250, base_def=130,
         image_url="https://img.freepik.com/free-photo/anime-japanese-character_23-2151478202.jpg",
         description="A god of war who revels in destruction"),
    
    # UR+ Heroes  
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

@app.on_event("startup")
async def startup_event():
    await init_heroes()

def get_random_hero(pity_counter: int) -> Hero:
    """Select a random hero based on gacha rates with pity system"""
    # Pity system: guarantee SSR at 50 pulls
    if pity_counter >= PITY_THRESHOLD:
        rarities = ["SSR", "UR", "UR+"]
        weights = [85, 13, 2]  # Weighted towards SSR but can still get better
    else:
        rarities = list(GACHA_RATES.keys())
        weights = list(GACHA_RATES.values())
    
    selected_rarity = random.choices(rarities, weights=weights)[0]
    
    # Get all heroes of selected rarity
    rarity_heroes = [h for h in HERO_POOL if h.rarity == selected_rarity]
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
        reward.gems = 50
    
    # Free summons schedule (10-15 per day over 250 days)
    # This gives roughly 3000 free summons over 250 days
    summons_per_day = random.randint(10, 15)
    if user.daily_summons_claimed < user.login_days * 12:  # Average 12 per day
        reward.free_summons = summons_per_day
    
    # Apply rewards
    user.coins += reward.coins
    user.gold += reward.gold
    user.gems += reward.gems
    user.last_login = now
    
    await db.users.update_one(
        {"username": username},
        {"$set": user.dict()}
    )
    
    return reward

@api_router.post("/gacha/pull")
async def pull_gacha(username: str, request: PullRequest):
    """Perform gacha pull"""
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_data)
    num_pulls = 10 if request.pull_type == "multi" else 1
    
    # Calculate cost
    if request.currency_type == "gems":
        cost = GEM_COST_MULTI if request.pull_type == "multi" else GEM_COST_SINGLE
        if user.gems < cost:
            raise HTTPException(status_code=400, detail="Not enough gems")
        user.gems -= cost
        gems_spent = cost
        coins_spent = 0
    else:
        cost = COIN_COST_MULTI if request.pull_type == "multi" else COIN_COST_SINGLE
        if user.coins < cost:
            raise HTTPException(status_code=400, detail="Not enough coins")
        user.coins -= cost
        gems_spent = 0
        coins_spent = cost
    
    # Perform pulls
    pulled_heroes = []
    for _ in range(num_pulls):
        user.pity_counter += 1
        hero = get_random_hero(user.pity_counter)
        
        # Reset pity if SSR or better
        if hero.rarity in ["SSR", "UR", "UR+"]:
            user.pity_counter = 0
        
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
    
    # Update user
    await db.users.update_one(
        {"username": username},
        {"$set": user.dict()}
    )
    
    return GachaResult(
        heroes=pulled_heroes,
        new_pity_counter=user.pity_counter,
        gems_spent=gems_spent,
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
    """Claim idle rewards based on time away"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.utcnow()
    last_login = user.get("last_login")
    
    if last_login:
        time_away = (now - last_login).total_seconds()
        # Cap at 8 hours
        time_away = min(time_away, 8 * 3600)
    else:
        time_away = 0
    
    # Calculate gold earned (100 gold per minute, capped at 8 hours)
    gold_per_second = 100 / 60
    gold_earned = int(gold_per_second * time_away)
    
    # Update user gold
    await db.users.update_one(
        {"username": username},
        {"$inc": {"gold": gold_earned}}
    )
    
    return IdleRewards(gold_earned=gold_earned, time_away=int(time_away))

@api_router.get("/")
async def root():
    return {"message": "Gacha Game API", "version": "1.0"}

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
