'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X, Users, Trophy, Clock, Zap, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLeaderboard } from './use-leaderboard'

interface CurrentQuestion {
  qNum: number
  text: string
  options: string[]
  timeLimitMs: number
}
interface CurrentResp {
  room: { roomId: string; title: string; status: string; startTime: number }
  serverNow: number
  questionCount: number
  current: { index: number; qNum?: number; question: CurrentQuestion | null; endsAt: number }
}

const ANSWER_COLORS = [
  { base: 'from-[#7c3aed] to-[#6d28d9]', hover: 'hover:from-[#6d28d9] hover:to-[#5b21b6]', border: 'border-[#7c3aed]/40' },
  { base: 'from-[#0891b2] to-[#0e7490]', hover: 'hover:from-[#0e7490] hover:to-[#155e75]', border: 'border-[#22d3ee]/40' },
  { base: 'from-[#be185d] to-[#9d174d]', hover: 'hover:from-[#9d174d] hover:to-[#831843]', border: 'border-[#ec4899]/40' },
  { base: 'from-[#b45309] to-[#92400e]', hover: 'hover:from-[#92400e] hover:to-[#78350f]', border: 'border-[#f59e0b]/40' },
]

export function GameRoom({ roomId }: { roomId: string }) {
  const [playerId, setPlayerId] = useState('')
  const [username, setUsername] = useState('')
  const [joined, setJoined] = useState(false)
  const [resp, setResp] = useState<CurrentResp | null>(null)
  const [skew, setSkew] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [answeredIdx, setAnsweredIdx] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; points: number; correctAnswer: number } | null>(null)
  const [myScore, setMyScore] = useState(0)
  const [pointsFlash, setPointsFlash] = useState<number | null>(null)
  const qStartRef = useRef(0)

  const { entries, live } = useLeaderboard(roomId)

  const join = useCallback(
    async (name: string) => {
      const existing = localStorage.getItem(`pulse_pid_${roomId}`) || undefined
      const r = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, username: name, playerId: existing }),
      })
      const j = await r.json()
      if (j.playerId) {
        setPlayerId(j.playerId)
        setUsername(j.username)
        localStorage.setItem(`pulse_pid_${roomId}`, j.playerId)
        localStorage.setItem('pulse_username', j.username)
        setJoined(true)
      }
    },
    [roomId],
  )

  useEffect(() => {
    const saved = localStorage.getItem('pulse_username')
    if (saved) {
      setUsername(saved)
      join(saved)
    }
  }, [join])

  // Poll server-authoritative current question
  useEffect(() => {
    if (!joined) return
    let stop = false
    async function tick() {
      try {
        const r = await fetch(`/api/room/current?roomId=${encodeURIComponent(roomId)}`, { cache: 'no-store' })
        const j: CurrentResp = await r.json()
        if (stop) return
        setResp(j)
        setSkew(j.serverNow - Date.now())
        if (j.current.question) qStartRef.current = j.current.endsAt - j.current.question.timeLimitMs
      } catch {
        /* transient */
      }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [joined, roomId])

  // Local countdown (skew-corrected to the server clock)
  useEffect(() => {
    const id = setInterval(() => {
      if (!resp?.current.question) return setRemaining(0)
      setRemaining(Math.max(0, resp.current.endsAt - (Date.now() + skew)))
    }, 100)
    return () => clearInterval(id)
  }, [resp, skew])

  const idx = resp?.current.index ?? -1
  useEffect(() => {
    if (idx !== answeredIdx) {
      setPicked(null)
      setResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  async function submit(option: number) {
    if (!resp?.current.question || picked !== null) return
    setPicked(option)
    setAnsweredIdx(idx)
    const responseMs = Math.max(0, Date.now() + skew - qStartRef.current)
    const r = await fetch('/api/answer/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId,
        playerId,
        username,
        qNum: resp.current.question.qNum,
        instance: resp.current.index,
        answer: option,
        responseMs,
      }),
    })
    const j = await r.json()
    if (j.alreadyAnswered) return
    setResult({ correct: j.isCorrect, points: j.points, correctAnswer: j.correctAnswer })
    if (typeof j.totalScore === 'number') setMyScore(j.totalScore)
    if (j.isCorrect && j.points) {
      setPointsFlash(j.points)
      setTimeout(() => setPointsFlash(null), 1800)
    }
  }

  // ── Join gate ──
  if (!joined) {
    return (
      <div className="min-h-[78vh] flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (username.trim().length >= 2) join(username.trim())
          }}
          className="card-glass rounded-3xl p-8 md:p-12 w-full max-w-md text-center"
        >
          <div className="size-16 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center mx-auto mb-6">
            <Zap className="size-8 text-[#7c3aed] fill-[#7c3aed]" />
          </div>
          <h1 className="text-2xl font-black mb-2">Enter your player name</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Questions broadcast to everyone at the same moment. Pick a name and jump in.
          </p>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your game handle…"
            maxLength={24}
            autoFocus
            className="w-full bg-white/5 border border-white/10 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20 outline-none rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm transition-all mb-3"
          />
          <button
            type="submit"
            disabled={username.trim().length < 2}
            className="glow-purple w-full flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl transition-all active:scale-95"
          >
            Join Room
            <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    )
  }

  const q = resp?.current.question
  const roundOver = resp?.room.status === 'ended'
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const pct = q ? Math.max(0, Math.min(1, remaining / q.timeLimitMs)) : 0
  const secs = Math.ceil(remaining / 1000)
  const timerColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#f43f5e'
  const reveal = result !== null

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full max-w-6xl mx-auto px-4 py-6">
      {/* Main panel */}
      <div className="flex-1 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>
              {resp?.room.title} —{' '}
              {q ? `Q${(resp!.current.qNum ?? 0) + 1}/${resp!.questionCount}` : 'standby'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#7c3aed]/15 border border-[#7c3aed]/25 rounded-full px-3 py-1">
            <Zap className="size-3.5 text-[#7c3aed]" />
            <span className="text-sm font-bold text-[#a78bfa]">{myScore.toLocaleString()} pts</span>
          </div>
        </div>

        {roundOver ? (
          <div className="card-glass rounded-3xl p-10 text-center flex-1 flex flex-col items-center justify-center gap-4">
            <Trophy className="size-16 text-[#f59e0b]" />
            <h2 className="text-3xl font-black">Round over!</h2>
            <p className="text-5xl font-black text-[#7c3aed] glow-text-purple">{myScore.toLocaleString()}</p>
          </div>
        ) : !q ? (
          <Standby title={resp?.room.title} startsIn={resp ? resp.room.startTime - (Date.now() + skew) : 0} />
        ) : (
          <>
            {/* Question card */}
            <div className="card-glass rounded-3xl p-6 flex flex-col items-center gap-6 animate-rise">
              <div className="relative size-28 flex items-center justify-center shrink-0">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={timerColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - pct)}
                    style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.4s' }}
                  />
                </svg>
                <span className="text-3xl font-black tabular-nums" style={{ color: timerColor }}>
                  {secs}
                </span>
                <Clock className="absolute bottom-4 size-3 text-muted-foreground" />
              </div>
              <p className="text-center font-bold text-lg md:text-xl leading-snug text-balance">{q.text}</p>
            </div>

            {/* Answer grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              {pointsFlash !== null && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="text-4xl font-black text-[#22c55e] animate-bounce drop-shadow-lg">
                    +{pointsFlash}
                  </span>
                </div>
              )}
              {q.options.map((opt, i) => {
                const colors = ANSWER_COLORS[i % 4]
                const isCorrect = reveal && result!.correctAnswer === i
                const isWrong = reveal && picked === i && !result!.correct
                const dim = reveal && !isCorrect && !isWrong
                return (
                  <button
                    key={i}
                    onClick={() => submit(i)}
                    disabled={picked !== null || remaining <= 0}
                    className={cn(
                      'relative flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border font-semibold text-sm text-left transition-all duration-200 bg-gradient-to-r',
                      !reveal && picked === null && remaining > 0 && `${colors.base} ${colors.hover} ${colors.border} active:scale-[0.98]`,
                      !reveal && (picked !== null || remaining <= 0) && `${colors.base} ${colors.border} opacity-90`,
                      isCorrect && 'from-[#15803d] to-[#166534] border-[#22c55e]/60 ring-2 ring-[#22c55e]/50',
                      isWrong && 'from-[#9f1239] to-[#881337] border-[#f43f5e]/60 ring-2 ring-[#f43f5e]/50',
                      dim && 'from-[#1e1a2e] to-[#1e1a2e] border-white/5 opacity-40',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {['A', 'B', 'C', 'D'][i]}
                      </span>
                      <span className="leading-snug">{opt}</span>
                    </span>
                    {isCorrect && <Check className="size-5 text-[#22c55e] shrink-0" />}
                    {isWrong && <X className="size-5 text-[#f43f5e] shrink-0" />}
                  </button>
                )
              })}
            </div>

            {picked !== null && !result && (
              <p className="text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> scoring…
              </p>
            )}
            {reveal && !result!.correct && picked !== null && (
              <p className="text-center text-[#f43f5e] font-semibold text-sm">Not this time — hang in there.</p>
            )}
          </>
        )}
      </div>

      {/* Live standings */}
      <aside className="lg:w-64 shrink-0">
        <div className="card-glass rounded-2xl p-4 sticky top-20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-foreground">Live Standings</h2>
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold border',
                live
                  ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/25'
                  : 'bg-white/5 text-muted-foreground border-white/10',
              )}
            >
              <span className={cn('size-1.5 rounded-full', live ? 'bg-[#22c55e] animate-pulse' : 'bg-white/40')} />
              {live ? 'LIVE' : 'POLLING'}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {entries.length === 0 && (
              <li className="text-xs text-muted-foreground text-center py-6">
                No scores yet — be the first to answer.
              </li>
            )}
            {entries.slice(0, 12).map((p) => {
              const isMe = p.playerId === playerId
              const rank = p.rank - 1
              return (
                <li
                  key={p.playerId ?? p.username}
                  className={cn(
                    'lb-row flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm border',
                    isMe ? 'bg-[#7c3aed]/15 border-[#7c3aed]/30' : 'bg-white/[0.03] border-white/5',
                  )}
                >
                  <span
                    className="size-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      background: rank === 0 ? '#f59e0b20' : rank === 1 ? '#94a3b820' : rank === 2 ? '#b4530920' : 'transparent',
                      color: rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : rank === 2 ? '#b45309' : '#9b93b8',
                    }}
                  >
                    {p.rank}
                  </span>
                  <span className={cn('flex-1 truncate font-medium', isMe && 'text-[#a78bfa]')}>{p.username}</span>
                  {isMe && (
                    <span className="text-[9px] font-bold bg-[#7c3aed]/25 text-[#a78bfa] px-1.5 py-0.5 rounded-full">
                      YOU
                    </span>
                  )}
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    {p.score.toLocaleString()}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function Standby({ title, startsIn }: { title?: string; startsIn: number }) {
  const secs = Math.max(0, Math.ceil(startsIn / 1000))
  return (
    <div className="card-glass rounded-3xl p-10 text-center flex-1 flex flex-col items-center justify-center gap-3 animate-rise min-h-[40vh]">
      <div className="text-xs uppercase tracking-widest text-[#22d3ee]">{title}</div>
      <h2 className="text-3xl font-black">{secs > 0 ? 'Round starts in…' : 'Get ready…'}</h2>
      {secs > 0 && <div className="text-6xl font-black tabular-nums text-[#22d3ee] glow-text-cyan">{secs}</div>}
      <p className="text-muted-foreground text-sm">Questions broadcast to everyone at the same moment.</p>
    </div>
  )
}
