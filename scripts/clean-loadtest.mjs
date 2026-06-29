// Purge throwaway load-test items (the load-single / load-sharded rooms).
//
//   pnpm ddb:clean
//
// Queries each load room's partition and batch-deletes everything. Real game
// rooms (live-1, etc.) are untouched.
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './aws.mjs'

const doc = docClient()
const ROOMS = ['load-single', 'load-sharded']
const BASE_BUCKETS = 200 // must match lambda/loadgen-worker.mjs

// Every partition the load tests may have written on the main table:
//  - ROOM#load-*           (the laptop scripts/loadtest.mjs runs)
//  - LOAD#load-*#<bucket>  (the in-region loadgen isolated-base runs)
function loadPartitions() {
  const pks = []
  for (const r of ROOMS) {
    pks.push(`ROOM#${r}`)
    for (let b = 0; b < BASE_BUCKETS; b++) pks.push(`LOAD#${r}#${b}`)
  }
  return pks
}

async function purge(pk) {
  let removed = 0
  let ExclusiveStartKey
  do {
    const page = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey,
      }),
    )
    const items = page.Items ?? []
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25).map((it) => ({ DeleteRequest: { Key: { PK: it.PK, SK: it.SK } } }))
      if (batch.length) await doc.send(new BatchWriteCommand({ RequestItems: { [TABLE]: batch } }))
      removed += batch.length
    }
    ExclusiveStartKey = page.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return removed
}

async function main() {
  let total = 0
  for (const pk of loadPartitions()) total += await purge(pk)
  console.log(`[clean] ✓ removed ${total} throwaway load-test items from ${TABLE}`)
}

main().catch((err) => {
  console.error('[clean] FAILED:', err)
  process.exit(1)
})
