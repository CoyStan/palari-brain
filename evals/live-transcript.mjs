// Gitignored live-provider transcript recording.
//
// The recorder receives normalized provider bodies, never request headers or
// credentials. It durably creates one record before an attempt is forwarded,
// then atomically replaces that record with its terminal response/error data.

import { createHash } from 'node:crypto'
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const TRANSCRIPT_SCHEMA_VERSION = 1
const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type',
  'retry-after',
  'retry-after-ms',
  'x-should-retry',
  'x-request-id',
])
const FORBIDDEN_FIELD_NAMES = new Set([
  'access_token',
  'accesstoken',
  'api_key',
  'apikey',
  'authorization',
  'bearer',
  'headers',
  'openai_api_key',
  'openaiapikey',
  'proxy_authorization',
  'secret',
])
const DEFAULT_SECRET_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g,
  /\bBearer\s+[^\s"',}\\]+/gi,
]

export class LiveTranscriptError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'LiveTranscriptError'
    this.code = code
  }
}

export function transcriptSha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function transcriptFilename(attemptId) {
  const source = String(attemptId ?? '')
  if (!source) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_ATTEMPT_ID_MISSING',
      'Transcript attemptId must be a non-empty string.',
    )
  }
  const slug = source
    .replaceAll(/[^A-Za-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 72) || 'attempt'
  return `${slug}--${transcriptSha256(source).slice(0, 16)}.json`
}

function cloneJson(value, label) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_NOT_JSON_SAFE',
      `${label} must be JSON-serializable.`,
      { cause: error },
    )
  }
}

function normalizeSecrets(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value ?? ''))
      .filter(Boolean),
  )]
}

function containsSecret(text, secrets) {
  if (secrets.some((secret) => text.includes(secret))) return true
  return DEFAULT_SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
}

function assertSecretFree(text, secrets) {
  if (containsSecret(text, secrets)) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_SECRET_DETECTED',
      'Transcript data contained a forbidden credential-like value; nothing unsafe was written.',
    )
  }
}

function redactText(value, secrets) {
  if (value === undefined || value === null) return null
  let text = String(value)
  for (const secret of secrets) {
    text = text.replaceAll(secret, '[REDACTED_SECRET]')
  }
  for (const pattern of DEFAULT_SECRET_PATTERNS) {
    pattern.lastIndex = 0
    text = text.replace(pattern, '[REDACTED_SECRET]')
  }
  return text
}

function assertNoCredentialFields(value, label, seen = new Set()) {
  if (!value || typeof value !== 'object') return
  if (seen.has(value)) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_NOT_JSON_SAFE',
      `${label} must not contain circular references.`,
    )
  }
  seen.add(value)
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll('-', '_')
    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_CREDENTIAL_FIELD',
        `${label} cannot contain credential or request-header fields.`,
      )
    }
    assertNoCredentialFields(child, label, seen)
  }
  seen.delete(value)
}

function responseHeaders(headers) {
  if (!headers) return {}
  let entries
  if (typeof headers.entries === 'function') {
    entries = [...headers.entries()]
  } else if (Array.isArray(headers)) {
    entries = headers
  } else if (typeof headers === 'object') {
    entries = Object.entries(headers)
  } else {
    throw new LiveTranscriptError(
      'TRANSCRIPT_BAD_HEADERS',
      'Response headers must be a Headers instance, entry array, or object.',
    )
  }
  const kept = new Map()
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const name = String(entry[0]).toLowerCase()
    if (!ALLOWED_RESPONSE_HEADERS.has(name) && !name.startsWith('x-ratelimit-')) {
      continue
    }
    const raw = entry[1]
    const value = Array.isArray(raw)
      ? raw.map((part) => String(part)).join(', ')
      : String(raw)
    kept.set(name, value)
  }
  return Object.fromEntries([...kept.entries()].sort(([left], [right]) =>
    left.localeCompare(right)))
}

function safeError(error, secrets, { includeStack = true } = {}) {
  if (!error) return null
  const safe = {
    code: redactText(error.code, secrets),
    message: redactText(error.message, secrets),
    name: redactText(error.name, secrets),
    stack: includeStack ? redactText(error.stack, secrets) : null,
  }
  if (error.cause && error.cause !== error) {
    safe.cause = safeError(error.cause, secrets, { includeStack: false })
  }
  return safe
}

