import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 120_000
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length
}

function assertRequiredSymbols(source, requiredFunctions) {
  if (!Array.isArray(requiredFunctions) || requiredFunctions.length === 0) {
    throw new TypeError('At least one required function is required.')
  }
  const seen = new Set()
  for (const name of requiredFunctions) {
    if (typeof name !== 'string' || !IDENTIFIER.test(name) || seen.has(name)) {
      throw new TypeError('Required function names must be unique identifiers.')
    }
    seen.add(name)
    const escaped = escapeRegExp(name)
    const definitions = occurrences(
      source,
      new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\s*\\(`, 'gu'),
    )
    if (definitions !== 1) {
      throw new Error(
        `Generated runtime requires exactly one ${name} definition; found ${definitions}.`,
      )
    }
    const references = occurrences(
      source,
      new RegExp(`\\b${escaped}\\s*\\(`, 'gu'),
    )
    if (references < 2) {
      throw new Error(
        `Generated runtime retains no call to required function ${name}.`,
      )
    }
  }
}

function runChild(runtimePath, {
  args,
  maxOutputBytes,
  timeoutMs,
}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [runtimePath, ...args], {
      encoding: 'utf8',
      env: Object.freeze({ PALARI_GENERATED_RUNTIME_VERIFY: '1' }),
      maxBuffer: maxOutputBytes,
      timeout: timeoutMs,
    }, (error, stdout, stderr) => {
      if (error) {
        const reason = error.killed || error.code === 'ETIMEDOUT'
          ? 'timed out'
          : error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
            ? 'exceeded its output limit'
            : error.signal
              ? `terminated by signal ${error.signal}`
              : `exited nonzero (${String(error.code)})`
        reject(new Error(`Generated runtime verification ${reason}.`))
        return
      }
      resolve({ stderr, stdout })
    })
  })
}

function parseSuccessfulTelemetry(stdout, stderr, maxOutputBytes) {
  if (Buffer.byteLength(stdout) > maxOutputBytes ||
    Buffer.byteLength(stderr) > maxOutputBytes) {
    throw new Error('Generated runtime verification exceeded its output limit.')
  }
  if (stderr !== '') {
    throw new Error('Generated runtime verification emitted stderr.')
  }
  let report
  try {
    report = JSON.parse(stdout)
  } catch (error) {
    throw new TypeError('Generated runtime verification emitted invalid JSON.', {
      cause: error,
    })
  }
  if (!report || typeof report !== 'object' || Array.isArray(report) ||
    report.status !== 'passed' || !report.telemetry ||
    typeof report.telemetry !== 'object' || Array.isArray(report.telemetry)) {
    throw new Error('Generated runtime verification did not report a pass.')
  }
  for (const field of [
    'providerCalls',
    'credentialReads',
    'datasetReads',
    'resultWrites',
  ]) {
    if (report.telemetry[field] !== 0) {
      throw new Error(
        `Generated runtime verification reported nonzero ${field}.`,
      )
    }
  }
  return report
}

export async function verifyGeneratedRuntime({
  args = ['--offline-verify'],
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  requiredFunctions,
  runtimePath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof runtimePath !== 'string' || runtimePath.length === 0) {
    throw new TypeError('runtimePath is required.')
  }
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
    throw new TypeError('args must be an array of strings.')
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 256 ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Verification bounds are invalid.')
  }
  const source = await readFile(runtimePath, 'utf8')
  assertRequiredSymbols(source, requiredFunctions)
  const output = await runChild(runtimePath, {
    args,
    maxOutputBytes,
    timeoutMs,
  })
  return parseSuccessfulTelemetry(
    output.stdout,
    output.stderr,
    maxOutputBytes,
  )
}
