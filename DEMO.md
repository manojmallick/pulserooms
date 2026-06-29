# PulseRooms — Demo Runbook

**Live:** https://pulserooms.vercel.app · **Repo:** https://github.com/manojmallick/pulserooms

The demo room is **evergreen** — questions loop forever, so the link is always
playable. No pre-seeding required, but the reset commands below give a clean slate.

## 90-second click path (what to show)

1. **Landing** (`/`) — "One round. A million players." Read the badge: *built on
   Amazon DynamoDB*. Scroll to the three pillars + "Why DynamoDB".
2. **Play** (`/room/live-1`) — type a name → answer a live question. Point out:
   timer ring, instant scoring, **your row climbing the live leaderboard**.
3. **Scale** (`/scale`) — the money shot. Say the line:
   > *"A single room's writes would hot-spot one partition, so we shard the
   > leaderboard across 10 partitions and scatter-gather the top-K on read."*
   Point at the **even shard-distribution bars** (live), the **GSIs**, the
   **3-region Global Tables**, and the **load-test card** (single p99 1,262 ms vs
   sharded 154 ms; 47,115 throttles on the control).
4. **Leaderboard** (`/leaderboard`) — gold/silver/bronze podium, GSI2 season board.
5. **Profile** (`/profile`) — total score, streak, games (AP#8/#9, live data).

## The three sentences that win Track 3

1. *"All game state — rooms, players, answers, two leaderboards — lives in one
   DynamoDB table with deliberate access patterns."*
2. *"The hard part is the hot partition: one room's whole answer firehose would
   hit a single leaderboard partition. We write-shard across 10 and scatter-gather
   on read — proven with an in-region load test, not asserted."*
3. *"Vercel serves the app; AWS owns realtime (Streams→Lambda→WebSocket) and
   multi-region active-active via Global Tables."*

## Reset / freshen before demo (optional)

```bash
cd pulserooms
pnpm ddb:crowd            # repopulate the leaderboard with ~150 players
pnpm ddb:backfill         # ensure every player has a profile/history row
pnpm proof                # regenerate docs/proof/ evidence (table + throttles)
pnpm gt:status            # confirm 3-region Global Tables still active
```

The round never "ends," but to restart the question clock at Q1:

```bash
pnpm ddb:seed             # re-seed live-1 (keeps existing players/scores)
```

## If something looks off

- **Leaderboard empty** → `pnpm ddb:crowd`.
- **Profile all zeros** → `pnpm ddb:backfill` (then refresh).
- **"Live stats unavailable" on /scale** → AWS creds/region; check `.env.local`.
- **Region selector** in the AWS console must read **N. Virginia (us-east-1)**.

## Console screenshots to capture (for the written submission)

- DynamoDB → PulseRooms → **Indexes** tab (GSI1 + GSI2)
- DynamoDB → PulseRooms → **Overview** (Streams = NEW_AND_OLD_IMAGES) + **Global tables**
- CloudWatch → **WriteThrottleEvents** for the table/GSI (the load-test proof)

Raw equivalents already in [`docs/proof/`](docs/proof/) (`pnpm proof`).
