// Build the release tarball, install it into a clean offline consumer, and
// verify that every declared public entry imports with the reviewed API names.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const expectedEntries = Object.freeze([
  Object.freeze({
    count: 96,
    hash: '3cf6e9a5a1e92ad46803e7d09b0379b9f2b462d64024b8a929bb79bc15322431',
    specifier: 'palari-brain',
  }),
  Object.freeze({
    count: 4,
    hash: 'c534349fd6dc948cadfa8086ffd0ba4c8274ce2d357752d91d7b01b216f04046',
    specifier: 'palari-brain/canonical-evidence',
  }),
  Object.freeze({
    count: 1,
    hash: '66c882496bf0f67f08b810060950de54d45cb0cd54c57d49671fa6663c90ec64',
    specifier: 'palari-brain/embedder',
  }),
  Object.freeze({
    count: 2,
    hash: '33c67c46a138bb3d05b05ba2e74d92d186dc24e658ab799112c202acb7827afa',
    specifier: 'palari-brain/gemini',
  }),
  Object.freeze({
    count: 21,
    hash: 'da1fcd348a5703c85313d47831c13c1c726774304d3b51f97b2bd9c2720c32b2',
    specifier: 'palari-brain/openai',
  }),
  Object.freeze({
    count: 10,
    hash: 'ce4b437d9f804b095a006925ad25f7c0ae05c0a6da6e60710c765ca820b35ac3',
    specifier: 'palari-brain/reranker-ettin',
  }),
  Object.freeze({
    count: 10,
    hash: '0bac1a2b3cadb95bf50eb01af8eb5dd20b0d11479d3472987af8135b81034eea',
    specifier: 'palari-brain/reranker-transformers',
  }),
])

function run(command, args, { cwd = repositoryRoot } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim()
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${result.status}` +
      (detail ? `:\n${detail}` : '.'),
    )
  }
  return result.stdout
}

function consumerCheckSource() {
  return [
    "import { createHash } from 'node:crypto'",
    `const expectedEntries = ${JSON.stringify(expectedEntries)}`,
    'for (const expected of expectedEntries) {',
    '  const entry = await import(expected.specifier)',
    '  const names = Object.keys(entry).sort()',
    "  const hash = createHash('sha256')",
    "    .update(names.join('\\n'))",
    "    .digest('hex')",
    '  if (names.length !== expected.count || hash !== expected.hash) {',
    '    throw new Error(',
    '      `${expected.specifier} API changed: ${names.length} exports, ${hash}.`,',
    '    )',
    '  }',
    '  console.log(`${expected.specifier}: ${names.length} exports`)',
    '}',
    '',
  ].join('\n')
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'palari-package-check-'))

try {
  const packRoot = join(temporaryRoot, 'pack')
  const consumerRoot = join(temporaryRoot, 'consumer')
  await Promise.all([
    mkdir(packRoot),
    mkdir(consumerRoot),
  ])

  const packed = JSON.parse(run(npmCommand, [
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    packRoot,
  ]))
  if (!Array.isArray(packed) || packed.length !== 1 || !packed[0]?.filename) {
    throw new Error('npm pack did not report exactly one release tarball.')
  }
  const manifest = packed[0]
  const tarballPath = join(packRoot, manifest.filename)

  await writeFile(
    join(consumerRoot, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  )
  run(npmCommand, [
    'install',
    '--offline',
    '--ignore-scripts',
    '--omit=optional',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    tarballPath,
  ], { cwd: consumerRoot })

  const consumerCheck = join(consumerRoot, 'check.mjs')
  await writeFile(consumerCheck, consumerCheckSource(), 'utf8')
  process.stdout.write(run(process.execPath, [consumerCheck], {
    cwd: consumerRoot,
  }))
  console.log(
    `package: ${manifest.files.length} files, ${manifest.size} packed bytes, ` +
    `${manifest.unpackedSize} unpacked bytes`,
  )
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
