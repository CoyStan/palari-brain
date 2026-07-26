import assert from 'node:assert/strict'
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  runIncrementalLongMemEvalQuestionForScoring,
} from '../evals/arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  INCREMENTAL_CHECKPOINT_AGGREGATE_FILENAME,
  atomicReplaceIncrementalCheckpointAggregate,
  createIncrementalLongMemEvalCheckpointJournal,
  incrementalCheckpointReceiptFilename,
} from '../evals/incremental-longmemeval-checkpoint-journal.mjs'

function manualCheckpoint(ordinal, interactionCount = 3) {
  return {
    activeMemories: [],
    completedInteraction: ordinal,
    digest: {
      digestRevision: ordinal,
      pending: 0,
      ready: true,
    },
    interactionCount,
    status: 'completed',
    unitOrder: ordinal,
  }
}

function fixture() {
  return {
    answer: 'No durable preference was supplied.',
    answerSessionIds: [],
    isAbstention: true,
    question: 'What durable preference did the user provide?',
    questionDate: '2026-01-04T00:00:00.000Z',
    questionId: 'checkpoint-journal-fixture',
    questionType: 'single-session-user',
    sessions: [
      {
        eventAt: '2026-01-01T00:00:00.000Z',
        sessionId: 'session-1',
        turns: [
          { content: 'Hello one.', role: 'user' },
          { content: 'Hello.', role: 'assistant' },
        ],
      },
      {
        eventAt: '2026-01-02T00:00:00.000Z',
        sessionId: 'session-2',
        turns: [
          { content: 'Hello two.', role: 'user' },
          { content: 'Hello again.', role: 'assistant' },
        ],
      },
      {
        eventAt: '2026-01-03T00:00:00.000Z',
        sessionId: 'session-3',
        turns: [
          { content: 'Hello three.', role: 'user' },
          { content: 'Hello once more.', role: 'assistant' },
        ],
      },
    ],
  }
}

function noMemoryReducer(body) {
  const input = JSON.parse(body.contents[0].parts[0].text).input
  return {
    actions: [],
    baseRevision: input.baseRevision,
    dispositions: input.evidence.map((entry) => ({
      evidenceId: entry.id,
      outcome: 'no_memory',
    })),
  }
}

