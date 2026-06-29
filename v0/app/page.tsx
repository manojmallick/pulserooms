import { Nav } from '@/components/nav'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { WhyDynamo } from '@/components/landing/why-dynamo'
import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Nav />

      <Hero />
      <Features />
      <WhyDynamo />

      {/* CTA banner */}
      <section className="px-4 pb-24 max-w-3xl mx-auto text-center">
        <div className="card-glass rounded-3xl p-10 border border-[#7c3aed]/20">
          <Zap className="size-10 text-[#7c3aed] fill-[#7c3aed] mx-auto mb-4" />
          <h2 className="text-3xl font-black tracking-tighter mb-3">
            Ready to test your knowledge?
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-7">
            Rounds run every 30 minutes. Jump in, answer fast, and see your name on the global board.
          </p>
          <Link
            href="/game"
            className="glow-purple inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-base px-8 py-4 rounded-2xl transition-all active:scale-95"
          >
            Enter Game Room
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