function isoTimestamp(value, label) {
  const text = String(value ?? '')
  if (!text || Number.isNaN(Date.parse(text))) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_BAD_TIMESTAMP',
      `${label} must be an ISO-compatible timestamp.`,
    )
  }
  return text
}

function serializeRecord(record, secrets) {
  const text = `${JSON.stringify(record, null, 2)}\n`
  assertSecretFree(text, secrets)
  return text
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function createDurableExclusive(path, text) {
  const handle = await open(path, 'wx', 0o600).catch((error) => {
    if (error?.code === 'EEXIST') {
      throw new LiveTranscriptError(
        'TRANSCRIPT_EXISTS',
        'A transcript already exists for this provider attempt.',
        { cause: error },
      )
    }
    throw error
  })
  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await syncDirectory(dirname(path))
}

async function atomicReplace(path, text) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporary, path)
    await syncDirectory(dirname(path))
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    throw error
  }
}

function terminalResponse({
  bodyUnavailable = false,
  finishReason,
  rawBody,
  headers,
  status,
  usage,
}) {
  if (rawBody === null || rawBody === undefined) {
    if (status !== null && status !== undefined) {
      if (!bodyUnavailable ||
        !Number.isSafeInteger(status) ||
        status < 100 ||
        status > 599) {
        throw new LiveTranscriptError(
          'TRANSCRIPT_RESPONSE_BODY_MISSING',
          'A provider HTTP status requires its exact raw response body unless transport failed.',
        )
      }
      return {
        bodyAvailable: false,
        bodyBytes: null,
        bodySha256: null,
        finishReason: null,
        headers: responseHeaders(headers),
        rawBody: null,
        status,
        usage: null,
      }
    }
    return null
  }
  if (typeof rawBody !== 'string') {
    throw new LiveTranscriptError(
      'TRANSCRIPT_BAD_RESPONSE_BODY',
      'Provider raw response body must be an exact UTF-8 string.',
    )
  }
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_BAD_STATUS',
      'Provider response status must be an HTTP status integer.',
    )
  }
  let parsed = null
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    // The exact raw body is still valuable when a provider returns non-JSON.
  }
  const observedUsage = usage === undefined
    ? parsed?.usage ?? null
    : usage
  const observedFinishReason = finishReason === undefined
    ? parsed?.choices?.[0]?.finish_reason ?? null
    : finishReason
  return {
    bodyAvailable: true,
    bodyBytes: Buffer.byteLength(rawBody),
    bodySha256: transcriptSha256(rawBody),
    finishReason: observedFinishReason === null
      ? null
      : cloneJson(observedFinishReason, 'finishReason'),
    headers: responseHeaders(headers),
    rawBody,
    status,
    usage: observedUsage === null
      ? null
      : cloneJson(observedUsage, 'usage'),
  }
}

