// ─────────────────────────────────────────────────────────────
// Leaderboard reads (Upgrade #2 — scatter-gather over write shards).
//
// Writes are scattered across N shard partitions (see lib/keys.ts) so no single
// partition absorbs a whole room's answer firehose. A leaderboard read fans out
// one descending Query per shard (each returns that shard's local top-K from the
// GSI sort key — cheap, index-only), then merges the N partial top-Ks into the
// global top-K. Cost is N small parallel queries; correctness is exact because
// each shard is already sorted and the global top-K ⊆ union of per-shard top-Ks.
// ─────────────────────────────────────────────────────────────
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './dynamo'
import {
  SHARDS,
  SEASON_ID,
  leaderboardShardPKByIndex,
  seasonPK,
} from './keys'

export interface LeaderboardEntry {
  rank: number
  playerId: string
  username: string
  score: number
}

interface RawItem {
  PK?: string
  SK?: string
  username?: string
  score?: number
}

function toPlayerId(it: RawItem): string {
  // GSI rows project SK; fall back to PK for safety.
  return (it.SK ?? '').replace('PLAYER#', '') || (it.PK ?? '').replace('PLAYER#', '')
}

/**
 * Per-room live leaderboard, top-K. Scatter-gather across all write shards.
 * `k` is the number of rows wanted; we pull `k` from each shard then merge —
 * the union is guaranteed to contain the true global top-K.
 */
export async function getLeaderboard(roomId: string, k = 50): Promise<LeaderboardEntry[]> {
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) =>
      docClient.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :p',
          ExpressionAttributeValues: { ':p': leaderboardShardPKByIndex(roomId, i) },
          ScanIndexForward: false, // SCORE# desc → highest first
          Limit: k,
        }),
      ),
    ),
  )

  return mergeTopK(shards.flatMap((s) => (s.Items as RawItem[] | undefined) ?? []), k)
}

/**
 * Global seasonal leaderboard via GSI2. A single partition per season is
 * acceptable here because this index is read-heavy / write-light relative to
 * the per-room firehose, and is updated only on score-index writes (not every
 * answer). If a season ever gets write-hot, it shards the same way GSI1 does.
 */
export async function getSeasonLeaderboard(
  seasonId: string = SEASON_ID,
  k = 100,
): Promise<LeaderboardEntry[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :p',
      ExpressionAttributeValues: { ':p': seasonPK(seasonId) },
      ScanIndexForward: false,
      Limit: k,
    }),
  )
  return mergeTopK((res.Items as RawItem[] | undefined) ?? [], k)
}

/** De-dupe by player (a player can appear once per shard at most), sort, rank. */
function mergeTopK(items: RawItem[], k: number): LeaderboardEntry[] {
  const best = new Map<string, RawItem>()
  for (const it of items) {
    const id = toPlayerId(it)
    const prev = best.get(id)
    if (!prev || (it.score ?? 0) > (prev.score ?? 0)) best.set(id, it)
  }
  return [...best.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, k)
    .map((it, i) => ({
      rank: i + 1,
      playerId: toPlayerId(it),
      username: it.username ?? 'anon',
      score: it.score ?? 0,
    }))
}
