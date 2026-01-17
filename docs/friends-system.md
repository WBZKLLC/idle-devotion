# Friends System Contract

Defines the friends system architecture and gift behavior.

---

## Friends Tabs

| Tab | Content | Badge Source |
|-----|---------|-------------|
| Requests | Pending friend requests | `pendingRequests` |
| Friends | Current friends list | `totalFriends` |
| Search | Player search | N/A |

---

## API Endpoints

### Summary
```
GET /api/friends/summary
Response: {
  pendingRequests: number,
  totalFriends: number
}
```

### Requests
```
GET /api/friends/requests
POST /api/friends/requests/{id}/accept -> Idempotent
POST /api/friends/requests/{id}/decline -> Idempotent
```

### Friends List
```
GET /api/friends
```

### Search
```
GET /api/friends/search?q={query}
```

### Friend Requests
```
POST /api/friends/request/{targetUserId}
```

### Gifts (Phase 3.28)
```
POST /api/friends/gifts/send
Body: { friendId: string, giftType: string }
Response: RewardReceipt (for sender confirmation)
```

---

## Gift System (Phase 3.28)

### Flow

1. **Sender:** Clicks "Send Gift" on friend row
2. **Backend:** Creates mail gift for recipient, returns confirmation receipt
3. **Recipient:** Sees gift in Mail > Gifts tab
4. **Recipient:** Claims gift -> RewardReceipt

### Gift Types

| Type | Amount | Daily Limit |
|------|--------|-------------|
| gold | 100 | 5 per friend |
| stamina | 10 | 3 per friend |
| gems | 5 | 1 per friend |

### Telemetry

| Event | Data |
|-------|------|
| `friend_gift_sent` | giftType, friendId |
| `friend_gift_claim_submitted` | giftId |
| Standard receipt events | source: mail_gift_claim |

---

## Authentication

All friends endpoints use auth-token identity:

```python
user, _ = await authenticate_request(credentials, require_auth=True)
```

---

## Search Behavior

- Minimum 3 characters
- Debounced (300ms)
- Max 20 results
- Excludes current user
- Shows friendship status

---

## Idempotency

- Accept/decline requests are idempotent
- Duplicate actions return success (not error)
