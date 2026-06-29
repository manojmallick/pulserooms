# PulseRooms realtime layer (Upgrade #3)

Persistent WebSocket connections live on **API Gateway WebSocket API** (AWS-side),
not on Vercel. Vercel serves the Next.js app + REST; AWS owns the live fanout.

```
Player answers ─▶ /api/answer/submit ─▶ DynamoDB write
                                              │ Streams (NEW_AND_OLD_IMAGES)
                                              ▼
                              leaderboard-aggregator.mjs (Lambda)
                                  • recompute top-K (scatter-gather over shards)
                                  • POST to @connections for that room
                                              │
                              API Gateway WebSocket API
                                              ▼
                         all subscribed clients update live
```

## Deploy

Two Lambdas, both Node 24, both with `dynamodb:Query/Delete` + `execute-api:ManageConnections`.

### 1. `ws-connection.mjs` — connection lifecycle

```bash
zip ws.zip ws-connection.mjs
aws lambda create-function \
  --function-name pulserooms-ws \
  --runtime nodejs24.x --handler ws-connection.handler \
  --zip-file fileb://ws.zip --role <LAMBDA_ROLE_ARN> \
  --environment "Variables={PULSEROOMS_TABLE=PulseRooms,AWS_REGION=us-east-1}"
```

Create a **WebSocket API** with routes `$connect`, `$disconnect`, `subscribe`
→ all integrated to `pulserooms-ws`. Deploy to stage `prod`. The invoke URL
(`wss://<id>.execute-api.<region>.amazonaws.com/prod`) is what clients dial; the
HTTPS form of that URL is `WS_API_ENDPOINT` for the aggregator.

### 2. `leaderboard-aggregator.mjs` — Streams → fanout

```bash
zip agg.zip leaderboard-aggregator.mjs
aws lambda create-function \
  --function-name pulserooms-aggregator \
  --runtime nodejs24.x --handler leaderboard-aggregator.handler \
  --zip-file fileb://agg.zip --role <LAMBDA_ROLE_ARN> \
  --environment "Variables={PULSEROOMS_TABLE=PulseRooms,AWS_REGION=us-east-1,LEADERBOARD_SHARDS=10,WS_API_ENDPOINT=https://<id>.execute-api.us-east-1.amazonaws.com/prod}"

# Wire the table stream (StreamArn printed by `pnpm ddb:provision`)
aws lambda create-event-source-mapping \
  --function-name pulserooms-aggregator \
  --event-source-arn <TABLE_STREAM_ARN> \
  --starting-position LATEST \
  --batch-size 100 --maximum-batching-window-in-seconds 1 \
  --function-response-types ReportBatchItemFailures
```

> The dependencies (`@aws-sdk/*`) are in the Node 24 Lambda runtime, so the zips
> can stay dependency-free. For pinned versions, bundle with `esbuild` instead.

## Local dev

Leave `WS_API_ENDPOINT` unset. The aggregator no-ops the push and the web UI
falls back to polling `/api/leaderboard` every ~1.5s — same data, just not pushed.
