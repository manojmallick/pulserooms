// ─────────────────────────────────────────────────────────────
// Enable Amazon DynamoDB Global Tables (active-active multi-region) — the
// capability Track 3 explicitly rewards.
//
//   pnpm gt:status                 # show current replicas
//   pnpm gt:enable                 # add eu-west-1 + ap-northeast-1 replicas
//   pnpm gt:enable -- us-west-2     # add a specific region
//   pnpm gt:disable -- eu-west-1    # remove a replica
//
// Requires the table to have Streams enabled (it does). Replica creation takes
// several minutes; the table stays ACTIVE and serving in the primary region the
// whole time. Replicas bill storage + replicated writes in each region (tiny for
// this dataset, but real — remove with gt:disable when done).
// ─────────────────────────────────────────────────────────────
import {
  UpdateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb'
import { ddbClient, TABLE, REGION } from './aws.mjs'

const client = ddbClient()
const argv = process.argv.slice(2)
const mode = argv.includes('--disable') ? 'disable' : argv.includes('--status') ? 'status' : 'enable'
const regionsArg = argv.filter((a) => /^[a-z]{2}-[a-z]+-\d$/.test(a))
const DEFAULT_REPLICAS = ['eu-west-1', 'ap-northeast-1']

async function describe() {
  const { Table } = await client.send(new DescribeTableCommand({ TableName: TABLE }))
  return Table
}

async function main() {
  const T = await describe()
  const current = (T.Replicas ?? []).map((r) => r.RegionName)
  console.log(`[gt] table ${TABLE} · primary ${REGION} · replicas: ${current.length ? current.join(', ') : '(none)'}`)

  if (mode === 'status') return

  if (!T.StreamSpecification?.StreamEnabled) {
    console.error('[gt] Streams must be enabled first (pnpm ddb:provision sets this).')
    process.exit(1)
  }

  const targets = regionsArg.length ? regionsArg : DEFAULT_REPLICAS
  const updates =
    mode === 'enable'
      ? targets.filter((r) => !current.includes(r)).map((RegionName) => ({ Create: { RegionName } }))
      : targets.filter((r) => current.includes(r)).map((RegionName) => ({ Delete: { RegionName } }))

  if (!updates.length) {
    console.log(`[gt] nothing to do (${mode}) for: ${targets.join(', ')}`)
    return
  }

  // DynamoDB allows one replica change per UpdateTable call.
  for (const u of updates) {
    const region = u.Create?.RegionName ?? u.Delete?.RegionName
    console.log(`[gt] ${mode === 'enable' ? 'creating' : 'deleting'} replica ${region}…`)
    await client.send(new UpdateTableCommand({ TableName: TABLE, ReplicaUpdates: [u] }))
    // Wait for the table to leave UPDATING before the next change.
    for (;;) {
      await new Promise((r) => setTimeout(r, 8000))
      const t = await describe()
      const replicaState = (t.Replicas ?? []).find((r) => r.RegionName === region)?.ReplicaStatus
      process.stdout.write(`   ${region}: ${replicaState ?? (mode === 'disable' ? 'removing' : 'creating')}\r`)
      if (t.TableStatus === 'ACTIVE' && (mode === 'disable' ? !replicaState : replicaState === 'ACTIVE')) break
    }
    console.log(`\n[gt] ✓ ${region} ${mode === 'enable' ? 'ACTIVE' : 'removed'}`)
  }

  const after = await describe()
  console.log(`[gt] done. regions now: ${REGION}, ${(after.Replicas ?? []).map((r) => r.RegionName).join(', ') || '(none)'}`)
}

main().catch((err) => {
  console.error('[gt] FAILED:', err.name, '-', err.message)
  process.exit(1)
})
