// ─────────────────────────────────────────────────────────────
// Provision the PulseRooms single table + GSIs + Streams.
//
//   pnpm ddb:provision              # create if absent (no-op if exists)
//   pnpm ddb:provision --recreate   # delete + recreate (DESTROYS data)
//
// On-demand (PAY_PER_REQUEST) billing so the table scales writes automatically
// — the right mode for a bursty live-trivia workload. Streams enabled with
// NEW_AND_OLD_IMAGES to drive the leaderboard-aggregator Lambda (Upgrade #3).
//
// For the multi-region "Global Tables" story, after this table exists run:
//   aws dynamodb update-table --table-name PulseRooms \
//     --replica-updates '[{"Create":{"RegionName":"eu-west-1"}}, …]'
// (Global Tables require an already-provisioned table with Streams on — which
// this script gives you.)
// ─────────────────────────────────────────────────────────────
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  waitUntilTableNotExists,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { ddbClient, TABLE, REGION } from './aws.mjs'

const client = ddbClient()
const recreate = process.argv.includes('--recreate')

async function exists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE }))
    return true
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false
    throw err
  }
}

const tableDef = {
  TableName: TABLE,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      // GSI1 — per-room leaderboard, WRITE-SHARDED. GSI1PK = SHARD#<room>#<n>
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      // Projection KEYS_ONLY would force a second read for username; we want the
      // leaderboard renderable from the index alone, so project the display attrs.
      Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['username', 'score'] },
    },
    {
      // GSI2 — global seasonal leaderboard. GSI2PK = SEASON#<id>
      IndexName: 'GSI2',
      KeySchema: [
        { AttributeName: 'GSI2PK', KeyType: 'HASH' },
        { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['username', 'score'] },
    },
  ],
  StreamSpecification: { StreamEnabled: true, StreamViewType: 'NEW_AND_OLD_IMAGES' },
  Tags: [{ Key: 'app', Value: 'pulserooms' }],
}

async function main() {
  console.log(`[provision] region=${REGION} table=${TABLE}`)

  if (await exists()) {
    if (!recreate) {
      console.log('[provision] table already exists — nothing to do. (use --recreate to rebuild)')
      return
    }
    console.log('[provision] --recreate: deleting existing table…')
    await client.send(new DeleteTableCommand({ TableName: TABLE }))
    await waitUntilTableNotExists({ client, maxWaitTime: 120 }, { TableName: TABLE })
    console.log('[provision] old table deleted.')
  }

  console.log('[provision] creating table + GSI1 (sharded leaderboard) + GSI2 (season) + Streams…')
  await client.send(new CreateTableCommand(tableDef))
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: TABLE })

  const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }))
  console.log('[provision] ✓ ACTIVE')
  console.log('  StreamArn:', desc.Table.LatestStreamArn)
  console.log('  GSIs:', desc.Table.GlobalSecondaryIndexes?.map((g) => g.IndexName).join(', '))
  console.log('\nNext: pnpm ddb:seed   (loads a demo room + questions)')
}

main().catch((err) => {
  console.error('[provision] FAILED:', err)
  process.exit(1)
})
