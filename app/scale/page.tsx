import { CheckCircle2, AlertTriangle, Globe, Database, Zap, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopNav } from '@/components/top-nav'
import { getScaleStats, type ScaleStats } from '@/lib/scale'
import { DEMO_ROOM_ID } from '@/db/questions.mjs'

export const dynamic = 'force-dynamic'

const LOAD_TEST = [
  { label: 'Single-partition p99', value: '1,262 ms', status: 'bad', note: 'Hot partition, matched load' },
  { label: 'Sharded p99', value: '154 ms', status: 'good', note: '10-shard scatter-gather' },
  { label: 'Throttles (single, sustained)', value: '47,115', status: 'bad', note: 'Sharded: 0' },
]

export default async function ScalePage() {
  let stats: ScaleStats | null = null
  try {
    stats = await getScaleStats(DEMO_ROOM_ID)
  } catch {
    stats = null
  }

  const replicas = stats?.table.replicas ?? []
  const allRegions = stats ? [stats.table.region, ...replicas.filter((r) => r !== stats!.table.region)] : []
  const maxShard = Math.max(1, ...(stats?.shards.map((s) => s.count) ?? [1]))

  const facts = stats
    ? [
        { icon: Globe, label: 'Region', value: stats.table.region, sub: replicas.length > 1 ? 'Global Tables enabled' : 'single region', ok: true, color: '#22d3ee' },
        { icon: Database, label: 'Billing Mode', value: stats.table.billing === 'PAY_PER_REQUEST' ? 'On-Demand' : stats.table.billing, sub: 'No capacity planning', ok: true, color: '#7c3aed' },
        { icon: Zap, label: 'DynamoDB Streams', value: stats.table.streams ? 'Enabled' : 'Off', sub: stats.table.streams ?? '—', ok: !!stats.table.streams, color: '#ec4899' },
        { icon: RefreshCw, label: 'Global Tables', value: `${allRegions.length} ${allRegions.length === 1 ? 'region' : 'replicas'}`, sub: allRegions.join(', '), ok: allRegions.length > 1, color: '#f59e0b' },
      ]
    : []

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7c3aed] mb-2">Live architecture</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-3 text-balance">
            How PulseRooms Scales
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
            Pulled live from Amazon DynamoDB. Write sharding prevents hot partitions; Global Tables
            push data closer to every player on earth.
          </p>
        </div>

        {!stats && (
          <div className="card-glass rounded-2xl p-6 text-muted-foreground border border-[#f43f5e]/30">
            Live stats unavailable (AWS credentials not configured in this environment).
          </div>
        )}

        {stats && (
          <>
            {/* table facts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {facts.map(({ icon: Icon, label, value, sub, ok, color }) => (
                <div key={label} className="card-glass rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                      <Icon className="size-4" style={{ color }} />
                    </div>
                    {ok ? <CheckCircle2 className="size-4 text-[#22c55e]" /> : <AlertTriangle className="size-4 text-[#f59e0b]" />}
                  </div>
                  <div>
                    <p className="font-black text-sm text-foreground truncate">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-bold">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug font-mono truncate">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* GSIs */}
            <div className="card-glass rounded-2xl p-5 mb-8">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Database className="size-4 text-[#22d3ee]" /> Global Secondary Indexes
              </h2>
              <div className="flex flex-col gap-4">
                {stats.table.gsis.map((g) => {
                  const color = g.name === 'GSI1' ? '#7c3aed' : '#22d3ee'
                  const purpose = g.name === 'GSI1' ? 'Write-sharded room leaderboard — fan-out writes across shards, scatter-gather for reads' : 'Season-level aggregated rankings sorted by cumulative score'
                  return (
                    <div key={g.name} className="rounded-xl p-4 border" style={{ background: `${color}08`, borderColor: `${color}20` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded-md" style={{ background: `${color}20`, color }}>{g.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{g.keys.join(' · ')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{purpose}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* write shard chart */}
            <div className="card-glass rounded-2xl p-5 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Zap className="size-4 text-[#7c3aed]" /> Write-Shard Distribution
                </h2>
                <span className="flex items-center gap-1.5 text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-full font-bold">
                  <span className="size-1.5 rounded-full bg-[#22c55e] animate-pulse" /> LIVE · {stats.totalPlayers.toLocaleString()} players
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {stats.shards.map(({ shard, count }) => (
                  <div key={shard} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-16 shrink-0 tabular-nums">Shard {shard}</span>
                    <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg" style={{ width: `${Math.max(2, (count / maxShard) * 100)}%`, background: 'linear-gradient(90deg, #7c3aed, #22d3ee)', transition: 'width 0.6s ease' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted-foreground w-12 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                Writes distributed across {stats.shardCount} shards via{' '}
                <code className="text-[#a78bfa] bg-[#7c3aed]/10 px-1.5 py-0.5 rounded text-[10px]">SHARD#{DEMO_ROOM_ID}#hash(playerId) % {stats.shardCount}</code>.
                A scatter-gather query reads all {stats.shardCount} shards and merges the top-K.
              </p>
            </div>

            {/* load test proof */}
            <div className="card-glass rounded-2xl p-5">
              <h2 className="font-bold text-sm mb-1 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#22c55e]" /> Load-Test Proof — in-region Lambda fleet
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Retries off so throttles surface. Single partition vs 10 shards, measured on real DynamoDB.</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {LOAD_TEST.map(({ label, value, status, note }) => (
                  <div key={label} className={cn('rounded-xl p-4 border', status === 'good' ? 'bg-[#22c55e]/[0.06] border-[#22c55e]/20' : 'bg-[#f43f5e]/[0.06] border-[#f43f5e]/20')}>
                    <p className="text-2xl font-black tabular-nums mb-1" style={{ color: status === 'good' ? '#22c55e' : '#f43f5e' }}>{value}</p>
                    <p className="text-xs font-bold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
