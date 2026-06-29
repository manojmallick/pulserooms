'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, X, Users, Trophy, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── mock data ─────────────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 1,
    text: 'Which AWS service provides a fully managed, serverless, NoSQL database with single-digit millisecond performance?',
    options: ['Amazon RDS', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon Aurora'],
    correct: 1,
  },
  {
    id: 2,
    text: 'What is the maximum size of a single DynamoDB item?',
    options: ['1 MB', '400 KB', '64 KB', '16 MB'],
    correct: 1,
  },
  {
    id: 3,
    text: 'Which consistency model does DynamoDB use by default for read operations?',
    options: ['Strong consistency', 'Eventual consistency', 'Linearizable', 'Causal consistency'],
    correct: 1,
  },
]

const ANSWER_COLORS = [
  { base: 'from-[#7c3aed] to-[#6d28d9]', hover: 'hover:from-[#6d28d9] hover:to-[#5b21b6]', border: 'border-[#7c3aed]/40' },
  { base: 'from-[#0891b2] to-[#0e7490]', hover: 'hover:from-[#0e7490] hover:to-[#155e75]', border: 'border-[#22d3ee]/40' },
  { base: 'from-[#be185d] to-[#9d174d]', hover: 'hover:from-[#9d174d] hover:to-[#831843]', border: 'border-[#ec4899]/40' },
  { base: 'from-[#b45309] to-[#92400e]', hover: 'hover:from-[#92400e] hover:to-[#78350f]', border: 'border-[#f59e0b]/40' },
]

const LEADERBOARD_MOCK = [
  { name: 'xXDarkStarXx', score: 8420 },
  { name: 'QuantumLeap', score: 7990 },
  { name: 'CodeWitch', score: 7730 },
  { name: 'NightOwl99', score: 6850 },
  { name: 'BlitzKrieg', score: 6410 },
  { name: 'You', score: 0, isYou: true },
]

const QUESTION_DURATION = 20

