// GET /api/room/current?roomId=...
// Returns room metadata + the server-authoritative current question (no answer).
import { NextRequest, NextResponse } from 'next/server'
import { getRoom, getQuestions, currentQuestion } from '@/lib/room'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roomId = searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const room = await getRoom(roomId)
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  const questions = await getQuestions(roomId)
  const now = Date.now()
  const current = await currentQuestion(room, questions, now)

  return NextResponse.json({
    room,
    serverNow: now,
    questionCount: questions.length,
    current, // { index, question (answer-stripped) | null, endsAt }
  })
}
