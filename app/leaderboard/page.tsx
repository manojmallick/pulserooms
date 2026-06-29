import { Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopNav } from '@/components/top-nav'
import { getSeasonLeaderboard } from '@/lib/leaderboard'
import { SEASON_ID } from '@/lib/keys'

export const dynamic = 'force-dynamic'

const MEDAL = ['#f59e0b', '#94a3b8', '#b45309']
const MEDAL_BG = ['#f59e0b18', '#94a3b818', '#b4530918']
const MEDAL_LABEL = ['GOLD', 'SILVER', 'BRONZE']

export default async function GlobalLeaderboard() {
  let entries: { rank: number; playerId: string; username: string; score: number }[] = []
  try {
    entries = await getSeasonLeaderboard(SEASON_ID, 100)
  } catch {
    entries = []
  }
  const podium = entries.slice(0, 3)

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        {/* header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/25 flex items-center justify-center">
            <Trophy className="size-5 text-[#f59e0b]" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Global Leaderboard</h1>
            <p className="text-muted-foreground text-xs">Season {SEASON_ID} · DynamoDB GSI2</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
            <Users className="size-3.5" />
            {entries.length.toLocaleString()} ranked
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="card-glass rounded-2xl p-10 text-center text-muted-foreground">
            No scores yet this season.
          </div>
        ) : (
          <>
            {/* podium */}
            {podium.length === 3 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {podium.map((p, i) => (
                  <div
                    key={p.playerId}
                    className="card-glass rounded-2xl p-4 text-center flex flex-col items-center gap-2 border"
                    style={{ borderColor: `${MEDAL[i]}30` }}
                  >
                    <div
                      className="size-10 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: MEDAL_BG[i], color: MEDAL[i] }}
                    >
                      {i + 1}
                    </div>
                    <p className="font-bold text-[11px] truncate w-full" style={{ color: MEDAL[i] }}>
                      {MEDAL_LABEL[i]}
                    </p>
                    <p className="font-bold text-sm truncate w-full">{p.username}</p>
                    <p className="text-xs font-bold tabular-nums text-foreground">{p.score.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {/* full list */}
            <div className="card-glass rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[2.5rem_1fr_auto] gap-x-4 px-4 py-2.5 border-b border-white/[0.06] text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <span>#</span>
                <span>Player</span>
                <span className="text-right w-20">Score</span>
              </div>
              {entries.map((p) => (
                <div
                  key={p.playerId}
                  className="grid grid-cols-[2.5rem_1fr_auto] gap-x-4 px-4 py-3 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors"
                >
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: p.rank <= 3 ? MEDAL[p.rank - 1] : '#9b93b8' }}
                  >
                    {p.rank}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 uppercase"
                      style={{
                        background: p.rank <= 3 ? MEDAL_BG[p.rank - 1] : 'rgba(255,255,255,0.05)',
                        color: p.rank <= 3 ? MEDAL[p.rank - 1] : '#9b93b8',
                      }}
                    >
                      {p.username[0]}
                    </div>
                    <span className={cn('font-semibold text-sm truncate')}>{p.username}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-right w-20">
                    {p.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
