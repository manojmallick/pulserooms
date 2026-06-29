# PulseRooms — Submission

**Track 3 · Million-scale Global App · Amazon DynamoDB + Global Tables**

> A real-time global trivia battle royale: thousands of players join one live
> round, answer against the clock, and climb a worldwide leaderboard updating in
> real time — engineered to absorb **millions of concurrent answer-writes without
> a hot partition.**

## Links

| | |
|---|---|
| 🎮 **Live app** | **https://pulserooms.vercel.app** |
| ▶️ Play a live round | https://pulserooms.vercel.app/room/live-1 |
| 📊 **Live scale dashboard** (shard distribution, table internals) | https://pulserooms.vercel.app/scale |
| 🏆 Global leaderboard | https://pulserooms.vercel.app/leaderboard |
| 📦 Repo | https://github.com/manojmallick/pulserooms |
| 👥 Team ID | _<add your hackathon Team ID>_ |
| 🎬 Demo video | _<add link — script in §7>_ |

The live round is **evergreen** — questions loop continuously, so the link is
always playable whenever a judge opens it.

---

## 1. Why this wins Track 3

Track 3 is judged on **architecture that scales to millions globally** — the
architecture *is* the submission. Live trivia is the perfect stress test: a
massive concurrent **write** firehose (every answer), a hot real-time **read**
(the leaderboard), and **global** distribution. We don't just assert scale — we
**prove** the hard part (the hot-partition problem) with an in-region load test.

Our edge here is **architectural rigor**, not concept novelty. Lead with the data
model, the write-sharding, and the load-test evidence.

## 2. Why DynamoDB

Single-digit-ms latency at any scale, Streams for event-driven fanout, and Global
Tables for active-active multi-region. A relational DB buckles under millions of
concurrent leaderboard writes; this is the textbook DynamoDB workload.

## 3. The three things a NoSQL SA judge looks for

### ① Correct atomic scoring — no race ([`lib/scoring.ts`](lib/scoring.ts))
The naïve flow sets the leaderboard sort key from *per-question* points and
patches it in a second write — indexing the player at the wrong score and racing
under concurrency. We order it right: **atomic `ADD score` → read the true total →
set the GSI sort key from that total**, guarded by `scoreSeen <= :s` so a slower
out-of-order write can't stomp a higher score. Grading is **server-authoritative**
and answer writes are **idempotent** (`attribute_not_exists`).

### ② Write-sharded leaderboard — the hot-partition fix ([`lib/keys.ts`](lib/keys.ts), [`lib/leaderboard.ts`](lib/leaderboard.ts))
A room's whole answer firehose would hit one GSI partition (`ROOM#<id>`) and
throttle. We **scatter** writes across N shards (`SHARD#<id>#<hash(playerId)%N>`)
and **gather** on read — N parallel descending Queries merged into the global
top-K. The union of per-shard top-Ks provably contains the true top-K.

### ③ AWS-native realtime ([`lambda/`](lambda/))
Vercel can't host persistent WebSockets, so connections live on **API Gateway
WebSocket API**. **DynamoDB Streams → Lambda** recomputes top-K on score changes
and pushes to subscribed clients. Vercel serves the app + REST; AWS owns fanout.

→ Diagrams: [`docs/architecture.md`](docs/architecture.md)

## 4. Proof, not adjectives (measured on real AWS, us-east-1)

A fleet of **in-region Lambda workers** drives writes with retries off so
throttles surface. Methodology isolates the GSI partition as the only variable
(base writes spread across 200 buckets; provisioned capacity so the per-partition
**1,000 WCU** limit bites deterministically).

| Run | Offered | single partition (control) | sharded (fix) |
|---|---|---|---|
| Matched, paced | 3,000/s | p99 **1,262 ms** | p99 **154 ms** (~8× better) |
| Sustained (burst drained) | 7,000/s → 1 partition | **47,115** `ProvisionedThroughputExceeded` throttles | — |