/* ── component ─────────────────────────────────────────────────── */
export function GameRoom({ playerName }: { playerName: string }) {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION)
  const [score, setScore] = useState(0)
  const [pointsFlash, setPointsFlash] = useState<number | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [leaderboard, setLeaderboard] = useState(LEADERBOARD_MOCK)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const question = QUESTIONS[qIndex]
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const progress = (timeLeft / QUESTION_DURATION) * circumference
  const timerColor = timeLeft > 12 ? '#22c55e' : timeLeft > 6 ? '#f59e0b' : '#f43f5e'

  /* tick */
  useEffect(() => {
    if (revealed || gameOver) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setRevealed(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [qIndex, revealed, gameOver])

  /* reveal → next question */
  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => {
      if (qIndex + 1 >= QUESTIONS.length) {
        setGameOver(true)
      } else {
        setQIndex((q) => q + 1)
        setSelected(null)
        setRevealed(false)
        setTimeLeft(QUESTION_DURATION)
        // bump a random leaderboard score
        setLeaderboard((lb) =>
          lb
            .map((p) =>
              !p.isYou && Math.random() > 0.4
                ? { ...p, score: p.score + Math.floor(Math.random() * 400 + 200) }
                : p
            )
            .sort((a, b) => b.score - a.score)
        )
      }
    }, 3000)
    return () => clearTimeout(t)
  }, [revealed, qIndex])

  function handleAnswer(idx: number) {
    if (selected !== null || revealed) return
    clearInterval(timerRef.current!)
    setSelected(idx)
    setRevealed(true)
    if (idx === question.correct) {
      const pts = Math.round(1000 * (timeLeft / QUESTION_DURATION)) + 100
      setScore((s) => s + pts)
      setPointsFlash(pts)
      setLeaderboard((lb) =>
        lb
          .map((p) => (p.isYou ? { ...p, score: p.score + pts } : p))
          .sort((a, b) => b.score - a.score)
      )
      setTimeout(() => setPointsFlash(null), 1800)
    }
  }

  function getButtonState(idx: number) {
    if (!revealed) return 'idle'
    if (idx === question.correct) return 'correct'
    if (idx === selected) return 'wrong'
    return 'dim'
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full max-w-6xl mx-auto px-4 py-6">
      {/* ── main panel ── */}
      <div className="flex-1 flex flex-col gap-5">
        {/* header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>Round #2847 — Q{qIndex + 1}/{QUESTIONS.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-[#7c3aed]/15 border border-[#7c3aed]/25 rounded-full px-3 py-1">
            <Zap className="size-3.5 text-[#7c3aed]" />
            <span className="text-sm font-bold text-[#a78bfa]">{score.toLocaleString()} pts</span>
          </div>
        </div>

        {gameOver ? (
          <div className="card-glass rounded-3xl p-10 text-center flex-1 flex flex-col items-center justify-center gap-4">
            <Trophy className="size-16 text-[#f59e0b]" />
            <h2 className="text-3xl font-black">Round over!</h2>
            <p className="text-muted-foreground">Your final score</p>
            <p className="text-5xl font-black text-[#7c3aed] glow-text-purple">{score.toLocaleString()}</p>
            <button
              onClick={() => {
                setQIndex(0); setSelected(null); setRevealed(false)
                setTimeLeft(QUESTION_DURATION); setScore(0); setGameOver(false)
                setLeaderboard(LEADERBOARD_MOCK)
              }}
              className="mt-4 glow-purple bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold px-8 py-3 rounded-2xl transition-all"
            >
              Play again
            </button>
          </div>
        ) : (
          <>
            {/* question card */}
            <div className="card-glass rounded-3xl p-6 flex flex-col items-center gap-6">
              {/* circular timer */}
              <div className="relative size-28 flex items-center justify-center shrink-0">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke={timerColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.4s' }}
                  />
                </svg>
                <span className="text-3xl font-black tabular-nums" style={{ color: timerColor }}>
                  {timeLeft}
                </span>
                <Clock className="absolute bottom-4 size-3 text-muted-foreground" />
              </div>

              <p className="text-center font-bold text-lg md:text-xl leading-snug text-balance">
                {question.text}
              </p>
            </div>

            {/* answer grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              {/* points flash */}
              {pointsFlash !== null && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="text-4xl font-black text-[#22c55e] animate-bounce drop-shadow-lg">
                    +{pointsFlash}
                  </span>
                </div>
              )}

              {question.options.map((opt, idx) => {
                const state = getButtonState(idx)
                const colors = ANSWER_COLORS[idx]
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={revealed}
                    className={cn(
                      'relative flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border font-semibold text-sm text-left transition-all duration-200 bg-gradient-to-r',
                      state === 'idle' && `${colors.base} ${colors.hover} ${colors.border} active:scale-[0.98]`,
                      state === 'correct' && 'from-[#15803d] to-[#166534] border-[#22c55e]/60 ring-2 ring-[#22c55e]/50',
                      state === 'wrong' && 'from-[#9f1239] to-[#881337] border-[#f43f5e]/60 ring-2 ring-[#f43f5e]/50',
                      state === 'dim' && 'from-[#1e1a2e] to-[#1e1a2e] border-white/5 opacity-40',
                      revealed && state === 'idle' && 'cursor-default'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {['A', 'B', 'C', 'D'][idx]}
                      </span>
                      <span className="leading-snug">{opt}</span>
                    </span>
                    {state === 'correct' && <Check className="size-5 text-[#22c55e] shrink-0" />}
                    {state === 'wrong' && <X className="size-5 text-[#f43f5e] shrink-0" />}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── live leaderboard sidebar ── */}
      <aside className="lg:w-64 shrink-0">
        <div className="card-glass rounded-2xl p-4 sticky top-20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-foreground">Live Standings</h2>
            <span className="flex items-center gap-1.5 text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/25 px-2 py-0.5 rounded-full font-semibold">
              <span className="size-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              LIVE
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {leaderboard.map((player, rank) => (
              <li
                key={player.name}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-500',
                  player.isYou
                    ? 'bg-[#7c3aed]/15 border border-[#7c3aed]/30'
                    : 'bg-white/[0.03] border border-white/5'
                )}
              >
                <span
                  className="size-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{
                    background:
                      rank === 0 ? '#f59e0b20' : rank === 1 ? '#94a3b820' : rank === 2 ? '#b4530920' : 'transparent',
                    color: rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : rank === 2 ? '#b45309' : '#9b93b8',
                  }}
                >
                  {rank + 1}
                </span>
                <span className={cn('flex-1 truncate font-medium', player.isYou && 'text-[#a78bfa]')}>
                  {player.isYou ? playerName : player.name}
                </span>
                {player.isYou && (
                  <span className="text-[9px] font-bold bg-[#7c3aed]/25 text-[#a78bfa] px-1.5 py-0.5 rounded-full">
                    YOU
                  </span>
                )}
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {player.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
