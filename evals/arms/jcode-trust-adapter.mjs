import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

export const JCODE_TRUST_COMMIT =
  'c7f487309ad693c61a6b3268132ff2cb2813fced'
export const JCODE_TRUST_EXTRACTION_MODEL = 'gemini-2.5-flash-lite'
export const JCODE_TRUST_EMBEDDING_MODEL = 'text-embedding-3-small'

function bridgePath() {
  return process.env.PALARI_JCODE_TRUST_BRIDGE ||
    resolve(
      process.cwd(),
      'evals/adapters/jcode-bridge/target/release/jcode-trust-bridge',
    )
}

function requiredEnvironment() {
  const geminiApiKey = String(process.env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(process.env.OPENAI_API_KEY ?? '').trim()
  const artifactDir =
    String(process.env.PALARI_TRUST_ARTIFACT_DIR ?? '').trim()
  if (!geminiApiKey || !openaiApiKey) {
    throw new Error(
      'jcode trust adapter requires GEMINI_API_KEY and OPENAI_API_KEY.',
    )
  }
  if (!artifactDir) {
    throw new Error(
      'jcode trust adapter requires PALARI_TRUST_ARTIFACT_DIR.',
    )
  }
  return { artifactDir, geminiApiKey, openaiApiKey }
}

export async function invokeJcodeTrustBridge(command, {
  executable = bridgePath(),
} = {}) {
  const { artifactDir, geminiApiKey, openaiApiKey } =
    requiredEnvironment()
  return new Promise((resolvePromise, reject) => {
    const childEnvironment = {
      ...process.env,
      GEMINI_API_KEY: geminiApiKey,
      JCODE_GEMINI_MODEL: JCODE_TRUST_EXTRACTION_MODEL,
      JCODE_HOME: command.jcodeHome,
      JCODE_MEMORY_EMBEDDING_BACKEND: 'openai',
      JCODE_MEMORY_EMBEDDING_MODEL: JCODE_TRUST_EMBEDDING_MODEL,
      JCODE_MEMORY_SIDECAR_ENABLED: 'true',
      MEM0_TELEMETRY: 'false',
      OPENAI_API_KEY: undefined,
      PALARI_JCODE_OPENAI_API_KEY: openaiApiKey,
      PALARI_TRUST_ARTIFACT_DIR: artifactDir,
      PALARI_TRUST_SPEND_CAP_USD: '1',
    }
    delete childEnvironment.OPENAI_API_KEY
    const child = spawn(executable, [], {
      env: childEnvironment,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      const line = stdout.trim().split('\n').filter(Boolean).at(-1)
      let parsed
      try {
        parsed = JSON.parse(line)
      } catch {
        reject(new Error(
          `jcode bridge returned non-JSON output (exit ${code}): ` +
          stderr.slice(-500),
        ))
        return
      }
      if (code !== 0 || parsed.ok !== true) {
        reject(new Error(
          `jcode bridge failed: ${parsed.error ?? stderr.slice(-500)}`,
        ))
        return
      }
      resolvePromise(parsed.value)
    })
    const payload = { ...command }
    delete payload.jcodeHome
    child.stdin.end(JSON.stringify(payload))
  })
}

export function createTrustAdapter({
  invoke = invokeJcodeTrustBridge,
} = {}) {
  return {
    name: `jcode@${JCODE_TRUST_COMMIT.slice(0, 7)}`,

    async open() {
      return {
        closed: false,
        jcodeHome: await mkdtemp(
          resolve(tmpdir(), 'palari-jcode-trust-'),
        ),
      }
    },

    async ingest(session, { eventAt, scope, turn }) {
      await invoke({
        action: 'ingest',
        event_at: eventAt,
        jcodeHome: session.jcodeHome,
        scope,
        turn,
      })
    },

    async forget(session, { containing, scope }) {
      await invoke({
        action: 'forget',
        containing,
        jcodeHome: session.jcodeHome,
        scope,
      })
    },

    async retrieve(session, { question, scope }) {
      const result = await invoke({
        action: 'retrieve',
        jcodeHome: session.jcodeHome,
        question,
        scope,
      })
      return result.items
    },

    async close(session) {
      if (session.closed) return
      session.closed = true
      await rm(session.jcodeHome, { force: true, recursive: true })
    },
  }
}

export async function runConnectivitySmoke({
  invoke = invokeJcodeTrustBridge,
} = {}) {
  const jcodeHome = await mkdtemp(
    resolve(tmpdir(), 'palari-jcode-trust-smoke-'),
  )
  try {
    return await invoke({ action: 'smoke', jcodeHome })
  } finally {
    await rm(jcodeHome, { force: true, recursive: true })
  }
}
