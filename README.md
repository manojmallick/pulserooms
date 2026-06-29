# PulseRooms — Real-Time Global Trivia Battle Royale

**Track 3 · Million-scale Global App · Amazon DynamoDB + Global Tables**

Thousands of players join one live round, answer against a timer, and climb a
worldwide leaderboard updating in real time — architected to absorb **millions of
concurrent answer-writes without a hot partition**.

> The submission is won on **architectural rigor**, not concept novelty. Lead with
> the data model, the write-sharding, and the load-test proof below.

🎮 **Live:** https://pulserooms.vercel.app · ▶️ play https://pulserooms.vercel.app/room/live-1
📦 **Judges start here:** [`SUBMISSION.md`](SUBMISSION.md) · 🗺️ [`docs/architecture.md`](docs/architecture.md)

---

## Why DynamoDB

A live trivia round is a write firehose with a real-time read: every answer is a
write, the leaderboard is a hot read, and players are global. That is the textbook
DynamoDB profile — single-digit-ms latency at any scale, Streams for event-driven
fanout, and Global Tables for active-active multi-region. A relational DB buckles
under millions of concurrent leaderboard writes; DynamoDB is built for exactly it.

---

## Single-table design

One table, `PulseRooms`, on-demand (PAY_PER_REQUEST) billing, Streams on
(`NEW_AND_OLD_IMAGES`). Provisioned by [`scripts/provision-table.mjs`](scripts/provision-table.mjs);
keys are centralized and documented in [`lib/keys.ts`](lib/keys.ts).

| Entity | PK | SK | Key attrs |
|---|---|---|---|
| Room | `ROOM#<roomId>` | `META` | status, title, startTime, questionCount |
| Question | `ROOM#<roomId>` | `Q#<nnn>` | text, options, correctAnswer, timeLimitMs |
| Player-in-room | `ROOM#<roomId>` | `PLAYER#<playerId>` | username, **score**, scoreSeen, joinedAt |
| Answer | `ROOM#<roomId>` | `ANS#<playerId>#<qNum>` | answer, isCorrect, responseMs, points |
| WS connection | `ROOM#<roomId>` | `CONN#<connectionId>` | connectedAt, ttl |
| Player profile | `PLAYER#<playerId>` | `PROFILE` | username, totalScore, streak, level |
| Player history | `PLAYER#<playerId>` | `ROOM#<roomId>` | finalRank, score, playedAt |

### Global Secondary Indexes

**GSI1 — per-room leaderboard, WRITE-SHARDED**
- `GSI1PK = SHARD#<roomId>#<0..N-1>` · `GSI1SK = SCORE#<zero-padded>`
- Projects `username, score` so the board renders from the index alone.

**GSI2 — global seasonal leaderboard**
- `GSI2PK = SEASON#<seasonId>` · `GSI2SK = SCORE#<zero-padded>`

The zero-padded score key (`SCORE#00001500`) makes DynamoDB sort numeric
leaderboards correctly **as strings**, so a single descending `Query` returns
ranked players — no server-side sort on the hot path.

### Access patterns

| # | Pattern | Query | Code |
|---|---|---|---|
| 1 | Room metadata | `PK=ROOM#<id>, SK=META` | `getRoom` |
| 2 | All questions | `PK=ROOM#<id>, begins_with(SK,'Q#')` | `getQuestions` |
| 3 | Join room | Put `ROOM#<id> / PLAYER#<pid>` (idempotent) | `joinRoom` |
| 4 | Submit answer | Put `ROOM#<id> / ANS#<pid>#<q>` (idempotent) | `/api/answer/submit` |
| 5 | Live room leaderboard (top-K) | **scatter-gather** GSI1 over N shards | `getLeaderboard` |
| 6 | My score | `ALL_NEW` from the atomic add | `applyScore` |
| 7 | Global seasonal leaderboard | GSI2 `GSI2PK=SEASON#<id>` desc | `getSeasonLeaderboard` |
| 8 | Profile + streak | `PK=PLAYER#<id>, SK=PROFILE` | `getProfile` |
| 9 | Game history | `PK=PLAYER#<id>, begins_with(SK,'ROOM#')` | `getHistory` |

---

## The three things that win this track

