import Link from 'next/link'
import { ArrowRight, Users, Trophy } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative pt-32 pb-24 px-4 text-center overflow-hidden">
      {/* decorative rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-[600px] rounded-full border border-[#7c3aed]/10 absolute" />
        <div className="size-[900px] rounded-full border border-[#7c3aed]/5 absolute" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/25 text-[#a78bfa] text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
          <span className="size-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
          Live Trivia — Round #2847 starting soon
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-balance leading-[0.9] mb-6">
          One round.{' '}
          <span className="text-[#7c3aed] glow-text-purple">A million</span>{' '}
          <span className="text-[#22d3ee] glow-text-cyan">players.</span>
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-10">
          HQ Trivia meets Kahoot, built for global scale on Amazon DynamoDB.
          Answer fast, score big, climb the leaderboard in real time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/game"
            className="glow-purple flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base px-7 py-4 rounded-2xl transition-all active:scale-95 w-full sm:w-auto justify-center"
          >
            Join Round #2847
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

        <div className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#22d3ee]" />
            <span><strong className="text-foreground">1,243,891</strong> players this season</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span><strong className="text-foreground">18,402</strong> online now</span>
          </div>
        </div>
      </div>
    </section>
  )
}
