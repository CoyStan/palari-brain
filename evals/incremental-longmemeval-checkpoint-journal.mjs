// Successor-only durable checkpoint journal for incremental LongMemEval.
//
// Each completed interaction gets one write-once receipt before the aggregate
// checkpoint is replaced. A failed aggregate replacement therefore cannot
// erase proof that the interaction completed. Importing this module is inert.

import { createHash, randomUUID } from 'node:crypto'
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export const INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA =
  'palari-incremental-checkpoint-receipt/v1'
export const INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA =
  'palari-incremental-checkpoint-aggregate/v1'
export const INCREMENTAL_CHECKPOINT_AGGREGATE_FILENAME =
  'checkpoint.json'

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const RECEIPT_PATTERN =
  /^interaction-(\d{6})\.receipt\.json$/
const RECEIPT_PUBLICATION_TEMP_PATTERN =
  /^\.(interaction-(\d{6})\.receipt\.json)\.(\d+)\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.tmp$/

export class IncrementalCheckpointJournalError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'IncrementalCheckpointJournalError'
    this.code = code
  }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function jsonClone(value, label) {
  try {
    const encoded = JSON.stringify(value)
    if (encoded === undefined) throw new TypeError('not JSON')
    return JSON.parse(encoded)
  } catch (cause) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_INPUT_INVALID',
      `${label} must be finite JSON data.`,
      { cause },
    )
  }
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_INPUT_INVALID',
      `Checkpoint journal requires a non-empty ${label}.`,
    )
  }
  return text
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const actual = Object.keys(value).sort()
  return JSON.stringify(actual) ===
    JSON.stringify([...expected].sort())
}

function permissionBits(metadata) {
  return metadata.mode & 0o777
}

async function metadataOrNull(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function ensurePrivateDirectory(path) {
  const before = await metadataOrNull(path)
  if (!before) {
    await mkdir(path, {
      mode: PRIVATE_DIRECTORY_MODE,
      recursive: true,
    })
  }
  const metadata = await lstat(path)
  if (metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    permissionBits(metadata) !== PRIVATE_DIRECTORY_MODE) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_DIRECTORY_UNSAFE',
      'Checkpoint journal directory must be one mode-0700 non-symlink directory.',
    )
  }
}

function assertPrivateFileMetadata(metadata, label) {
  if (metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.nlink !== 1 ||
    permissionBits(metadata) !== PRIVATE_FILE_MODE) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_FILE_UNSAFE',
      `${label} must be one mode-0600 regular non-symlink file.`,
    )
  }
}

function publicationTempReceiptName(name) {
  const match = RECEIPT_PUBLICATION_TEMP_PATTERN.exec(name)
  if (!match) return null
  const ordinal = Number(match[2])
  if (match[1] !== incrementalCheckpointReceiptFilename(ordinal)) {
    return null
  }
  return match[1]
}

async function interruptedReceiptPublication({
  directory,
  metadata,
  publicationTemps,
  receiptName,
}) {
  if (metadata.nlink === 1) {
    assertPrivateFileMetadata(
      metadata,
      `Checkpoint receipt ${receiptName}`,
    )
    return null
  }
  const candidates = publicationTemps.filter((entry) =>
    entry.receiptName === receiptName)
  if (metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.nlink !== 2 ||
    permissionBits(metadata) !== PRIVATE_FILE_MODE ||
    candidates.length !== 1) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_FILE_UNSAFE',
      `Checkpoint receipt ${receiptName} has an unowned hard link.`,
    )
  }
  const [candidate] = candidates
  const temporaryPath = join(directory, candidate.name)
  const temporaryMetadata = await lstat(temporaryPath)
  if (temporaryMetadata.isSymbolicLink() ||
    !temporaryMetadata.isFile() ||
    temporaryMetadata.nlink !== 2 ||
    permissionBits(temporaryMetadata) !== PRIVATE_FILE_MODE ||
    temporaryMetadata.dev !== metadata.dev ||
    temporaryMetadata.ino !== metadata.ino) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_FILE_UNSAFE',
      `Checkpoint receipt ${receiptName} has an invalid publication link.`,
    )
  }
  return {
    candidate,
    temporaryPath,
  }
}

async function adoptInterruptedReceiptPublication({
  directory,
  interruptedPublication,
  path,
  receiptName,
}) {
  if (!interruptedPublication) return
  const { candidate, temporaryPath } = interruptedPublication
  await unlink(temporaryPath)
  await syncDirectory(directory)
  const adoptedMetadata = await lstat(path)
  assertPrivateFileMetadata(
    adoptedMetadata,
    `Checkpoint receipt ${receiptName}`,
  )
  candidate.adopted = true
}

