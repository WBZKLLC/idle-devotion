"""Configuration constants for the game"""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Rarity multipliers for stats
RARITY_MULTIPLIERS = {
    "N": 0.6, "R": 0.8, "SR": 1.0, "SSR": 1.3, "SSR+": 1.5, "UR": 1.8, "UR+": 2.2
}

# ==================== STAMINA SYSTEM ====================
STAMINA_MAX = 100
STAMINA_REGEN_MINUTES = 5  # 1 stamina per 5 minutes
STAMINA_COSTS = {
    "story_stage": 6,
    "exp_stage": 10,
    "gold_stage": 10,
    "skill_dungeon": 12,
    "equipment_dungeon": 15,
    "boss_challenge": 20,
}

# ==================== CURRENCY DEFAULTS ====================
DEFAULT_CURRENCIES = {
    "gold": 5000,
    "coins": 10000,
    "crystals": 300,
    "divine_essence": 0,
    "soul_dust": 0,  # Hero EXP
    "skill_essence": 0,
    "star_crystals": 0,
    "divine_gems": 100,  # Premium currency
    "stamina": STAMINA_MAX,
    "guild_coins": 0,
    "pvp_medals": 0,
    "enhancement_stones": 0,
    "hero_shards": 0,
}

# ==================== HERO LEVELING ====================
HERO_MAX_LEVEL = 300
HERO_LEVEL_COSTS = {
    # Level ranges: (gold_per_level, soul_dust_per_level)
    (1, 20): (100, 50),
    (21, 50): (250, 100),
    (51, 100): (500, 200),
    (101, 150): (1000, 400),
    (151, 200): (2000, 800),
    (201, 250): (4000, 1500),
    (251, 300): (8000, 3000),
}

# ==================== SKILL LEVELING ====================
SKILL_MAX_LEVEL = 15
SKILL_ESSENCE_COSTS = [0, 10, 20, 35, 50, 75, 100, 150, 200, 300, 400, 500, 700, 900, 1200]

# ==================== STAR PROMOTION ====================
STAR_PROMOTION_COSTS = {
    # Current stars: star_crystals needed
    0: 50,    # 0 -> 1 star
    1: 100,   # 1 -> 2 stars
    2: 200,   # 2 -> 3 stars
    3: 400,   # 3 -> 4 stars
    4: 800,   # 4 -> 5 stars
    5: 1500,  # 5 -> 6 stars (max)
}

# ==================== EQUIPMENT SYSTEM ====================
EQUIPMENT_SLOTS = ["weapon", "helmet", "chestplate", "gloves", "boots", "talisman"]

EQUIPMENT_SLOT_STATS = {
    "weapon": "atk",
    "helmet": "def",
    "chestplate": "hp",
    "gloves": "crit_rate",
    "boots": "speed",
    "talisman": "crit_dmg",
}

EQUIPMENT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]

EQUIPMENT_RARITY_MULTIPLIERS = {
    "common": 1.0,
    "uncommon": 1.3,
    "rare": 1.6,
    "epic": 2.0,
    "legendary": 2.5,
}

EQUIPMENT_BASE_STATS = {
    "weapon": {"atk": 50},
    "helmet": {"def": 30},
    "chestplate": {"hp": 500},
    "gloves": {"crit_rate": 3},  # percentage
    "boots": {"speed": 10},
    "talisman": {"crit_dmg": 10},  # percentage
}

EQUIPMENT_MAX_LEVEL = 20
EQUIPMENT_ENHANCE_COSTS = {
    # Level: (gold, enhancement_stones)
    1: (100, 1), 2: (150, 1), 3: (200, 2), 4: (300, 2), 5: (400, 3),
    6: (500, 3), 7: (650, 4), 8: (800, 4), 9: (1000, 5), 10: (1200, 6),
    11: (1500, 7), 12: (1800, 8), 13: (2200, 10), 14: (2600, 12), 15: (3000, 14),
    16: (3500, 16), 17: (4000, 18), 18: (4500, 20), 19: (5000, 25), 20: (6000, 30),
}

