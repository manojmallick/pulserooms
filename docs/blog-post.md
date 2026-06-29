# Designing a million-player leaderboard with DynamoDB single-table design

*#H0Hackathon · Track 3 · how PulseRooms keeps a live global leaderboard fast at
millions of concurrent answers*

Live trivia looks simple until you do the math. Put 10,000 — or a million —
players in one round and every answer is a write, the leaderboard is a hot read,
and the players are everywhere. That's the exact shape Amazon DynamoDB is built
for. Here's how we designed the data model, and the one trick that separates a
demo from something that actually scales.

## One table, deliberate keys

We use a single DynamoDB table. Rooms, questions, players, answers, and two
leaderboards all live in it, distinguished by partition/sort key patterns:

| Entity | PK | SK |
|---|---|---|
| Room | `ROOM#<id>` | `META` |
| Question | `ROOM#<id>` | `Q#<nnn>` |
| Player | `ROOM#<id>` | `PLAYER#<pid>` |
| Answer | `ROOM#<id>` | `ANS#<pid>#<instance>` |

The leaderboard is a Global Secondary Index sorted by a **zero-padded score**:
`SCORE#00001500`. Padding is the trick that makes DynamoDB sort numbers correctly
*as strings*, so one descending `Query` returns players already ranked — no
server-side sort on the hot path.

## The bug everyone writes first

The tempting score update does too much at once:

```
ADD score :p  SET GSI1SK = scoreKey(:perQuestionPoints)   -- wrong: not the total
```

You can't know a player's cumulative total before the atomic add, so this indexes
them at the wrong score, then races when a second patch tries to fix it. The fix
is to order the writes: **atomic `ADD score` returning the new total, then set the
sort key from that true total**, guarded so a slower out-of-order write can't
overwrite a higher score:

```
ConditionExpression: attribute_not_exists(scoreSeen) OR scoreSeen <= :s
```

## The part that actually scales: write sharding

Here's the one that matters. Every answer in a room writes to the same partition
key — `ROOM#<id>`. A naïve leaderboard GSI keyed on `ROOM#<id>` therefore funnels
the *entire room's* write firehose into a single partition. DynamoDB caps a
partition at ~1,000 write units/second, so at scale you get a guaranteed hot
partition and throttling.

The fix is **scatter-gather**. On write, place each player on one of N shards:

```
GSI1PK = SHARD#<roomId>#<hash(playerId) % N>
```

On read, fan out one descending Query per shard and merge the partial top-Ks. The
union of per-shard top-Ks always contains the true global top-K, so the answer is
exact — and the write load is spread across N partitions instead of one.

## Proving it (not just claiming it)

We built an in-region load harness: a fleet of Lambda workers fire writes from
*inside* the region (so latency is ~1–4 ms, not the ~250 ms a laptop pays), with
retries off so throttles surface. Under identical paced load, the single-partition
control was **~8× worse at p99 (1,262 ms vs 154 ms)**; sustained, it threw
**47,115 `ProvisionedThroughputExceeded` throttles** while the sharded design
stayed flat. Same data, spread across ten partitions instead of one.

## Realtime, the AWS-native way

Vercel functions can't hold persistent WebSockets, so the live connections live on
**API Gateway WebSocket API**. **DynamoDB Streams** trigger a Lambda that
recomputes the top-K on score changes and pushes it to subscribed clients. Vercel
serves the app and REST; AWS owns the realtime fanout and (via Global Tables)
multi-region active-active.

## Takeaway

DynamoDB rewards designing for your access patterns up front. Pad your sort keys,
order your atomic writes, and — the big one — **shard the partition that takes the
firehose**. That single decision is the difference between a leaderboard that
throttles at scale and one that stays single-digit-millisecond at millions of
concurrent answers.

*Built with Amazon DynamoDB + Global Tables on Vercel. #H0Hackathon*
