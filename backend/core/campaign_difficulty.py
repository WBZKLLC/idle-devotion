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
DIFFICULTY_TABLE: Dict[int, Tuple[int, int, float]] = {
    1: (5000, 500, 1.5),
    2: (10000, 750, 1.5),
    3: (18000, 1000, 1.6),
    4: (30000, 1500, 1.6),
    5: (45000, 2000, 1.7),
    6: (65000, 2500, 1.7),
    7: (90000, 3000, 1.8),
    8: (120000, 4000, 1.8),
    9: (160000, 5000, 1.9),
    10: (210000, 6000, 1.9),
    11: (270000, 7500, 2.0),
    12: (350000, 10000, 2.0),
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
