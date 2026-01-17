# Mail System Contract

Defines the mail system architecture, tabs, and receipt queue semantics.

---

## Mail Tabs

| Tab | Content | Badge Source |
|-----|---------|-------------|
| Rewards | Claimable rewards (daily, achievement, event) | `rewardsAvailable` |
| Messages | System messages | `unreadMessages` |
| Gifts | Gifts from friends/system | `giftsAvailable` |
| Receipts | Queued receipts (fallback queue) | `receiptsAvailable` |

**Note:** Receipts tab only visible when `receiptsAvailable > 0`.

---

## API Endpoints

### Summary
```
GET /api/mail/summary
Response: {
  rewardsAvailable: number,
  unreadMessages: number,
  giftsAvailable: number,
  receiptsAvailable: number
}
```

### Rewards
```
GET /api/mail/rewards
POST /api/mail/rewards/{id}/claim -> RewardReceipt
```

### Messages
```
GET /api/mail/messages
```

### Gifts
```
GET /api/mail/gifts
POST /api/mail/gifts/{id}/claim -> RewardReceipt
```

### Receipts (Phase 3.26)
```
GET /api/mail/receipts
POST /api/mail/receipts/{id}/claim -> RewardReceipt
```

---

## Receipt Queue Semantics

### When to Queue

Use `queue_receipt_to_mail()` when:
- Reward grant fails due to transient error
- Offline user should receive rewards
- System-generated rewards need mail delivery
- Async reward processing (e.g., from webhooks)

### Queue Record Shape

```json
{
  "id": "receipt_abc123",
  "user_id": "user_xyz",
  "original_source": "idle_claim",
  "original_source_id": "idle_user_ts",
  "rewards": [{"type": "gold", "amount": 1000}],
  "description": "Idle rewards recovery",
  "claimed": false,
  "created_at": "2024-01-15T10:00:00Z",
  "expires_at": "2024-02-14T10:00:00Z"
}
```

### Expiration

- Default: 30 days
- Expired receipts return 410 Gone on claim attempt
- Expired receipts not returned in list

---

## Authentication

All mail endpoints use auth-token identity:

```python
user, _ = await authenticate_request(credentials, require_auth=True)
```

Legacy routes (`/api/mail/{username}/...`) ignore username param.

---

## Badge Refresh

- Event-driven via `triggerBadgeRefresh()`
- Called after successful claim
- No polling loops

---

## Telemetry

| Event | Trigger |
|-------|--------|
| `mail_claim_submitted` | Claim button pressed |
| `mail_receipts_viewed` | Receipts tab opened |
| `mail_receipt_claim_submitted` | Receipt claim pressed |
| `reward_*` events | Standard receipt events |
