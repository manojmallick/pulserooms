// ─────────────────────────────────────────────────────────────
// Amazon DynamoDB client (single-table design).
//
// Two auth modes, auto-detected — mirrors the credential-less path the
// hackathon rewards:
//   1. IAM/OIDC  — Vercel OIDC federation. No static keys: the SDK assumes
//      AWS_ROLE_ARN via the project's short-lived OIDC token. This is the
//      preferred production path.  Env: AWS_REGION + AWS_ROLE_ARN (+ the
//      VERCEL_OIDC_TOKEN that `vercel env pull` provides locally).
//   2. Default chain — AWS_ACCESS_KEY_ID / SECRET (local provisioning, seeding,
//      and load tests). The SDK's default provider chain picks these up.
//
// A single DocumentClient is reused across hot Function invocations (Fluid
// Compute reuses instances), so we cache it on globalThis.
// ─────────────────────────────────────────────────────────────
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'

declare global {
  // eslint-disable-next-line no-var
  var __pulseroomsDoc: DynamoDBDocumentClient | undefined
}

export const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'
export const REGION = process.env.AWS_REGION || 'us-east-1'

function makeClient(): DynamoDBDocumentClient {
  const roleArn = process.env.AWS_ROLE_ARN

  const base = new DynamoDBClient({
    region: REGION,
    // Mode 1: OIDC role federation when a role ARN is present. Otherwise the
    // SDK falls through to its default chain (env keys) — Mode 2.
    ...(roleArn
      ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region: REGION } }) }
      : {}),
  })

  // marshallOptions: drop undefined attrs so partial writes don't blow up, and
  // let empty strings through (usernames can't be empty but answers/options can).
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
  })
}

/** Lazily create + reuse the DocumentClient. Importing must not require creds. */
export function getDoc(): DynamoDBDocumentClient {
  if (!globalThis.__pulseroomsDoc) globalThis.__pulseroomsDoc = makeClient()
  return globalThis.__pulseroomsDoc
}

// Convenience alias matching the original spec's `docClient` symbol.
export const docClient = getDoc()
