// POST /api/room/join  { roomId, username }  → { playerId }
import { NextRequest, NextResponse } from 'next/server'
import { joinRoom, getRoom } from '@/lib/room'

export const runtime = 'nodejs'

// Lightweight id generation (no external dep). Stable per join.
function newPlayerId() {
  const rand = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  return `p_${Date.now().toString(36)}_${rand}`
}

export async function POST(req: NextRequest) {
  let body: { roomId?: string; username?: string; playerId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const roomId = body.roomId?.trim()
  const username = (body.username ?? '').trim().slice(0, 24) || 'anon'
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const room = await getRoom(roomId)
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  const playerId = body.playerId?.trim() || newPlayerId()
  await joinRoom(roomId, playerId, username)

  return NextResponse.json({ playerId, username, room })
}
