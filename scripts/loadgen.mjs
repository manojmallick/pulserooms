// ─────────────────────────────────────────────────────────────
// In-region load-test orchestrator (the money-shot proof).
//
//   pnpm loadgen -- --mode=both   --writes=40000 --workers=20 --concurrency=50
//   pnpm loadgen -- --mode=single --writes=40000 --workers=20 --concurrency=50
//   pnpm loadgen -- --mode=sharded …
//
// Fans out `workers` parallel invocations of the pulserooms-loadgen Lambda
// (each running in-region with retries OFF), merges their latency histograms
// for EXACT global percentiles, and reports throttles. `--mode=both` runs the
// single-partition control and the sharded fix back-to-back and prints the
// side-by-side — pair it with a CloudWatch WriteThrottleEvents screenshot.
//
// The local→Lambda RTT is paid once per worker (each worker then does thousands
// of in-region writes), so it does not pollute the measured write latency.
// ─────────────────────────────────────────────────────────────
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const REGION = process.env.AWS_REGION || 'us-east-1'
const FN = process.env.LOADGEN_FN || 'pulserooms-loadgen'
const SHARDS = Math.max(1, Number(process.env.LEADERBOARD_SHARDS || 10))

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const MODE = args.mode === 'single' || args.mode === 'sharded' ? args.mode : 'both'
const WRITES = Number(args.writes ?? 40000)
const WORKERS = Number(args.workers ?? 20)
const CONCURRENCY = Number(args.concurrency ?? 50)
// Cap simultaneous Lambda INVOKES (new accounts have low concurrency limits).
// Each worker is high-throughput, so a small pool still saturates a partition.
const INVOKE_POOL = Number(args.invokePool ?? 8)
// Target table (use the provisioned PulseRoomsLoad for the deterministic proof).
const LOAD_TABLE = args.table ?? process.env.LOADTEST_TABLE ?? process.env.PULSEROOMS_TABLE ?? 'PulseRooms'
// Total OFFERED writes/sec across all workers (0 = blast). Paced load makes the
// per-partition throttle deterministic. Split evenly across the active workers.
const RATE = Number(args.rate ?? 0)

// Generous request timeout: a sync Invoke blocks until the worker returns.
const lambda = new LambdaClient({
  region: REGION,
  requestHandler: { requestTimeout: 310_000, connectionTimeout: 10_000 },
})

function pctFromHist(hist, bucketMs, total, p) {
  const target = (p / 100) * total
  let cum = 0
  for (let i = 0; i < hist.length; i++) {
    cum += hist[i]
    if (cum >= target) return i * bucketMs
  }
  return hist.length * bucketMs
}

async function runMode(mode) {
  const room = `load-${mode}`
  const per = Math.ceil(WRITES / WORKERS)
  console.log(
    `\n[loadgen] mode=${mode} writes=${WRITES} workers=${WORKERS} concurrency/worker=${CONCURRENCY} ` +
      `invokePool=${INVOKE_POOL} shards=${mode === 'sharded' ? SHARDS : 1} table=${LOAD_TABLE} ` +
      `rate=${RATE || 'blast'} fn=${FN}`,
  )
  if (mode === 'single') console.log('[loadgen] CONTROL — all writes target ONE partition.')

  const ratePerWorker = RATE > 0 ? RATE / WORKERS : 0
  async function invokeWorker(w) {
    const payload = Buffer.from(
      JSON.stringify({
        mode,
        room,
        startN: w * per,
        count: per,
        concurrency: CONCURRENCY,
        shards: SHARDS,
        table: LOAD_TABLE,
        ratePerWorker,
      }),
    )
    // Retry the INVOKE (not the writes) on Lambda-side rate limits.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await lambda.send(new InvokeCommand({ FunctionName: FN, Payload: payload }))
        const txt = Buffer.from(res.Payload).toString()
        if (res.FunctionError) throw new Error(`worker ${w} ${res.FunctionError}: ${txt.slice(0, 300)}`)
        return JSON.parse(txt)
      } catch (err) {
        const rate = err.name === 'TooManyRequestsException' || /rate exceeded/i.test(err.message || '')
        if (rate && attempt < 8) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
          continue
        }
        throw err
      }
    }
  }

  // Bounded pool of concurrent invokes.
  const wall0 = performance.now()
  const results = new Array(WORKERS)
  let nextW = 0
  await Promise.all(
    Array.from({ length: Math.min(INVOKE_POOL, WORKERS) }, async () => {
      while (nextW < WORKERS) {
        const w = nextW++
        results[w] = await invokeWorker(w)
      }
    }),
  )
  const wallMs = performance.now() - wall0

  // Merge.
  const bucketMs = results[0]?.bucketMs ?? 2
  const len = results[0]?.hist?.length ?? 0
  const hist = new Array(len).fill(0)
  let ok = 0
  let throttles = 0
  let max = 0
  const errors = {}
  for (const r of results) {
    ok += r.ok
    throttles += r.throttles
    max = Math.max(max, r.max)
    r.hist.forEach((c, i) => (hist[i] += c))
    for (const [k, v] of Object.entries(r.errors)) errors[k] = (errors[k] ?? 0) + v
  }
  const total = hist.reduce((a, b) => a + b, 0)

  const summary = {
    mode,
    writes: WRITES,
    ok,
    throttles,
    errors,
    wallS: wallMs / 1000,
    throughput: Math.round(WRITES / (wallMs / 1000)),
    p50: pctFromHist(hist, bucketMs, total, 50),
    p90: pctFromHist(hist, bucketMs, total, 90),
    p99: pctFromHist(hist, bucketMs, total, 99),
    max: Math.round(max),
  }

  console.log('────────────────────────────────────────')
  console.log(`mode             ${summary.mode}`)
  console.log(`wall clock       ${summary.wallS.toFixed(2)}s`)
  console.log(`throughput       ${summary.throughput} writes/s (in-region)`)
  console.log(`latency p50      ${summary.p50} ms`)
  console.log(`latency p90      ${summary.p90} ms`)
  console.log(`latency p99      ${summary.p99} ms`)
  console.log(`latency max      ${summary.max} ms`)
  console.log(`THROTTLES        ${summary.throttles}`)
  console.log(`other errors     ${JSON.stringify(errors)}`)
  console.log('────────────────────────────────────────')
  return summary
}

async function main() {
  const modes = MODE === 'both' ? ['single', 'sharded'] : [MODE]
  const out = []
  for (const m of modes) out.push(await runMode(m))

  if (out.length === 2) {
    const [s, h] = out
    console.log('\n══════════ SIDE BY SIDE ══════════')
    console.log('metric         single(control)   sharded(fix)')
    console.log(`throughput/s   ${String(s.throughput).padEnd(17)} ${h.throughput}`)
    console.log(`p50 ms         ${String(s.p50).padEnd(17)} ${h.p50}`)
    console.log(`p99 ms         ${String(s.p99).padEnd(17)} ${h.p99}`)
    console.log(`max ms         ${String(s.max).padEnd(17)} ${h.max}`)
    console.log(`THROTTLES      ${String(s.throttles).padEnd(17)} ${h.throttles}`)
    console.log('══════════════════════════════════')
    if (s.throttles > 0 && h.throttles === 0)
      console.log('✓ PROOF: the single partition throttles; sharding eliminates it.')
    else if (s.throttles === 0)
      console.log(
        'ℹ No throttling on the control yet — raise --workers/--concurrency/--writes to push past ~1k WCU on the hot partition.',
      )
  }
}

main().catch((err) => {
  console.error('[loadgen] FAILED:', err.message)
  process.exit(1)
})
