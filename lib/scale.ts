// ─────────────────────────────────────────────────────────────
// Live architecture stats for the in-app /scale dashboard.
// Reads the real table description (region, billing, Streams, GSIs, Global
// Tables replicas) and the live per-shard player distribution — visual proof
// that the write-sharding actually spreads load across partitions.
// ─────────────────────────────────────────────────────────────
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import { docClient, TABLE, REGION } from './dynamo'
import { SHARDS, leaderboardShardPKByIndex } from './keys'

function rawClient(): DynamoDBClient {
  const roleArn = process.env.AWS_ROLE_ARN
  return new DynamoDBClient({
    region: REGION,
    ...(roleArn
      ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region: REGION } }) }
      : {}),
  })
}

export interface ScaleStats {
  table: {
    name: string
    region: string
    billing: string
    itemCount: number
    streams: string | null
    streamArn: string | null
    gsis: { name: string; keys: string[] }[]
    replicas: string[]
  }
  shardCount: number
  shards: { shard: number; count: number }[]
  totalPlayers: number
}

export async function getScaleStats(roomId: string): Promise<ScaleStats> {
  const desc = await rawClient().send(new DescribeTableCommand({ TableName: TABLE }))
  const T = desc.Table!

  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) =>
      docClient
        .send(
          new QueryCommand({
            TableName: TABLE,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :p',
            ExpressionAttributeValues: { ':p': leaderboardShardPKByIndex(roomId, i) },
            Select: 'COUNT',
          }),
        )
        .then((r) => ({ shard: i, count: r.Count ?? 0 })),
    ),
  )

  return {
    table: {
      name: T.TableName!,
      region: REGION,
      billing: T.BillingModeSummary?.BillingMode ?? 'PROVISIONED',
      itemCount: T.ItemCount ?? 0,
      streams: T.StreamSpecification?.StreamEnabled ? T.StreamSpecification.StreamViewType! : null,
      streamArn: T.LatestStreamArn ?? null,
      gsis: (T.GlobalSecondaryIndexes ?? []).map((g) => ({
        name: g.IndexName!,
        keys: (g.KeySchema ?? []).map((k) => k.AttributeName!),
      })),
      // Replicas (Global Tables). [REGION] alone means single-region.
      replicas: (T.Replicas ?? []).map((r) => r.RegionName!),
    },
    shardCount: SHARDS,
    shards,
    totalPlayers: shards.reduce((s, x) => s + x.count, 0),
  }
}
