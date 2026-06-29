// ─────────────────────────────────────────────────────────────
// POST /api/answer/submit  — the hot write path.
//
// Hardened vs the original spec in two ways:
//   1. Server-authoritative grading. The original trusted `correctAnswer` from
//      the request body — a client could forge it. Here we fetch the question
//      server-side and grade against the stored answer.
//   2. Correct atomic score flow (lib/scoring.applyScore — Upgrade #1).
//
// The answer record is written idempotently (one per player+question) so a
// double-tap or retry can't double-score.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from '@/lib/dynamo'
import { roomPK, answerSK } from '@/lib/keys'
import { calculatePoints, applyScore } from '@/lib/scoring'
import { getQuestion, recordPlay } from '@/lib/room'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: {
    roomId?: string
    playerId?: string
    username?: string
    qNum?: number
    instance?: number
    answer?: number
    responseMs?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { roomId, playerId, qNum, answer, responseMs } = body
  if (!roomId || !playerId || qNum == null || answer == null) {
    return NextResponse.json({ error: 'roomId, playerId, qNum, answer required' }, { status: 400 })
  }
  // Idempotency key: the question *instance* (cycle*N+pos) for the evergreen
  // loop, so a player can re-answer the same qNum on the next cycle. Falls back
  // to qNum for a non-looping room.
  const slot = body.instance ?? qNum

  // Server-authoritative grading — never trust a client-supplied correctAnswer.
  const question = await getQuestion(roomId, qNum)
  if (!question) {
    return NextResponse.json({ error: 'question not found' }, { status: 404 })
  }

  const rt = Math.max(0, Number(responseMs ?? question.timeLimitMs))
  const isCorrect = Number(answer) === question.correctAnswer
  const points = calculatePoints(isCorrect, rt, question.timeLimitMs)

  // 1) Record the answer idempotently. attribute_not_exists guards double-tap /
  //    retry: the first write wins, later ones are no-ops (no double-scoring).
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: roomPK(roomId),
          SK: answerSK(playerId, slot),
          answer: Number(answer),
          isCorrect,
          responseMs: rt,
          points,
          at: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // auto-expire after 7d
        },
        ConditionExpression: 'attribute_not_exists(SK)',
      }),
    )
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
      // Already answered this question — return the existing outcome, don't re-score.
      return NextResponse.json({ alreadyAnswered: true }, { status: 200 })
    }
    throw err
  }

  // 2) Atomic score + sharded-leaderboard index (Upgrade #1 fixed flow).
  const { totalScore } = await applyScore(roomId, playerId, points)

  // 3) Cross-room profile (AP#8) + per-room history (AP#9).
  await recordPlay(roomId, playerId, (body.username ?? 'anon').slice(0, 24), points, isCorrect)

  return NextResponse.json({
    isCorrect,
    points,
    totalScore,
    correctAnswer: question.correctAnswer, // safe to reveal AFTER answering
  })
}