CloudWatch on the app table recorded **83,643** table + **44,723** GSI
`WriteThrottleEvents` during testing. Regenerate evidence anytime: `pnpm proof`
→ [`docs/proof/`](docs/proof/). Full method + harness: [`README`](README.md#proof-not-adjectives--load-test).

## 5. Single-table design & access patterns

One table, on-demand billing, Streams on; GSI1 = sharded room leaderboard, GSI2 =
seasonal. Zero-padded score key (`SCORE#00001500`) makes DynamoDB sort
leaderboards correctly as strings. Full table + 9 documented access patterns:
[`README`](README.md#single-table-design) · [`docs/architecture.md`](docs/architecture.md).

## 6. Special awards targeted

- **Best Technical Implementation** — the single-table design, the write-sharding,
  and the in-region load-test proof are a complete, rigorous technical story.
- **Most Original** — evergreen looping rounds + AWS-native realtime fanout.

## 7. Demo video script (~2:45)

1. **0:00–0:20 — Hook.** Open https://pulserooms.vercel.app/room/live-1, type a
   name, answer a live question — score animates, leaderboard updates. "Thousands
   could be doing this in the same round right now."
2. **0:20–0:55 — The data model.** Show [`docs/architecture.md`](docs/architecture.md)
   single-table + the access-pattern table. "One table; rooms, players, answers,
   and two leaderboards, with deliberate PK/SK access patterns."
3. **0:55–1:40 — The hot-partition fix.** Open the **live [`/scale`](https://pulserooms.vercel.app/scale)
   dashboard** — point at the shard-distribution bars (players spread evenly across
   all 10 partitions). Say the line: *"A single room's writes would hot-spot one
   partition, so we shard the leaderboard across N partitions and scatter-gather
   the top-K on read. That's how this stays single-digit-millisecond at millions of
   answers."* Backup: the sharding diagram + [`lib/keys.ts`](lib/keys.ts).
4. **1:40–2:20 — Proof.** Show the load-test table (§4) + a CloudWatch
   `WriteThrottleEvents` graph: control throttles, sharded stays flat.
5. **2:20–2:45 — AWS-native realtime + Global Tables.** Show the
   Streams→Lambda→WebSocket diagram. "Vercel serves the app; AWS owns realtime and
   multi-region active-active."

## 8. Verify it yourself

```bash
pnpm install
cp .env.example .env.local       # AWS creds (or vercel env pull for OIDC)
pnpm ddb:provision && pnpm ddb:seed && pnpm dev   # → /room/live-1
pnpm proof                       # regenerate DynamoDB evidence
```

## 9. Submission checklist

- [x] Live Vercel app (evergreen demo room)
- [x] DynamoDB single-table design + 9 access patterns documented
- [x] Hot-partition fix (write-sharded leaderboard) with in-region load-test proof
- [x] **Live scale dashboard** — shard distribution + table internals ([`/scale`](https://pulserooms.vercel.app/scale))
- [x] AWS-native realtime (Streams → Lambda → API Gateway WebSocket)
- [x] **Global Tables** — multi-region active-active replicas enabled (`pnpm gt:status`)
- [x] **TTL** on ephemeral items (answers, connections) for auto-cleanup
- [x] Architecture diagrams ([`docs/architecture.md`](docs/architecture.md))
- [x] Cost-at-scale analysis ([`docs/cost-at-scale.md`](docs/cost-at-scale.md))
- [x] Machine-verifiable storage evidence (`pnpm proof` → [`docs/proof/`](docs/proof/))
- [x] Bonus blog post ([`docs/blog-post.md`](docs/blog-post.md)) — tag `#H0Hackathon`
- [x] v0 design prompts ([`docs/v0-prompts.md`](docs/v0-prompts.md))
- [ ] **Team ID** + **repo URL** (fill in §Links)
- [ ] **Demo video** recorded (script in §7)

---

*PulseRooms · Track 3 Million-scale · Amazon DynamoDB single-table design with a write-sharded leaderboard.*
