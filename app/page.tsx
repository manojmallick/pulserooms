import Link from 'next/link'
import { ArrowRight, Zap, Trophy, Database, BarChart2, Wifi, CheckCircle2, Globe, Layers } from 'lucide-react'
import { TopNav } from '@/components/top-nav'
import { DEMO_ROOM_ID, DEMO_ROOM_TITLE } from '@/db/questions.mjs'

export const dynamic = 'force-static'

const FEATURES = [
  {
    icon: Database,
    color: '#7c3aed',
    title: 'DynamoDB Single-Table',
    description:
      'Rooms, players, questions, answers and two leaderboards in one table with deliberate PK/SK access patterns — predictable latency at any scale.',
  },
  {
    icon: BarChart2,
    color: '#22d3ee',
    title: 'Write-Sharded Leaderboard',
    description:
      "A room's answer firehose fans out across 10 write shards to prevent hot-partition throttling. A scatter-gather query reassembles the live top-K in milliseconds.",
  },
  {
    icon: Wifi,
    color: '#ec4899',
    title: 'AWS-Native Realtime',
    description:
      'DynamoDB Streams trigger a Lambda that pushes the live top-K over API Gateway WebSockets. Vercel serves the app; AWS owns the realtime fanout.',
  },
]

const REASONS = [
  {
    title: 'Single-digit millisecond latency',
    body: 'DynamoDB delivers consistent low-latency reads and writes regardless of table size — essential when thousands of answers land in the same second.',
    accent: '#7c3aed',
  },
  {
    title: 'On-demand absorbs any spike',
    body: 'Live trivia is bursty: nothing between rounds, a wall of writes during one. On-demand scales to the spike and bills nothing at idle.',
    accent: '#22d3ee',
  },
  {
    title: 'Global Tables — active-active',
    body: 'Replicas in us-east-1, eu-west-1 and ap-northeast-1 let a player in Tokyo and one in London each read from the nearest region with the same low latency.',
    accent: '#ec4899',
  },
  {
    title: 'Streams for event-driven scoring',
    body: 'Every score change emits a stream record; a Lambda recomputes the top-K and pushes live standings — no polling.',
    accent: '#f59e0b',
  },
]

export default function Landing() {
  return (
    <main className="min-h-screen">
      <TopNav />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-[600px] rounded-full border border-[#7c3aed]/10 absolute" />
          <div className="size-[900px] rounded-full border border-[#7c3aed]/5 absolute" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/25 text-[#a78bfa] text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <span className="size-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
            Live global trivia · built on Amazon DynamoDB
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-balance leading-[0.9] mb-6">
            One round.{' '}
            <span className="text-[#7c3aed] glow-text-purple">A million</span>{' '}
            <span className="text-[#22d3ee] glow-text-cyan">players.</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-10">
            Thousands join the same live round, answer against the clock, and climb a worldwide
            leaderboard in real time — engineered to scale to millions of concurrent answers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href={`/room/${DEMO_ROOM_ID}`}
              className="glow-purple flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base px-7 py-4 rounded-2xl transition-all active:scale-95 w-full sm:w-auto justify-center"
            >
              Join “{DEMO_ROOM_TITLE}”
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-semibold text-base px-7 py-4 rounded-2xl transition-all w-full sm:w-auto justify-center"
            >
              <Trophy className="size-4 text-[#f59e0b]" />
              View Leaderboard
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-12 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Globe className="size-4 text-[#22d3ee]" />
              <strong className="text-foreground">3-region</strong> active-active
            </span>
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-[#7c3aed]" />
              <strong className="text-foreground">10</strong> write shards
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
              single-digit-ms leaderboard
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-20 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, title, description }) => (
            <div key={title} className="card-glass card-glass-hover rounded-2xl p-6">
              <div
                className="size-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}
              >
                <Icon className="size-5" style={{ color }} />
              </div>
              <h3 className="font-bold text-base text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why DynamoDB */}
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7c3aed] mb-3">Infrastructure</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-balance">
            Why Amazon DynamoDB?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm leading-relaxed">
            A live round is a write firehose with a real-time read — designed from day one for
            DynamoDB&apos;s strengths, not bolted on after.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {REASONS.map(({ title, body, accent }) => (
            <div key={title} className="card-glass card-glass-hover rounded-2xl p-6 flex gap-4">
              <CheckCircle2 className="size-5 mt-0.5 shrink-0" style={{ color: accent }} />
              <div>
                <h3 className="font-bold text-sm text-foreground mb-1">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 max-w-3xl mx-auto text-center">
        <div className="card-glass rounded-3xl p-10 border border-[#7c3aed]/20">
          <Zap className="size-10 text-[#7c3aed] fill-[#7c3aed] mx-auto mb-4" />
          <h2 className="text-3xl font-black tracking-tighter mb-3">Ready to test your knowledge?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-7">
            The round runs continuously — jump in, answer fast, and watch your name climb the live
            global board.
          </p>
          <Link
            href={`/room/${DEMO_ROOM_ID}`}
            className="glow-purple inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base px-8 py-4 rounded-2xl transition-all active:scale-95"
          >
            Enter Game Room
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-muted-foreground">
        PulseRooms · Track 3 Million-scale · Amazon DynamoDB + Global Tables
      </footer>
    </main>
  )
}
