// GET /api/profile?playerId=...  → profile + game history (AP#8, AP#9)
import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getHistory } from '@/lib/room'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const playerId = new URL(req.url).searchParams.get('playerId')
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 })

  const [profile, history] = await Promise.all([getProfile(playerId), getHistory(playerId)])
  return NextResponse.json({
    playerId,
    profile,
    history: history.map((h) => ({
      roomId: (h.SK as string).replace('ROOM#', ''),
      score: h.score ?? 0,
      finalRank: h.finalRank ?? null,
      playedAt: h.playedAt ?? null,
    })),
  })
}
