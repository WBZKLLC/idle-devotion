# PvP Season System

## Overview

Phase 4.2 implements seasonal PvP with rank bands and rewards.

## Rank Bands

| Band | Min Rating | Daily Reward | Season Reward |
|------|------------|--------------|---------------|
| Bronze | 0 | 10 medals, 1k gold | 100 medals, 10k gold |
| Silver | 1000 | 20 medals, 2k gold | 200 medals, 25k gold |
| Gold | 1200 | 40 medals, 4k gold | 400 medals, 50k gold, 100 crystals |
| Platinum | 1400 | 60 medals, 6k gold | 600 medals, 100k gold, 200 crystals |
| Diamond | 1600 | 80 medals, 8k gold | 1000 medals, 200k gold, 500 crystals |
| Master | 1800 | 100 medals, 10k gold | 1500 medals, 500k gold, 1000 crystals |
| Grandmaster | 2000 | 150 medals, 15k gold | 2500 medals, 1M gold, 2000 crystals |

## Ethics Compliance

- **No stat boosts** from PvP rewards
- **No shop links** from PvP screens
- **Currency/cosmetics only** rewards
- **No paid advantage** in matchmaking

## Endpoints

- `GET /api/pvp/season` - Current season info
- `GET /api/pvp/rewards/preview` - All rank rewards
- `POST /api/pvp/daily/claim` - Claim daily reward (idempotent)
- `POST /api/pvp/season/claim` - Claim season reward (idempotent)

## Season Schedule

- Seasons run monthly (1st to last day)
- Season ID format: `season_YYYY_MM`
- Season rewards claimable for 7 days after end
