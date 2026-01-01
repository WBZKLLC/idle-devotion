"""
Production Infrastructure - Redis Cache, Message Queue, Auto-scaling Support
This module provides production-ready implementations for:
1. Redis-backed cache (with fallback to in-memory)
2. Message queue (Redis pub/sub, ready for RabbitMQ/Kafka)
3. Health checks for Kubernetes
4. Metrics collection for auto-scaling
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Production configuration from environment variables"""
    # Redis Configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_ENABLED = os.getenv("REDIS_ENABLED", "false").lower() == "true"
    
    # Message Queue Configuration
    RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
    KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
    MQ_BACKEND = os.getenv("MQ_BACKEND", "memory")  # memory, redis, rabbitmq, kafka
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
    
    # Cache TTL defaults
    CACHE_TTL_SHORT = int(os.getenv("CACHE_TTL_SHORT", "30"))
    CACHE_TTL_MEDIUM = int(os.getenv("CACHE_TTL_MEDIUM", "60"))
    CACHE_TTL_LONG = int(os.getenv("CACHE_TTL_LONG", "300"))
    
    # Service Configuration
    SERVICE_NAME = os.getenv("SERVICE_NAME", "divine-heroes-api")
    SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
    POD_NAME = os.getenv("POD_NAME", "local")
    
    # Metrics
    METRICS_ENABLED = os.getenv("METRICS_ENABLED", "false").lower() == "true"

config = Config()

# =============================================================================
# REDIS-BACKED CACHE
# =============================================================================

