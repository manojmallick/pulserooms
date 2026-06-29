import { Nav } from '@/components/nav'
import { Flame, Trophy, Gamepad2, Target, TrendingUp, Star, CheckCircle2, XCircle } from 'lucide-react'

const STATS = [
  { label: 'Total Score',    value: '258,730', icon: Trophy,    color: '#f59e0b', bg: '#f59e0b18' },
  { label: 'Current Streak', value: '7 days',  icon: Flame,     color: '#f43f5e', bg: '#f43f5e18' },
  { label: 'Games Played',   value: '41',      icon: Gamepad2,  color: '#22d3ee', bg: '#22d3ee18' },
  { label: 'Avg Accuracy',   value: '74%',     icon: Target,    color: '#7c3aed', bg: '#7c3aed18' },
]

const RECENT = [
  { round: '#2847', date: 'Jun 29',   score: 8_420, rank: 3,   result: 'win',  questions: 10, correct: 8  },
  { round: '#2831', date: 'Jun 28',   score: 7_250, rank: 5,   result: 'win',  questions: 10, correct: 7  },
  { round: '#2820', date: 'Jun 27',   score: 5_900, rank: 12,  result: 'loss', questions: 10, correct: 5  },
  { round: '#2808', date: 'Jun 26',   score: 9_100, rank: 1,   result: 'win',  questions: 10, correct: 9  },
  { round: '#2795', date: 'Jun 25',   score: 6_400, rank: 8,   result: 'win',  questions: 10, correct: 6  },
  { round: '#2781', date: 'Jun 24',   score: 4_200, rank: 21,  result: 'loss', questions: 10, correct: 4  },
]

const BADGES = [
  { label: 'Top 3',         desc: 'Finished in the top 3',  color: '#f59e0b', earned: true  },
  { label: 'Perfect Round', desc: '10/10 correct answers',  color: '#22c55e', earned: true  },
  { label: 'Hot Streak',    desc: '7-day streak',           color: '#f43f5e', earned: true  },
  { label: 'Marathon',      desc: '50 games played',        color: '#7c3aed', earned: false },
  { label: 'Speed Demon',   desc: 'Answer in < 2s, 5 times',color: '#22d3ee', earned: false },
  { label: 'Centurion',     desc: '100 games played',       color: '#ec4899', earned: false },
]

export default function ProfilePage() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">

        {/* profile header */}
        <div className="card-glass rounded-2xl p-6 flex items-center gap-5 mb-6">
          <div className="size-16 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center text-2xl font-black text-[#a78bfa] shrink-0">
            C
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black tracking-tight">CodeWitch</h1>
              <span className="text-xs bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25 px-2 py-0.5 rounded-full font-bold">
                Rank #3
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Season 4 · Joined Feb 2025</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-[#f43f5e]/10 border border-[#f43f5e]/20 rounded-xl px-3 py-2">
            <Flame className="size-5 text-[#f43f5e]" />
            <div>
              <p className="text-xs font-bold text-[#f43f5e]">7-day</p>
              <p className="text-[10px] text-muted-foreground">streak</p>
            </div>
          </div>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {STATS.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card-glass rounded-2xl p-4 flex flex-col gap-2">
              <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                <Icon className="size-4" style={{ color }} />
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color }}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* badges */}
        <div className="card-glass rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Star className="size-4 text-[#f59e0b]" />
            Badges
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BADGES.map(({ label, desc, color, earned }) => (
              <div
                key={label}
                className={`rounded-xl p-3 border flex items-start gap-2.5 ${earned ? '' : 'opacity-40 grayscale'}`}
                style={{
                  background: `${color}12`,
                  borderColor: `${color}25`,
                }}
              >
                <div
                  className="size-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black"
                  style={{ background: `${color}20`, color }}
                >
                  {label[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* recent games */}
        <div className="card-glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <TrendingUp className="size-4 text-[#22d3ee]" />
            <h2 className="font-bold text-sm">Recent Games</h2>
          </div>
          {RECENT.map((g) => (
            <div
              key={g.round}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${g.result === 'win' ? 'bg-[#22c55e]/15' : 'bg-[#f43f5e]/15'}`}>
                {g.result === 'win'
                  ? <CheckCircle2 className="size-4 text-[#22c55e]" />
                  : <XCircle className="size-4 text-[#f43f5e]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Round {g.round}</p>
                <p className="text-xs text-muted-foreground">{g.date} · {g.correct}/{g.questions} correct</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums">{g.score.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Rank #{g.rank}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
