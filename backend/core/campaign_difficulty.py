"""
Phase 3.56: Campaign Difficulty Table

Locked difficulty scaling for campaign stages.
No random scaling - all values are deterministic.
"""

from typing import Dict, Tuple

# Difficulty bands
BAND_EASY = "easy"
BAND_OKAY = "okay"
BAND_HARD = "hard"

# Chapter difficulty scaling table
# Format: chapter_id -> (base_enemy_power, power_per_stage, boss_multiplier)
# Phase 3.61: Expanded to cover chapters 1-25
DIFFICULTY_TABLE: Dict[int, Tuple[int, int, float]] = {
    # Early game (chapters 1-5): Gentle introduction
    1: (5000, 500, 1.5),       # Tutorial-level
    2: (10000, 750, 1.5),
    3: (18000, 1000, 1.6),
    4: (30000, 1500, 1.6),
    5: (45000, 2000, 1.7),     # First real challenge point
    
    # Mid game (chapters 6-10): Player should be building teams
    6: (65000, 2500, 1.7),
    7: (90000, 3000, 1.8),
    8: (120000, 4000, 1.8),
    9: (160000, 5000, 1.9),
    10: (210000, 6000, 1.9),   # Second major checkpoint
    
    # Late game (chapters 11-15): Requires investment
    11: (270000, 7500, 2.0),
    12: (350000, 10000, 2.0),
    13: (450000, 12500, 2.1),  # Phase 3.61: Added
    14: (580000, 15000, 2.1),  # Phase 3.61: Added
    15: (750000, 18000, 2.2),  # Phase 3.61: Added - major spike
    
    # Endgame (chapters 16-20): For dedicated players
    16: (950000, 22000, 2.2),  # Phase 3.61: Added
    17: (1200000, 26000, 2.3), # Phase 3.61: Added
    18: (1500000, 32000, 2.3), # Phase 3.61: Added
    19: (1900000, 40000, 2.4), # Phase 3.61: Added
    20: (2400000, 50000, 2.4), # Phase 3.61: Added - endgame goal
    
    # Post-game / Mythic tier (chapters 21-25): Whale territory
    21: (3000000, 60000, 2.5), # Phase 3.61: Added
    22: (3800000, 75000, 2.5), # Phase 3.61: Added
    23: (4800000, 90000, 2.6), # Phase 3.61: Added
    24: (6000000, 110000, 2.6), # Phase 3.61: Added
    25: (7500000, 140000, 2.7), # Phase 3.61: Added - final chapter
}

# Recommended power bands (percentage of enemy power)
# easy: player is >= 110% of enemy
# okay: player is 90-110% of enemy
# hard: player is < 90% of enemy


def get_stage_enemy_power(chapter_id: int, stage_number: int) -> int:
    """
    Calculate enemy power for a specific stage.
    Uses deterministic table lookup - no RNG.
    
    Args:
        chapter_id: Chapter number (1-12)
        stage_number: Stage within chapter (1-20, 21 = boss)
    
    Returns:
        Enemy power value
    """
    if chapter_id not in DIFFICULTY_TABLE:
        # Fallback for unknown chapters
        chapter_id = max(DIFFICULTY_TABLE.keys())
    
    base_power, power_per_stage, boss_mult = DIFFICULTY_TABLE[chapter_id]
    
    # Boss stage (every 20th or 21st)
    is_boss = stage_number % 20 == 0 or stage_number == 21
    
    stage_power = base_power + (stage_number * power_per_stage)
    
    if is_boss:
        stage_power = int(stage_power * boss_mult)
    
    return stage_power


def get_recommended_power(chapter_id: int, stage_number: int) -> int:
    """
    Get recommended player power for a stage.
    Returns enemy power + 10% buffer for comfortable clear.
    """
    enemy_power = get_stage_enemy_power(chapter_id, stage_number)
    return int(enemy_power * 1.1)


def get_power_band(player_power: int, enemy_power: int) -> str:
    """
    Determine difficulty band based on power comparison.
    
    Returns:
        'easy' | 'okay' | 'hard'
    """
    if enemy_power <= 0:
        return BAND_EASY
    
    ratio = player_power / enemy_power
    
    if ratio >= 1.1:
        return BAND_EASY
    elif ratio >= 0.9:
        return BAND_OKAY
    else:
        return BAND_HARD


def get_stage_difficulty_info(chapter_id: int, stage_number: int, player_power: int) -> dict:
    """
    Get complete difficulty info for a stage.
    
    Returns dict with:
        - enemy_power: int
        - recommended_power: int
        - power_band: str ('easy' | 'okay' | 'hard')
        - power_gap_percent: int (negative if player is weaker)
    """
    enemy_power = get_stage_enemy_power(chapter_id, stage_number)
    recommended_power = get_recommended_power(chapter_id, stage_number)
    band = get_power_band(player_power, enemy_power)
    
    gap_percent = 0
    if enemy_power > 0:
        gap_percent = int(((player_power - enemy_power) / enemy_power) * 100)
    
    return {
        "enemy_power": enemy_power,
        "recommended_power": recommended_power,
        "power_band": band,
        "power_gap_percent": gap_percent,
    }


def dump_difficulty_table() -> list:
    """
    Phase 3.61: Dump entire difficulty table for DEV tuning.
    Returns list of all chapter configurations.
    
    DEV-ONLY: Do not expose in production.
    """
    result = []
    for chapter_id, (base_power, power_per_stage, boss_mult) in DIFFICULTY_TABLE.items():
        # Sample stages for each chapter
        stages = []
        for stage_num in [1, 5, 10, 15, 20]:
            enemy_power = get_stage_enemy_power(chapter_id, stage_num)
            stages.append({
                "stage": stage_num,
                "enemy_power": enemy_power,
                "is_boss": stage_num == 20,
            })
        
        result.append({
            "chapter": chapter_id,
            "base_power": base_power,
            "power_per_stage": power_per_stage,
            "boss_multiplier": boss_mult,
            "sample_stages": stages,
        })
    
    return result
