// Shared AWS client factory for node scripts (provision, seed, loadtest).
// Mirrors lib/dynamo.ts: OIDC role federation when AWS_ROLE_ARN is set
// (needs VERCEL_OIDC_TOKEN locally, via `vercel env pull`), else the default
// provider chain (AWS_ACCESS_KEY_ID / SECRET).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'

export const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'
export const REGION = process.env.AWS_REGION || 'us-east-1'

function creds() {
  const roleArn = process.env.AWS_ROLE_ARN
  if (roleArn && process.env.VERCEL_OIDC_TOKEN) {
    return { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region: REGION } }) }
  }
  return {} // default chain (env keys)
}

export function ddbClient() {
  return new DynamoDBClient({ region: REGION, ...creds() })
}

export function docClient() {
  return DynamoDBDocumentClient.from(ddbClient(), {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
  })
}
