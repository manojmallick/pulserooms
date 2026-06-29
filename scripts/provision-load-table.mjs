// ─────────────────────────────────────────────────────────────
// Dedicated PROVISIONED table for the deterministic hot-partition proof.
//
//   pnpm loadtable:up      # create PulseRoomsLoad (provisioned)
//   pnpm loadtable:down    # DELETE it (do this right after the test — it bills hourly)
//
// Why provisioned (not the on-demand prod table): the per-partition 1,000 WCU
// limit is a HARD cap independent of provisioned total. With a known capacity we
// can offer a paced ~3k writes/s and show:
//   • single GSI partition  → capped at 1,000 WCU → throttles ~2/3 of writes
//   • sharded across N parts → 300/s per partition → zero throttling
// On-demand can't show this cleanly because its table-level limit floats.
//
// Capacity is generous on the base table + GSI so the ONLY bottleneck is the
// single GSI partition in `single` mode. RCU is low (we only write here).
// ─────────────────────────────────────────────────────────────
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb'
import { ddbClient, REGION } from './aws.mjs'

const TABLE = process.env.LOADTEST_TABLE || 'PulseRoomsLoad'
const WCU = Number(process.env.LOADTEST_WCU || 4000)
const client = ddbClient()
const del = process.argv.includes('--delete')

async function exists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE }))
    return true
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false
    throw err
  }
}

async function main() {
  if (del) {
    if (!(await exists())) return console.log(`[loadtable] ${TABLE} not present — nothing to delete.`)
    console.log(`[loadtable] deleting ${TABLE}…`)
    await client.send(new DeleteTableCommand({ TableName: TABLE }))
    await waitUntilTableNotExists({ client, maxWaitTime: 180 }, { TableName: TABLE })
    console.log('[loadtable] ✓ deleted (billing stopped)')
    return
  }

  if (await exists()) return console.log(`[loadtable] ${TABLE} already exists (WCU target ${WCU}).`)

  console.log(`[loadtable] creating PROVISIONED ${TABLE} — base ${WCU} WCU, GSI1 ${WCU} WCU, region ${REGION}`)
  await client.send(
    new CreateTableCommand({
      TableName: TABLE,
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: { ReadCapacityUnits: 50, WriteCapacityUnits: WCU },
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['username', 'score'] },
          ProvisionedThroughput: { ReadCapacityUnits: 50, WriteCapacityUnits: WCU },
        },
      ],
      Tags: [{ Key: 'app', Value: 'pulserooms-loadtest' }],
    }),
  )
  await waitUntilTableExists({ client, maxWaitTime: 180 }, { TableName: TABLE })
  console.log(`[loadtable] ✓ ACTIVE. Run the proof, then: pnpm loadtable:down`)
  console.log(`[loadtable] ⚠ provisioned ${WCU * 2} WCU bills hourly — delete it when done.`)
}

main().catch((err) => {
  console.error('[loadtable] FAILED:', err)
  process.exit(1)
})
