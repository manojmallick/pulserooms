# Cost at scale

Scaling to millions is only impressive if it's also *affordable*. Here's the
honest unit economics of PulseRooms on DynamoDB on-demand.

> Figures use Amazon DynamoDB **on-demand** pricing, **us-east-1**, standard
> tables (list price; excludes free tier and any committed-use discounts).
> Verify against the current [DynamoDB pricing page](https://aws.amazon.com/dynamodb/pricing/on-demand/)
> before quoting — prices change. `[MED confidence]`

## What one answer costs

A single answer submission performs:

| Operation | Write units | Notes |
|---|---|---|
| `PutItem` answer (`ANS#…`, <1 KB) | 1 WRU | idempotent record |
| `UpdateItem` ADD score (base item) | 1 WRU | the atomic counter |
| → GSI1 (sharded leaderboard) | 1 WRU | replicated index write |
| → GSI2 (season) | 1 WRU | replicated index write |

≈ **4 write units per answer**. On-demand writes are ~**$1.25 per million WRU**,
so **~$5 per million answers**. Leaderboard reads are eventually-consistent
Queries against a projected index (≈0.5 RRU each), effectively rounding to zero
next to the writes.

## A concrete live round

**1,000,000 players · one round · 8 questions** = 8,000,000 answers:

```
8,000,000 answers × 4 WRU            = 32,000,000 WRU
32,000,000 WRU × $1.25 / 1,000,000   ≈ $40 in writes for the whole round
```

Add leaderboard reads (every client polls/streams the top-K): the Streams→Lambda
fanout means clients are **pushed**, not polling, so reads scale with *score
changes*, not client count — a few thousand recomputes, not millions of Queries.
Streams read requests and the aggregator Lambda are cents.

**A million-player round costs on the order of tens of dollars in DynamoDB** —
and nothing when idle, because on-demand bills per request.

## Why on-demand is the right call here

Live trivia is **spiky**: zero load between rounds, a wall of writes during one.
Provisioned capacity would force you to either over-provision (pay for idle
headroom) or under-provision (throttle at the spike). On-demand absorbs the spike
automatically and bills nothing between rounds — the correct model for a bursty
event workload.

## Levers if writes ever dominate

- **Drop GSI2 to a periodic rollup.** The seasonal board doesn't need per-answer
  freshness; aggregating it from Streams every N seconds removes 1 of the 4 WRU.
- **Batch the score index.** Coalesce a player's rapid answers before re-indexing.
- **TTL** (enabled) auto-expires answers + connections, so storage stays flat
  instead of growing with every historical round.

## Multi-region note

Global Tables replicate writes to each region, so a 3-region deployment is ~3×
the write cost — the price of active-active low latency worldwide. Enable replicas
only for the regions you actually serve; `pnpm gt:disable` removes them.

---

*Bottom line: single-digit-millisecond at millions of concurrent answers, for tens
of dollars per million-player round, scaling to **$0 at idle.***
