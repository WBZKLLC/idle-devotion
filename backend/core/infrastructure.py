"""
Core Infrastructure - Service Registry & Cache Layer
Implements scalable patterns for future microservices architecture

This module provides:
1. Service Registry - for service discovery in microservices setup
2. Cache Layer - Redis-like in-memory caching with TTL
3. Rate Limiter - API rate limiting per user
4. Event Queue - for async task processing
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from functools import wraps
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# IN-MEMORY CACHE WITH TTL (Redis-like behavior)
# =============================================================================

class CacheEntry:
    """Single cache entry with expiration"""
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

class GameCache:
    """
    In-memory cache layer with TTL support
    Designed to be swapped with Redis in production
    
    Usage:
        cache = GameCache()
        await cache.set("leaderboard:arena", data, ttl=60)
        result = await cache.get("leaderboard:arena")
    """
    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, CacheEntry] = {}
        self._max_size = max_size
        self._hits = 0
        self._misses = 0
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None
        if entry.is_expired():
            del self._cache[key]
            self._misses += 1
            return None
        self._hits += 1
        return entry.value
    
    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Set value in cache with TTL (seconds)"""
        # Evict expired entries if cache is full
        if len(self._cache) >= self._max_size:
            await self._evict_expired()
        
        self._cache[key] = CacheEntry(value, ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern (e.g., 'user:Adam:*')"""
        keys_to_delete = [k for k in self._cache.keys() if pattern.replace('*', '') in k]
        for key in keys_to_delete:
            del self._cache[key]
        return len(keys_to_delete)
    
    async def _evict_expired(self) -> None:
        """Remove all expired entries"""
        expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
        for key in expired_keys:
            del self._cache[key]
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / (self._hits + self._misses) if (self._hits + self._misses) > 0 else 0
        }

# Global cache instance
game_cache = GameCache()

# =============================================================================
# RATE LIMITER
# =============================================================================

class RateLimiter:
    """
    Token bucket rate limiter
    Limits requests per user to prevent abuse
    """
    def __init__(self, requests_per_minute: int = 60):
        self._buckets: Dict[str, Dict] = {}
        self._requests_per_minute = requests_per_minute
        self._refill_rate = requests_per_minute / 60  # tokens per second
    
    async def check(self, user_id: str, cost: int = 1) -> tuple[bool, int]:
        """
        Check if request is allowed
        Returns: (allowed: bool, wait_seconds: int)
        """
        now = datetime.utcnow()
        
        if user_id not in self._buckets:
            self._buckets[user_id] = {
                "tokens": self._requests_per_minute,
                "last_update": now
            }
        
        bucket = self._buckets[user_id]
        
        # Refill tokens based on time elapsed
        elapsed = (now - bucket["last_update"]).total_seconds()
        bucket["tokens"] = min(
            self._requests_per_minute,
            bucket["tokens"] + elapsed * self._refill_rate
        )
        bucket["last_update"] = now
        
        if bucket["tokens"] >= cost:
            bucket["tokens"] -= cost
            return (True, 0)
        else:
            wait_time = int((cost - bucket["tokens"]) / self._refill_rate)
            return (False, wait_time)
    
    async def get_remaining(self, user_id: str) -> int:
        """Get remaining tokens for user"""
        if user_id not in self._buckets:
            return self._requests_per_minute
        return int(self._buckets[user_id]["tokens"])

# Global rate limiter instance
rate_limiter = RateLimiter(requests_per_minute=120)

# =============================================================================
# EVENT QUEUE (for async processing)
# =============================================================================

class EventQueue:
    """
    Simple async event queue for decoupled processing
    In production, replace with RabbitMQ/Kafka
    
    Events:
    - BATTLE_COMPLETED: Update leaderboards, grant rewards
    - GACHA_PULLED: Track analytics, update pity
    - ACHIEVEMENT_UNLOCKED: Send notifications
    """
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._handlers: Dict[str, List[Callable]] = {}
        self._running = False
    
    def register_handler(self, event_type: str, handler: Callable) -> None:
        """Register an event handler"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    async def publish(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish an event to the queue"""
        await self._queue.put({
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def start_processing(self) -> None:
        """Start processing events (run in background)"""
        self._running = True
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._process_event(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing event: {e}")
    
    async def _process_event(self, event: Dict) -> None:
        """Process a single event"""
        event_type = event["type"]
        handlers = self._handlers.get(event_type, [])
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event["data"])
                else:
                    handler(event["data"])
            except Exception as e:
                logger.error(f"Handler error for {event_type}: {e}")
    
    def stop(self) -> None:
        """Stop processing"""
        self._running = False

# Global event queue
event_queue = EventQueue()

# =============================================================================
# SERVICE REGISTRY (for microservices)
# =============================================================================

class ServiceRegistry:
    """
    Service registry for microservices discovery
    In production, use Consul/etcd/Kubernetes DNS
    
    Services:
    - auth: Authentication & user management
    - battle: PvE/PvP combat processing
    - gacha: Summoning & pity system
    - chat: Real-time chat & social
    - economy: Currency & transactions
    """
    def __init__(self):
        self._services: Dict[str, Dict] = {}
        self._health_checks: Dict[str, datetime] = {}
    
    def register(self, name: str, endpoint: str, metadata: Dict = None) -> None:
        """Register a service"""
        self._services[name] = {
            "endpoint": endpoint,
            "metadata": metadata or {},
            "registered_at": datetime.utcnow().isoformat(),
            "status": "healthy"
        }
        self._health_checks[name] = datetime.utcnow()
    
    def get(self, name: str) -> Optional[Dict]:
        """Get service info"""
        return self._services.get(name)
    
    def get_endpoint(self, name: str) -> Optional[str]:
        """Get service endpoint URL"""
        service = self._services.get(name)
        return service["endpoint"] if service else None
    
    def list_services(self) -> Dict[str, Dict]:
        """List all registered services"""
        return self._services.copy()
    
    def update_health(self, name: str, healthy: bool = True) -> None:
        """Update service health status"""
        if name in self._services:
            self._services[name]["status"] = "healthy" if healthy else "unhealthy"
            self._health_checks[name] = datetime.utcnow()
    
    def get_healthy_services(self) -> List[str]:
        """Get list of healthy services"""
        return [name for name, info in self._services.items() if info["status"] == "healthy"]

# Global service registry
service_registry = ServiceRegistry()

# Register default services (monolith mode)
service_registry.register("auth", "http://localhost:8001/api", {"version": "1.0", "mode": "monolith"})
service_registry.register("battle", "http://localhost:8001/api", {"version": "1.0", "mode": "monolith"})
service_registry.register("gacha", "http://localhost:8001/api", {"version": "1.0", "mode": "monolith"})
service_registry.register("chat", "http://localhost:8001/api", {"version": "1.0", "mode": "monolith"})
service_registry.register("economy", "http://localhost:8001/api", {"version": "1.0", "mode": "monolith"})

# =============================================================================
# DECORATORS FOR CACHING & RATE LIMITING
# =============================================================================

def cached(ttl: int = 60, key_prefix: str = ""):
    """
    Decorator to cache function results
    
    Usage:
        @cached(ttl=60, key_prefix="leaderboard")
        async def get_leaderboard(board_type: str):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_value = await game_cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await game_cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator

def rate_limited(cost: int = 1):
    """
    Decorator to rate limit function calls
    
    Usage:
        @rate_limited(cost=5)  # Costs 5 tokens
        async def expensive_operation():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user_id from kwargs or first arg
            user_id = kwargs.get("username") or kwargs.get("user_id") or (args[0] if args else "anonymous")
            
            allowed, wait_time = await rate_limiter.check(str(user_id), cost)
            if not allowed:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Try again in {wait_time} seconds."
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# =============================================================================
# LEADERBOARD CACHE HELPERS
# =============================================================================

async def get_cached_leaderboard(board_type: str, limit: int = 100) -> Optional[List]:
    """Get leaderboard from cache"""
    cache_key = f"leaderboard:{board_type}:{limit}"
    return await game_cache.get(cache_key)

async def set_cached_leaderboard(board_type: str, data: List, limit: int = 100, ttl: int = 60) -> None:
    """Cache leaderboard data"""
    cache_key = f"leaderboard:{board_type}:{limit}"
    await game_cache.set(cache_key, data, ttl)

async def invalidate_leaderboard(board_type: str) -> None:
    """Invalidate leaderboard cache when data changes"""
    await game_cache.invalidate_pattern(f"leaderboard:{board_type}:")

# =============================================================================
# USER DATA CACHE HELPERS
# =============================================================================

async def get_cached_user(username: str) -> Optional[Dict]:
    """Get user data from cache"""
    return await game_cache.get(f"user:{username}")

async def set_cached_user(username: str, user_data: Dict, ttl: int = 30) -> None:
    """Cache user data"""
    await game_cache.set(f"user:{username}", user_data, ttl)

async def invalidate_user_cache(username: str) -> None:
    """Invalidate all user-related cache"""
    await game_cache.invalidate_pattern(f"user:{username}:")
    await game_cache.delete(f"user:{username}")