async function assertExactPrivateFile(path, expectedText, label) {
  const metadata = await lstat(path)
  assertPrivateFileMetadata(metadata, label)
  const actualText = await readFile(path, 'utf8')
  if (actualText !== expectedText) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_WRITE_INVALID',
      `${label} writer did not persist the exact requested bytes.`,
    )
  }
}

export function incrementalCheckpointReceiptFilename(ordinal) {
  if (!Number.isSafeInteger(ordinal) ||
    ordinal < 1 ||
    ordinal > 999_999) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_ORDINAL_INVALID',
      'Checkpoint receipt ordinal must be an integer from 1 through 999999.',
    )
  }
  return `interaction-${String(ordinal).padStart(6, '0')}.receipt.json`
}

// The hard link publishes a fully written, fsynced temporary file at a path
// that can never replace an existing receipt.
export async function writeImmutableIncrementalCheckpointReceipt(
  path,
  text,
) {
  const parent = dirname(path)
  await ensurePrivateDirectory(parent)
  if (await metadataOrNull(path)) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_RECEIPT_EXISTS',
      'Checkpoint receipts are immutable and cannot be replaced.',
    )
  }
  const temporary = join(
    parent,
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  )
  let handle
  let published = false
  try {
    handle = await open(temporary, 'wx', PRIVATE_FILE_MODE)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await link(temporary, path)
    published = true
    await unlink(temporary)
    await syncDirectory(parent)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    // Once link() succeeds, preserving the complete receipt is safer than
    // rolling it back. Recovery can validate and adopt it.
    if (published) {
      await syncDirectory(parent).catch(() => {})
    }
    throw error
  }
}

export async function atomicReplaceIncrementalCheckpointAggregate(
  path,
  text,
) {
  const parent = dirname(path)
  await ensurePrivateDirectory(parent)
  const current = await metadataOrNull(path)
  if (current) {
    assertPrivateFileMetadata(current, 'Checkpoint aggregate')
  }
  const temporary = join(
    parent,
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  )
  let handle
  try {
    handle = await open(temporary, 'wx', PRIVATE_FILE_MODE)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporary, path)
    await syncDirectory(parent)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    throw error
  }
}

function receiptPayload({
  checkpoint,
  ordinal,
  previousReceiptSha256,
  questionId,
  runId,
}) {
  const checkpointSha256 = sha256(JSON.stringify(checkpoint))
  return {
    checkpoint,
    checkpointSha256,
    ordinal,
    previousReceiptSha256,
    questionId,
    runId,
    schemaVersion: INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA,
  }
}

function receiptRecord(payload) {
  return {
    payload,
    payloadSha256: sha256(JSON.stringify(payload)),
  }
}

function receiptEntry(record, filename, text) {
  return {
    checkpoint: record.payload.checkpoint,
    checkpointSha256: record.payload.checkpointSha256,
    filename,
    ordinal: record.payload.ordinal,
    receiptSha256: sha256(text),
  }
}

function aggregateFor(entries, { questionId, runId }) {
  return {
    checkpoints: entries.map((entry) => entry.checkpoint),
    completedInteraction: entries.length,
    lastReceiptSha256:
      entries.length ? entries.at(-1).receiptSha256 : null,
    questionId,
    receiptManifest: entries.map((entry) => ({
      checkpointSha256: entry.checkpointSha256,
      filename: entry.filename,
      ordinal: entry.ordinal,
      receiptSha256: entry.receiptSha256,
    })),
    runId,
    schemaVersion: INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA,
  }
}

function validateCheckpoint(checkpoint, expectedOrdinal) {
  if (!checkpoint ||
    typeof checkpoint !== 'object' ||
    Array.isArray(checkpoint) ||
    checkpoint.status !== 'completed' ||
    checkpoint.completedInteraction !== expectedOrdinal ||
    checkpoint.unitOrder !== expectedOrdinal ||
    !Number.isSafeInteger(checkpoint.interactionCount) ||
    checkpoint.interactionCount < expectedOrdinal) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_CHECKPOINT_INVALID',
      `Checkpoint ${expectedOrdinal} is not one completed interaction.`,
    )
  }
}

