import { CheckCircle2 } from 'lucide-react'

const reasons = [
  {
    title: 'Single-digit millisecond latency',
    body: 'DynamoDB delivers consistent <10 ms reads and writes regardless of table size — essential when thousands of answers arrive in the same second.',
    accent: '#7c3aed',
  },
  {
    title: 'Infinite horizontal scale',
    body: 'On-demand capacity absorbs any spike. A sudden viral moment that sends 500k concurrent players won\'t cause a single throttle.',
    accent: '#22d3ee',
  },
  {
    title: 'Global Tables replication',
    body: 'Multi-region active-active means a player in Tokyo and one in São Paulo both read their score from the nearest replica with the same low latency.',
    accent: '#ec4899',
  },
  {
    title: 'Streams for event-driven scoring',
    body: 'Every score update emits a stream record. Lambda reacts instantly to recalculate shard totals and push live standings — no polling required.',
    accent: '#f59e0b',
  },
]

export function WhyDynamo() {
  return (
    <section className="px-4 py-20 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs font-bold uppercase tracking-widest text-[#7c3aed] mb-3">
          Infrastructure
        </p>
        <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-balance">
          Why Amazon DynamoDB?
        </h2>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm leading-relaxed">
          PulseRooms was designed from day one for DynamoDB&apos;s strengths — not bolted on after.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {reasons.map(({ title, body, accent }) => (
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
  )
}
