// GET /api/leaderboard?roomId=...&k=50    → per-room live leaderboard (sharded)
// GET /api/leaderboard?season=2026-S1&k=100 → global seasonal leaderboard (GSI2)
import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard, getSeasonLeaderboard } from '@/lib/leaderboard'
import { SEASON_ID } from '@/lib/keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roomId = searchParams.get('roomId')
  const season = searchParams.get('season')
  const k = Math.min(200, Math.max(1, Number(searchParams.get('k') ?? (roomId ? 50 : 100))))

  try {
    if (roomId) {
      const entries = await getLeaderboard(roomId, k)
      return NextResponse.json({ scope: 'room', roomId, entries })
    }
    const entries = await getSeasonLeaderboard(season ?? SEASON_ID, k)
    return NextResponse.json({ scope: 'season', season: season ?? SEASON_ID, entries })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ error: 'leaderboard unavailable', entries: [] }, { status: 500 })
  }
}