### 1 · Correct atomic scoring — [`lib/scoring.ts`](lib/scoring.ts)

The naïve flow (`ADD score` **and** `SET GSI1SK` from per-question points in one
write, then patch the sort key) indexes the player at the **wrong** score and
**races** under concurrent answers, corrupting leaderboard order. You cannot know
the cumulative total before the atomic add. The fix orders the writes:

1. `ADD score :p` with `ReturnValues: ALL_NEW` → the **true** cumulative total.
2. `SET` the GSI sort keys from that total, guarded by
   `attribute_not_exists(scoreSeen) OR scoreSeen <= :s` so a slower out-of-order
   write can't stomp a higher score. A condition failure is the **expected**,
   benign outcome of losing that race — not an error.

Grading is also **server-authoritative** (`/api/answer/submit` fetches the
question and grades it) — the original trusted a client-supplied `correctAnswer`.
Answer writes are idempotent (`attribute_not_exists(SK)`), so a double-tap or
retry can't double-score.

### 2 · Write-sharded leaderboard — the hot-partition fix — [`lib/keys.ts`](lib/keys.ts) · [`lib/leaderboard.ts`](lib/leaderboard.ts)

Every answer in a room writes to `PK=ROOM#<id>`, and a naïve leaderboard GSI keys
on `GSI1PK=ROOM#<id>` → **one partition absorbs the entire room's write
firehose**. At millions of concurrent answers that partition throttles (the
per-partition write ceiling is a hard limit, on-demand or not).

**Fix:** scatter writes across `N` shards by a stable hash of `playerId`
(`SHARD#<roomId>#<n>`), and **gather on read** — one descending `Query` per shard
(each index-only, cheap), merged into the global top-K. The union of per-shard
top-Ks provably contains the true top-K. A player always hashes to the same shard,
so the conditional score-index write targets one deterministic item.

> *"A single room's writes would hot-spot one partition, so we shard the
> leaderboard across N partitions and scatter-gather the top-K on read. That's how
> this stays single-digit-millisecond at millions of concurrent answers."*

### 3 · AWS-native realtime — [`lambda/`](lambda/)

Vercel functions can't host persistent WebSocket servers, so the connections live
on AWS:

```
answer ─▶ /api/answer/submit ─▶ DynamoDB write ─▶ Streams ─▶ Lambda (aggregator)
                                                                  │ recompute top-K
                                            API Gateway WebSocket API ◀── push
                                                                  ▼
                                              all subscribed clients update live
```

`leaderboard-aggregator.mjs` debounces thousands of score writes per stream batch
into a handful of top-K broadcasts. Vercel serves the Next.js app + REST; AWS owns
realtime fanout. The web UI ([`components/use-leaderboard.ts`](components/use-leaderboard.ts))
prefers the WS push and falls back to polling for local dev. Deploy steps:
[`lambda/README.md`](lambda/README.md).

---

## Proof, not adjectives — load test