function validateReceiptRecord(
  record,
  {
    expectedOrdinal,
    expectedPreviousSha256,
    filename,
    questionId,
    runId,
    text,
  },
) {
  if (!exactKeys(record, ['payload', 'payloadSha256']) ||
    !exactKeys(record.payload, [
      'checkpoint',
      'checkpointSha256',
      'ordinal',
      'previousReceiptSha256',
      'questionId',
      'runId',
      'schemaVersion',
    ])) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
      `${filename} has an invalid receipt shape.`,
    )
  }
  const payload = record.payload
  validateCheckpoint(payload.checkpoint, expectedOrdinal)
  const expectedPayload = receiptPayload({
    checkpoint: payload.checkpoint,
    ordinal: expectedOrdinal,
    previousReceiptSha256: expectedPreviousSha256,
    questionId,
    runId,
  })
  const expectedRecord = receiptRecord(expectedPayload)
  if (payload.schemaVersion !==
      INCREMENTAL_CHECKPOINT_RECEIPT_SCHEMA ||
    payload.runId !== runId ||
    payload.questionId !== questionId ||
    payload.ordinal !== expectedOrdinal ||
    payload.previousReceiptSha256 !== expectedPreviousSha256 ||
    payload.checkpointSha256 !==
      expectedPayload.checkpointSha256 ||
    record.payloadSha256 !== expectedRecord.payloadSha256 ||
    text !== jsonText(expectedRecord)) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
      `${filename} failed identity, ordinal, hash-link, or byte validation.`,
    )
  }
  return expectedRecord
}

async function readReceiptEntries(directory, identity) {
  const names = await readdir(directory)
  const receiptNames = []
  const publicationTemps = []
  for (const name of names) {
    const receiptName = publicationTempReceiptName(name)
    if (receiptName) {
      publicationTemps.push({
        adopted: false,
        name,
        receiptName,
      })
      continue
    }
    if (name.startsWith('.interaction-')) {
      throw new IncrementalCheckpointJournalError(
        'CHECKPOINT_JOURNAL_FILE_UNSAFE',
        `Checkpoint journal contains unowned publication file ${name}.`,
      )
    }
    if (!name.startsWith('interaction-')) continue
    const match = RECEIPT_PATTERN.exec(name)
    if (!match) {
      throw new IncrementalCheckpointJournalError(
        'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
        `Checkpoint journal contains malformed receipt name ${name}.`,
      )
    }
    receiptNames.push({
      name,
      ordinal: Number(match[1]),
    })
  }
  receiptNames.sort((left, right) => left.ordinal - right.ordinal)

  const entries = []
  let previousReceiptSha256 = null
  for (let index = 0; index < receiptNames.length; index += 1) {
    const expectedOrdinal = index + 1
    const { name, ordinal } = receiptNames[index]
    if (ordinal !== expectedOrdinal ||
      name !== incrementalCheckpointReceiptFilename(expectedOrdinal)) {
      throw new IncrementalCheckpointJournalError(
        'CHECKPOINT_JOURNAL_ORDINAL_INVALID',
        'Checkpoint receipt ordinals must be strictly contiguous from one.',
      )
    }
    const path = join(directory, name)
    const metadata = await lstat(path)
    const interruptedPublication =
      await interruptedReceiptPublication({
        directory,
        metadata,
        publicationTemps,
        receiptName: name,
      })
    const text = await readFile(path, 'utf8')
    let record
    try {
      record = JSON.parse(text)
    } catch (cause) {
      throw new IncrementalCheckpointJournalError(
        'CHECKPOINT_JOURNAL_RECEIPT_INVALID',
        `${name} is not valid JSON.`,
        { cause },
      )
    }
    const validated = validateReceiptRecord(record, {
      expectedOrdinal,
      expectedPreviousSha256: previousReceiptSha256,
      filename: name,
      ...identity,
      text,
    })
    await adoptInterruptedReceiptPublication({
      directory,
      interruptedPublication,
      path,
      receiptName: name,
    })
    const entry = receiptEntry(validated, name, text)
    entries.push(entry)
    previousReceiptSha256 = entry.receiptSha256
  }
  const unownedTemp = publicationTemps.find((entry) => !entry.adopted)
  if (unownedTemp) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_FILE_UNSAFE',
      `Checkpoint journal contains unowned publication file ${unownedTemp.name}.`,
    )
  }
  return entries
}

