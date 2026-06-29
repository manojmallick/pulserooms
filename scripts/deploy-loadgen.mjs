// ─────────────────────────────────────────────────────────────
// Deploy the in-region load-generator worker Lambda.
//
//   pnpm loadgen:deploy
//
// Idempotent: ensures an execution role, zips lambda/loadgen-worker.mjs, then
// creates or updates the function `pulserooms-loadgen`. Needs creds with
// iam:* (role) + lambda:* on first run. If your keys lack IAM, set
// LOADGEN_ROLE_ARN to a pre-made Lambda role and only lambda:* is required.
//
// Requires the `zip` CLI (preinstalled on macOS/Linux).
// ─────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
} from '@aws-sdk/client-iam'
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda'

const REGION = process.env.AWS_REGION || 'us-east-1'
const TABLE = process.env.PULSEROOMS_TABLE || 'PulseRooms'
const FN = process.env.LOADGEN_FN || 'pulserooms-loadgen'
const ROLE_NAME = 'pulserooms-loadgen-role'

const iam = new IAMClient({ region: REGION })
const lambda = new LambdaClient({ region: REGION })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ensureRole() {
  if (process.env.LOADGEN_ROLE_ARN) {
    console.log(`[deploy] using LOADGEN_ROLE_ARN=${process.env.LOADGEN_ROLE_ARN}`)
    return process.env.LOADGEN_ROLE_ARN
  }
  try {
    const r = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }))
    console.log(`[deploy] role exists: ${r.Role.Arn}`)
    return r.Role.Arn
  } catch (err) {
    if (err.name !== 'NoSuchEntity' && err.name !== 'NoSuchEntityException') throw err
  }

  console.log('[deploy] creating execution role…')
  const trust = {
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' },
    ],
  }
  const created = await iam.send(
    new CreateRoleCommand({
      RoleName: ROLE_NAME,
      AssumeRolePolicyDocument: JSON.stringify(trust),
      Description: 'PulseRooms in-region load generator',
    }),
  )
  await iam.send(
    new AttachRolePolicyCommand({
      RoleName: ROLE_NAME,
      PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    }),
  )
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: ROLE_NAME,
      PolicyName: 'pulserooms-ddb-write',
      PolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['dynamodb:UpdateItem', 'dynamodb:PutItem', 'dynamodb:BatchWriteItem', 'dynamodb:Query'],
            Resource: '*',
          },
        ],
      }),
    }),
  )
  console.log('[deploy] role created; waiting 12s for IAM propagation…')
  await sleep(12_000)
  return created.Role.Arn
}

function buildZip() {
  const dir = mkdtempSync(join(tmpdir(), 'pulse-loadgen-'))
  // Lambda needs the handler file at the zip root named loadgen-worker.mjs.
  copyFileSync(new URL('../lambda/loadgen-worker.mjs', import.meta.url), join(dir, 'loadgen-worker.mjs'))
  const zipPath = join(dir, 'fn.zip')
  execFileSync('zip', ['-j', zipPath, join(dir, 'loadgen-worker.mjs')], { stdio: 'ignore' })
  return readFileSync(zipPath)
}

async function functionExists() {
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: FN }))
    return true
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false
    throw err
  }
}

async function main() {
  const roleArn = await ensureRole()
  const zip = buildZip()
  const Environment = { Variables: { PULSEROOMS_TABLE: TABLE } }

  if (await functionExists()) {
    console.log(`[deploy] updating ${FN} code…`)
    await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: FN, ZipFile: zip }))
    // Config update may race with code update; retry briefly.
    for (let i = 0; i < 6; i++) {
      try {
        await lambda.send(
          new UpdateFunctionConfigurationCommand({
            FunctionName: FN,
            Timeout: 300,
            MemorySize: 1024,
            Environment,
          }),
        )
        break
      } catch (err) {
        if (err.name === 'ResourceConflictException') {
          await sleep(3000)
          continue
        }
        throw err
      }
    }
  } else {
    console.log(`[deploy] creating ${FN}…`)
    for (let i = 0; i < 8; i++) {
      try {
        await lambda.send(
          new CreateFunctionCommand({
            FunctionName: FN,
            Runtime: 'nodejs22.x',
            Role: roleArn,
            Handler: 'loadgen-worker.handler',
            Code: { ZipFile: zip },
            Timeout: 300,
            MemorySize: 1024,
            Environment,
          }),
        )
        break
      } catch (err) {
        // New roles can take a moment to be assumable by Lambda.
        if (err.name === 'InvalidParameterValueException' && /assume/i.test(err.message)) {
          console.log('[deploy]   role not assumable yet, retrying…')
          await sleep(4000)
          continue
        }
        throw err
      }
    }
  }

  console.log(`[deploy] ✓ ${FN} ready (region=${REGION}, table=${TABLE})`)
  console.log('Next: pnpm loadgen -- --mode=single   then   --mode=sharded')
}

main().catch((err) => {
  console.error('[deploy] FAILED:', err.name, '-', err.message)
  if (err.name === 'AccessDenied' || /not authorized/i.test(err.message || '')) {
    console.error(
      '\nYour keys lack IAM/Lambda permissions. Either grant iam:*+lambda:* once, or\n' +
        'create a Lambda role manually and set LOADGEN_ROLE_ARN, then re-run.',
    )
  }
  process.exit(1)
})
