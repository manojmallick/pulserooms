// ─────────────────────────────────────────────────────────────
// Load test — PROOF that write-sharding fixes the hot partition.
//
// Fires thousands of concurrent "answer" score-writes at one room and reports
// latency percentiles + throttle counts. Run it twice and compare:
//
//   pnpm loadtest -- --mode=single  --writes=8000 --concurrency=300
//   pnpm loadtest -- --mode=sharded --writes=8000 --concurrency=300
//
//   --mode=single   CONTROL: every write hits GSI1PK=ROOM#<id> → ONE partition
//                   absorbs the whole firehose. Expect ProvisionedThroughput /
//                   throttling and a fat p99 as load climbs.
//   --mode=sharded  FIX: writes scatter across LEADERBOARD_SHARDS partitions
//                   (lib/keys.shardIndex). Expect flat latency, no throttling.
//
// Pair the two runs with a CloudWatch screenshot of WriteThrottleEvents on the
// table/GSI — that side-by-side is the Track 3 money shot.
//
// NOTE: writes go to a disposable room id (load-<mode>) so they never pollute a
// real game. Clean up by deleting those items or just leave them (PAY_PER_REQUEST).
// ─────────────────────────────────────────────────────────────
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE, REGION } from './aws.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const MODE = args.mode === 'single' ? 'single' : 'sharded'
const WRITES = Number(args.writes ?? 5000)
const CONCURRENCY = Number(args.concurrency ?? 200)
const SHARDS = Math.max(1, Number(process.env.LEADERBOARD_SHARDS || 10))
const ROOM = String(args.room ?? `load-${MODE}`)

const doc = docClient()
const pad8 = (n) => `SCORE#${Math.floor(n).toString().padStart(8, '0')}`

function shardIndex(playerId) {
  let h = 0
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) >>> 0
  return h % SHARDS
}

// One synthetic answer write: atomic ADD + set GSI sort keys.
async function oneWrite(n) {
  const playerId = `lp_${n}`
  const gsi1pk =
    MODE === 'single' ? `ROOM#${ROOM}` : `SHARD#${ROOM}#${shardIndex(playerId)}`
  const points = 1000 + (n % 500)
  const t0 = performance.now()
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ROOM#${ROOM}`, SK: `PLAYER#${playerId}` },
        UpdateExpression: 'ADD score :p SET GSI1PK = :g1, GSI1SK = :sk, username = :u',
        ExpressionAttributeValues: {
          ':p': points,
          ':g1': gsi1pk,
          ':sk': pad8(points),
          ':u': playerId,
        },
      }),
    )
    return { ms: performance.now() - t0, ok: true }
  } catch (err) {
    return { ms: performance.now() - t0, ok: false, name: err?.name ?? 'Error' }
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

async function main() {
  console.log(
    `[loadtest] mode=${MODE} writes=${WRITES} concurrency=${CONCURRENCY} ` +
      `shards=${MODE === 'sharded' ? SHARDS : 1} room=${ROOM} region=${REGION} table=${TABLE}`,
  )
  if (MODE === 'single')
    console.log('[loadtest] CONTROL — all writes target ONE GSI partition (expect throttling).')

  const latencies = []
  const errors = {}
  let done = 0
  let next = 0
  const wall0 = performance.now()

  // Fixed-size worker pool of size CONCURRENCY.
  async function worker() {
    while (next < WRITES) {
      const n = next++
      const r = await oneWrite(n)
      latencies.push(r.ms)
      if (!r.ok) errors[r.name] = (errors[r.name] ?? 0) + 1
      if (++done % 1000 === 0) process.stdout.write(`  …${done}/${WRITES}\r`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const wallMs = performance.now() - wall0
  latencies.sort((a, b) => a - b)
  const throttles =
    (errors.ProvisionedThroughputExceededException ?? 0) +
    (errors.ThrottlingException ?? 0) +
    (errors.RequestLimitExceeded ?? 0)

  console.log('\n────────────────────────────────────────')
  console.log(`mode             ${MODE}`)
  console.log(`writes           ${WRITES}`)
  console.log(`wall clock       ${(wallMs / 1000).toFixed(2)}s`)
  console.log(`throughput       ${Math.round(WRITES / (wallMs / 1000))} writes/s`)
  console.log(`latency p50      ${pct(latencies, 50).toFixed(1)} ms`)
  console.log(`latency p90      ${pct(latencies, 90).toFixed(1)} ms`)
  console.log(`latency p99      ${pct(latencies, 99).toFixed(1)} ms`)
  console.log(`latency max      ${pct(latencies, 100).toFixed(1)} ms`)
  console.log(`THROTTLES        ${throttles}`)
  console.log(`other errors     ${JSON.stringify(errors)}`)
  console.log('────────────────────────────────────────')
  if (MODE === 'sharded' && throttles === 0)
    console.log('✓ Sharded design absorbed the firehose with zero throttling.')
  if (MODE === 'single' && throttles > 0)
    console.log('✓ Control reproduced the hot-partition throttling the sharding fix removes.')
}

main().catch((err) => {
  console.error('[loadtest] FAILED:', err)
  process.exit(1)
})