async function readAggregate(path, entries, identity) {
  const metadata = await metadataOrNull(path)
  if (!metadata) return null
  assertPrivateFileMetadata(metadata, 'Checkpoint aggregate')
  const text = await readFile(path, 'utf8')
  let aggregate
  try {
    aggregate = JSON.parse(text)
  } catch (cause) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_AGGREGATE_INVALID',
      'Checkpoint aggregate is not valid JSON.',
      { cause },
    )
  }
  if (!exactKeys(aggregate, [
    'checkpoints',
    'completedInteraction',
    'lastReceiptSha256',
    'questionId',
    'receiptManifest',
    'runId',
    'schemaVersion',
  ]) ||
    aggregate.schemaVersion !==
      INCREMENTAL_CHECKPOINT_AGGREGATE_SCHEMA ||
    aggregate.runId !== identity.runId ||
    aggregate.questionId !== identity.questionId ||
    !Number.isSafeInteger(aggregate.completedInteraction) ||
    aggregate.completedInteraction < 0 ||
    aggregate.completedInteraction > entries.length) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_AGGREGATE_INVALID',
      'Checkpoint aggregate failed identity or ordinal validation.',
    )
  }
  const expected = aggregateFor(
    entries.slice(0, aggregate.completedInteraction),
    identity,
  )
  if (text !== jsonText(expected)) {
    throw new IncrementalCheckpointJournalError(
      'CHECKPOINT_JOURNAL_AGGREGATE_INVALID',
      'Checkpoint aggregate differs from its immutable receipt prefix.',
    )
  }
  return aggregate
}

export async function createIncrementalLongMemEvalCheckpointJournal({
  aggregateWriter =
    atomicReplaceIncrementalCheckpointAggregate,
  directory,
  questionId,
  receiptWriter =
    writeImmutableIncrementalCheckpointReceipt,
  runId,
} = {}) {
  if (typeof directory !== 'string' || !directory ||
    typeof aggregateWriter !== 'function' ||
    typeof receiptWriter !== 'function') {
    throw new TypeError(
      'Checkpoint journal requires a directory and writer functions.',
    )
  }
  const identity = {
    questionId: nonEmpty(questionId, 'questionId'),
    runId: nonEmpty(runId, 'runId'),
  }
  await ensurePrivateDirectory(directory)
  const aggregatePath = join(
    directory,
    INCREMENTAL_CHECKPOINT_AGGREGATE_FILENAME,
  )
  let entries = []
  let terminalError = null

  async function persistAggregate(aggregate) {
    const text = jsonText(aggregate)
    await aggregateWriter(aggregatePath, text)
    await assertExactPrivateFile(
      aggregatePath,
      text,
      'Checkpoint aggregate',
    )
  }

  async function recover() {
    await ensurePrivateDirectory(directory)
    const recoveredEntries =
      await readReceiptEntries(directory, identity)
    const existing = await readAggregate(
      aggregatePath,
      recoveredEntries,
      identity,
    )
    const recovered = aggregateFor(recoveredEntries, identity)
    if (!existing ||
      existing.completedInteraction !==
        recovered.completedInteraction) {
      if (recoveredEntries.length) {
        await persistAggregate(recovered)
      }
    }
    entries = recoveredEntries
    return structuredClone(recovered)
  }

  await recover()

  async function onCheckpoint(checkpoint) {
    if (terminalError) {
      throw new IncrementalCheckpointJournalError(
        'CHECKPOINT_JOURNAL_TERMINAL',
        'Checkpoint journal cannot append after a failed write.',
        { cause: terminalError },
      )
    }
    const ordinal = entries.length + 1
    let cleanCheckpoint
    try {
      cleanCheckpoint = jsonClone(checkpoint, 'Checkpoint')
      validateCheckpoint(cleanCheckpoint, ordinal)
      const previousReceiptSha256 =
        entries.length ? entries.at(-1).receiptSha256 : null
      const payload = receiptPayload({
        checkpoint: cleanCheckpoint,
        ordinal,
        previousReceiptSha256,
        ...identity,
      })
      const record = receiptRecord(payload)
      const text = jsonText(record)
      const filename = incrementalCheckpointReceiptFilename(ordinal)
      const path = join(directory, filename)
      await receiptWriter(path, text)
      await assertExactPrivateFile(
        path,
        text,
        `Checkpoint receipt ${filename}`,
      )
      const entry = receiptEntry(record, filename, text)
      entries.push(entry)
      await persistAggregate(aggregateFor(entries, identity))
    } catch (error) {
      terminalError = error
      throw error
    }
  }

  return Object.freeze({
    aggregatePath,
    directory,
    onCheckpoint,
    questionId: identity.questionId,
    recover,
    runId: identity.runId,
    snapshot() {
      return structuredClone(aggregateFor(entries, identity))
    },
  })
}
