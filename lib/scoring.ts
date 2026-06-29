// ─────────────────────────────────────────────────────────────
// Speed-based scoring + the FIXED leaderboard-write flow (Upgrade #1).
//
// THE BUG (original): a single UpdateItem did `ADD score :p SET GSI1SK = <key
// from per-question points>` and then patched GSI1SK in a second write. You
// cannot know the cumulative total before the atomic add, so the first write
// indexes the player at the WRONG score, and under concurrent answers the
// two-step patch races — corrupting leaderboard order.
//
// THE FIX: order the writes correctly.
//   1. Atomic `ADD score :p` with ReturnValues=ALL_NEW → get the TRUE total.
//   2. SET the GSI sort keys from that true total, guarded by a condition so a
//      slower concurrent write can't stomp a higher score it already lost to.
// ─────────────────────────────────────────────────────────────
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './dynamo'
import {
  roomPK,
  playerSK,
  scoreKey,
  leaderboardShardPK,
  seasonPK,
} from './keys'

/** Faster correct answers earn more points (1000–1500). Wrong = 0. */
export function calculatePoints(isCorrect: boolean, responseMs: number, timeLimitMs: number): number {
  if (!isCorrect) return 0
  const base = 1000
  const speedBonus = Math.max(0, 1 - responseMs / Math.max(1, timeLimitMs))
  return Math.round(base + speedBonus * 500)
}

export interface ScoreResult {
  totalScore: number
  indexed: boolean // false if a concurrent higher score already won the sort key
}

/**
 * Apply `points` to a player's cumulative score and (re)index them on the
 * sharded leaderboard at the TRUE cumulative total. Returns the new total.
 *
 * Step 1 is the only authoritative mutation of `score` — it's a single atomic
 * counter increment, so concurrent answers from the same player accumulate
 * correctly with zero lost updates.
 *
 * Step 2 maintains the GSI sort keys. It's idempotent and self-healing: the
 * guard `attribute_not_exists(scoreSeen) OR scoreSeen <= :s` means if two of a
 * player's answers resolve out of order, only the write carrying the higher
 * total ends up setting the sort key. A condition failure is the EXPECTED,
 * benign outcome of losing that race — not an error.
 */
export async function applyScore(
  roomId: string,
  playerId: string,
  points: number,
  seasonId?: string,
): Promise<ScoreResult> {
  // ── Step 1: atomic increment ONLY. Do not touch GSI keys yet. ──
  const inc = await docClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: roomPK(roomId), SK: playerSK(playerId) },
      UpdateExpression: 'ADD score :p',
      ExpressionAttributeValues: { ':p': points },
      ReturnValues: 'ALL_NEW',
    }),
  )
  const totalScore = Number(inc.Attributes?.score ?? points)

  // Points==0 (wrong answer) still bumped score by 0; no need to re-index.
  if (points === 0) return { totalScore, indexed: false }

  // ── Step 2: index at the TRUE total, guarded against stale stomps. ──
  let indexed = true
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roomPK(roomId), SK: playerSK(playerId) },
        UpdateExpression:
          'SET GSI1PK = :shard, GSI1SK = :sk, GSI2PK = :season, GSI2SK = :sk, scoreSeen = :s',
        ConditionExpression: 'attribute_not_exists(scoreSeen) OR scoreSeen <= :s',
        ExpressionAttributeValues: {
          ':shard': leaderboardShardPK(roomId, playerId),
          ':season': seasonPK(seasonId),
          ':sk': scoreKey(totalScore),
          ':s': totalScore,
        },
      }),
    )
  } catch (err: unknown) {
    // ConditionalCheckFailed = a concurrent write already indexed a >= score.
    // That write is authoritative; ours is safely dropped.
    if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
      indexed = false
    } else {
      throw err
    }
  }

  return { totalScore, indexed }
}
