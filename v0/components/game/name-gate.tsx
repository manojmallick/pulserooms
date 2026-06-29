'use client'

import { useState } from 'react'
import { Zap, ArrowRight } from 'lucide-react'

export function NameGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    onJoin(trimmed)
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card-glass rounded-3xl p-8 md:p-12 w-full max-w-md text-center">
        <div className="size-16 rounded-2xl bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center mx-auto mb-6">
          <Zap className="size-8 text-[#7c3aed] fill-[#7c3aed]" />
        </div>
        <h1 className="text-2xl font-black mb-2">Enter your player name</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Round #2847 starts in{' '}
          <span className="text-[#22d3ee] font-bold">0:47</span>. Pick a name and jump in.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your game handle…"
            maxLength={20}
            autoFocus
            className="w-full bg-white/5 border border-white/10 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20 outline-none rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm transition-all"
          />
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="glow-purple flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl transition-all active:scale-95"
          >
            Join Room
            <ArrowRight className="size-4" />
          </button>
        </form>
        <p className="text-muted-foreground text-xs mt-5">18,402 players already in the lobby</p>
      </div>
    </div>
  )
}
