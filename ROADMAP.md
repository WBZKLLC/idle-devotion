# Idle Devotion, A Soul Bound Fantasy — 12-Month Roadmap (Systems + Juice)

## Guiding Rule
Tier logic lives in `/app/frontend/lib/tier.ts`. New systems must extend via NEW helpers/modules without rewriting existing screens.

---

## Month 1 (Now): Close the progression loop
- ✅ Heroes grid uses tier art via ascension_images[tier]
- ✅ Hero detail tier selector + tier portrait/background
- ✅ Hero progression promote-star optimistic UI + post-promo refresh
- ✅ Centralized tier logic in `/app/frontend/lib/tier.ts`
- ✅ Shared animated TierSelector component
- Add "New Tier Unlocked" toast + CTA to view art

Deliverable: gacha → duplicates → stars → tier art → cinematic preview flow is coherent.

---

## Month 2: Progression polish + feedback
- Promotion success animation (star burst + tier unlock banner)
- Shard economy clarity: "X pulls away" hints
- Add quick links: Progression → Detail (tier) → Summon

Deliverable: progression feels satisfying and obvious.

---

## Month 3: Cinematics phase 1
- Tier 6 (5★+) cinematic gate shown consistently
- Add "Preview cinematic" UX for eligible rarity (UR/UR+)
- Optional: preload video metadata for smoother playback

Deliverable: cinematic loop feels premium.

---

## Month 4: Campaign integration
- Campaign stage rewards feed hero shards more visibly
- Add "Shard Drops" UI to stage detail
- Add "Recommended hero upgrades" hint card

Deliverable: campaign supports progression loop.

---

## Month 5: Content scale tools (internal)
- Add JSON manifest validation (ascension_images completeness)
- Add dev UI to inspect tiers/arts per hero
- Add automated checks to prevent missing tier images

Deliverable: safe scaling beyond 22 heroes.

---

## Month 6: Awakening system planning + scaffolding (NO screen rewrites)
### Goal: Add 7★–10★ as an extension layer
- Create `/app/frontend/lib/awakening.ts`:
  - maps awakening_level → tiers 7–10
  - returns "effective display tier" as union of base tiers + awakening tiers
- Keep existing DisplayTier 1–6 untouched.
- Introduce `ExtendedTier = 1..10` ONLY in new code.
- Add new API keys for awakening arts later:
  - hero_data.awakening_images["7"], ["8"], ["9"], ["10"] (future)
- Update resolve logic via NEW function:
  - resolveExtendedTierArt(heroData, extendedTier) -> ascension_images OR awakening_images
  - existing resolveTierArt remains unchanged (backwards compatible)

Deliverable: awakening tiers can be added without breaking old tier logic.

---

## Month 7: Awakening phase 1 (system + minimal UI)
- Add Awakening selector (optional) in Hero Detail behind feature flag
- Add Awakening progression screen section (new card)
- Add cosmetic "aura layer" overlays per awakening tier

Deliverable: awakening feels like endgame.

---

## Month 8: Gear + buildcraft loop
- Equipment actually equips
- Stat deltas & loadouts
- "Suggested gear" and "auto-equip" MVP

Deliverable: deeper builds beyond stars.

---

## Month 9: Live ops + events
- Weekly shard events
- Limited banners (server-driven)
- Event currency → progression materials

Deliverable: retention loop.

---

## Month 10: Social + guild MVP
- Guild roster, donations, shared buffs
- Guild boss with shard rewards

Deliverable: community glue.

---

## Month 11: Economy + balance pass
- Audit shard costs vs pull rates
- Add "soft pity" transparency UI
- Tune campaign reward pacing

Deliverable: progression feels fair.

---

## Month 12: Launch hardening
- Telemetry
- Crash + perf sweeps
- Asset streaming + caching
- Store compliance and final polish

Deliverable: release-ready.

---

## Architecture Reference

### Current Files (Single Source of Truth)
```
/app/frontend/lib/tier.ts         # Tier logic (1-6)
/app/frontend/components/TierSelector.tsx  # Animated tier selector
```

### Screens Using Tier System
```
/app/frontend/app/heroes.tsx        # Grid with TierSelector
/app/frontend/app/hero-detail.tsx   # Detail with TierSelector
/app/frontend/app/hero-progression.tsx  # Promotion flow
/app/frontend/app/gacha.tsx         # Summon with tier reveal
```

### Backend Endpoints
```
GET  /api/user/{username}/heroes    # Returns hero_data.ascension_images
POST /api/hero/{id}/promote-star    # Star promotion
```

### Tier Mapping (Authoritative)
```
stars = 0  → tier 1
stars = 1  → tier 2
stars = 2  → tier 3
stars = 3  → tier 4
stars = 4  → tier 5
stars ≥ 5 OR awakening > 0 → tier 6 (5★+)
```