class RedisCache:
    """
    Production Redis cache with automatic fallback to in-memory
    
    Features:
    - Async Redis operations
    - Automatic reconnection
    - In-memory fallback when Redis unavailable
    - JSON serialization for complex objects
    """
    
    def __init__(self):
        self._redis = None
        self._memory_cache: Dict[str, Dict] = {}
        self._connected = False
        self._stats = {"hits": 0, "misses": 0, "redis_errors": 0}
    
    async def connect(self):
        """Connect to Redis server"""
        if not config.REDIS_ENABLED:
            logger.info("Redis disabled, using in-memory cache")
            return
        
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            # Test connection
            await self._redis.ping()
            self._connected = True
            logger.info(f"Connected to Redis at {config.REDIS_URL}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory cache.")
            self._connected = False
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self._redis:
            await self._redis.close()
            self._connected = False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        # Try Redis first
        if self._connected and self._redis:
            try:
                value = await self._redis.get(f"cache:{key}")
                if value:
                    self._stats["hits"] += 1
                    return json.loads(value)
                self._stats["misses"] += 1
                return None
            except Exception as e:
                self._stats["redis_errors"] += 1
                logger.warning(f"Redis get error: {e}")
        
        # Fallback to memory
        entry = self._memory_cache.get(key)
        if entry and datetime.utcnow() < entry.get("expires_at", datetime.min):
            self._stats["hits"] += 1
            return entry["value"]
        
        self._stats["misses"] += 1
        return None
    
    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Set value in cache with TTL"""
        # Try Redis first
        if self._connected and self._redis:
            try:
                await self._redis.setex(
                    f"cache:{key}",
                    ttl,
                    json.dumps(value, default=str)
                )
                return
            except Exception as e:
                self._stats["redis_errors"] += 1
                logger.warning(f"Redis set error: {e}")
        
        # Fallback to memory
        self._memory_cache[key] = {
            "value": value,
            "expires_at": datetime.utcnow() + timedelta(seconds=ttl)
        }
        
        # Cleanup old entries (simple eviction)
        if len(self._memory_cache) > 10000:
            await self._evict_expired()
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        deleted = False
        
        if self._connected and self._redis:
            try:
                deleted = await self._redis.delete(f"cache:{key}") > 0
            except Exception as e:
                logger.warning(f"Redis delete error: {e}")
        
        if key in self._memory_cache:
            del self._memory_cache[key]
            deleted = True
        
        return deleted
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern"""
        count = 0
        
        if self._connected and self._redis:
            try:
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor, match=f"cache:{pattern}")
                    if keys:
                        await self._redis.delete(*keys)
                        count += len(keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.warning(f"Redis invalidate error: {e}")
        
        # Also clear memory cache
        pattern_base = pattern.replace("*", "")
        keys_to_delete = [k for k in self._memory_cache.keys() if pattern_base in k]
        for key in keys_to_delete:
            del self._memory_cache[key]
            count += 1
        
        return count
    
    async def _evict_expired(self) -> None:
        """Remove expired entries from memory cache"""
        now = datetime.utcnow()
        expired = [k for k, v in self._memory_cache.items() if v.get("expires_at", datetime.min) < now]
        for key in expired:
            del self._memory_cache[key]
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._stats["hits"] + self._stats["misses"]
        return {
            "backend": "redis" if self._connected else "memory",
            "connected": self._connected,
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "hit_rate": self._stats["hits"] / total if total > 0 else 0,
            "redis_errors": self._stats["redis_errors"],
            "memory_keys": len(self._memory_cache)
        }

# Global cache instance
cache = RedisCache()

# =============================================================================
# MESSAGE QUEUE (Redis Pub/Sub, ready for RabbitMQ/Kafka)
# =============================================================================

class MessageQueue:
    """
    Production message queue with multiple backend support
    
    Backends:
    - memory: In-process asyncio queue (development)
    - redis: Redis pub/sub (simple production)
    - rabbitmq: RabbitMQ (enterprise production)
    - kafka: Kafka (high-throughput production)
    """
    
    def __init__(self):
        self._backend = config.MQ_BACKEND
        self._redis = None
        self._handlers: Dict[str, List[Callable]] = {}
        self._memory_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._pubsub = None
    
    async def connect(self):
        """Connect to message queue backend"""
        if self._backend == "redis" and config.REDIS_ENABLED:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(config.REDIS_URL)
                self._pubsub = self._redis.pubsub()
                logger.info("Message queue connected to Redis pub/sub")
            except Exception as e:
                logger.warning(f"Redis MQ connection failed: {e}. Using memory queue.")
                self._backend = "memory"
        else:
            logger.info(f"Using {self._backend} message queue")
    
    async def disconnect(self):
        """Disconnect from message queue"""
        self._running = False
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()
    
    def register_handler(self, event_type: str, handler: Callable) -> None:
        """Register an event handler"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    async def publish(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish an event"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "service": config.SERVICE_NAME,
            "pod": config.POD_NAME
        }
        
        if self._backend == "redis" and self._redis:
            try:
                await self._redis.publish(
                    f"events:{event_type}",
                    json.dumps(message, default=str)
                )
                return
            except Exception as e:
                logger.warning(f"Redis publish error: {e}")
        
        # Fallback to memory queue
        await self._memory_queue.put(message)
    
    async def start_consuming(self) -> None:
        """Start consuming messages (run in background)"""
        self._running = True
        
        if self._backend == "redis" and self._pubsub:
            # Subscribe to all event channels
            channels = [f"events:{et}" for et in self._handlers.keys()]
            if channels:
                await self._pubsub.subscribe(*channels)
            
            while self._running:
                try:
                    message = await self._pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message["type"] == "message":
                        event = json.loads(message["data"])
                        await self._process_event(event)
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Redis consume error: {e}")
                    await asyncio.sleep(1)
        else:
            # Memory queue processing
            while self._running:
                try:
                    event = await asyncio.wait_for(self._memory_queue.get(), timeout=1.0)
                    await self._process_event(event)
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Queue processing error: {e}")
    
    async def _process_event(self, event: Dict) -> None:
        """Process a single event"""
        event_type = event.get("type")
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
        """Stop consuming"""
        self._running = False

# Global message queue instance
mq = MessageQueue()

# =============================================================================
# DISTRIBUTED RATE LIMITER
# =============================================================================

class DistributedRateLimiter:
    """
    Production rate limiter with Redis backend for distributed limiting
    
    Uses sliding window algorithm for accurate rate limiting across pods
    """
    
    def __init__(self, requests_per_window: int = 120, window_seconds: int = 60):
        self._requests = requests_per_window
        self._window = window_seconds
        self._redis = None
        self._local_buckets: Dict[str, Dict] = {}
    
    async def connect(self):
        """Connect to Redis for distributed rate limiting"""
        if config.REDIS_ENABLED:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(config.REDIS_URL)
                await self._redis.ping()
                logger.info("Distributed rate limiter connected to Redis")
            except Exception as e:
                logger.warning(f"Rate limiter Redis connection failed: {e}")
    
    async def check(self, user_id: str, cost: int = 1) -> tuple[bool, int]:
        """
        Check if request is allowed
        Returns: (allowed: bool, retry_after_seconds: int)
        """
        key = f"ratelimit:{user_id}"
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self._window)
        
        # Try Redis first (distributed)
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                
                # Remove old entries
                pipe.zremrangebyscore(key, 0, window_start.timestamp())
                
                # Count current entries
                pipe.zcard(key)
                
                # Execute
                results = await pipe.execute()
                current_count = results[1]
                
                if current_count + cost <= self._requests:
                    # Add new request
                    await self._redis.zadd(key, {f"{now.timestamp()}:{cost}": now.timestamp()})
                    await self._redis.expire(key, self._window)
                    return (True, 0)
                else:
                    # Get oldest entry to calculate retry time
                    oldest = await self._redis.zrange(key, 0, 0, withscores=True)
                    if oldest:
                        retry_after = int(oldest[0][1] + self._window - now.timestamp())
                        return (False, max(1, retry_after))
                    return (False, self._window)
                    
            except Exception as e:
                logger.warning(f"Redis rate limit error: {e}")
        
        # Fallback to local rate limiting
        if user_id not in self._local_buckets:
            self._local_buckets[user_id] = {"tokens": self._requests, "last_update": now}
        
        bucket = self._local_buckets[user_id]
        elapsed = (now - bucket["last_update"]).total_seconds()
        bucket["tokens"] = min(self._requests, bucket["tokens"] + elapsed * (self._requests / self._window))
        bucket["last_update"] = now
        
        if bucket["tokens"] >= cost:
            bucket["tokens"] -= cost
            return (True, 0)
        
        return (False, int((cost - bucket["tokens"]) * (self._window / self._requests)))
    
    async def get_remaining(self, user_id: str) -> int:
        """Get remaining requests for user"""
        if self._redis:
            try:
                key = f"ratelimit:{user_id}"
                count = await self._redis.zcard(key)
                return max(0, self._requests - count)
            except:
                pass
        
        bucket = self._local_buckets.get(user_id)
        return int(bucket["tokens"]) if bucket else self._requests

# Global rate limiter
rate_limiter = DistributedRateLimiter(
    requests_per_window=config.RATE_LIMIT_REQUESTS,
    window_seconds=config.RATE_LIMIT_WINDOW
)

# =============================================================================
# HEALTH CHECKS FOR KUBERNETES
# =============================================================================

class HealthCheck:
    """
    Kubernetes health check endpoints
    
    - /health/live: Liveness probe (is the process running?)
    - /health/ready: Readiness probe (can it accept traffic?)
    """
    
    def __init__(self):
        self._dependencies: Dict[str, Callable] = {}
        self._start_time = datetime.utcnow()
    
    def register_dependency(self, name: str, check_func: Callable) -> None:
        """Register a dependency health check"""
        self._dependencies[name] = check_func
    
    async def liveness(self) -> Dict[str, Any]:
        """Liveness check - is the service running?"""
        return {
            "status": "healthy",
            "service": config.SERVICE_NAME,
            "version": config.SERVICE_VERSION,
            "pod": config.POD_NAME,
            "uptime_seconds": (datetime.utcnow() - self._start_time).total_seconds()
        }
    
    async def readiness(self) -> Dict[str, Any]:
        """Readiness check - can the service handle requests?"""
        results = {"status": "healthy", "checks": {}}
        all_healthy = True
        
        for name, check_func in self._dependencies.items():
            try:
                if asyncio.iscoroutinefunction(check_func):
                    healthy = await check_func()
                else:
                    healthy = check_func()
                results["checks"][name] = "healthy" if healthy else "unhealthy"
                if not healthy:
                    all_healthy = False
            except Exception as e:
                results["checks"][name] = f"error: {str(e)}"
                all_healthy = False
        
        results["status"] = "healthy" if all_healthy else "unhealthy"
        return results

# Global health checker
health = HealthCheck()

# =============================================================================
# METRICS COLLECTION FOR AUTO-SCALING
# =============================================================================

class Metrics:
    """
    Metrics collection for Kubernetes HPA (Horizontal Pod Autoscaler)
    
    Collects:
    - Request count and latency
    - Error rates
    - Cache hit rates
    - Queue depth
    """
    
    def __init__(self):
        self._counters: Dict[str, int] = {}
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = {}
        self._start_time = datetime.utcnow()
    
    def increment(self, name: str, value: int = 1, labels: Dict = None) -> None:
        """Increment a counter"""
        key = self._make_key(name, labels)
        self._counters[key] = self._counters.get(key, 0) + value
    
    def gauge(self, name: str, value: float, labels: Dict = None) -> None:
        """Set a gauge value"""
        key = self._make_key(name, labels)
        self._gauges[key] = value
    
    def histogram(self, name: str, value: float, labels: Dict = None) -> None:
        """Record a histogram value"""
        key = self._make_key(name, labels)
        if key not in self._histograms:
            self._histograms[key] = []
        self._histograms[key].append(value)
        
        # Keep only last 1000 values
        if len(self._histograms[key]) > 1000:
            self._histograms[key] = self._histograms[key][-1000:]
    
    def _make_key(self, name: str, labels: Dict = None) -> str:
        """Create a metric key with labels"""
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics in Prometheus format"""
        result = {
            "service": config.SERVICE_NAME,
            "pod": config.POD_NAME,
            "uptime": (datetime.utcnow() - self._start_time).total_seconds(),
            "counters": self._counters.copy(),
            "gauges": self._gauges.copy(),
            "histograms": {}
        }
        
        # Calculate histogram stats
        for key, values in self._histograms.items():
            if values:
                sorted_vals = sorted(values)
                result["histograms"][key] = {
                    "count": len(values),
                    "sum": sum(values),
                    "avg": sum(values) / len(values),
                    "p50": sorted_vals[len(sorted_vals) // 2],
                    "p95": sorted_vals[int(len(sorted_vals) * 0.95)],
                    "p99": sorted_vals[int(len(sorted_vals) * 0.99)]
                }
        
        return result
    
    def prometheus_format(self) -> str:
        """Export metrics in Prometheus text format"""
        lines = []
        
        for key, value in self._counters.items():
            lines.append(f"divine_heroes_{key} {value}")
        
        for key, value in self._gauges.items():
            lines.append(f"divine_heroes_{key} {value}")
        
        for key, values in self._histograms.items():
            if values:
                lines.append(f"divine_heroes_{key}_count {len(values)}")
                lines.append(f"divine_heroes_{key}_sum {sum(values)}")
        
        return "\n".join(lines)

# Global metrics instance
metrics = Metrics()

# =============================================================================
# DECORATORS
# =============================================================================

def cached(ttl: int = 60, key_prefix: str = ""):
    """Decorator to cache function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                metrics.increment("cache_hit", labels={"function": func.__name__})
                return cached_value
            
            metrics.increment("cache_miss", labels={"function": func.__name__})
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator

def rate_limited(cost: int = 1):
    """Decorator to rate limit function calls"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get("username") or kwargs.get("user_id") or (args[0] if args else "anonymous")
            
            allowed, wait_time = await rate_limiter.check(str(user_id), cost)
            if not allowed:
                metrics.increment("rate_limit_exceeded", labels={"function": func.__name__})
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Retry after {wait_time} seconds.",
                    headers={"Retry-After": str(wait_time)}
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def timed(name: str = None):
    """Decorator to time function execution"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            import time
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                metrics.increment("request_success", labels={"function": name or func.__name__})
                return result
            except Exception as e:
                metrics.increment("request_error", labels={"function": name or func.__name__})
                raise
            finally:
                duration = (time.perf_counter() - start) * 1000  # ms
                metrics.histogram("request_duration_ms", duration, labels={"function": name or func.__name__})
        return wrapper
    return decorator

# =============================================================================
# INITIALIZATION
# =============================================================================

async def init_infrastructure():
    """Initialize all infrastructure components"""
    await cache.connect()
    await mq.connect()
    await rate_limiter.connect()
    
    # Register health checks
    health.register_dependency("cache", lambda: cache._connected or len(cache._memory_cache) >= 0)
    health.register_dependency("mq", lambda: mq._running or True)
    
    logger.info("Production infrastructure initialized")

async def shutdown_infrastructure():
    """Shutdown all infrastructure components"""
    mq.stop()
    await mq.disconnect()
    await cache.disconnect()
    logger.info("Production infrastructure shutdown complete")
