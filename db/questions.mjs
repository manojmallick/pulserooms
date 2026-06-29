// Demo trivia set. correctAnswer is the 0-based index into options.
export const DEMO_ROOM_ID = 'live-1'
export const DEMO_ROOM_TITLE = 'Friday Night Pulse'

export const QUESTIONS = [
  {
    text: 'Which AWS database is purpose-built for single-digit millisecond key-value access at any scale?',
    options: ['Amazon Aurora', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon Neptune'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'In a DynamoDB single-table design, what spreads write load to avoid a hot partition?',
    options: ['A larger RCU budget', 'Write sharding', 'A scan', 'A bigger sort key'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'Zero-padding a numeric score in the sort key (SCORE#00001500) makes DynamoDB…',
    options: ['Compress it', 'Sort it correctly as a string', 'Encrypt it', 'Cache it'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'Which feature triggers downstream processing when an item changes?',
    options: ['DynamoDB Streams', 'Global Tables', 'DAX', 'Time to Live'],
    correctAnswer: 0,
    timeLimitMs: 10_000,
  },
  {
    text: 'For multi-region active-active replication, you enable…',
    options: ['Read replicas', 'Global Tables', 'A NAT gateway', 'A VPC endpoint'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'Persistent WebSocket connections at scale on AWS are best held by…',
    options: ['A Vercel function', 'API Gateway WebSocket API', 'An S3 bucket', 'CloudFront'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'On-demand (PAY_PER_REQUEST) billing is ideal for which workload?',
    options: ['Steady, predictable', 'Spiky and bursty', 'Batch nightly', 'Read-only'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
  {
    text: 'The scatter-gather leaderboard read queries N shard partitions and then…',
    options: ['Scans the table', 'Merges the partial top-Ks', 'Drops duplicates randomly', 'Sorts on the server only'],
    correctAnswer: 1,
    timeLimitMs: 10_000,
  },
]
