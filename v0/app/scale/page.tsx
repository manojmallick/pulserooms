import { Nav } from '@/components/nav'
import { CheckCircle2, AlertTriangle, Globe, Database, Zap, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABLE_FACTS = [
  {
    icon: Globe,
    label: 'Region',
    value: 'us-east-1',
    sub: 'Global Tables enabled',
    ok: true,
    color: '#22d3ee',
  },
  {
    icon: Database,
    label: 'Billing Mode',
    value: 'On-Demand',
    sub: 'No capacity planning',
    ok: true,
    color: '#7c3aed',
  },
  {
    icon: Zap,
    label: 'DynamoDB Streams',
    value: 'Enabled',
    sub: 'NEW_AND_OLD_IMAGES view',
    ok: true,
    color: '#ec4899',
  },
  {
    icon: RefreshCw,
    label: 'Global Tables',
    value: '4 Replicas',
    sub: 'us-east-1, eu-west-1, ap-northeast-1, ap-southeast-1',
    ok: true,
    color: '#f59e0b',
  },
]

const GSIS = [
  {
    id: 'GSI1',
    name: 'ShardedRoomLeaderboard',
    pk: 'SHARD#{shardId}',
    sk: 'SCORE#{paddedScore}#{userId}',
    purpose: 'Write-sharded leaderboard — fan-out writes across shards, scatter-gather for reads',
    color: '#7c3aed',
  },
  {
    id: 'GSI2',
    name: 'SeasonalRankings',
    pk: 'SEASON#{seasonId}',
    sk: 'SCORE#{paddedScore}#{userId}',
    purpose: 'Season-level aggregated rankings sorted by cumulative score',
    color: '#22d3ee',
  },
]

const SHARDS = [
  { id: 0, players: 18_740 },
  { id: 1, players: 19_210 },
  { id: 2, players: 17_980 },
  { id: 3, players: 20_410 },
  { id: 4, players: 18_100 },
  { id: 5, players: 19_870 },
  { id: 6, players: 17_650 },
  { id: 7, players: 20_980 },
  { id: 8, players: 18_560 },
  { id: 9, players: 19_330 },
]
const MAX_PLAYERS = Math.max(...SHARDS.map((s) => s.players))

const LOAD_TEST = [
  { label: 'Single-partition p99', value: '187 ms', status: 'bad',  note: 'Hot partition' },
  { label: 'Sharded p99',          value: '9 ms',   status: 'good', note: '10-shard fanout' },
  { label: 'Throttled requests',   value: '0',      status: 'good', note: 'Zero throttles' },
]

export default function ScalePage() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="pt-24 pb-16 px-4 max-w-5xl mx-auto">

        {/* page header */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7c3aed] mb-2">Architecture</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-3 text-balance">
            How PulseRooms Scales
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
            Every design decision targets DynamoDB&apos;s partition-level limits. Write sharding
            prevents hot partitions; Global Tables push data closer to every player on earth.
          </p>
        </div>

        {/* table facts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {TABLE_FACTS.map(({ icon: Icon, label, value, sub, ok, color }) => (
            <div key={label} className="card-glass rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div
                  className="size-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                >
                  <Icon className="size-4" style={{ color }} />
                </div>
                {ok
                  ? <CheckCircle2 className="size-4 text-[#22c55e]" />
                  : <AlertTriangle className="size-4 text-[#f59e0b]" />}
              </div>
              <div>
                <p className="font-black text-sm text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-bold">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* GSIs */}
        <div className="card-glass rounded-2xl p-5 mb-8">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Database className="size-4 text-[#22d3ee]" />
            Global Secondary Indexes
          </h2>
          <div className="flex flex-col gap-4">
            {GSIS.map(({ id, name, pk, sk, purpose, color }) => (
              <div
                key={id}
                className="rounded-xl p-4 border"
                style={{ background: `${color}08`, borderColor: `${color}20` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-black px-2 py-0.5 rounded-md"
                    style={{ background: `${color}20`, color }}
                  >
                    {id}
                  </span>
                  <span className="font-bold text-sm text-foreground">{name}</span>
                </div>
                <div className="flex flex-wrap gap-3 mb-2 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">PK</span>
                    <code
                      className="px-2 py-0.5 rounded-md text-[10px]"
                      style={{ background: `${color}18`, color }}
                    >
                      {pk}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">SK</span>
                    <code
                      className="px-2 py-0.5 rounded-md text-[10px]"
                      style={{ background: `${color}18`, color }}
                    >
                      {sk}
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{purpose}</p>
              </div>
            ))}
          </div>
        </div>

        {/* write shard chart */}
        <div className="card-glass rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Zap className="size-4 text-[#7c3aed]" />
              Write-Shard Distribution
            </h2>
            <span className="flex items-center gap-1.5 text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-full font-bold">
              <span className="size-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {SHARDS.map(({ id, players }) => {
              const pct = (players / MAX_PLAYERS) * 100
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-16 shrink-0 tabular-nums">
                    Shard {id}
                  </span>
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #7c3aed, #22d3ee)`,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-muted-foreground w-16 text-right shrink-0">
                    {players.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            Writes are distributed across 10 shards using{' '}
            <code className="text-[#a78bfa] bg-[#7c3aed]/10 px-1.5 py-0.5 rounded text-[10px]">
              shardId = hash(userId) % 10
            </code>
            . A scatter-gather query reads all 10 shards and merges them client-side.
          </p>
        </div>

        {/* load test proof */}
        <div className="card-glass rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#22c55e]" />
            Load-Test Proof — 500k concurrent players
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {LOAD_TEST.map(({ label, value, status, note }) => (
              <div
                key={label}
                className={cn(
                  'rounded-xl p-4 border',
                  status === 'good'
                    ? 'bg-[#22c55e]/[0.06] border-[#22c55e]/20'
                    : 'bg-[#f43f5e]/[0.06] border-[#f43f5e]/20'
                )}
              >
                <p
                  className="text-2xl font-black tabular-nums mb-1"
                  style={{ color: status === 'good' ? '#22c55e' : '#f43f5e' }}
                >
                  {value}
                </p>
                <p className="text-xs font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
