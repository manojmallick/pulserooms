// ─────────────────────────────────────────────────────────────
// Room operations over the single table (access patterns 1-4, 8-9).
// ─────────────────────────────────────────────────────────────
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './dynamo'
import {
  roomPK,
  roomMetaSK,
  questionSK,
  playerSK,
  playerPK,
  profileSK,
  historySK,
} from './keys'

export type RoomStatus = 'scheduled' | 'live' | 'ended'

export interface Room {
  roomId: string
  status: RoomStatus
  title: string
  startTime: number // epoch ms
  questionCount: number
}

export interface Question {
  qNum: number
  text: string
  options: string[]
  /** correctAnswer is intentionally NOT sent to clients (see currentQuestion). */
  correctAnswer: number
  timeLimitMs: number
}

// AP#1 — Get room metadata.
export async function getRoom(roomId: string): Promise<Room | null> {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { PK: roomPK(roomId), SK: roomMetaSK() } }),
  )
  if (!res.Item) return null
  const it = res.Item
  return {
    roomId,
    status: it.status,
    title: it.title,
    startTime: it.startTime,
    questionCount: it.questionCount,
  }
}

// AP#2 — Get all questions for a room (SK begins_with Q#), ordered.
export async function getQuestions(roomId: string): Promise<Question[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :q)',
      ExpressionAttributeValues: { ':pk': roomPK(roomId), ':q': 'Q#' },
    }),
  )
  return (res.Items ?? []).map((it) => ({
    qNum: it.qNum,
    text: it.text,
    options: it.options,
    correctAnswer: it.correctAnswer,
    timeLimitMs: it.timeLimitMs,
  }))
}

/**
 * Server-authoritative "current question" for a live room, derived from the
 * elapsed time since startTime (every client sees the same question at the same
 * moment — questions broadcast simultaneously). correctAnswer is stripped so
 * clients can't cheat; grading happens server-side in /api/answer/submit.
 *
 * EVERGREEN: the round loops forever while status==='live'. `index` is a
 * monotonically increasing *instance* id (cycle * N + position) so each loop is
 * a distinct, independently-scoreable question (the answer SK keys on it, so a
 * returning player can answer again next cycle). `qNum` is the real 0..N-1
 * position used for grading. This keeps the public demo link always playable.
 */
export async function currentQuestion(room: Room, questions: Question[], now: number) {
  const empty = { index: -1, qNum: -1, question: null as null, endsAt: 0 }
  if (room.status !== 'live' || questions.length === 0) return empty
  if (now < room.startTime) return empty // pre-start standby (client shows countdown)

  const roundMs = questions.reduce((s, q) => s + q.timeLimitMs, 0)
  const elapsed = now - room.startTime
  const cycle = Math.floor(elapsed / roundMs)
  let within = elapsed % roundMs

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (within < q.timeLimitMs) {
      const { correctAnswer, ...safe } = q
      return {
        index: cycle * questions.length + i, // unique per cycle → fresh & scoreable
        qNum: i, // real position, for server-side grading
        question: { ...safe, qNum: i },
        endsAt: now + (q.timeLimitMs - within),
      }
    }
    within -= q.timeLimitMs
  }
  return empty // unreachable while within < roundMs
}

// AP#3 — Player joins a room. Idempotent (re-join keeps existing score).
export async function joinRoom(roomId: string, playerId: string, username: string) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: roomPK(roomId),
        SK: playerSK(playerId),
        username,
        score: 0,
        joinedAt: Date.now(),
      },
      // Don't clobber an existing player+score on re-join.
      ConditionExpression: 'attribute_not_exists(SK)',
    }),
  ).catch((err: { name?: string }) => {
    if (err?.name !== 'ConditionalCheckFailedException') throw err
  })
}

// AP#8 — Player profile + streak.
export async function getProfile(playerId: string) {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { PK: playerPK(playerId), SK: profileSK() } }),
  )
  return res.Item ?? null
}

// AP#9 — Player game history (SK begins_with ROOM#).
export async function getHistory(playerId: string) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :r)',
      ExpressionAttributeValues: { ':pk': playerPK(playerId), ':r': 'ROOM#' },
      ScanIndexForward: false,
    }),
  )
  return res.Items ?? []
}

// Helper for grading: fetch one question with its correctAnswer (server-only).
export async function getQuestion(roomId: string, qNum: number): Promise<Question | null> {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { PK: roomPK(roomId), SK: questionSK(qNum) } }),
  )
  if (!res.Item) return null
  const it = res.Item
  return {
    qNum: it.qNum,
    text: it.text,
    options: it.options,
    correctAnswer: it.correctAnswer,
    timeLimitMs: it.timeLimitMs,
  }
}

/**
 * Maintain the cross-room player profile (AP#8) and per-room history (AP#9).
 * Called on each answer. Two single-partition counters keyed by PLAYER#<id>:
 *   • PROFILE  — cumulative totalScore across all rooms + current correct streak
 *   • ROOM#<id> — this room's score + playedAt (one row ⇒ "games played" = row count)
 * Both ADD points (idempotency is enforced upstream at the answer write), so they
 * stay consistent with the room leaderboard counter. Low write rate per player,
 * so these partitions never hot-spot.
 */
export async function recordPlay(
  roomId: string,
  playerId: string,
  username: string,
  points: number,
  isCorrect: boolean,
) {
  const now = Date.now()

  // Profile aggregate. `streak` = consecutive correct answers: a correct answer
  // increments it, a wrong one resets to 0. ADD and SET can't target the same
  // attribute in one expression, so the two cases use different expressions.
  const profileUpdate = isCorrect
    ? {
        UpdateExpression: 'ADD totalScore :p, streak :one SET username = :u, lastPlayedAt = :t',
        ExpressionAttributeValues: { ':p': points, ':one': 1, ':u': username, ':t': now },
      }
    : {
        UpdateExpression: 'SET username = :u, lastPlayedAt = :t, streak = :z ADD totalScore :p',
        ExpressionAttributeValues: { ':p': points, ':z': 0, ':u': username, ':t': now },
      }

  await Promise.all([
    docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: playerPK(playerId), SK: profileSK() },
        ...profileUpdate,
      }),
    ),
    docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: playerPK(playerId), SK: historySK(roomId) },
        UpdateExpression: 'ADD score :p SET username = :u, playedAt = :t',
        ExpressionAttributeValues: { ':p': points, ':u': username, ':t': now },
      }),
    ),
  ])
}

// Used by joinRoom callers that also want a profile history row written.
export { historySK }
