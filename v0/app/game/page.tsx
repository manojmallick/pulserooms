'use client'

import { useState } from 'react'
import { Nav } from '@/components/nav'
import { NameGate } from '@/components/game/name-gate'
import { GameRoom } from '@/components/game/game-room'

export default function GamePage() {
  const [playerName, setPlayerName] = useState<string | null>(null)

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="pt-20">
        {playerName ? (
          <GameRoom playerName={playerName} />
        ) : (
          <NameGate onJoin={setPlayerName} />
        )}
      </div>
    </main>
  )
}
