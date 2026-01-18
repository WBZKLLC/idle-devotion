"""
Phase 3.57: PvP Normalization

Normalization functions for PvP matchmaking.
Designed to reduce power advantages without eliminating progression incentive.

IMPORTANT: This module contains NO monetization hooks.
All PvP advantages must come from skill/strategy, not spending.
"""

from typing import Dict, Tuple, Optional
from enum import Enum


class NormalizationMode(Enum):
    """PvP normalization modes."""
    NONE = "none"  # Raw power (current default)
    BRACKET = "bracket"  # Same-bracket matchmaking only
    SOFT = "soft"  # Diminishing returns normalization
    FULL = "full"  # Complete stat normalization


# Power brackets for matchmaking
# Format: (min_power, max_power, bracket_name)
POWER_BRACKETS = [
    (0, 20000, "Bronze"),
    (20001, 50000, "Silver"),
    (50001, 100000, "Gold"),
    (100001, 200000, "Platinum"),
    (200001, float('inf'), "Diamond"),
]

# Normalization constants (from pvp-normalization-proposal.md)
BASE_POWER = 50000  # Target median power
COMPRESSION_FACTOR = 0.5  # sqrt compression
MAX_ADVANTAGE = 1.5  # 50% max advantage cap


def get_bracket(power: int) -> Tuple[str, int, int]:
    """
    Get the bracket for a given power level.
    
    Returns:
        (bracket_name, min_power, max_power)
    """
    for min_p, max_p, name in POWER_BRACKETS:
        if min_p <= power <= max_p:
            return (name, min_p, int(max_p) if max_p != float('inf') else 999999)
    return ("Diamond", 200001, 999999)


def normalize_power_soft(actual_power: int) -> int:
    """
    Apply soft normalization with diminishing returns.
    
    Formula: BASE_POWER * (actual_power / BASE_POWER) ^ COMPRESSION_FACTOR
    
    This compresses the power range while still rewarding upgrades.
    
    Args:
        actual_power: Player's real power value
    
    Returns:
        Normalized power value
    """
    if actual_power <= 0:
        return BASE_POWER
    
    # Apply compression
    normalized = BASE_POWER * ((actual_power / BASE_POWER) ** COMPRESSION_FACTOR)
    
    # Apply caps
    min_normalized = BASE_POWER / MAX_ADVANTAGE
    max_normalized = BASE_POWER * MAX_ADVANTAGE
    
    return int(max(min_normalized, min(max_normalized, normalized)))


def normalize_power(
    player_power: int,
    mode: NormalizationMode = NormalizationMode.NONE
) -> int:
    """
    Normalize power based on selected mode.
    
    Args:
        player_power: Raw player power
        mode: Normalization mode to apply
    
    Returns:
        Normalized power (or raw if mode is NONE/BRACKET)
    """
    if mode == NormalizationMode.NONE:
        return player_power
    elif mode == NormalizationMode.BRACKET:
        # Bracket mode doesn't change power, just restricts matchmaking
        return player_power
    elif mode == NormalizationMode.SOFT:
        return normalize_power_soft(player_power)
    elif mode == NormalizationMode.FULL:
        # Full normalization sets everyone to base
        return BASE_POWER
    else:
        return player_power


def get_match_preview(
    your_power: int,
    opponent_power: int,
    mode: NormalizationMode = NormalizationMode.NONE
) -> Dict:
    """
    Get preview of a match with normalization info.
    DEV-ONLY: This endpoint should only be available in development.
    
    Args:
        your_power: Your raw power
        opponent_power: Opponent's raw power
        mode: Normalization mode
    
    Returns:
        Dict with power comparison info
    """
    your_bracket = get_bracket(your_power)
    opp_bracket = get_bracket(opponent_power)
    
    your_normalized = normalize_power(your_power, mode)
    opp_normalized = normalize_power(opponent_power, mode)
    
    # Calculate advantage
    if opp_normalized > 0:
        advantage_ratio = your_normalized / opp_normalized
    else:
        advantage_ratio = 1.0
    
    return {
        "your_power": your_power,
        "opponent_power": opponent_power,
        "your_bracket": your_bracket[0],
        "opponent_bracket": opp_bracket[0],
        "normalized_your_power": your_normalized,
        "normalized_opponent_power": opp_normalized,
        "advantage_ratio": round(advantage_ratio, 2),
        "mode": mode.value,
        # No monetization fields allowed here!
    }
