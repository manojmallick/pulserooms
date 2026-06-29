'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Trophy, Gamepad2, Target, TrendingUp, Star, CheckCircle2 } from 'lucide-react'
import { TopNav } from '@/components/top-nav'
import { DEMO_ROOM_ID } from '@/db/questions.mjs'

interface ProfileResp {
  playerId: string
  profile: { username?: string; totalScore?: number; streak?: number } | null
  history: { roomId: string; score: number; finalRank: number | null; playedAt: number | null }[]
}

export default function ProfilePage() {
  const [username, setUsername] = useState('')
  const [data, setData] = useState<ProfileResp | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setUsername(localStorage.getItem('pulse_username') || '')
    const pid = localStorage.getItem(`pulse_pid_${DEMO_ROOM_ID}`)
    if (!pid) return setLoaded(true)
    fetch(`/api/profile?playerId=${encodeURIComponent(pid)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const history = data?.history ?? []
  const games = history.length
  const totalScore = data?.profile?.totalScore ?? history.reduce((s, h) => s + h.score, 0)
  const best = history.reduce((m, h) => Math.max(m, h.score), 0)
  const streak = data?.profile?.streak ?? 0
  const initial = (username || 'P')[0].toUpperCase()

  const STATS = [
    { label: 'Total Score', value: totalScore.toLocaleString(), icon: Trophy, color: '#f59e0b', bg: '#f59e0b18' },
    { label: 'Current Streak', value: String(streak), icon: Flame, color: '#f43f5e', bg: '#f43f5e18' },
    { label: 'Games Played', value: String(games), icon: Gamepad2, color: '#22d3ee', bg: '#22d3ee18' },
    { label: 'Best Score', value: best.toLocaleString(), icon: Target, color: '#7c3aed', bg: '#7c3aed18' },
  ]

  const BADGES = [
    { label: 'First Answer', desc: 'Played a round', color: '#22c55e', earned: games > 0 },
    { label: 'Contender', desc: 'Scored 1,000+', color: '#7c3aed', earned: best >= 1000 },
    { label: 'Marathon', desc: '50 games played', color: '#f59e0b', earned: games >= 50 },
    { label: 'Centurion', desc: '100 games played', color: '#ec4899', earned: games >= 100 },
  ]

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        {/* header */}
        <div className="card-glass rounded-2xl p-6 flex items-center gap-5 mb-6">
          <div className="size-16 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center text-2xl font-black text-[#a78bfa] shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight truncate">{username || 'Guest player'}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Season 2026-S1 · stored under <span className="font-mono">PLAYER#…</span>
            </p>
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

        {/* achievements */}
        <div className="card-glass rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Star className="size-4 text-[#f59e0b]" /> Achievements
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BADGES.map(({ label, desc, color, earned }) => (
              <div
                key={label}
                className={`rounded-xl p-3 border flex items-start gap-2.5 ${earned ? '' : 'opacity-40 grayscale'}`}
                style={{ background: `${color}12`, borderColor: `${color}25` }}
              >
                <div className="size-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black" style={{ background: `${color}20`, color }}>
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
          {loaded && games === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No games yet —{' '}
              <Link href={`/room/${DEMO_ROOM_ID}`} className="text-[#a78bfa] underline">join a round</Link>.
            </div>
          )}
          {history.map((g) => (
            <div key={g.roomId} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
              <div className="size-8 rounded-xl flex items-center justify-center shrink-0 bg-[#22c55e]/15">
                <CheckCircle2 className="size-4 text-[#22c55e]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Room {g.roomId}</p>
                {g.finalRank && <p className="text-xs text-muted-foreground">Rank #{g.finalRank}</p>}
              </div>
              <p className="text-sm font-bold tabular-nums">{g.score.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
