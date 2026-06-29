import { TopNav } from '@/components/top-nav'
import { GameRoom } from '@/components/game-room'

export const dynamic = 'force-dynamic'

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="pt-16">
        <GameRoom roomId={roomId} />
      </div>
    </main>
  )
}
