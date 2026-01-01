"""Gacha Service - Standalone microservice entry point"""
from fastapi import FastAPI
from contextlib import asynccontextmanager
import os

from motor.motor_asyncio import AsyncIOMotorClient
from routers import gacha
from core.production_infra import (
    init_infrastructure, shutdown_infrastructure,
    health, metrics, cache
)

# Database connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.divine_heroes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_infrastructure()
    gacha.set_database(db)
    yield
    # Shutdown
    await shutdown_infrastructure()
    client.close()

app = FastAPI(
    title="Divine Heroes - Gacha Service",
    description="Summoning system and pity counter microservice",
    version="1.0.0",
    lifespan=lifespan
)

# Include gacha router
app.include_router(gacha.router, prefix="/api")

# Health endpoints
@app.get("/health/live")
async def liveness():
    return await health.liveness()

@app.get("/health/ready")
async def readiness():
    return await health.readiness()

@app.get("/metrics")
async def get_metrics():
    return metrics.get_metrics()

@app.get("/metrics/prometheus")
async def get_prometheus_metrics():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(metrics.prometheus_format())
