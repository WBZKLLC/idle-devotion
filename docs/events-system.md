# Events System Contract

Defines the events/quests architecture and claim semantics.

---

## Active Events

### API Endpoint
```
GET /api/events/active
Response: {
  events: Event[],
  claimable_count: number
}
```

### Event Shape
```typescript
interface Event {
  id: string;              // Unique event identifier
  title: string;           // Display title
  description: string;     // Event description
  type: 'one_time' | 'daily';
  rewards_preview: string[]; // ["500 gold", "10 gems"]
  is_claimable: boolean;   // Can user claim now?
  ends_at: string | null;  // ISO date or null (never expires)
}
```

---

## Event Types

| Type | Behavior | Reset |
|------|----------|-------|
| `one_time` | Claimable once per user | Never |
| `daily` | Claimable once per day | UTC midnight |

---

## Claim Flow

### API Endpoint
```
POST /api/events/{eventId}/claim
Response: RewardReceipt (canonical)
```

### Idempotency
- First claim: `{ alreadyClaimed: false, items: [...] }`
- Duplicate claim: `{ alreadyClaimed: true, items: [] }`
- Both return 200 OK

---

## Canonical Receipt Source

| Source | Description | Example sourceId |
|--------|-------------|------------------|
| `event_claim` | Event reward claim | `welcome_2024_user123` |

---

## Sample Events (Phase 3.29)

| ID | Title | Type | Rewards |
|----|-------|------|--------|
| welcome_2024 | Welcome Bonus | one_time | 500 gold, 10 gems |
| daily_check_in | Daily Check-in | daily | 20 stamina |

---

## Telemetry Events

| Event | Trigger | Data |
|-------|---------|------|
| `events_viewed` | Events screen opened | { eventCount, claimableCount } |
| `event_claim_submitted` | Claim button pressed | { eventId } |
| `event_claim_success` | Claim completed | { eventId, itemCount } |
| `event_claim_already_claimed` | Duplicate claim | { eventId } |
| `event_claim_error` | Claim failed | { eventId, error } |

---

## Frontend Integration

### Events Screen (`/app/events.tsx`)
- Lists active events with claim buttons
- Shows claimable count in header badge
- Uses canonical receipt handling for claims
- No timers/RAF (event-driven refresh only)

### API Functions (`lib/api` inline)
- `getActiveQuests()` - Fetch active events
- `claimQuestReward(eventId)` - Claim and return receipt

---

## Guards

- `guard-phase-3-29.mjs` validates:
  - Events screen exists
  - `event_claim` is valid RewardSource
  - Canonical receipt handling present
  - No timers/RAF in events screen
