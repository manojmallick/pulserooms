// Seed a demo room + questions. The room starts LIVE ~5s from now so you can
// open the game room and watch questions broadcast on the server clock.
//
//   pnpm ddb:seed
import { PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE } from './aws.mjs'
import { DEMO_ROOM_ID, DEMO_ROOM_TITLE, QUESTIONS } from '../db/questions.mjs'

const doc = docClient()
const pad3 = (n) => String(n).padStart(3, '0')

async function main() {
  const startTime = Date.now() + 5_000 // kicks off in 5 seconds
  const roomId = DEMO_ROOM_ID

  // Room META
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ROOM#${roomId}`,
        SK: 'META',
        status: 'live',
        title: DEMO_ROOM_TITLE,
        startTime,
        questionCount: QUESTIONS.length,
      },
    }),
  )

  // Questions (batched). qNum is 0-based; SK uses Q#000, Q#001, …
  const items = QUESTIONS.map((q, i) => ({
    PutRequest: {
      Item: {
        PK: `ROOM#${roomId}`,
        SK: `Q#${pad3(i)}`,
        qNum: i,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        timeLimitMs: q.timeLimitMs,
      },
    },
  }))
  // BatchWrite caps at 25 items/request.
  for (let i = 0; i < items.length; i += 25) {
    await doc.send(new BatchWriteCommand({ RequestItems: { [TABLE]: items.slice(i, i + 25) } }))
  }

  console.log(`[seed] ✓ room "${DEMO_ROOM_TITLE}" (${roomId}) — ${QUESTIONS.length} questions`)
  console.log(`[seed]   starts in 5s · open /room/${roomId}`)
}

main().catch((err) => {
  console.error('[seed] FAILED:', err)
  process.exit(1)
})
