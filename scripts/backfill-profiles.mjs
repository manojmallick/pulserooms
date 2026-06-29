// Backfill AP#8 (PLAYER#/PROFILE) and AP#9 (PLAYER#/ROOM#) from existing
// per-room player items, so players who scored before profile/history writes
// existed still show real data.
//
//   pnpm ddb:backfill            # demo room (live-1)
//   pnpm ddb:backfill -- room2   # a specific room
//
// Idempotent: only creates a profile/history row if absent (won't clobber totals
// that subsequent gameplay has grown).
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './aws.mjs'
import { DEMO_ROOM_ID } from '../db/questions.mjs'

const ROOM = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? DEMO_ROOM_ID
const doc = docClient()

async function putIfAbsent(item) {
  try {
    await doc.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }))
    return true
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return false
    throw err
  }
}

async function main() {
  console.log(`[backfill] room ${ROOM} → PLAYER#/PROFILE + PLAYER#/ROOM# rows`)
  let made = 0
  let skipped = 0
  let ExclusiveStartKey
  do {
    const page = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :p)',
        ExpressionAttributeValues: { ':pk': `ROOM#${ROOM}`, ':p': 'PLAYER#' },
        ExclusiveStartKey,
      }),
    )
    for (const it of page.Items ?? []) {
      const playerId = it.SK.replace('PLAYER#', '')
      const username = it.username ?? 'anon'
      const score = it.score ?? 0
      const now = Date.now()
      const a = await putIfAbsent({ PK: `PLAYER#${playerId}`, SK: 'PROFILE', username, totalScore: score, lastPlayedAt: now })
      const b = await putIfAbsent({ PK: `PLAYER#${playerId}`, SK: `ROOM#${ROOM}`, username, score, finalRank: null, playedAt: now })
      if (a || b) made++
      else skipped++
    }
    ExclusiveStartKey = page.LastEvaluatedKey
  } while (ExclusiveStartKey)
  console.log(`[backfill] ✓ ${made} players backfilled, ${skipped} already had profiles`)
}

main().catch((err) => {
  console.error('[backfill] FAILED:', err)
  process.exit(1)
})
