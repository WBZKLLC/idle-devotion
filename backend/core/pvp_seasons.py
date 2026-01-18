"""
Phase 4.2: PvP Season System

Server-authoritative PvP seasons with daily and seasonal rewards.
All rewards are currency/cosmetics only - no stat boosts.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from enum import Enum


class RankBand(str, Enum):
    """PvP rank bands"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"
    MASTER = "master"
    GRANDMASTER = "grandmaster"


class SeasonReward(BaseModel):
    """A season-end reward"""
    rank_band: RankBand
    min_rating: int
    rewards: Dict[str, int]  # currency -> amount
    title: Optional[str] = None  # Cosmetic title
    frame: Optional[str] = None  # Cosmetic avatar frame


class DailyReward(BaseModel):
    """Daily participation reward"""
    rank_band: RankBand
    rewards: Dict[str, int]


class Season(BaseModel):
    """A PvP season configuration"""
    season_id: str
    name: str
    start_at: datetime
    end_at: datetime
    season_rewards: List[SeasonReward]
    daily_rewards: List[DailyReward]


# ═══════════════════════════════════════════════════════════════════════════
# RANK BAND THRESHOLDS
# ═══════════════════════════════════════════════════════════════════════════

RANK_THRESHOLDS = {
    RankBand.BRONZE: 0,
    RankBand.SILVER: 1000,
    RankBand.GOLD: 1200,
    RankBand.PLATINUM: 1400,
    RankBand.DIAMOND: 1600,
    RankBand.MASTER: 1800,
    RankBand.GRANDMASTER: 2000,
}


def get_rank_band(rating: int) -> RankBand:
    """Get rank band for a given rating"""
    result = RankBand.BRONZE
    for band, threshold in RANK_THRESHOLDS.items():
        if rating >= threshold:
            result = band
    return result


# ═══════════════════════════════════════════════════════════════════════════
# SEASON CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Season rewards by rank band (currency/cosmetics only - NO stat boosts)
DEFAULT_SEASON_REWARDS = [
    SeasonReward(
        rank_band=RankBand.BRONZE,
        min_rating=0,
        rewards={"pvp_medals": 100, "gold": 10000},
    ),
    SeasonReward(
        rank_band=RankBand.SILVER,
        min_rating=1000,
        rewards={"pvp_medals": 200, "gold": 25000},
    ),
    SeasonReward(
        rank_band=RankBand.GOLD,
        min_rating=1200,
        rewards={"pvp_medals": 400, "gold": 50000, "crystals": 100},
        title="Gold Champion",
    ),
    SeasonReward(
        rank_band=RankBand.PLATINUM,
        min_rating=1400,
        rewards={"pvp_medals": 600, "gold": 100000, "crystals": 200},
        title="Platinum Elite",
    ),
    SeasonReward(
        rank_band=RankBand.DIAMOND,
        min_rating=1600,
        rewards={"pvp_medals": 1000, "gold": 200000, "crystals": 500},
        title="Diamond Legend",
        frame="diamond_frame",
    ),
    SeasonReward(
        rank_band=RankBand.MASTER,
        min_rating=1800,
        rewards={"pvp_medals": 1500, "gold": 500000, "crystals": 1000},
        title="Master of Arms",
        frame="master_frame",
    ),
    SeasonReward(
        rank_band=RankBand.GRANDMASTER,
        min_rating=2000,
        rewards={"pvp_medals": 2500, "gold": 1000000, "crystals": 2000},
        title="Grandmaster",
        frame="grandmaster_frame",
    ),
]

# Daily rewards by rank band (smaller amounts)
DEFAULT_DAILY_REWARDS = [
    DailyReward(rank_band=RankBand.BRONZE, rewards={"pvp_medals": 10, "gold": 1000}),
    DailyReward(rank_band=RankBand.SILVER, rewards={"pvp_medals": 20, "gold": 2000}),
    DailyReward(rank_band=RankBand.GOLD, rewards={"pvp_medals": 40, "gold": 4000}),
    DailyReward(rank_band=RankBand.PLATINUM, rewards={"pvp_medals": 60, "gold": 6000}),
    DailyReward(rank_band=RankBand.DIAMOND, rewards={"pvp_medals": 80, "gold": 8000}),
    DailyReward(rank_band=RankBand.MASTER, rewards={"pvp_medals": 100, "gold": 10000}),
    DailyReward(rank_band=RankBand.GRANDMASTER, rewards={"pvp_medals": 150, "gold": 15000}),
]


def get_current_season() -> Season:
    """
    Get the current PvP season.
    Seasons run monthly.
    """
    now = datetime.now(timezone.utc)
    
    # Season starts on 1st of month, ends on last day
    season_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate last day of month
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1)
    else:
        next_month = now.replace(month=now.month + 1, day=1)
    season_end = next_month - timedelta(seconds=1)
    
    season_id = f"season_{now.year}_{now.month:02d}"
    season_name = f"Season {now.year}-{now.month:02d}"
    
    return Season(
        season_id=season_id,
        name=season_name,
        start_at=season_start,
        end_at=season_end,
        season_rewards=DEFAULT_SEASON_REWARDS,
        daily_rewards=DEFAULT_DAILY_REWARDS,
    )


def get_season_info(rating: int) -> Dict[str, Any]:
    """Get season info for display"""
    season = get_current_season()
    now = datetime.now(timezone.utc)
    time_remaining = (season.end_at - now).total_seconds()
    rank_band = get_rank_band(rating)
    
    return {
        "season_id": season.season_id,
        "name": season.name,
        "start_at": season.start_at.isoformat(),
        "end_at": season.end_at.isoformat(),
        "time_remaining_seconds": max(0, int(time_remaining)),
        "current_rank_band": rank_band.value,
        "rating": rating,
    }


def get_rewards_preview() -> List[Dict[str, Any]]:
    """Get preview of all rank band rewards"""
    season = get_current_season()
    
    return [
        {
            "rank_band": r.rank_band.value,
            "min_rating": r.min_rating,
            "rewards": r.rewards,
            "title": r.title,
            "frame": r.frame,
        }
        for r in season.season_rewards
    ]


def get_daily_reward_for_band(rank_band: RankBand) -> Dict[str, int]:
    """Get daily reward for a specific rank band"""
    for dr in DEFAULT_DAILY_REWARDS:
        if dr.rank_band == rank_band:
            return dr.rewards
    return {"pvp_medals": 10, "gold": 1000}  # Fallback


def get_season_reward_for_band(rank_band: RankBand) -> SeasonReward:
    """Get season reward for a specific rank band"""
    for sr in DEFAULT_SEASON_REWARDS:
        if sr.rank_band == rank_band:
            return sr
    return DEFAULT_SEASON_REWARDS[0]  # Fallback to bronze
