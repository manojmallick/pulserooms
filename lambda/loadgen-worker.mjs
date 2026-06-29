// ─────────────────────────────────────────────────────────────
// In-region load-generator worker (Lambda).
//
// Runs INSIDE AWS (same region as the table), so each write pays ~1-3ms to
// DynamoDB instead of the ~250ms a laptop pays over the internet. That removes
// the network-RTT ceiling and lets a handful of these workers push well past a
// single partition's ~1,000 WCU limit — which is what actually reproduces the
// hot-partition throttling the sharding fix removes.
//
// CRITICAL: maxAttempts=1. The SDK's default retry policy silently retries
// throttled writes with backoff, which both HIDES the throttle and inflates
// latency. With retries off, a throttle surfaces immediately as
// ProvisionedThroughputExceededException and we can count it.
//
// Invoked by scripts/loadgen.mjs with:
//   { mode, room, startN, count, concurrency, shards }
// Returns a compact latency histogram (merged by the orchestrator for exact
// global percentiles) plus throttle/error counts.
// ─────────────────────────────────────────────────────────────
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'

// region comes from the Lambda's own AWS_REGION; no retries so throttles show.
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 1 }))

const BUCKET_MS = 2
const BUCKETS = 2500 // 0–5000ms

// Spread the BASE-table writes across many partitions so the base item is never
// the bottleneck. This ISOLATES the leaderboard GSI partition as the only
// variable that differs between single and sharded mode — so the throttling we
// measure is attributable to the GSI design, not the base table.
const BASE_BUCKETS = 200

function shardIndex(playerId, shards) {
  let h = 0
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) >>> 0
  return h % shards
}
const pad8 = (n) => `SCORE#${Math.floor(n).toString().padStart(8, '0')}`
const THROTTLE = new Set([
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function handler(event) {
  const {
    mode = 'sharded',
    room = `load-${mode}`,
    startN = 0,
    count = 1000,
    concurrency = 50,
    shards = 10,
    table = TABLE,
    ratePerWorker = 0, // writes/sec to OFFER; 0 = blast as fast as possible
  } = event

  const hist = new Array(BUCKETS).fill(0)
  const errors = {}
  let ok = 0
  let throttles = 0
  let max = 0

  const record = (ms) => {
    if (ms > max) max = ms
    hist[Math.min(BUCKETS - 1, Math.floor(ms / BUCKET_MS))]++
  }

  // One write; records its own latency/outcome. Returns a promise.
  function oneWrite(n) {
    const playerId = `lp_${n}`
    const basePK = `LOAD#${room}#${n % BASE_BUCKETS}` // base spread → not the bottleneck
    const gsi1pk = mode === 'single' ? `HOT#${room}` : `SHARD#${room}#${shardIndex(playerId, shards)}`
    const points = 1000 + (n % 500)
    const t0 = performance.now()
    return doc
      .send(
        new UpdateCommand({
          TableName: table,
          Key: { PK: basePK, SK: `P#${n}` },
          UpdateExpression: 'ADD score :p SET GSI1PK = :g1, GSI1SK = :sk, username = :u',
          ExpressionAttributeValues: { ':p': points, ':g1': gsi1pk, ':sk': pad8(points), ':u': playerId },
        }),
      )
      .then(() => {
        ok++
        record(performance.now() - t0)
      })
      .catch((err) => {
        const name = err?.name ?? 'Error'
        errors[name] = (errors[name] ?? 0) + 1
        if (THROTTLE.has(name)) throttles++
        record(performance.now() - t0)
      })
  }

  const t0 = performance.now()
  const end = startN + count

  if (ratePerWorker > 0) {
    // PACED: dispatch at a steady offered rate (fire-and-track), independent of
    // how fast each write completes. This holds offered load constant so the
    // single-partition cap throttles deterministically.
    const interval = 1000 / ratePerWorker
    const inflight = []
    let i = 0
    while (startN + i < end) {
      const target = t0 + i * interval
      const wait = target - performance.now()
      if (wait > 1) await sleep(wait)
      inflight.push(oneWrite(startN + i))
      i++
    }
    await Promise.all(inflight)
  } else {
    // BLAST: fixed concurrency pool, each pulling the next index.
    let next = startN
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (next < end) await oneWrite(next++)
      }),
    )
  }

  const wallMs = performance.now() - t0
  return { count, ok, throttles, errors, max, wallMs, bucketMs: BUCKET_MS, hist }
}