# ==================== EQUIPMENT SETS ====================
EQUIPMENT_SETS = {
    "warrior": {
        "name": "Warrior's Might",
        "description": "Forged in the fires of countless battles",
        "bonuses": {
            2: {"atk_percent": 10},
            4: {"atk_percent": 20, "hp_percent": 10},
            6: {"atk_percent": 35, "hp_percent": 15, "crit_rate": 5},
        }
    },
    "mage": {
        "name": "Arcane Vestments",
        "description": "Woven with threads of pure magic",
        "bonuses": {
            2: {"atk_percent": 12},
            4: {"atk_percent": 25, "speed": 15},
            6: {"atk_percent": 40, "speed": 25, "crit_dmg": 20},
        }
    },
    "assassin": {
        "name": "Shadow's Edge",
        "description": "Darkness incarnate",
        "bonuses": {
            2: {"crit_rate": 8},
            4: {"crit_rate": 15, "crit_dmg": 20},
            6: {"crit_rate": 25, "crit_dmg": 50, "speed": 20},
        }
    },
    "tank": {
        "name": "Guardian's Bastion",
        "description": "An unbreakable fortress",
        "bonuses": {
            2: {"hp_percent": 15},
            4: {"hp_percent": 25, "def_percent": 15},
            6: {"hp_percent": 40, "def_percent": 30, "damage_reduction": 10},
        }
    },
}

# ==================== RUNE SYSTEM ====================
RUNE_TYPES = {
    "power": {"stat": "atk_percent", "values": [3, 5, 8, 12, 15]},
    "vitality": {"stat": "hp_percent", "values": [3, 5, 8, 12, 15]},
    "precision": {"stat": "crit_rate", "values": [2, 3, 5, 7, 10]},
    "destruction": {"stat": "crit_dmg", "values": [4, 6, 10, 15, 20]},
    "swiftness": {"stat": "speed", "values": [5, 8, 12, 18, 25]},
    "fortitude": {"stat": "def_percent", "values": [3, 5, 8, 12, 15]},
}

RUNE_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]

# Epic+ equipment can have sockets
SOCKET_REQUIREMENTS = {
    "common": 0,
    "uncommon": 0,
    "rare": 0,
    "epic": 1,
    "legendary": 2,
}

# ==================== GACHA RATES ====================
GACHA_RATES_COMMON = {
    "SR": 90.8, "SSR": 8.0, "SSR+": 1.2,
}

GACHA_RATES_PREMIUM = {
    "SR": 66.8, "SSR": 32.0, "UR": 1.2,
}

# Divine Summons: Heroes + Resources
GACHA_RATES_DIVINE = {
    # Heroes
    "UR+": 0.8,
    "UR": 2.7,
    # Crystal Jackpots
    "crystals_8000": 1.2,
    "crystals_5000": 1.7,
    "crystals_3000": 3.0,
    # Valuable Resources (lower % = higher value)
    "legendary_equipment_box": 0.5,
    "enhancement_stones_100": 1.5,
    "enhancement_stones_50": 3.0,
    "star_crystals_200": 1.0,
    "star_crystals_100": 2.0,
    "skill_essence_500": 2.0,
    "skill_essence_200": 4.0,
    "soul_dust_10000": 3.0,
    "soul_dust_5000": 5.0,
    # Common Fillers
    "divine_essence_10": 12.0,
    "divine_essence_5": 15.0,
    "gold_500k": 10.0,
    "gold_250k": 12.0,
    "stamina_potion_50": 8.0,
    "stamina_potion_full": 4.0,
    "enhancement_stones_20": 8.6,
}

