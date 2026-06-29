import { Nav } from '@/components/nav'
import { Trophy, TrendingUp, Users, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const YOU = 'CodeWitch'

const PLAYERS = [
  { rank: 1,  name: 'xXDarkStarXx',   score: 284_200, games: 47, streak: 12 },
  { rank: 2,  name: 'QuantumLeap',     score: 271_550, games: 44, streak: 9  },
  { rank: 3,  name: YOU,               score: 258_730, games: 41, streak: 7  },
  { rank: 4,  name: 'NightOwl99',      score: 241_100, games: 39, streak: 5  },
  { rank: 5,  name: 'BlitzKrieg',      score: 232_800, games: 38, streak: 4  },
  { rank: 6,  name: 'StarterPack',     score: 221_400, games: 35, streak: 3  },
  { rank: 7,  name: 'PulseMaster',     score: 208_750, games: 33, streak: 2  },
  { rank: 8,  name: 'GhostProtocol',   score: 199_200, games: 31, streak: 1  },
  { rank: 9,  name: 'NeonViper',       score: 187_640, games: 29, streak: 0  },
  { rank: 10, name: 'SkyBreaker',      score: 176_300, games: 27, streak: 0  },
  { rank: 11, name: 'TurboFrost',      score: 168_900, games: 26, streak: 0  },
  { rank: 12, name: 'ZeroGravity',     score: 159_200, games: 24, streak: 0  },
  { rank: 13, name: 'DeepPulse',       score: 147_800, games: 22, streak: 0  },
  { rank: 14, name: 'WildVoltage',     score: 138_400, games: 21, streak: 0  },
  { rank: 15, name: 'EchoStrike',      score: 129_600, games: 20, streak: 0  },
]

const MEDAL = ['#f59e0b', '#94a3b8', '#b45309']
const MEDAL_BG = ['#f59e0b18', '#94a3b818', '#b4530918']
const MEDAL_LABEL = ['GOLD', 'SILVER', 'BRONZE']

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        {/* header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/25 flex items-center justify-center">
            <Trophy className="size-5 text-[#f59e0b]" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Global Leaderboard</h1>
            <p className="text-muted-foreground text-xs">Season 4 — resets in 12 days</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/8 rounded-full px-3 py-1.5">
            <Users className="size-3.5" />
            1,243,891 players
          </div>
        </div>

        {/* podium */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {PLAYERS.slice(0, 3).map((p, i) => (
            <div
              key={p.name}
              className={cn(
                'card-glass rounded-2xl p-4 text-center flex flex-col items-center gap-2 border',
                p.name === YOU && 'border-[#7c3aed]/40 bg-[#7c3aed]/[0.06]'
              )}
              style={{ borderColor: p.name !== YOU ? `${MEDAL[i]}30` : undefined }}
            >
              <div
                className="size-10 rounded-full flex items-center justify-center text-sm font-black"
                style={{ background: MEDAL_BG[i], color: MEDAL[i] }}
              >
                {i + 1}
              </div>
              <p
                className="font-bold text-xs truncate w-full"
                style={{ color: MEDAL[i] }}
              >
                {MEDAL_LABEL[i]}
              </p>
              <p className={cn('font-bold text-sm truncate w-full', p.name === YOU && 'text-[#a78bfa]')}>
                {p.name}
                {p.name === YOU && ' (you)'}
              </p>
              <p className="text-xs font-bold tabular-nums text-foreground">
                {p.score.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* full list */}
        <div className="card-glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-x-4 px-4 py-2.5 border-b border-white/[0.06] text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Games</span>
            <span className="text-right w-20">Score</span>
          </div>
          {PLAYERS.map((p) => (
            <div
              key={p.name}
              className={cn(
                'grid grid-cols-[2.5rem_1fr_auto_auto] gap-x-4 px-4 py-3 items-center border-b border-white/[0.04] last:border-0 transition-colors',
                p.name === YOU
                  ? 'bg-[#7c3aed]/10 border-[#7c3aed]/15'
                  : 'hover:bg-white/[0.025]'
              )}
            >
              {/* rank */}
              <span
                className="text-sm font-black tabular-nums"
                style={{
                  color: p.rank <= 3 ? MEDAL[p.rank - 1] : '#9b93b8',
                }}
              >
                {p.rank}
              </span>

              {/* name */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: p.rank <= 3 ? MEDAL_BG[p.rank - 1] : 'rgba(255,255,255,0.05)',
                    color: p.rank <= 3 ? MEDAL[p.rank - 1] : '#9b93b8',
                  }}
                >
                  {p.name[0]}
                </div>
                <span className={cn('font-semibold text-sm truncate', p.name === YOU && 'text-[#a78bfa]')}>
                  {p.name}
                  {p.name === YOU && (
                    <span className="ml-1.5 text-[9px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full font-bold align-middle">
                      YOU
                    </span>
                  )}
                </span>
                {p.streak > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-1.5 py-0.5 rounded-full font-bold ml-auto shrink-0">
                    <Star className="size-2.5" />
                    {p.streak}
                  </span>
                )}
              </div>

              {/* games */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                <TrendingUp className="size-3" />
                {p.games}
              </div>

              {/* score */}
              <span className="text-sm font-bold tabular-nums text-right w-20">
                {p.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
