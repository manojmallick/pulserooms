// Populate the demo room + season leaderboard with a realistic crowd so the
// boards and the /scale shard distribution look alive in the demo.
//
//   pnpm ddb:crowd            # ~150 players
//   pnpm ddb:crowd -- 400     # custom count
//
// Players are written exactly like the real scoring path: base item under
// ROOM#<room>/PLAYER#<pid>, indexed on the sharded GSI1 and the seasonal GSI2.
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './aws.mjs'
import { DEMO_ROOM_ID } from '../db/questions.mjs'

const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 150)
const SHARDS = Math.max(1, Number(process.env.LEADERBOARD_SHARDS || 10))
const SEASON_ID = process.env.SEASON_ID || '2026-S1'
const doc = docClient()

const FIRST = ['Aria', 'Kenji', 'Luca', 'Mara', 'Noah', 'Priya', 'Sven', 'Yuki', 'Zoe', 'Diego', 'Fatima', 'Ravi', 'Nina', 'Omar', 'Lena', 'Tariq', 'Sofia', 'Hiro', 'Ana', 'Kwame']
const CITY = ['TYO', 'LDN', 'SAO', 'NYC', 'BLR', 'BER', 'SYD', 'TOR', 'DXB', 'SFO']
const pad8 = (n) => `SCORE#${Math.floor(n).toString().padStart(8, '0')}`
function shardIndex(pid) {
  let h = 0
  for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) >>> 0
  return h % SHARDS
}

function makePlayer(i) {
  const pid = `bot_${i.toString(36)}_${(i * 2654435761 % 1e6).toString(36)}`
  const name = `${FIRST[i % FIRST.length]}_${CITY[(i * 7) % CITY.length]}`
  // Spread scores 2k–30k with a long tail so a leaderboard has shape.
  const score = 2000 + Math.floor(((i * 9301 + 49297) % 233280) / 233280 * 28000)
  return {
    PK: `ROOM#${DEMO_ROOM_ID}`,
    SK: `PLAYER#${pid}`,
    username: name,
    score,
    scoreSeen: score,
    GSI1PK: `SHARD#${DEMO_ROOM_ID}#${shardIndex(pid)}`,
    GSI1SK: pad8(score),
    GSI2PK: `SEASON#${SEASON_ID}`,
    GSI2SK: pad8(score),
    joinedAt: Date.now(),
    bot: true,
  }
}

async function main() {
  console.log(`[crowd] seeding ${N} players into room ${DEMO_ROOM_ID} across ${SHARDS} shards + season ${SEASON_ID}`)
  const items = Array.from({ length: N }, (_, i) => ({ PutRequest: { Item: makePlayer(i) } }))
  for (let i = 0; i < items.length; i += 25) {
    await doc.send(new BatchWriteCommand({ RequestItems: { [TABLE]: items.slice(i, i + 25) } }))
  }
  console.log(`[crowd] ✓ ${N} players written — see /leaderboard and /scale`)
}

main().catch((err) => {
  console.error('[crowd] FAILED:', err)
  process.exit(1)
})
