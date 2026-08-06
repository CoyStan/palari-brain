import { createHash, randomUUID } from 'node:crypto'
import { lstat, open, readFile, realpath, unlink } from 'node:fs/promises'
import { execFile, spawnSync } from 'node:child_process'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 120_000
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u
const STATIC_IMPORT_PARSER = String.raw`
import { SourceTextModule } from 'node:vm'
let source = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) source += chunk
const module = new SourceTextModule(source)
console.log(JSON.stringify(module.moduleRequests.map(({ specifier }) => specifier)))
`

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function staticSpecifiers(source, path) {
  const parsed = spawnSync(process.execPath, [
    '--experimental-vm-modules',
    '--input-type=module',
    '--eval',
    STATIC_IMPORT_PARSER,
  ], {
    encoding: 'utf8',
    env: Object.freeze({ NODE_NO_WARNINGS: '1' }),
    input: source,
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  })
  if (parsed.error || parsed.status !== 0 || parsed.signal || parsed.stderr) {
    throw new Error(`Could not parse static module imports for ${path}.`)
  }
  let specifiers
  try {
    specifiers = JSON.parse(parsed.stdout)
  } catch (error) {
    throw new TypeError(`Static import parser returned invalid JSON for ${path}.`, {
      cause: error,
    })
  }
  if (!Array.isArray(specifiers) ||
    specifiers.some((value) => typeof value !== 'string')) {
    throw new TypeError(`Static import parser returned invalid paths for ${path}.`)
  }
  return specifiers
}

function inside(root, path, label) {
  const suffix = relative(root, path)
  if (suffix === '' || suffix === '..' || suffix.startsWith(`..${sep}`) ||
    isAbsolute(suffix)) {
    throw new TypeError(`${label} must stay strictly inside root.`)
  }
  return suffix.split(sep).join('/')
}

export async function hashStaticModuleClosure({ entryPaths, root } = {}) {
  if (typeof root !== 'string' || !isAbsolute(root) ||
    !Array.isArray(entryPaths) || entryPaths.length === 0 ||
    entryPaths.some((path) => typeof path !== 'string' || !isAbsolute(path))) {
    throw new TypeError('An absolute root and absolute entryPaths are required.')
  }
  const canonicalRoot = await realpath(root)
  const pending = [...new Set(entryPaths.map((path) => resolve(path)))]
  const visited = new Map()
  const externalSpecifiers = new Set()
  while (pending.length > 0) {
    pending.sort()
    const path = pending.shift()
    const relativePath = inside(canonicalRoot, path, 'Module path')
    if (visited.has(relativePath)) continue
    const metadata = await lstat(path)
    const canonicalPath = await realpath(path)
    if (!metadata.isFile() || metadata.isSymbolicLink() ||
      inside(canonicalRoot, canonicalPath, 'Canonical module path') !==
        relativePath) {
      throw new TypeError(`Module closure path is not a regular owned file: ${path}`)
    }
    const bytes = await readFile(path)
    const source = bytes.toString('utf8')
    visited.set(relativePath, { bytes, path: relativePath })
    for (const specifier of staticSpecifiers(source, relativePath)) {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const dependency = resolve(dirname(path), specifier)
        inside(canonicalRoot, dependency, 'Static module dependency')
        pending.push(dependency)
      } else {
        externalSpecifiers.add(specifier)
      }
    }
  }
  const modules = [...visited.values()].sort((left, right) =>
    left.path.localeCompare(right.path)).map(({ bytes, path }) => ({
    bytes: bytes.length,
    path,
    sha256: sha256(bytes),
  }))
  const hash = createHash('sha256')
  hash.update('palari-static-module-closure-v1\0')
  for (const module of modules) {
    hash.update(`${module.path}\0${module.bytes}\0${module.sha256}\0`)
  }
  const externals = [...externalSpecifiers].sort()
  for (const specifier of externals) hash.update(`external\0${specifier}\0`)
  return Object.freeze({
    bytes: modules.reduce((sum, module) => sum + module.bytes, 0),
    externalSpecifiers: Object.freeze(externals),
    files: modules.length,
    modules: Object.freeze(modules.map(Object.freeze)),
    root: canonicalRoot,
    sha256: hash.digest('hex'),
  })
}

