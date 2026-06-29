# PulseRooms — Architecture

## System (write path + realtime + multi-region)

```mermaid
flowchart TB
  subgraph Clients["🌍 Players (worldwide)"]
    T["Tokyo"]; L["London"]; S["São Paulo"]
  end

  subgraph Vercel["▲ Vercel — Next.js app + REST (Fluid Compute)"]
    UI["Game room · live leaderboard"]
    API["/api/room/* · /api/answer/submit · /api/leaderboard/"]
  end

  subgraph AWS["☁️ AWS — data + realtime"]
    direction TB
    DDB[("Amazon DynamoDB\nsingle table 'PulseRooms'\nGSI1 (sharded LB) · GSI2 (season)")]
    STREAM["DynamoDB Streams\n(NEW_AND_OLD_IMAGES)"]
    AGG["Lambda\nleaderboard-aggregator\n(recompute top-K)"]
    WS["API Gateway\nWebSocket API\n(@connections)"]
    subgraph GT["Global Tables (active-active)"]
      R1["us-east-1"]; R2["eu-west-1"]; R3["ap-northeast-1"]
    end
  end

  T & L & S --> UI
  UI -->|"answer"| API
  API -->|"atomic ADD score → index on shard"| DDB
  API -->|"scatter-gather top-K"| DDB
  DDB --> STREAM --> AGG -->|"push top-K"| WS
  WS -.->|"live leaderboard"| UI
  DDB <-.->|"replication"| GT
```

## The hot-partition fix (Upgrade #2)

Every answer in a room targets the same room — a naïve leaderboard GSI keyed on
`ROOM#<id>` puts the entire firehose on one partition. We scatter writes across
N shards and gather on read.

```mermaid
flowchart LR
  subgraph W["Answers in room R (millions/s)"]
    a1["player a"]; a2["player b"]; a3["player c"]; a4["player d"]
  end
  subgraph G["GSI1 — write shards (no hot partition)"]
    s0["SHARD#R#0"]; s1["SHARD#R#1"]; s2["…"]; s9["SHARD#R#9"]
  end
  a1 -->|"hash(id)%N"| s0
  a2 --> s1
  a3 --> s9
  a4 --> s0
  s0 & s1 & s2 & s9 -->|"N parallel descending Queries, merge top-K"| LB["🏆 leaderboard top-50"]
```

## Scoring write order (Upgrade #1 — no race)

```mermaid
sequenceDiagram
  participant C as Client
  participant API as /api/answer/submit
  participant D as DynamoDB
  C->>API: answer (qNum, option, responseMs)
  API->>D: getQuestion(qNum)  %% server-authoritative grading
  API->>D: PutItem ANS#... (attribute_not_exists → idempotent)
  API->>D: 1) UpdateItem ADD score :p  (ReturnValues ALL_NEW)
  D-->>API: true cumulative total
  API->>D: 2) SET GSI keys = scoreKey(total)\nguard: scoreSeen <= total
  Note over API,D: condition-fail = a higher concurrent score already won → safe to drop
  API-->>C: { isCorrect, points, totalScore }
```

## Single-table layout

| Entity | PK | SK | GSI1PK / GSI1SK | GSI2PK / GSI2SK |
|---|---|---|---|---|
| Room | `ROOM#<id>` | `META` | — | — |
| Question | `ROOM#<id>` | `Q#<nnn>` | — | — |
| Player | `ROOM#<id>` | `PLAYER#<pid>` | `SHARD#<id>#<n>` / `SCORE#<padded>` | `SEASON#<s>` / `SCORE#<padded>` |
| Answer | `ROOM#<id>` | `ANS#<pid>#<instance>` | — | — |
| WS conn | `ROOM#<id>` | `CONN#<connId>` | — | — |
| Profile | `PLAYER#<pid>` | `PROFILE` | — | — |
| History | `PLAYER#<pid>` | `ROOM#<id>` | — | — |

See [`lib/keys.ts`](../lib/keys.ts) for the authoritative key construction.
