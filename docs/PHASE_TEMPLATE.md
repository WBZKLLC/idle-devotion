# Phase X.XX — [Phase Name]

**Status:** 🔵 In Progress | ✅ Closed | ⏸️ Deferred

**Goal:** [One sentence describing the phase objective]

---

## Scope

- [Bullet list of what IS included]
- [Another scope item]

## Non-goals

- [What is explicitly NOT included]
- [Deferred to future phase]

---

## Deliverables

### Backend
- [ ] Endpoint/helper description
- [ ] Another backend item

### Frontend
- [ ] Screen/component description
- [ ] Another frontend item

### Documentation
- [ ] Contract doc created/updated
- [ ] Ledger updated

---

## Routes & Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/... | Description |
| POST | /api/... | Description |

---

## Telemetry Events

| Event | Trigger | Data |
|-------|---------|------|
| `event_name` | When fired | { field: type } |

---

## Guards

- [ ] `guard-phase-x-xx.mjs` created
- [ ] Added to `npm run guard`
- [ ] Enforces: [specific invariants]

---

## Definition of Done (DoD)

- [ ] All deliverables checked
- [ ] Guards passing
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Telemetry events emitting in DEV
- [ ] No timers/RAF in new code (if applicable)
- [ ] Reduce Motion respected (if applicable)
- [ ] Ledger updated with CLOSED status + commit SHA

---

## Exit Checks

- [ ] Specific verification item
- [ ] Another verification

---

## Notes

- Implementation notes
- Known limitations
- Future considerations

---

## Closure

**Closed:** [Date]
**Commit SHA:** [sha]
