"""
CAMPAIGN & STORY MODE SYSTEM
=============================

Comprehensive chapter-based campaign with:
- 12 Chapters × 20 Stages + Boss = 252 total stages
- Narrative progression from Mortal Threat → Cosmic Balance
- Tutorialization integrated into gameplay
- Reward structure tied to progression
- Difficulty scaling with exponential formula

PROGRESSION TIMELINE: 3-4 months for F2P daily player
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import math
import random

# ============================================================================
# CHAPTER STRUCTURE & NARRATIVE
# ============================================================================

CHAPTER_DATA = {
    # ========== ACT 1: THE MORTAL THREAT (Chapters 1-3) ==========
    1: {
        "id": 1,
        "title": "The Awakening",
        "subtitle": "A Summoner is Born",
        "act": 1,
        "act_name": "The Mortal Threat",
        "summary": "You awaken as a Summoner during an attack on your homeland by the Crimson Empire. Learn the basics of combat and rescue survivors.",
        "unlock_requirements": {"previous_chapter": None, "player_level": 1},
        "enemy_faction": "empire",
        "recommended_power": 1000,
        "story_heroes_introduced": ["Lyra_Lightblade", "Marcus_Ironshield"],
        "mechanics_introduced": ["basic_combat", "auto_battle", "active_skills"],
        "theme_color": "#3b82f6",
        "background": "burning_village",
        "boss": {
            "id": "commander_vex",
            "name": "Commander Vex",
            "title": "Crimson Vanguard",
            "hp_multiplier": 5.0,
            "mechanic": "Rallying Cry - Every 3 turns, summons 2 Empire Soldiers. Kill quickly or be overwhelmed.",
            "rewards": {"gems": 500, "gold": 50000, "hero_shards": {"Lyra_Lightblade": 30}}
        }
    },
    2: {
        "id": 2,
        "title": "The Siege",
        "subtitle": "Defenders of the Realm",
        "act": 1,
        "act_name": "The Mortal Threat",
        "summary": "The Empire's forces advance on the capital. Rally the scattered defenders and hold the line while civilians evacuate.",
        "unlock_requirements": {"previous_chapter": 1, "player_level": 8},
        "enemy_faction": "empire",
        "recommended_power": 3500,
        "story_heroes_introduced": ["Elena_Stormcaller", "Theron_Shadowbane"],
        "mechanics_introduced": ["hero_upgrade", "skill_leveling", "gacha_unlock"],
        "theme_color": "#ef4444",
        "background": "castle_siege",
        "special_stage": {
            "stage": 10,
            "event": "GACHA_UNLOCK",
            "narrative": "Elena gifts you an ancient summoning crystal. 'Use this to call heroes from across the realms.'",
            "reward": {"free_multi_summon": True, "summon_scrolls": 10}
        },
        "boss": {
            "id": "general_krath",
            "name": "General Krath",
            "title": "The Iron Fist",
            "hp_multiplier": 6.0,
            "mechanic": "Iron Defense - Takes 50% reduced damage while any minion is alive. Focus the adds first.",
            "rewards": {"gems": 750, "gold": 75000, "hero_shards": {"Elena_Stormcaller": 30}}
        }
    },
    3: {
        "id": 3,
        "title": "The Counterattack",
        "subtitle": "Turning the Tide",
        "act": 1,
        "act_name": "The Mortal Threat",
        "summary": "With the capital secured, launch a daring raid behind enemy lines to destroy their siege weapons and supply chains.",
        "unlock_requirements": {"previous_chapter": 2, "player_level": 15},
        "enemy_faction": "empire",
        "recommended_power": 8000,
        "story_heroes_introduced": ["Gareth_Flameheart"],
        "mechanics_introduced": ["gear_system", "set_bonuses", "daily_dungeons_unlock"],
        "theme_color": "#f59e0b",
        "background": "enemy_camp",
        "special_stage": {
            "stage": 15,
            "event": "FORCE_MAGE",
            "narrative": "The Empire's elite guard wear anti-physical armor. You'll need magic to penetrate their defenses!",
            "hint": "Use Elena or another mage - physical attacks deal only 10% damage."
        },
        "boss": {
            "id": "warlord_magnus",
            "name": "Warlord Magnus",
            "title": "The Unbreakable",
            "hp_multiplier": 7.0,
            "mechanic": "Berserk Rage - Below 30% HP, attack damage triples. Burst him down or use healing reduction.",
            "rewards": {"gems": 1000, "gold": 100000, "gear_set": "warrior_set_2pc"}
        },
        "completion_unlock": "daily_dungeons"
    },
    
    # ========== ACT 2: THE ANCIENT EVIL (Chapters 4-6) ==========
    4: {
        "id": 4,
        "title": "Shadows Rising",
        "subtitle": "Whispers of Darkness",
        "act": 2,
        "act_name": "The Ancient Evil",
        "summary": "Victory celebrations are cut short. Dark portals open across the land, and the Empire's true masters reveal themselves - a demonic legion thought extinct for millennia.",
        "unlock_requirements": {"previous_chapter": 3, "player_level": 22},
        "enemy_faction": "demon",
        "recommended_power": 15000,
        "story_heroes_introduced": ["Seraphina_Dawnbringer", "Kael_Voidwalker"],
        "mechanics_introduced": ["faction_system", "elemental_advantages"],
        "theme_color": "#7c3aed",
        "background": "demon_portal",
        "boss": {
            "id": "soul_reaver",
            "name": "Soul Reaver",
            "title": "Devourer of Light",
            "hp_multiplier": 8.0,
            "mechanic": "Soul Drain - Every 4 turns, steals 20% HP from highest HP hero and distributes to minions. Use burst damage or healing reduction.",
            "rewards": {"gems": 1250, "gold": 150000, "hero_shards": {"Seraphina_Dawnbringer": 50}}
        }
    },
    5: {
        "id": 5,
        "title": "The Infernal Gate",
        "subtitle": "Descent into Darkness",
        "act": 2,
        "act_name": "The Ancient Evil",
        "summary": "To close the demon portals, you must venture into the Infernal Realm itself. Allies and enemies blur as you discover the demons were once... something else.",
        "unlock_requirements": {"previous_chapter": 4, "player_level": 30},
        "enemy_faction": "demon",
        "recommended_power": 28000,
        "story_heroes_introduced": ["Azrael_Fallen", "Nyx_Shadowdancer"],
        "mechanics_introduced": ["gear_enhancement", "artifact_system"],
        "theme_color": "#dc2626",
        "background": "infernal_realm",
        "special_stage": {
            "stage": 20,
            "event": "GEAR_SET_DROP",
            "narrative": "A chest sealed with infernal runes. Inside: the complete Demonbane set.",
            "reward": {"gear_set": "demonbane_4pc"}
        },
        "boss": {
            "id": "prince_malachar",
            "name": "Prince Malachar",
            "title": "The Corruptor",
            "hp_multiplier": 9.0,
            "mechanic": "Corruption - Randomly converts one of your heroes to fight for him for 2 turns. Bring cleanse or high-resistance units.",
            "rewards": {"gems": 1500, "gold": 200000, "hero_shards": {"Azrael_Fallen": 50}}
        }
    },
    6: {
        "id": 6,
        "title": "The Binding",
        "subtitle": "Sealing the Breach",
        "act": 2,
        "act_name": "The Ancient Evil",
        "summary": "Armed with forbidden knowledge, perform an ancient ritual to seal the Infernal Gate. But sealing requires sacrifice, and one hero must stay behind...",
        "unlock_requirements": {"previous_chapter": 5, "player_level": 38},
        "enemy_faction": "demon",
        "recommended_power": 45000,
        "story_heroes_introduced": ["Dante_Hellfire"],
        "mechanics_introduced": ["hero_awakening", "ultimate_skills"],
        "theme_color": "#991b1b",
        "background": "ritual_chamber",
        "boss": {
            "id": "archdemon_vezoth",
            "name": "Archdemon Vezoth",
            "title": "Lord of the Breach",
            "hp_multiplier": 10.0,
            "mechanic": "Reality Tear - Creates zones that deal massive damage. Position carefully and use mobility skills.",
            "rewards": {"gems": 2000, "gold": 300000, "legendary_hero_selector": True}
        },
        "completion_unlock": "arena_pvp"
    },
    
    # ========== ACT 3: THE DIVINE CONFLICT (Chapters 7-9) ==========
    7: {
        "id": 7,
        "title": "The Celestial Call",
        "subtitle": "Heaven's Intervention",
        "act": 3,
        "act_name": "The Divine Conflict",
        "summary": "Your actions have drawn the attention of the Celestial Host. Angels descend - but not all come in peace. The war escalates beyond mortal comprehension.",
        "unlock_requirements": {"previous_chapter": 6, "player_level": 45},
        "enemy_faction": "celestial",
        "recommended_power": 70000,
        "story_heroes_introduced": ["Archangel_Michael", "Uriel_Lightbringer"],
        "mechanics_introduced": ["faction_bonuses", "celestial_blessing"],
        "theme_color": "#fbbf24",
        "background": "celestial_realm",
        "special_stage": {
            "stage": 10,
            "event": "FACTION_TUTORIAL",
            "narrative": "The angels are weak to Infernal energy. Celestial > Infernal > Natural > Celestial.",
            "hint": "Bring Infernal heroes for 30% bonus damage against Celestial enemies."
        },
        "boss": {
            "id": "judgment_angel",
            "name": "The Judgment",
            "title": "Arbiter of Souls",
            "hp_multiplier": 11.0,
            "mechanic": "Divine Verdict - Marks one hero for death. If not healed to full in 2 turns, instant kill. Bring strong healers.",
            "rewards": {"gems": 2500, "gold": 400000, "hero_shards": {"Archangel_Michael": 80}}
        }
    },
    8: {
        "id": 8,
        "title": "The Fractured Host",
        "subtitle": "Civil War in Heaven",
        "act": 3,
        "act_name": "The Divine Conflict",
        "summary": "The Celestial Host splits into factions - those who see you as salvation and those who see you as the prophesied destroyer. Navigate divine politics while the world burns.",
        "unlock_requirements": {"previous_chapter": 7, "player_level": 52},
        "enemy_faction": "mixed",
        "recommended_power": 100000,
        "story_heroes_introduced": ["Lucien_Morningstar", "Gabriel_Herald"],
        "mechanics_introduced": ["legendary_gear", "transcendence"],
        "theme_color": "#8b5cf6",
        "background": "shattered_heaven",
        "boss": {
            "id": "fallen_seraph",
            "name": "Seraph Astaroth",
            "title": "The Betrayer",
            "hp_multiplier": 12.0,
            "mechanic": "Duality - Shifts between Light and Dark forms. Light form heals, Dark form damages. Time your burst for Dark phase.",
            "rewards": {"gems": 3000, "gold": 500000, "transcendence_stone": 1}
        }
    },
    9: {
        "id": 9,
        "title": "The Revelation",
        "subtitle": "The Summoner's Truth",
        "act": 3,
        "act_name": "The Divine Conflict",
        "summary": "In the heart of the Celestial Archive, discover the truth: you are not merely a Summoner - you are the reincarnation of the First, the being who created all factions. Your choice will reshape reality.",
        "unlock_requirements": {"previous_chapter": 8, "player_level": 60},
        "enemy_faction": "celestial",
        "recommended_power": 140000,
        "story_heroes_introduced": ["The_Oracle", "Chrono_Archangel_Selene"],
        "mechanics_introduced": ["mythic_heroes", "reality_fragments"],
        "theme_color": "#ec4899",
        "background": "archive_of_creation",
        "branching_choice": {
            "stage": 20,
            "choice_a": {"name": "Embrace the Light", "reward": "avatar_frame_celestial_chosen"},
            "choice_b": {"name": "Accept the Balance", "reward": "avatar_frame_equilibrium"}
        },
        "boss": {
            "id": "prime_guardian",
            "name": "The Prime Guardian",
            "title": "Keeper of Truth",
            "hp_multiplier": 14.0,
            "mechanic": "Memory Echo - Summons copies of all bosses you've faced. True damage bypasses all defenses.",
            "rewards": {"gems": 4000, "gold": 750000, "mythic_hero_shards": {"Chrono_Archangel_Selene": 30}}
        },
        "completion_unlock": "guild_system"
    },
    
    # ========== ACT 4: THE COSMIC BALANCE (Chapters 10-12) ==========
    10: {
        "id": 10,
        "title": "The Unraveling",
        "subtitle": "When Worlds Collide",
        "act": 4,
        "act_name": "The Cosmic Balance",
        "summary": "Your awakening has destabilized reality. The barriers between dimensions crumble. Armies from parallel worlds pour through, each claiming YOU as their rightful ruler.",
        "unlock_requirements": {"previous_chapter": 9, "player_level": 68},
        "enemy_faction": "void",
        "recommended_power": 200000,
        "story_heroes_introduced": ["Void_Emperor", "Paradox_Knight"],
        "mechanics_introduced": ["dimensional_rift", "void_corruption"],
        "theme_color": "#1e1b4b",
        "background": "shattered_dimensions",
        "boss": {
            "id": "mirror_self",
            "name": "The Other You",
            "title": "Shadow of What Could Be",
            "hp_multiplier": 15.0,
            "mechanic": "Perfect Counter - Copies your team composition. Any skill you use is reflected back. Use unpredictable strategies.",
            "rewards": {"gems": 5000, "gold": 1000000, "hero_shards": {"Void_Emperor": 100}}
        }
    },
    11: {
        "id": 11,
        "title": "The Convergence",
        "subtitle": "Alliance of All",
        "act": 4,
        "act_name": "The Cosmic Balance",
        "summary": "Former enemies become allies as the true threat emerges: The Void Itself - the primordial chaos that existed before creation. Unite all factions or watch reality dissolve.",
        "unlock_requirements": {"previous_chapter": 10, "player_level": 75},
        "enemy_faction": "void",
        "recommended_power": 280000,
        "story_heroes_introduced": ["Primordial_Titan", "Harmony_Weaver"],
        "mechanics_introduced": ["ultimate_awakening", "faction_unity"],
        "theme_color": "#0f172a",
        "background": "void_edge",
        "boss": {
            "id": "void_herald",
            "name": "Herald of Oblivion",
            "title": "Voice of the Nothing",
            "hp_multiplier": 18.0,
            "mechanic": "Entropy Field - All stats decay by 5% each turn. Race against time with maximum burst damage.",
            "rewards": {"gems": 6000, "gold": 1500000, "ultimate_awakening_stone": 1}
        }
    },
    12: {
        "id": 12,
        "title": "The Final Balance",
        "subtitle": "Creation or Oblivion",
        "act": 4,
        "act_name": "The Cosmic Balance",
        "summary": "Face the Void Incarnate at the edge of existence. Not a battle of strength, but of will. Your choice determines whether reality is reborn... or ends forever.",
        "unlock_requirements": {"previous_chapter": 11, "player_level": 80},
        "enemy_faction": "void",
        "recommended_power": 400000,
        "story_heroes_introduced": ["The_First_Summoner"],
        "mechanics_introduced": ["true_ending", "new_game_plus"],
        "theme_color": "#ffffff",
        "background": "edge_of_reality",
        "boss": {
            "id": "void_incarnate",
            "name": "The Void Incarnate",
            "title": "The End of All Things",
            "hp_multiplier": 25.0,
            "mechanic": "Absolute Zero - Every 5 turns, one random hero is erased from the battle permanently. You cannot resurrect them. Win before you lose everyone.",
            "rewards": {
                "gems": 10000,
                "gold": 5000000,
                "title": "Savior of Reality",
                "mythic_hero_selector": True,
                "exclusive_frame": "frame_cosmic_champion"
            }
        },
        "completion_unlock": "endgame_raids"
    }
}

# ============================================================================
# STAGE GENERATION
# ============================================================================

def generate_stage_data(chapter: int, stage: int) -> Dict[str, Any]:
    """Generate data for a specific stage"""
    chapter_data = CHAPTER_DATA.get(chapter)
    if not chapter_data:
        return None
    
    stage_id = f"{chapter}-{stage}"
    is_boss = stage == 21  # Stage 21 is chapter boss
    is_mini_boss = stage % 5 == 0 and stage != 21
    
    # Calculate enemy power using exponential formula
    base_power = chapter_data["recommended_power"]
    stage_multiplier = (stage / 20) ** 1.3
    enemy_power = int(base_power * stage_multiplier)
    
    # Generate enemy composition
    enemies = generate_enemy_team(chapter, stage, is_boss, is_mini_boss)
    
    # Generate rewards
    rewards = generate_stage_rewards(chapter, stage, is_boss, is_mini_boss)
    
    stage_data = {
        "stage_id": stage_id,
        "chapter": chapter,
        "stage": stage,
        "is_boss": is_boss,
        "is_mini_boss": is_mini_boss,
        "enemy_power": enemy_power,
        "recommended_player_power": int(enemy_power * 0.8),
        "enemy_team": enemies,
        "waves": 3 if is_boss else 2 if is_mini_boss else 1,
        "first_clear_rewards": rewards["first_clear"],
        "three_star_bonus": rewards["three_star"],
        "sweep_rewards": rewards["sweep"],
        "stamina_cost": 6 + (chapter - 1) + (1 if is_mini_boss else 0) + (2 if is_boss else 0),
    }
    
    # Add special stage events
    special = chapter_data.get("special_stage")
    if special and special.get("stage") == stage:
        stage_data["special_event"] = special
    
    # Add branching choice
    if chapter_data.get("branching_choice") and chapter_data["branching_choice"].get("stage") == stage:
        stage_data["branching_choice"] = chapter_data["branching_choice"]
    
    return stage_data

def generate_enemy_team(chapter: int, stage: int, is_boss: bool, is_mini_boss: bool) -> List[Dict]:
    """Generate enemy team composition"""
    chapter_data = CHAPTER_DATA.get(chapter, {})
    faction = chapter_data.get("enemy_faction", "empire")
    
    # Enemy templates by faction
    enemy_templates = {
        "empire": ["Empire Soldier", "Empire Archer", "Empire Mage", "Empire Knight", "Empire Captain"],
        "demon": ["Imp", "Hellhound", "Shadow Fiend", "Demon Warrior", "Succubus"],
        "celestial": ["Angel Scout", "Divine Archer", "Light Mage", "Seraph Guard", "Virtue Knight"],
        "void": ["Void Spawn", "Reality Tear", "Entropy Being", "Null Walker", "Chaos Entity"],
        "mixed": ["Corrupted Angel", "Demon Convert", "Lost Soul", "Twisted Knight", "Aberration"],
    }
    
    templates = enemy_templates.get(faction, enemy_templates["empire"])
    
    if is_boss:
        boss_data = chapter_data.get("boss", {})
        return [{
            "id": boss_data.get("id", f"boss_ch{chapter}"),
            "name": boss_data.get("name", f"Chapter {chapter} Boss"),
            "title": boss_data.get("title", "Boss"),
            "is_boss": True,
            "hp_multiplier": boss_data.get("hp_multiplier", 5.0),
            "mechanic": boss_data.get("mechanic", "None"),
        }] + [{"name": random.choice(templates), "is_minion": True} for _ in range(2)]
    
    if is_mini_boss:
        return [
            {"name": f"Elite {templates[-1]}", "is_elite": True, "hp_multiplier": 2.5},
            {"name": random.choice(templates[:3])},
            {"name": random.choice(templates[:3])},
        ]
    
    # Regular stage
    enemy_count = min(3 + (stage // 5), 5)
    return [{"name": random.choice(templates)} for _ in range(enemy_count)]

def generate_stage_rewards(chapter: int, stage: int, is_boss: bool, is_mini_boss: bool) -> Dict[str, Dict]:
    """Generate reward structure for a stage"""
    base_gold = 500 * chapter * (1 + stage / 10)
    base_exp = 100 * chapter * (1 + stage / 10)
    base_gems = 5 * chapter
    
    first_clear = {
        "gold": int(base_gold * (3 if is_boss else 2 if is_mini_boss else 1)),
        "hero_exp": int(base_exp * (3 if is_boss else 2 if is_mini_boss else 1)),
        "gems": int(base_gems * (5 if is_boss else 2 if is_mini_boss else 1)),
    }
    
    three_star = {
        "gems": int(base_gems * 0.5),
        "enhancement_stones": 2 * chapter,
    }
    
    sweep = {
        "gold": int(base_gold * 0.3),
        "hero_exp": int(base_exp * 0.3),
        "gear_drop_chance": 0.05 + (chapter * 0.02),
        "material_drop_chance": 0.15 + (chapter * 0.03),
    }
    
    # Boss specific rewards
    if is_boss:
        chapter_data = CHAPTER_DATA.get(chapter, {})
        boss_rewards = chapter_data.get("boss", {}).get("rewards", {})
        first_clear.update(boss_rewards)
    
    return {
        "first_clear": first_clear,
        "three_star": three_star,
        "sweep": sweep,
    }

# ============================================================================
# NARRATIVE DIALOGUES
# ============================================================================

CHAPTER_DIALOGUES = {
    1: {
        "intro": [
            {"speaker": "Narrator", "text": "Fire. Screams. The world you knew burns around you..."},
            {"speaker": "Mysterious Voice", "text": "Awaken, Summoner. Your destiny calls."},
            {"speaker": "You", "text": "What... what's happening? Who are you?"},
            {"speaker": "Lyra", "text": "No time for questions! The Empire is here. Can you fight?"},
        ],
        "mid": {
            10: [
                {"speaker": "Marcus", "text": "You fight well for someone who just 'awakened.' There's more to you than meets the eye."},
                {"speaker": "Lyra", "text": "The capital is overrun. We need to reach the survivors."},
            ]
        },
        "boss_intro": [
            {"speaker": "Commander Vex", "text": "So, the rumors are true. A new Summoner emerges. How... inconvenient."},
            {"speaker": "Lyra", "text": "Vex! You'll pay for what you've done!"},
            {"speaker": "Commander Vex", "text": "Pay? Child, this is merely the beginning. The Empire's true masters demand sacrifice."},
        ],
        "boss_victory": [
            {"speaker": "Commander Vex", "text": "Impossible... you cannot... the masters will not be denied..."},
            {"speaker": "Marcus", "text": "What masters? Vex! Answer me!"},
            {"speaker": "Narrator", "text": "But Vex speaks no more. In his dying eyes, you glimpse something... inhuman."},
        ]
    },
    # Additional dialogues for other chapters would follow the same pattern
}

# ============================================================================
# PROGRESSION & UNLOCKS
# ============================================================================

CHAPTER_UNLOCKS = {
    1: [],
    2: ["hero_upgrade_system", "skill_leveling"],
    3: ["daily_dungeons", "gear_system"],
    4: ["faction_system", "elemental_combat"],
    5: ["gear_enhancement", "artifact_system"],
    6: ["arena_pvp", "hero_awakening"],
    7: ["faction_bonuses", "celestial_blessing"],
    8: ["legendary_gear", "transcendence"],
    9: ["guild_system", "mythic_heroes"],
    10: ["dimensional_rift", "void_corruption"],
    11: ["ultimate_awakening", "faction_unity"],
    12: ["endgame_raids", "new_game_plus"],
}

TUTORIAL_STAGES = {
    "1-1": {"mechanic": "basic_attack", "hint": "Tap a hero to select, then tap an enemy to attack."},
    "1-3": {"mechanic": "active_skill", "hint": "When the skill gauge fills, tap the skill button for a powerful attack!"},
    "1-5": {"mechanic": "auto_battle", "hint": "Toggle Auto-Battle to let your heroes fight automatically."},
    "2-10": {"mechanic": "gacha", "hint": "Use the Summoning Crystal to call powerful heroes to your side!"},
    "3-5": {"mechanic": "gear", "hint": "Equip gear to boost your heroes' stats. Matching sets give bonus effects!"},
    "3-15": {"mechanic": "composition", "hint": "Some enemies resist physical attacks. Use magic-based heroes!"},
    "4-5": {"mechanic": "factions", "hint": "Celestial beats Infernal, Infernal beats Natural, Natural beats Celestial."},
    "7-10": {"mechanic": "faction_bonus", "hint": "Having 3+ heroes of the same faction grants a team-wide bonus!"},
}

# ============================================================================
# DIFFICULTY CALCULATION
# ============================================================================

def calculate_stage_difficulty(chapter: int, stage: int) -> Dict[str, Any]:
    """Calculate difficulty parameters using exponential formula"""
    base_power = CHAPTER_DATA.get(chapter, {}).get("recommended_power", 1000)
    
    # Enemy_Power = Base_Power * (Stage_Number ^ 1.3)
    global_stage = ((chapter - 1) * 21) + stage
    difficulty_multiplier = global_stage ** 1.3
    
    enemy_power = int(base_power * (1 + (stage - 1) * 0.1))
    enemy_level = 5 + ((chapter - 1) * 8) + (stage // 3)
    
    # Mini-boss spike
    is_mini_boss = stage % 5 == 0 and stage != 21
    is_boss = stage == 21
    
    if is_mini_boss:
        enemy_power = int(enemy_power * 1.5)
    elif is_boss:
        enemy_power = int(enemy_power * 2.5)
    
    return {
        "enemy_power": enemy_power,
        "enemy_level": enemy_level,
        "recommended_power": int(enemy_power * 0.8),
        "is_spike": is_mini_boss or is_boss,
    }

# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "CHAPTER_DATA",
    "generate_stage_data",
    "generate_enemy_team",
    "generate_stage_rewards",
    "CHAPTER_DIALOGUES",
    "CHAPTER_UNLOCKS",
    "TUTORIAL_STAGES",
    "calculate_stage_difficulty",
]