function validatedReducer(body) {
  return {
    finishReason: 'STOP',
    modelVersion: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
    text: JSON.stringify(noMemoryReducer(body)),
    usage: {
      geminiInputTokens: 10,
      geminiOutputTokens: 5,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0.000003,
    },
    usageDetails: {
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
  }
}

async function privateRoot(prefix) {
  return mkdtemp(join(tmpdir(), prefix))
}

test('aggregate failure after receipt N stops the real arm before N+1 and recovery adopts N',
  async () => {
    const root = await privateRoot('palari-checkpoint-arm-')
    const directory = join(root, 'journal')
    const calls = []
    const aggregateFailure = new Error(
      'synthetic aggregate replacement failure',
    )
    aggregateFailure.code = 'SYNTHETIC_AGGREGATE_WRITE_FAILURE'
    let failAggregate = true
    try {
      const journal =
        await createIncrementalLongMemEvalCheckpointJournal({
          async aggregateWriter(path, text) {
            const aggregate = JSON.parse(text)
            if (aggregate.completedInteraction === 2 &&
              failAggregate) {
              failAggregate = false
              throw aggregateFailure
            }
            await atomicReplaceIncrementalCheckpointAggregate(
              path,
              text,
            )
          },
          directory,
          questionId: fixture().questionId,
          runId: 'checkpoint-failure-run',
        })

      await assert.rejects(
        runIncrementalLongMemEvalQuestionForScoring({
          async callGemini(request) {
            calls.push([
              request.purpose,
              request.operationId,
            ])
            return validatedReducer(request.body)
          },
          instance: fixture(),
          onCheckpoint: journal.onCheckpoint,
          workspaceDir: join(root, 'workspace'),
        }),
        (error) =>
          error?.code === 'SYNTHETIC_AGGREGATE_WRITE_FAILURE',
      )

      assert.deepEqual(calls, [
        [
          'writer',
          'question:checkpoint-journal-fixture:reducer:1',
        ],
        [
          'writer',
          'question:checkpoint-journal-fixture:reducer:2',
        ],
      ])
      const receipt2 = join(
        directory,
        incrementalCheckpointReceiptFilename(2),
      )
      assert.equal((await lstat(receipt2)).mode & 0o777, 0o600)
      const receipt2Text = await readFile(receipt2, 'utf8')
      assert.equal(
        JSON.parse(receipt2Text).payload.ordinal,
        2,
      )
      const interruptedPublication = join(
        directory,
        '.interaction-000002.receipt.json.4242.' +
          '00000000-0000-4000-8000-000000000002.tmp',
      )
      await link(receipt2, interruptedPublication)
      assert.equal((await lstat(receipt2)).nlink, 2)
      const staleAggregate = JSON.parse(await readFile(
        join(
          directory,
          INCREMENTAL_CHECKPOINT_AGGREGATE_FILENAME,
        ),
        'utf8',
      ))
      assert.equal(staleAggregate.completedInteraction, 1)
      assert.equal(
        (await journal.recover()).completedInteraction,
        2,
      )
      assert.equal((await lstat(receipt2)).nlink, 1)
      await assert.rejects(
        lstat(interruptedPublication),
        (error) => error?.code === 'ENOENT',
      )
      await assert.rejects(
        journal.onCheckpoint(manualCheckpoint(3)),
        (error) =>
          error?.code === 'CHECKPOINT_JOURNAL_TERMINAL' &&
          error.cause === aggregateFailure,
      )

      const recoveredJournal =
        await createIncrementalLongMemEvalCheckpointJournal({
          directory,
          questionId: fixture().questionId,
          runId: 'checkpoint-failure-run',
        })
      const recovered = await recoveredJournal.recover()
      assert.equal(recovered.completedInteraction, 2)
      assert.equal(recovered.checkpoints.length, 2)
      assert.deepEqual(
        recovered.receiptManifest.map((entry) => entry.ordinal),
        [1, 2],
      )
      assert.equal(
        recovered.lastReceiptSha256,
        recovered.receiptManifest[1].receiptSha256,
      )
      const repairedAggregate = JSON.parse(await readFile(
        recoveredJournal.aggregatePath,
        'utf8',
      ))
      assert.deepEqual(repairedAggregate, recovered)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('receipt writer failures propagate and permanently stop that journal instance',
  async () => {
    const root = await privateRoot('palari-checkpoint-write-')
    const failure = new Error('synthetic receipt failure')
    failure.code = 'SYNTHETIC_RECEIPT_WRITE_FAILURE'
    try {
      const journal =
        await createIncrementalLongMemEvalCheckpointJournal({
          directory: join(root, 'journal'),
          questionId: 'question',
          async receiptWriter() {
            throw failure
          },
          runId: 'run',
        })
      await assert.rejects(
        journal.onCheckpoint(manualCheckpoint(1)),
        (error) =>
          error?.code === 'SYNTHETIC_RECEIPT_WRITE_FAILURE',
      )
      await assert.rejects(
        journal.onCheckpoint(manualCheckpoint(1)),
        (error) =>
          error?.code === 'CHECKPOINT_JOURNAL_TERMINAL' &&
          error.cause === failure,
      )
      assert.equal(journal.snapshot().completedInteraction, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('recovery rejects receipt mutation, gaps, symlinks, unsafe modes, and identity drift',
  async (t) => {
    async function withJournal(name, callback) {
      const root = await privateRoot(`palari-checkpoint-${name}-`)
      const directory = join(root, 'journal')
      try {
        const journal =
          await createIncrementalLongMemEvalCheckpointJournal({
            directory,
            questionId: 'question',
            runId: 'run',
          })
        await callback({ directory, journal, root })
      } finally {
        await rm(root, { force: true, recursive: true })
      }
    }

    await t.test('content mutation', async () => {
      await withJournal('mutation', async ({ directory, journal }) => {
        await journal.onCheckpoint(manualCheckpoint(1))
        const path = join(
          directory,
          incrementalCheckpointReceiptFilename(1),
        )
        const record = JSON.parse(await readFile(path, 'utf8'))
        record.payload.checkpoint.digest.ready = false
        await writeFile(path, `${JSON.stringify(record, null, 2)}\n`)
        await assert.rejects(
          journal.recover(),
          (error) =>
            error?.code ===
              'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
        )
      })
    })

    await t.test('ordinal gap', async () => {
      await withJournal('gap', async ({ directory, journal }) => {
        await journal.onCheckpoint(manualCheckpoint(1))
        await journal.onCheckpoint(manualCheckpoint(2))
        await unlink(join(
          directory,
          incrementalCheckpointReceiptFilename(1),
        ))
        await assert.rejects(
          journal.recover(),
          (error) =>
            error?.code ===
              'CHECKPOINT_JOURNAL_ORDINAL_INVALID',
        )
      })
    })

    await t.test('receipt symlink', async () => {
      await withJournal(
        'symlink',
        async ({ directory, journal, root }) => {
          await journal.onCheckpoint(manualCheckpoint(1))
          const path = join(
            directory,
            incrementalCheckpointReceiptFilename(1),
          )
          const target = join(root, 'target.json')
          await writeFile(target, '{}\n', { mode: 0o600 })
          await unlink(path)
          await symlink(target, path)
          await assert.rejects(
            journal.recover(),
            (error) =>
              error?.code === 'CHECKPOINT_JOURNAL_FILE_UNSAFE',
          )
        },
      )
    })

    await t.test('receipt mode', async () => {
      await withJournal('mode', async ({ directory, journal }) => {
        await journal.onCheckpoint(manualCheckpoint(1))
        await chmod(join(
          directory,
          incrementalCheckpointReceiptFilename(1),
        ), 0o644)
        await assert.rejects(
          journal.recover(),
          (error) =>
            error?.code === 'CHECKPOINT_JOURNAL_FILE_UNSAFE',
        )
      })
    })

    await t.test('unowned receipt hard link', async () => {
      await withJournal(
        'hardlink',
        async ({ directory, journal, root }) => {
          await journal.onCheckpoint(manualCheckpoint(1))
          await link(
            join(
              directory,
              incrementalCheckpointReceiptFilename(1),
            ),
            join(root, 'outside-receipt-link.json'),
          )
          await assert.rejects(
            journal.recover(),
            (error) =>
              error?.code === 'CHECKPOINT_JOURNAL_FILE_UNSAFE',
          )
        },
      )
    })

    await t.test('run and question identity', async () => {
      await withJournal(
        'identity',
        async ({ directory, journal }) => {
          await journal.onCheckpoint(manualCheckpoint(1))
          await assert.rejects(
            createIncrementalLongMemEvalCheckpointJournal({
              directory,
              questionId: 'different-question',
              runId: 'run',
            }),
            (error) =>
              error?.code ===
                'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
          )
          await assert.rejects(
            createIncrementalLongMemEvalCheckpointJournal({
              directory,
              questionId: 'question',
              runId: 'different-run',
            }),
            (error) =>
              error?.code ===
                'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
          )
        },
      )
    })
  })

test('recovery rejects aggregate mutation, symlinks, and unsafe modes',
  async (t) => {
    async function withAggregate(name, callback) {
      const root = await privateRoot(`palari-aggregate-${name}-`)
      const directory = join(root, 'journal')
      try {
        const journal =
          await createIncrementalLongMemEvalCheckpointJournal({
            directory,
            questionId: 'question',
            runId: 'run',
          })
        await journal.onCheckpoint(manualCheckpoint(1))
        await callback({
          aggregatePath: journal.aggregatePath,
          journal,
          root,
        })
      } finally {
        await rm(root, { force: true, recursive: true })
      }
    }

    await t.test('content mutation', async () => {
      await withAggregate(
        'mutation',
        async ({ aggregatePath, journal }) => {
          const aggregate = JSON.parse(
            await readFile(aggregatePath, 'utf8'),
          )
          aggregate.lastReceiptSha256 = '0'.repeat(64)
          await writeFile(
            aggregatePath,
            `${JSON.stringify(aggregate, null, 2)}\n`,
          )
          await assert.rejects(
            journal.recover(),
            (error) =>
              error?.code ===
                'CHECKPOINT_JOURNAL_AGGREGATE_INVALID',
          )
        },
      )
    })

    await t.test('symlink', async () => {
      await withAggregate(
        'symlink',
        async ({ aggregatePath, journal, root }) => {
          const target = join(root, 'aggregate-target.json')
          await writeFile(target, '{}\n', { mode: 0o600 })
          await unlink(aggregatePath)
          await symlink(target, aggregatePath)
          await assert.rejects(
            journal.recover(),
            (error) =>
              error?.code === 'CHECKPOINT_JOURNAL_FILE_UNSAFE',
          )
        },
      )
    })

    await t.test('mode', async () => {
      await withAggregate(
        'mode',
        async ({ aggregatePath, journal }) => {
          await chmod(aggregatePath, 0o640)
          await assert.rejects(
            journal.recover(),
            (error) =>
              error?.code === 'CHECKPOINT_JOURNAL_FILE_UNSAFE',
          )
        },
      )
    })
  })
