# PulseRooms — Detailed v0 UI Spec

> A fuller, paste-ready version of [`v0-prompts.md`](v0-prompts.md). Use the **Design System**
> block once, then each **screen prompt** in order. The **Data Contract** at the bottom mirrors the
> real DynamoDB-backed API responses (`lib/` + `app/api/`), so v0's mock data lines up with what ships
> — keep components presentational (take props), never fetch inside them.

---

## DESIGN SYSTEM (paste first / keep selected the whole time)

```
Build a Next.js 15 (App Router) + TypeScript + Tailwind real-time trivia app called PulseRooms —
HQ Trivia meets Kahoot, engineered for global scale. Mobile-first (people play on phones).

MOOD: high-energy game show. Loud but premium, not childish.
BACKGROUND: radial gradient from deep indigo (#1e1b4b) to near-black (#0a0a12). Subtle grain.
ACCENTS: electric purple #7c3aed and cyan #22d3ee as the primary pair; pink #ec4899 and amber
  #f59e0b as the secondary answer/highlight colors. Success #22c55e, danger #ef4444.
TYPE: bold black display headings (e.g. "Inter/Geist" 800–900, tight tracking) for hero numbers and
  questions; Inter for body. Big, confident sizes.
COMPONENTS: big tappable buttons (min 56px tall), glow/box-shadow on the primary CTA, rounded-2xl
  cards with a 1px white/8% border on translucent panels (backdrop-blur), animated number counters.
ICONS: lucide-react. Motion: framer-motion-style transforms (CSS transitions are fine), ~300–450ms ease.
ACCESSIBILITY: visible focus rings, color is never the only signal (use icons + labels too).

Shared shell: a slim top bar (PulseRooms wordmark with a pulse/zap glyph; links Play, Leaderboard,
Profile, Scale) over the gradient. Everything responsive, thumb-reachable on mobile.
```

---

## SCREEN 1 — Landing (`/`)
```
Landing page. Hero: a kicker pill "LIVE TRIVIA • GLOBAL", a huge black display headline
"One round. A million players.", a one-line subhead about thousands answering the same question at
the same instant. Two CTAs: primary glowing "Join {round title}" and ghost "View leaderboard".
Under the hero, a live "next round" element: round title + a countdown timer (HH:MM:SS) to startTime,
and a small "{N} players warming up" counter.

Then THREE feature cards (icon + title + one line):
  • "DynamoDB single-table" — one table, every access pattern.
  • "Write-sharded leaderboard" — answers scatter across 10 partitions, no hot spot.
  • "AWS-native realtime" — API Gateway WebSockets + DynamoDB Streams fanout.

Then a "Why Amazon DynamoDB" section with FOUR reason cards: single-digit-ms latency, Global Tables
active-active, predictable access patterns, Streams-driven fanout. Footer with a #H0Hackathon tag.
```

## SCREEN 2 — Game Room (`/room/[roomId]`)
```
The live game room — the signature screen. Full-viewport, dark.

NAME GATE (before joining): a centered card "Enter a display name to join {round title}" with one
input + a big "Join round" button. After joining, show the live game.

LIVE QUESTION STATE:
  - Top: a circular SVG countdown ring around the question number ("Q3 / 10"); the ring sweeps and
    shifts color green → amber → red as time runs out (endsAt - serverNow).
  - Center: the question text in big bold type.
  - Four answer tiles, full-width on mobile / 2×2 on desktop, each a distinct gradient
    (purple, cyan, pink, amber) with the option label. Min 56px tall, tappable.
  - Right (desktop) / collapsible (mobile): a LIVE leaderboard sidebar (see Screen 3 behavior).
  - A "Your score" readout with an animated counter.

AFTER TAP (locked): disable all tiles; reveal — the correct tile flashes green with a check, a wrong
pick flashes red with an X, others dim to 40%. If correct, pop "+{points}" in green (faster = more).
If the player already answered this question, show a subtle "answer locked" state.

BETWEEN QUESTIONS: a standby card — "Next question in {n}…" countdown, "questions broadcast to
everyone at the same moment." When status is 'ended', show a final-rank summary card with a
"View full leaderboard" CTA.
```

## SCREEN 3 — Leaderboard (`/leaderboard`) + live sidebar behavior
```
Global/seasonal leaderboard: a ranked list of {rank, username, score}. Top 3 rows get medal
treatments (gold/silver/bronze accents + a medal glyph). The current player's row is highlighted with
a "you" tag and a left accent bar. Scores render with animated counters and tabular-nums.

LIVE BEHAVIOR (used both here and in the game-room sidebar): rows smoothly animate position changes —
when a score updates and a player moves up, their row slides up (transform transition ~450ms ease);
new entries fade-and-rise in. Show a small status pill: "live" (green dot) when polling is active.
Keep it readable at 50+ rows.
```