const ONE_SHOT_TRANSITIONS = Object.freeze({
  absent: 'reserved',
  launched: 'consumed',
  reserved: 'launched',
})

export function assertOneShotAttemptTransition(current, next) {
  if (ONE_SHOT_TRANSITIONS[current] !== next) {
    throw new Error(`Invalid one-shot attempt transition: ${current} -> ${next}.`)
  }
  return next
}

function assertRequiredFunctionNames(requiredFunctions) {
  if (!Array.isArray(requiredFunctions) || requiredFunctions.length === 0) {
    throw new TypeError('At least one required function is required.')
  }
  const seen = new Set()
  for (const name of requiredFunctions) {
    if (typeof name !== 'string' || !IDENTIFIER.test(name) || seen.has(name)) {
      throw new TypeError('Required function names must be unique identifiers.')
    }
    seen.add(name)
  }
}

async function instrumentRuntime(runtimePath, source, requiredFunctions) {
  const nonce = randomUUID()
  const prefix = `PALARI_RUNTIME_SYMBOLS:${nonce}:`
  const declarations = requiredFunctions.map((name) =>
    `[${JSON.stringify(name)}, typeof ${name} === 'function']`).join(',\n  ')
  const instrumented = `${source}\n` +
    `console.log(${JSON.stringify(prefix)} + JSON.stringify({\n` +
    `  requiredFunctions: [\n  ${declarations}\n  ],\n` +
    `  status: 'structural-pass',\n` +
    `}))\n`
  const directory = dirname(resolve(runtimePath))
  const path = join(
    directory,
    `.${basename(runtimePath)}.palari-verify-${nonce}.mjs`,
  )
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(instrumented, 'utf8')
  } finally {
    await handle.close()
  }
  return { path, prefix }
}

function runChild(runtimePath, {
  args,
  maxOutputBytes,
  timeoutMs,
}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [runtimePath, ...args], {
      encoding: 'utf8',
      env: Object.freeze({
        NODE_NO_WARNINGS: '1',
        PALARI_GENERATED_RUNTIME_VERIFY: '1',
      }),
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

function parseSuccessfulTelemetry(
  stdout,
  stderr,
  maxOutputBytes,
  prefix,
  requiredFunctions,
) {
  if (Buffer.byteLength(stdout) > maxOutputBytes ||
    Buffer.byteLength(stderr) > maxOutputBytes) {
    throw new Error('Generated runtime verification exceeded its output limit.')
  }
  if (stderr !== '') {
    throw new Error('Generated runtime verification emitted stderr.')
  }
  const marker = `\n${prefix}`
  const markerIndex = stdout.lastIndexOf(marker)
  if (markerIndex < 0 || stdout.indexOf(marker) !== markerIndex) {
    throw new Error('Generated runtime structural evidence is missing.')
  }
  const reportText = stdout.slice(0, markerIndex).trim()
  const structuralText = stdout.slice(markerIndex + marker.length).trim()
  let report
  let structural
  try {
    report = JSON.parse(reportText)
    structural = JSON.parse(structuralText)
  } catch (error) {
    throw new TypeError('Generated runtime verification emitted invalid JSON.', {
      cause: error,
    })
  }
  const expectedFunctions = requiredFunctions.map((name) => [name, true])
  if (!structural || structural.status !== 'structural-pass' ||
    JSON.stringify(structural.requiredFunctions) !==
      JSON.stringify(expectedFunctions)) {
    throw new Error(
      'Generated runtime required function bindings are missing or invalid.',
    )
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
  assertRequiredFunctionNames(requiredFunctions)
  const source = await readFile(runtimePath, 'utf8')
  const instrumented = await instrumentRuntime(
    runtimePath,
    source,
    requiredFunctions,
  )
  try {
    const output = await runChild(instrumented.path, {
      args,
      maxOutputBytes,
      timeoutMs,
    })
    return parseSuccessfulTelemetry(
      output.stdout,
      output.stderr,
      maxOutputBytes,
      instrumented.prefix,
      requiredFunctions,
    )
  } finally {
    await unlink(instrumented.path).catch(() => {})
  }
}