export async function createLiveTranscriptRecorder({
  directory,
  forbiddenSecrets = [],
  now = () => new Date().toISOString(),
} = {}) {
  if (!directory) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_DIRECTORY_MISSING',
      'A transcript directory is required.',
    )
  }
  if (typeof now !== 'function') {
    throw new LiveTranscriptError(
      'TRANSCRIPT_CLOCK_INVALID',
      'Transcript clock must be a function.',
    )
  }
  const root = resolve(directory)
  const secrets = normalizeSecrets(forbiddenSecrets)
  await mkdir(root, { recursive: true, mode: 0o700 })

  return {
    directory: root,

    async beginAttempt({
      attempt,
      attemptId,
      cellId,
      endpoint,
      metadata = {},
      model,
      normalizedRequestBody,
      operationId,
      purpose,
      requestBytes,
      settings = {},
      startedAt = now(),
    } = {}) {
      if (!Number.isSafeInteger(attempt) || attempt < 1) {
        throw new LiveTranscriptError(
          'TRANSCRIPT_BAD_ATTEMPT',
          'Transcript attempt must be a positive integer.',
        )
      }
      for (const [label, value] of Object.entries({
        attemptId,
        cellId,
        endpoint,
        model,
        operationId,
        purpose,
      })) {
        if (typeof value !== 'string' || value.length === 0) {
          throw new LiveTranscriptError(
            'TRANSCRIPT_METADATA_MISSING',
            `Transcript ${label} must be a non-empty string.`,
          )
        }
      }
      if (typeof normalizedRequestBody !== 'string') {
        throw new LiveTranscriptError(
          'TRANSCRIPT_BAD_REQUEST_BODY',
          'Normalized request body must be an exact UTF-8 string.',
        )
      }
      assertNoCredentialFields(metadata, 'Transcript metadata')
      assertNoCredentialFields(settings, 'Transcript settings')
      const bodyBytes = Buffer.byteLength(normalizedRequestBody)
      if (requestBytes !== undefined && requestBytes !== bodyBytes) {
        throw new LiveTranscriptError(
          'TRANSCRIPT_REQUEST_BYTES_MISMATCH',
          'Supplied request byte count differs from the exact normalized body.',
        )
      }
      const record = {
        attempt: {
          attempt,
          attemptId,
          cellId,
          endpoint,
          metadata: cloneJson(metadata, 'metadata'),
          operationId,
          purpose,
        },
        request: {
          bodyBytes,
          bodySha256: transcriptSha256(normalizedRequestBody),
          model,
          normalizedBody: normalizedRequestBody,
          settings: cloneJson(settings, 'settings'),
        },
        schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
        startedAt: isoTimestamp(startedAt, 'startedAt'),
        state: 'started',
      }
      const initialText = serializeRecord(record, secrets)
      const transcriptFile = transcriptFilename(attemptId)
      const transcriptPath = join(root, transcriptFile)
      await createDurableExclusive(transcriptPath, initialText)
      const initialSha256 = transcriptSha256(initialText)
      let finished = false

      return {
        transcriptFile,
        transcriptPath,
        transcriptSha256: initialSha256,

        async finish({
          completedAt = now(),
          finishReason,
          outcome,
          rawBody = null,
          responseHeaders: headers,
          status = null,
          transportError = null,
          usage,
        } = {}) {
          if (finished) {
            throw new LiveTranscriptError(
              'TRANSCRIPT_ALREADY_TERMINAL',
              'A provider-attempt transcript can become terminal only once.',
            )
          }
          if (typeof outcome !== 'string' || outcome.length === 0) {
            throw new LiveTranscriptError(
              'TRANSCRIPT_OUTCOME_MISSING',
              'Transcript terminal outcome must be a non-empty string.',
            )
          }
          const existingText = await readFile(transcriptPath, 'utf8')
          if (transcriptSha256(existingText) !== initialSha256) {
            throw new LiveTranscriptError(
              'TRANSCRIPT_CHANGED',
              'The durable pre-call transcript changed before terminal recording.',
            )
          }
          const terminalRecord = {
            ...record,
            completedAt: isoTimestamp(completedAt, 'completedAt'),
            state: 'terminal',
            startedRecordSha256: initialSha256,
            terminal: {
              outcome,
              response: terminalResponse({
                bodyUnavailable: Boolean(transportError),
                finishReason,
                rawBody,
                headers,
                status,
                usage,
              }),
              transportError: safeError(transportError, secrets),
            },
          }
          const terminalText = serializeRecord(terminalRecord, secrets)
          await atomicReplace(transcriptPath, terminalText)
          finished = true
          return {
            transcriptFile,
            transcriptPath,
            transcriptSha256: transcriptSha256(terminalText),
          }
        },
      }
    },
  }
}

