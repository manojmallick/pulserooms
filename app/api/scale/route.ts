// GET /api/scale?roomId=live-1 → live architecture stats (JSON proof endpoint)
import { NextRequest, NextResponse } from 'next/server'
import { getScaleStats } from '@/lib/scale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const roomId = new URL(req.url).searchParams.get('roomId') ?? 'live-1'
  try {
    return NextResponse.json(await getScaleStats(roomId))
  } catch (err) {
    console.error('[scale]', err)
    return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  }
}
