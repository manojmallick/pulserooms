// ─────────────────────────────────────────────────────────────
// API Gateway WebSocket connection handler ($connect / $disconnect / subscribe).
//
// Routes (configure on the WebSocket API):
//   $connect    — accepts the socket. roomId passed as a query string param.
//   subscribe   — { action: "subscribe", roomId } stores the connection under
//                 the room so the aggregator can find it. (Also handled at
//                 $connect when roomId is present in the query string.)
//   $disconnect — removes the connection record.
//
// Connection item: PK=ROOM#<roomId> SK=CONN#<connectionId>, with a TTL so
// abandoned sockets self-expire even if $disconnect is missed.
// ─────────────────────────────────────────────────────────────
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'
const REGION = process.env.AWS_REGION || 'us-east-1'
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))

const ok = (body = 'ok') => ({ statusCode: 200, body })

async function store(connectionId, roomId) {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ROOM#${roomId}`,
        SK: `CONN#${connectionId}`,
        connectedAt: Date.now(),
        // 4h TTL safety net (enable TTL on attribute `ttl` in the table config).
        ttl: Math.floor(Date.now() / 1000) + 4 * 3600,
      },
    }),
  )
}

export async function handler(event) {
  const { routeKey, connectionId } = event.requestContext
  const roomId =
    event.queryStringParameters?.roomId ||
    (() => {
      try {
        return JSON.parse(event.body || '{}').roomId
      } catch {
        return undefined
      }
    })()

  if (routeKey === '$connect') {
    if (roomId) await store(connectionId, roomId)
    return ok()
  }

  if (routeKey === 'subscribe') {
    if (!roomId) return { statusCode: 400, body: 'roomId required' }
    await store(connectionId, roomId)
    return ok('subscribed')
  }

  if (routeKey === '$disconnect') {
    // We don't always know the room at disconnect; the aggregator also reaps
    // 410 Gone connections. If roomId is known, delete precisely.
    if (roomId) {
      await doc
        .send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { PK: `ROOM#${roomId}`, SK: `CONN#${connectionId}` },
          }),
        )
        .catch(() => {})
    }
    return ok()
  }

  return ok()
}
