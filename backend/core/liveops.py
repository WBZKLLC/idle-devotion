"""
Phase 4.3: Live Ops Configuration

Server-driven live ops system for limited-time events and boosts.
All configurations are server-authoritative.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from enum import Enum


class BoostType(str, Enum):
    """Types of boosts available"""
    IDLE_CAP_MULTIPLIER = "idle_cap_multiplier"
    EVENT_REWARDS_MULTIPLIER = "event_rewards_multiplier"
    GACHA_RATE_UP = "gacha_rate_up"
    STAMINA_REGEN_BOOST = "stamina_regen_boost"


class LiveOpsBoost(BaseModel):
    """A single boost configuration"""
    boost_type: BoostType
    multiplier: float = 1.0
    # VIP stacking: if True, VIP players get additional bonus
    vip_stackable: bool = False
    vip_bonus: float = 0.0  # Additional multiplier for VIP
    max_total: float = 2.0  # Hard cap on total multiplier


class LiveOpsEvent(BaseModel):
    """A live ops event configuration"""
    event_id: str
    name: str
    description: str
    start_at: datetime
    end_at: datetime
    boosts: List[LiveOpsBoost] = []
    banner_ids: List[str] = []  # Banners enabled during this event
    is_active: bool = True


# ═══════════════════════════════════════════════════════════════════════════
# LIVE OPS CONFIGURATION TABLE
# All events and boosts defined here - server-authoritative
# ═══════════════════════════════════════════════════════════════════════════

# Default event (always active when no special events)
DEFAULT_EVENT = LiveOpsEvent(
    event_id="default",
    name="Normal Operations",
    description="Standard game operations",
    start_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
    end_at=datetime(2099, 12, 31, tzinfo=timezone.utc),
    boosts=[],
    banner_ids=["standard", "beginner"],
    is_active=True,
)

# Special events table
LIVE_OPS_EVENTS: Dict[str, LiveOpsEvent] = {
    "summer_fest_2026": LiveOpsEvent(
        event_id="summer_fest_2026",
        name="Summer Festival 2026",
        description="Celebrate summer with bonus rewards!",
        start_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        end_at=datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc),
        boosts=[
            LiveOpsBoost(
                boost_type=BoostType.IDLE_CAP_MULTIPLIER,
                multiplier=1.5,
                vip_stackable=True,
                vip_bonus=0.25,
                max_total=2.0,
            ),
            LiveOpsBoost(
                boost_type=BoostType.EVENT_REWARDS_MULTIPLIER,
                multiplier=2.0,
                vip_stackable=False,
            ),
        ],
        banner_ids=["standard", "beginner", "summer_special"],
        is_active=True,
    ),
    "new_year_2027": LiveOpsEvent(
        event_id="new_year_2027",
        name="New Year Celebration 2027",
        description="Ring in the new year with special bonuses!",
        start_at=datetime(2026, 12, 28, tzinfo=timezone.utc),
        end_at=datetime(2027, 1, 7, 23, 59, 59, tzinfo=timezone.utc),
        boosts=[
            LiveOpsBoost(
                boost_type=BoostType.GACHA_RATE_UP,
                multiplier=1.2,
                vip_stackable=True,
                vip_bonus=0.1,
                max_total=1.5,
            ),
        ],
        banner_ids=["standard", "beginner", "new_year_limited"],
        is_active=True,
    ),
}


def get_current_time() -> datetime:
    """Get current UTC time"""
    return datetime.now(timezone.utc)


def get_active_events() -> List[LiveOpsEvent]:
    """Get all currently active events"""
    now = get_current_time()
    active = []
    
    for event in LIVE_OPS_EVENTS.values():
        if event.is_active and event.start_at <= now <= event.end_at:
            active.append(event)
    
    # If no special events, return default
    if not active:
        return [DEFAULT_EVENT]
    
    return active


def get_active_boosts(is_vip: bool = False) -> Dict[BoostType, float]:
    """
    Get all active boosts with their effective multipliers.
    
    Args:
        is_vip: Whether the user has VIP status
        
    Returns:
        Dict mapping boost type to effective multiplier
    """
    boosts: Dict[BoostType, float] = {}
    active_events = get_active_events()
    
    for event in active_events:
        for boost in event.boosts:
            base = boost.multiplier
            
            # Apply VIP bonus if applicable
            if is_vip and boost.vip_stackable:
                base += boost.vip_bonus
            
            # Apply max cap
            base = min(base, boost.max_total)
            
            # Merge with existing (take highest if overlapping)
            if boost.boost_type in boosts:
                boosts[boost.boost_type] = max(boosts[boost.boost_type], base)
            else:
                boosts[boost.boost_type] = base
    
    return boosts


def get_available_banner_ids() -> List[str]:
    """Get list of banner IDs that should be available"""
    active_events = get_active_events()
    banner_ids = set()
    
    for event in active_events:
        banner_ids.update(event.banner_ids)
    
    return list(banner_ids)


def get_liveops_status(is_vip: bool = False) -> Dict[str, Any]:
    """
    Get complete live ops status for client display.
    
    Returns:
        Dict with active events, boosts, and time remaining
    """
    now = get_current_time()
    active_events = get_active_events()
    active_boosts = get_active_boosts(is_vip)
    
    events_data = []
    for event in active_events:
        time_remaining = (event.end_at - now).total_seconds()
        events_data.append({
            "event_id": event.event_id,
            "name": event.name,
            "description": event.description,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
            "time_remaining_seconds": max(0, int(time_remaining)),
            "is_default": event.event_id == "default",
        })
    
    boosts_data = [
        {"type": k.value, "multiplier": v}
        for k, v in active_boosts.items()
    ]
    
    return {
        "server_time": now.isoformat(),
        "events": events_data,
        "boosts": boosts_data,
        "available_banners": get_available_banner_ids(),
        "has_special_event": any(e["event_id"] != "default" for e in events_data),
    }