# Divine Summon Filler Rewards
DIVINE_FILLER_REWARDS = {
    "crystals_8000": {"crystals": 8000, "display": "💎 8,000 Crystals!", "rarity": "legendary"},
    "crystals_5000": {"crystals": 5000, "display": "💎 5,000 Crystals!", "rarity": "epic"},
    "crystals_3000": {"crystals": 3000, "display": "💎 3,000 Crystals", "rarity": "rare"},
    "legendary_equipment_box": {"equipment_box": "legendary", "display": "📦 Legendary Gear Box!", "rarity": "legendary"},
    "enhancement_stones_100": {"enhancement_stones": 100, "display": "🔨 100 Enhancement Stones!", "rarity": "epic"},
    "enhancement_stones_50": {"enhancement_stones": 50, "display": "🔨 50 Enhancement Stones", "rarity": "rare"},
    "enhancement_stones_20": {"enhancement_stones": 20, "display": "🔨 20 Enhancement Stones", "rarity": "uncommon"},
    "star_crystals_200": {"star_crystals": 200, "display": "⭐ 200 Star Crystals!", "rarity": "epic"},
    "star_crystals_100": {"star_crystals": 100, "display": "⭐ 100 Star Crystals", "rarity": "rare"},
    "skill_essence_500": {"skill_essence": 500, "display": "🔮 500 Skill Essence!", "rarity": "epic"},
    "skill_essence_200": {"skill_essence": 200, "display": "🔮 200 Skill Essence", "rarity": "rare"},
    "soul_dust_10000": {"soul_dust": 10000, "display": "✨ 10K Soul Dust!", "rarity": "epic"},
    "soul_dust_5000": {"soul_dust": 5000, "display": "✨ 5K Soul Dust", "rarity": "rare"},
    "divine_essence_10": {"divine_essence": 10, "display": "🌟 10 Divine Essence!", "rarity": "epic"},
    "divine_essence_5": {"divine_essence": 5, "display": "🌟 5 Divine Essence", "rarity": "rare"},
    "gold_500k": {"gold": 500000, "display": "🪙 500K Gold!", "rarity": "epic"},
    "gold_250k": {"gold": 250000, "display": "🪙 250K Gold", "rarity": "rare"},
    "stamina_potion_50": {"stamina": 50, "display": "⚡ 50 Stamina", "rarity": "uncommon"},
    "stamina_potion_full": {"stamina": 100, "display": "⚡ Full Stamina!", "rarity": "rare"},
}

# Pity thresholds
PITY_THRESHOLD_COMMON = 50
PITY_THRESHOLD_PREMIUM = 50
PITY_THRESHOLD_DIVINE = 40

# Summon costs
DIVINE_ESSENCE_COST_SINGLE = 1
DIVINE_ESSENCE_COST_MULTI = 10
CRYSTAL_COST_SINGLE = 100
CRYSTAL_COST_MULTI = 900
COIN_COST_SINGLE = 1000
COIN_COST_MULTI = 9000

# ==================== DUPLICATE CONVERSION ====================
# When pulling duplicate heroes, convert to Star Crystals
DUPLICATE_CONVERSION = {
    "N": 1,
    "R": 3,
    "SR": 10,
    "SSR": 30,
    "SSR+": 50,
    "UR": 100,
    "UR+": 200,
}

# ==================== VIP SYSTEM ====================
VIP_THRESHOLDS = {
    0: 0, 1: 5, 2: 15, 3: 30, 4: 50, 5: 100,
    6: 200, 7: 350, 8: 500, 9: 750, 10: 1000,
    11: 1500, 12: 2000, 13: 3000, 14: 5000, 15: 10000,
}

VIP_BENEFITS = {
    0: {"daily_stamina": 0, "boss_attacks": 3, "arena_tickets": 5},
    1: {"daily_stamina": 20, "boss_attacks": 3, "arena_tickets": 6},
    2: {"daily_stamina": 30, "boss_attacks": 4, "arena_tickets": 6},
    3: {"daily_stamina": 40, "boss_attacks": 4, "arena_tickets": 7},
    4: {"daily_stamina": 50, "boss_attacks": 5, "arena_tickets": 7},
    5: {"daily_stamina": 60, "boss_attacks": 5, "arena_tickets": 8},
    6: {"daily_stamina": 70, "boss_attacks": 6, "arena_tickets": 8},
    7: {"daily_stamina": 80, "boss_attacks": 6, "arena_tickets": 9},
    8: {"daily_stamina": 90, "boss_attacks": 7, "arena_tickets": 9},
    9: {"daily_stamina": 100, "boss_attacks": 7, "arena_tickets": 10},
    10: {"daily_stamina": 120, "boss_attacks": 8, "arena_tickets": 10},
    11: {"daily_stamina": 140, "boss_attacks": 8, "arena_tickets": 12},
    12: {"daily_stamina": 160, "boss_attacks": 9, "arena_tickets": 12},
    13: {"daily_stamina": 180, "boss_attacks": 9, "arena_tickets": 15},
    14: {"daily_stamina": 200, "boss_attacks": 10, "arena_tickets": 15},
    15: {"daily_stamina": 250, "boss_attacks": 12, "arena_tickets": 20},
}
