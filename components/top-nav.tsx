'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEMO_ROOM_ID } from '@/db/questions.mjs'

const links = [
  { href: '/', label: 'Home' },
  { href: `/room/${DEMO_ROOM_ID}`, label: 'Game Room' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/profile', label: 'Profile' },
  { href: '/scale', label: 'Scale' },
]

export function TopNav() {
  const pathname = usePathname()
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-background/60">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Zap className="size-5 text-[#7c3aed] fill-[#7c3aed]" />
          <span className="text-foreground">Pulse</span>
          <span className="text-[#22d3ee]">Rooms</span>
        </Link>
        <ul className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/15 text-[#7c3aed]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
        <Link
          href={`/room/${DEMO_ROOM_ID}`}
          className="glow-purple bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
        >
          Play Now
        </Link>
      </nav>
    </header>
  )
}