export async function verifyLiveTranscriptArtifacts({
  directory,
  journalPath,
} = {}) {
  if (!directory || !journalPath) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_VERIFICATION_INPUT_MISSING',
      'Transcript verification requires a directory and meter journal.',
    )
  }
  const root = resolve(directory)
  let journalText
  try {
    journalText = await readFile(journalPath, 'utf8')
  } catch (error) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_METER_MISSING',
      'Transcript verification could not read the meter journal.',
      { cause: error },
    )
  }
  const starts = new Map()
  const terminals = new Map()
  const lines = journalText.split('\n').filter(Boolean)
  for (let index = 0; index < lines.length; index += 1) {
    let event
    try {
      event = JSON.parse(lines[index])
    } catch (error) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_BAD_METER',
        'Transcript verification found invalid meter JSON.',
        { cause: error },
      )
    }
    if (event.sequence !== index + 1 || typeof event.attemptId !== 'string') {
      throw new LiveTranscriptError(
        'TRANSCRIPT_BAD_METER',
        'Transcript verification found invalid meter sequencing.',
      )
    }
    if (event.type === 'attempt_started') {
      if (starts.has(event.attemptId) ||
        event.transcriptFile !== transcriptFilename(event.attemptId) ||
        !/^[a-f0-9]{64}$/.test(event.transcriptStartedSha256 ?? '') ||
        !/^[a-f0-9]{64}$/.test(event.requestSha256 ?? '')) {
        throw new LiveTranscriptError(
          'TRANSCRIPT_METER_LINK_MISMATCH',
          'A meter start lacks one valid transcript link.',
        )
      }
      starts.set(event.attemptId, event)
      continue
    }
    if (event.type !== 'attempt_terminal' ||
      terminals.has(event.attemptId) ||
      !/^[a-f0-9]{64}$/.test(event.transcriptSha256 ?? '')) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_METER_LINK_MISMATCH',
        'A meter terminal lacks one valid transcript link.',
      )
    }
    terminals.set(event.attemptId, event)
  }
  if (starts.size !== terminals.size) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_TERMINAL_MISSING',
      'Every metered attempt must have one terminal transcript.',
    )
  }

  let actualFiles
  try {
    actualFiles = (await readdir(root)).sort()
  } catch (error) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_DIRECTORY_MISSING',
      'Transcript verification could not read the transcript directory.',
      { cause: error },
    )
  }
  const expectedFiles = [...starts.values()]
    .map((event) => event.transcriptFile)
    .sort()
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new LiveTranscriptError(
      'TRANSCRIPT_SET_MISMATCH',
      'Transcript directory has missing or extra files.',
    )
  }

  const verified = []
  for (const [attemptId, start] of starts) {
    const terminal = terminals.get(attemptId)
    if (!terminal ||
      terminal.transcriptFile !== start.transcriptFile ||
      terminal.requestSha256 !== start.requestSha256) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_METER_LINK_MISMATCH',
        'Meter start and terminal transcript links differ.',
      )
    }
    const path = join(root, start.transcriptFile)
    const [metadata, text] = await Promise.all([
      stat(path),
      readFile(path, 'utf8'),
    ])
    if (!metadata.isFile() || (metadata.mode & 0o777) !== 0o600) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_MODE_MISMATCH',
        'Every transcript must be one regular mode-0600 file.',
      )
    }
    const fileSha256 = transcriptSha256(text)
    if (fileSha256 !== terminal.transcriptSha256) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_HASH_MISMATCH',
        'A transcript file differs from its terminal meter hash.',
      )
    }
    let record
    try {
      record = JSON.parse(text)
    } catch (error) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_BAD_JSON',
        'A transcript file is not valid JSON.',
        { cause: error },
      )
    }
    if (record.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION ||
      record.state !== 'terminal' ||
      record.attempt?.attemptId !== attemptId ||
      record.attempt?.attempt !== start.attempt ||
      record.attempt?.cellId !== start.cellId ||
      record.attempt?.endpoint !== start.endpoint ||
      record.attempt?.operationId !== start.operationId ||
      record.attempt?.purpose !== start.purpose ||
      record.request?.bodySha256 !== start.requestSha256 ||
      record.startedRecordSha256 !== start.transcriptStartedSha256 ||
      record.terminal?.outcome !== terminal.outcome) {
      throw new LiveTranscriptError(
        'TRANSCRIPT_RECORD_MISMATCH',
        'A transcript record differs from its meter attempt.',
      )
    }
    verified.push({
      attemptId,
      file: start.transcriptFile,
      sha256: fileSha256,
    })
  }
  verified.sort((left, right) => left.attemptId.localeCompare(right.attemptId))
  return {
    attempts: verified.length,
    setSha256: transcriptSha256(JSON.stringify(verified)),
    verified,
  }
}