Two harnesses. The laptop one is a smoke test; the **in-region** one is the real
proof, because a single laptop can't push enough throughput over the internet to
saturate a DynamoDB partition (each write pays ~250 ms RTT; you top out ~450
writes/s — far below a partition's 1,000 WCU ceiling).

### In-region proof (the money shot) — measured results

A fleet of **Lambda workers fire writes from inside the region** (write latency
~1–4 ms, not 250 ms), driven by a local orchestrator that merges their latency
histograms for exact global percentiles. Retries are **off** (`maxAttempts: 1`)
so throttles surface instead of being silently retried.

```bash
pnpm loadgen:deploy                       # deploy the worker Lambda (one time)
pnpm loadtable:up                         # provisioned PulseRoomsLoad (controlled capacity)
pnpm loadgen -- --mode=both --table=PulseRoomsLoad \
  --writes=24000 --workers=8 --invokePool=8 --rate=3000   # paced 3k writes/s
pnpm loadtable:down                       # ⚠ delete it — provisioned WCU bills hourly
```

**Methodology to isolate the variable:** base-table writes are spread across 200
buckets so the base partition is never the bottleneck — the **leaderboard GSI
partition is the only thing that differs** between modes. The table is
*provisioned* (not on-demand) so the per-partition **1,000 WCU hard limit** bites
deterministically instead of fighting on-demand's floating table-level ceiling.

Measured on a provisioned `PulseRoomsLoad` table, `us-east-1`:

| Run | offered | single (control) | sharded (fix) |
|---|---|---|---|
| **Matched, paced** | 3,000/s | p99 **1,262 ms**, p90 920 ms | p99 **154 ms**, p90 46 ms |
| **Sustained** (burst exhausted) | 7,000/s → 1 partition | **47,115** `ProvisionedThroughputExceeded` throttles, max 18 s | — |

Reading the result: under **identical** paced load the hot single GSI partition
is **~8× worse at p99** (1,262 ms vs 154 ms) — that *is* the hot-partition effect.
Push harder and it crosses from "slow" to **hard-throttling** (47k
`ProvisionedThroughputExceededException`) once DynamoDB's burst capacity drains;
the sharded design stays flat because the same load is spread across 10
partitions. Pair either run with a CloudWatch `WriteThrottleEvents` screenshot of
the GSI — that side-by-side is the demo slide.

> Honest notes: (1) on a *short* test the single partition degrades in **latency**
> rather than throwing throttles, because burst capacity absorbs the overage —
> sustain the load to force hard throttles. (2) Above ~5k writes/s the Lambda's
> own HTTP socket pool becomes a client-side bottleneck, so read the **3k/s
> matched run** for the clean apples-to-apples latency comparison.

### Laptop smoke test

[`scripts/loadtest.mjs`](scripts/loadtest.mjs) writes directly from your machine —
useful to validate the write path and the scatter-gather read, not to reproduce
throttling:

```bash
pnpm loadtest -- --mode=sharded --writes=2000 --concurrency=120
```

### Cleanup

```bash
pnpm ddb:clean        # purge throwaway load-test items from the main table
pnpm loadtable:down   # delete the provisioned proof table (stops hourly billing)
```

---

## Run it

```bash
cp .env.example .env.local          # set AWS creds (or vercel env pull for OIDC)
pnpm install
pnpm ddb:provision                  # create table + GSI1/GSI2 + Streams
pnpm ddb:seed                       # demo room "live-1", starts in 5s
pnpm dev                            # → http://localhost:3000/room/live-1
```

**Auth (two modes, auto-detected — [`lib/dynamo.ts`](lib/dynamo.ts)):**
1. **OIDC role federation** (preferred, credential-less) — set `AWS_ROLE_ARN`;
   `vercel env pull` provides the short-lived `VERCEL_OIDC_TOKEN`.
2. **Static keys** — `AWS_ACCESS_KEY_ID` / `SECRET` for local provisioning.

**Global Tables:** after the table exists, add replica regions with
`aws dynamodb update-table --replica-updates …` (requires Streams, which the
provisioner enables).

---

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · `@aws-sdk/lib-dynamodb` ·
`@vercel/oidc-aws-credentials-provider` · Vercel (app + REST) · AWS DynamoDB,
Streams, Lambda, API Gateway WebSocket.

```
app/            landing · room/[roomId] · leaderboard · profile · api/*
components/     game-room · leaderboard · use-leaderboard (WS+poll) · top-nav
lib/            dynamo · keys (schema+sharding) · scoring · leaderboard · room
lambda/         leaderboard-aggregator · ws-connection · loadgen-worker (in-region)
scripts/        provision-table · seed · aws (client factory) · proof (evidence)
                loadtest (laptop) · loadgen + deploy-loadgen + provision-load-table (in-region proof)
                clean-loadtest
db/             questions (demo set)
docs/           architecture · cost-at-scale · blog-post (#H0Hackathon)
                v0-prompts · proof/ (generated evidence)
SUBMISSION.md   the submission package (pitch · links · awards · demo script)
```

### Submission-grade scripts
```
pnpm ddb:crowd     populate the leaderboard with a realistic crowd
pnpm ddb:ttl       enable TTL on ephemeral items (answers, connections)
pnpm gt:enable     enable Global Tables (multi-region active-active)  ·  gt:status / gt:disable
pnpm proof         regenerate DynamoDB evidence into docs/proof/
```

---

*PulseRooms · Track 3 Million-scale · Amazon DynamoDB single-table design with a write-sharded leaderboard.*
