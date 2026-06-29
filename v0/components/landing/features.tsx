import { Database, BarChart2, Wifi } from 'lucide-react'

const features = [
  {
    icon: Database,
    color: '#7c3aed',
    title: 'DynamoDB Single-Table',
    description:
      'All game state lives in one DynamoDB table — questions, scores, sessions — with zero cold starts and predictable latency at any scale.',
  },
  {
    icon: BarChart2,
    color: '#22d3ee',
    title: 'Write-Sharded Leaderboard',
    description:
      'Scores fan out across 10 write shards to prevent hot-partition throttles. A scatter-gather query reassembles the live top-100 in milliseconds.',
  },
  {
    icon: Wifi,
    color: '#ec4899',
    title: 'AWS-Native Realtime',
    description:
      "DynamoDB Streams trigger Lambda fanout. Every player sees the same question at the same clock tick, no matter what region they're in.",
  },
]

export function Features() {
  return (
    <section className="px-4 pb-20 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-5">
        {features.map(({ icon: Icon, color, title, description }) => (
          <div
            key={title}
            className="card-glass card-glass-hover rounded-2xl p-6"
          >
            <div
              className="size-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${color}20`, border: `1px solid ${color}30` }}
            >
              <Icon className="size-5" style={{ color }} />
            </div>
            <h3 className="font-bold text-base text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
