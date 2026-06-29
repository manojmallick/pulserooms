// ─────────────────────────────────────────────────────────────
// DynamoDB Streams → leaderboard fanout Lambda (Upgrade #3).
//
// Trigger: PulseRooms table stream (NEW_AND_OLD_IMAGES), batched.
// Job: when player scores change, recompute each affected room's top-K
//      (scatter-gather over the write shards) and push it to every WebSocket
//      client subscribed to that room via the API Gateway @connections endpoint.
//
// This keeps the persistent connections on AWS (API Gateway WebSocket API) —
// NOT on Vercel, which can't host long-lived sockets. Vercel serves the app +
// REST; AWS owns realtime. Clean separation, fully on the sponsor stack.
//
// Why aggregate in a Lambda and not per-write: every answer is a write, but
// clients only need the *current top-K*. Debouncing fanout into the stream
// batch collapses thousands of score writes into a handful of broadcasts.
//
// Env: PULSEROOMS_TABLE, AWS_REGION, WS_API_ENDPOINT, LEADERBOARD_SHARDS
// ─────────────────────────────────────────────────────────────
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'
const REGION = process.env.AWS_REGION || 'us-east-1'
const SHARDS = Math.max(1, Number(process.env.LEADERBOARD_SHARDS || 10))
const WS_ENDPOINT = process.env.WS_API_ENDPOINT // e.g. https://abc.execute-api…/prod
const TOP_K = 50

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))
const mgmt = WS_ENDPOINT
  ? new ApiGatewayManagementApiClient({ region: REGION, endpoint: WS_ENDPOINT })
  : null

// Scatter-gather top-K for one room (mirrors lib/leaderboard.ts).
async function topK(roomId, k = TOP_K) {
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) =>
      doc.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :p',
          ExpressionAttributeValues: { ':p': `SHARD#${roomId}#${i}` },
          ScanIndexForward: false,
          Limit: k,
        }),
      ),
    ),
  )
  const best = new Map()
  for (const s of shards)
    for (const it of s.Items ?? []) {
      const id = (it.SK ?? it.PK ?? '').replace('PLAYER#', '')
      if (!best.has(id) || it.score > best.get(id).score) best.set(id, it)
    }
  return [...best.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, k)
    .map((it, i) => ({ rank: i + 1, username: it.username ?? 'anon', score: it.score ?? 0 }))
}

// Connections are stored under the room partition: PK=ROOM#<id> SK=CONN#<connId>.
async function connectionsForRoom(roomId) {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :c)',
      ExpressionAttributeValues: { ':pk': `ROOM#${roomId}`, ':c': 'CONN#' },
    }),
  )
  return (res.Items ?? []).map((it) => it.SK.replace('CONN#', ''))
}

async function broadcast(roomId, payload) {
  if (!mgmt) {
    console.log(`[fanout] WS_API_ENDPOINT unset — skipping push for room ${roomId}`)
    return
  }
  const connections = await connectionsForRoom(roomId)
  const data = Buffer.from(JSON.stringify(payload))
  await Promise.all(
    connections.map((connectionId) =>
      mgmt
        .send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }))
        .catch(async (err) => {
          // 410 Gone = stale connection; reap it.
          if (err?.$metadata?.httpStatusCode === 410) {
            await doc
              .send(
                new DeleteCommand({
                  TableName: TABLE,
                  Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` },
                }),
              )
              .catch(() => {})
          } else {
            console.error('[fanout] post failed', connectionId, err?.name)
          }
        }),
    ),
  )
}

export async function handler(event) {
  // Find which rooms had a player score change in this stream batch.
  const dirtyRooms = new Set()
  for (const rec of event.Records ?? []) {
    if (rec.eventName === 'REMOVE') continue
    const img = rec.dynamodb?.NewImage
    const pk = img?.PK?.S
    const sk = img?.SK?.S
    if (!pk?.startsWith('ROOM#') || !sk?.startsWith('PLAYER#')) continue
    const newScore = img?.score?.N
    const oldScore = rec.dynamodb?.OldImage?.score?.N
    if (newScore !== oldScore) dirtyRooms.add(pk.replace('ROOM#', ''))
  }

  await Promise.all(
    [...dirtyRooms].map(async (roomId) => {
      const entries = await topK(roomId)
      await broadcast(roomId, { type: 'leaderboard', roomId, entries, at: Date.now() })
    }),
  )

  return { batchItemFailures: [] } // report-batch-item-failures friendly
}
