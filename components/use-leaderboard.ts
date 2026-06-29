'use client'
import { useEffect, useRef, useState } from 'react'

export interface Entry {
  rank: number
  playerId?: string
  username: string
  score: number
}

/**
 * Live leaderboard for a room. Prefers the AWS realtime push (API Gateway
 * WebSocket, set NEXT_PUBLIC_WS_ENDPOINT) and falls back to polling
 * /api/leaderboard. The push path is what the Streams→Lambda fanout drives;
 * polling keeps local dev (no WS infra) working with identical data.
 */
export function useLeaderboard(roomId: string, pollMs = 1500) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [live, setLive] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!roomId) return
    let stopped = false
    const wsBase = process.env.NEXT_PUBLIC_WS_ENDPOINT

    async function poll() {
      try {
        const r = await fetch(`/api/leaderboard?roomId=${encodeURIComponent(roomId)}&k=50`, {
          cache: 'no-store',
        })
        const j = await r.json()
        if (!stopped && Array.isArray(j.entries)) setEntries(j.entries)
      } catch {
        /* transient */
      }
    }

    let timer: ReturnType<typeof setInterval> | undefined

    if (wsBase) {
      try {
        const ws = new WebSocket(`${wsBase}?roomId=${encodeURIComponent(roomId)}`)
        wsRef.current = ws
        ws.onopen = () => {
          setLive(true)
          ws.send(JSON.stringify({ action: 'subscribe', roomId }))
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.type === 'leaderboard' && Array.isArray(msg.entries)) setEntries(msg.entries)
          } catch {
            /* ignore */
          }
        }
        ws.onclose = () => setLive(false)
        ws.onerror = () => setLive(false)
        // Seed once immediately so the board isn't empty before first push.
        poll()
      } catch {
        timer = setInterval(poll, pollMs)
        poll()
      }
    } else {
      timer = setInterval(poll, pollMs)
      poll()
    }

    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      wsRef.current?.close()
    }
  }, [roomId, pollMs])

  return { entries, live }
}