## SCREEN 4 — Profile (`/profile`)
```
Player profile. Header: avatar/initials, username, level. A row of stat cards: Total score (big
animated number), Current streak (flame icon + day count), Games played. Below: a "Recent games"
list — each row shows the round, final rank (with a medal for top 3), score, and a relative
"played {time} ago". Empty state: "No games yet — jump into a live round."
```

## SCREEN 5 — Scale dashboard (`/scale`) — the architecture story (judge-facing)
```
A "How PulseRooms scales" dashboard — this is what the NoSQL judge reads.

TOP: four stat cards, each with a check/alert indicator:
  • Table + region (name, AWS region)
  • Billing mode (On-demand / PAY_PER_REQUEST)
  • Streams (Enabled + stream view type, or "—")
  • Global Tables (N replica regions listed)

THEN: a "Global Secondary Indexes" card listing each GSI with its key schema in monospace
  — GSI1 (write-sharded room leaderboard), GSI2 (seasonal ranking).

HERO ELEMENT: a "Write-shard distribution" horizontal bar chart — one bar per shard (0..9), bar width
∝ that shard's player count, the count shown on the right. The point it must make visually: writes
spread evenly across shards instead of hot-spotting a single partition. Add a one-line caption stating
exactly that.

FINISH: a load-test proof card — three metrics colored red/green: single-partition p99 (red/high),
sharded p99 (green/low), throttled requests (green/zero).
```

---

## DATA CONTRACT — make v0 type its mocks with these (mirror the real API)

```typescript
// GET /api/room/current?roomId=… → { room, serverNow, questionCount, current }
export type RoomStatus = 'scheduled' | 'live' | 'ended';

export interface Room {
  roomId: string;
  status: RoomStatus;
  title: string;
  startTime: number;     // epoch ms
  questionCount: number;
}

// Client-safe question — correctAnswer is NEVER sent until after you answer.
export interface ClientQuestion {
  qNum: number;
  text: string;
  options: string[];     // 4 options
  timeLimitMs: number;
}

export interface CurrentRound {
  index: number;
  question: ClientQuestion | null;  // null between questions / before start
  endsAt: number | null;            // epoch ms; ring = endsAt - serverNow
}

// POST /api/answer/submit  { roomId, playerId, qNum, answer } → AnswerResult
export interface AnswerResult {
  isCorrect: boolean;
  points: number;        // 0 if wrong; 1000–1500 if correct (faster = more)
  totalScore: number;
  correctAnswer: number; // revealed only in the response, after answering
  alreadyAnswered?: true;
}

// GET /api/leaderboard?roomId=…  → LeaderboardEntry[]  (scatter-gather over shards)
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  score: number;
}

// GET /api/profile?playerId=… → { playerId, profile, history }
export interface PlayerProfile {
  username: string;
  totalScore: number;
  streak: number;
  level: number;
}
export interface GameHistoryEntry {
  roomId: string;
  score: number;
  finalRank: number | null;
  playedAt: number | null;
}

// GET /api/scale?roomId=… → ScaleStats
export interface ScaleStats {
  table: {
    name: string;
    region: string;
    billing: string;
    itemCount: number;
    streams: string | null;
    streamArn: string | null;
    gsis: { name: string; keys: string[] }[];
    replicas: string[];
  };
  shardCount: number;
  shards: { shard: number; count: number }[];  // the bar chart
  totalPlayers: number;
}
```

### Mock content that makes the demo feel real
- A `Room` with `status: 'live'`, a `CurrentRound` with a question + `endsAt` ~12s out (ring mid-sweep).
- A `LeaderboardEntry[]` of ~12 rows with one flagged as "you"; vary scores so reorder animation shows.
- A `ScaleStats.shards` array of 10 roughly-even counts (e.g. 980–1040 each) → the even-distribution bar.
- A `PlayerProfile` with `streak: 5` and 3–4 `history` rows incl. a top-3 finish.

---

## The three judge-facing UI moments (must land visually)
1. **Live leaderboard reorder** — smooth slide-up on score change = the realtime story.
2. **Scale dashboard shard chart** — even bars across 10 shards = the hot-partition fix made visible.
3. **Speed-scored answer reveal** — "+1500" on a fast correct answer = the scoring model felt, not told.

> v0 builds the presentation layer only. DynamoDB single-table design, write-sharding, scoring, and
> realtime are hand-built — see [`lib/`](../lib/) and [`docs/architecture.md`](architecture.md).
```
