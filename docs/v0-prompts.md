# v0 design prompts

The PulseRooms UI was scaffolded with [v0](https://v0.app) and then wired to the
DynamoDB backend. These are the prompts (refined to match what shipped), so the
front end is reproducible and the design intent is documented for the submission.

**Design system (use across every prompt):**
> High-energy, game-show aesthetic. Dark UI on a radial indigo→near-black
> gradient. Electric purple (`#7c3aed`) + cyan (`#22d3ee`) accents, with pink and
> amber highlights. Big tappable buttons, bold black display headings, animated
> score counters, subtle glow on primary CTAs. Mobile-first (people play on
> phones). Tailwind CSS, `lucide-react` icons, Inter font.

---

## 1. Initial scaffold

```
Build a Next.js (App Router) real-time trivia game called PulseRooms — HQ Trivia
meets Kahoot, built for global scale. Dark, high-energy game-show look: radial
indigo-to-black background, electric purple + cyan accents, bold black display
type, big tappable buttons, glow on the primary CTA. Mobile-first. Tailwind +
lucide-react + Inter.

Pages:
1. Landing — hero "One round. A million players." with a live-trivia kicker, a
   "Join {round name}" CTA + "View leaderboard"; three feature cards (DynamoDB
   single-table, write-sharded leaderboard, AWS-native realtime); and a "Why
   Amazon DynamoDB" section with four reason cards.
2. Game room — full-screen live question, 4 answer options as big gradient
   buttons, a circular countdown timer ring, your-score readout, and a live
   leaderboard sidebar. A name-entry gate before joining.
3. Leaderboard — global seasonal rankings: rank, username, score; medal colors
   for top 3; highlight "you".
4. Profile — total score, current streak (flame icon), games played, recent games.
5. Scale — a live "how it scales" dashboard: table facts (region, billing,
   streams, Global Tables replicas), the GSIs, and a horizontal bar chart of
   players-per-write-shard.
```

## 2. Game room — answer + timer interactions

```
On the game room: the 4 answer buttons are full-width gradient tiles (purple,
cyan, pink, amber). A circular SVG timer ring counts down and changes color
green→amber→red as time runs out. When the player taps an answer, lock all
buttons, then reveal: correct option flashes green with a check, a wrong pick
flashes red with an X, the rest dim. Show "+{points} points" in green on a
correct answer (faster = more points). Between questions show a standby/countdown
state; questions broadcast to everyone at the same moment.
```

## 3. Live leaderboard — smooth reordering

```
The live leaderboard sidebar updates in real time. Rows smoothly animate their
position when scores change — a player moving up slides up (CSS transform
transition, ~450ms ease). Show a "live"/"polling" status pill. Top 3 get medal
colors; the current player's row is highlighted with a "you" tag. New entries
rise-in with a subtle fade.
```

## 4. Scale dashboard — the architecture story

```
Build a "How PulseRooms scales" dashboard page. Top: four stat cards — Table +
region, Billing (On-demand), Streams (Enabled + view type), Global Tables (N
regions) — each with a check/alert indicator. Then a Global Secondary Indexes
card listing GSI1 (sharded room leaderboard) and GSI2 (seasonal) with their key
schema in mono. Then the hero element: a "Write-shard distribution" horizontal
bar chart, one bar per shard (0..9), bar width ∝ player count, count on the right
— visually proving writes spread evenly instead of hot-spotting one partition.
Finish with a load-test proof card: three metrics (single-partition p99, sharded
p99, throttles) colored red/green.
```

---

> Note: v0 generates the presentation layer. All data access, the DynamoDB
> single-table design, the write-sharding, scoring, and realtime are hand-built —
> see [`lib/`](../lib/) and [`docs/architecture.md`](architecture.md).
