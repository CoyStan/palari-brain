import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_SCRIPT = join(PROJECT_ROOT, 'scripts/ticket-system.mjs')
const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function execute(file, args, { cwd, env = {}, expect = 0 } = {}) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  assert.equal(
    result.status,
    expect,
    `unexpected exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return result
}

function git(repo, ...args) {
  return execute('git', args, { cwd: repo }).stdout.trim()
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'palari-brain-ticket-test-'))
  temporaryRoots.push(root)
  const repo = join(root, 'repo')
  const worktrees = join(root, 'worktrees')
  for (const directory of [
    'scripts',
    'coding-sessions/tickets/open',
    'coding-sessions/tickets/closed',
    'coding-sessions/reports',
    'coding-sessions/human-report',
    'coding-sessions/handoffs',
  ]) {
    mkdirSync(join(repo, directory), { recursive: true })
    writeFileSync(join(repo, directory, 'README.md'), '# Fixture\n')
  }
  copyFileSync(SOURCE_SCRIPT, join(repo, 'scripts/ticket-system.mjs'))
  writeFileSync(join(repo, '.gitignore'), '.env\n*.key\n')
  writeFileSync(join(repo, 'outside.txt'), 'outside baseline\n')
  writeFileSync(join(repo, 'token.txt'), 'tracked danger-zone baseline\n')
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.name', 'Ticket Contract Test')
  git(repo, 'config', 'user.email', 'ticket-test@example.invalid')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'baseline')
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'main')
  return { root, repo, worktrees, script: join(repo, 'scripts/ticket-system.mjs') }
}

function ticket(repo, script, worktrees, extra = []) {
  return execute(process.execPath, [
    script,
    'ticket-create',
    '--id', 'BRN-1001',
    '--title', 'Portable Ticket Lifecycle',
    '--stream', 'memory',
    '--risk', 'R2',
    '--priority', 'P1',
    '--allowed-path', 'owned.txt',
    '--allowed-path', 'dirty.txt',
    '--allowed-path', 'allowed-renamed.txt',
    '--verification', 'npm run quickstart',
    ...extra,
  ], {
    cwd: repo,
    env: { PALARI_WORKTREE_ROOT: worktrees },
  })
}

test('ticket creation is atomic, risk-defaulted, scoped, and linted', () => {
  const { repo, script, worktrees } = fixture()
  const created = ticket(repo, script, worktrees)
  assert.match(created.stdout, /ticket-create: ok/)
  const path = join(repo, 'coding-sessions/tickets/open/BRN-1001-portable-ticket-lifecycle.md')
  const text = readFileSync(path, 'utf8')
  assert.match(text, /^requires_review: true$/m)
  assert.match(text, /^requires_human_confirmation: false$/m)
  assert.match(text, /coding-sessions\/reports\/BRN-1001-\*\.md/)
  assert.match(text, /^  - "\.env"$/m)
  assert.match(text, new RegExp(`^worktree: ${JSON.stringify(join(worktrees, 'BRN-1001-portable-ticket-lifecycle')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))

  const lint = execute(process.execPath, [script, 'ticket-lint'], { cwd: repo })
  assert.match(lint.stdout, /ticket-lint: ok/)
})

test('duplicate create fails without damaging the first ticket', () => {
  const { repo, script, worktrees } = fixture()
  ticket(repo, script, worktrees)
  const duplicate = execute(process.execPath, [
    script,
    'ticket-create',
    '--id', 'BRN-1001',
    '--title', 'Portable Ticket Lifecycle',
    '--stream', 'memory',
    '--risk', 'R2',
    '--priority', 'P1',
    '--allowed-path', 'owned.txt',
    '--verification', 'npm run quickstart',
  ], { cwd: repo, env: { PALARI_WORKTREE_ROOT: worktrees }, expect: 2 })
  assert.match(duplicate.stderr, /ticket ID already exists/)
  assert.equal(
    readFileSync(join(repo, 'coding-sessions/tickets/open/BRN-1001-portable-ticket-lifecycle.md'), 'utf8')
      .match(/^id: BRN-1001$/gm)?.length,
    1,
  )
})

test('worktree and role packets bind specialists and reviewers to declared clean scope', () => {
  const { repo, script, worktrees } = fixture()
  ticket(repo, script, worktrees)
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'add governed ticket')
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'main')

  const prepared = execute(process.execPath, [script, 'ticket-worktree', 'BRN-1001'], { cwd: repo })
  const worktree = join(worktrees, 'BRN-1001-portable-ticket-lifecycle')
  assert.match(prepared.stdout, new RegExp(`Ticket worktree: ${worktree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  assert.equal(git(worktree, 'branch', '--show-current'), 'ticket/BRN-1001-portable-ticket-lifecycle')

  const specialist = execute(process.execPath, [join(worktree, 'scripts/ticket-system.mjs'), 'agent-packet', 'BRN-1001', 'specialist'], { cwd: worktree })
  assert.match(specialist.stdout, /Role: specialist/)
  assert.match(specialist.stdout, /never accept your own work/)
  assert.match(specialist.stdout, /Allowed paths:/)
  assert.match(specialist.stdout, /Forbidden paths:/)
  assert.match(specialist.stdout, /Ticket branch: ticket\/BRN-1001-portable-ticket-lifecycle/)

  const reviewer = execute(process.execPath, [join(worktree, 'scripts/ticket-system.mjs'), 'agent-packet', 'BRN-1001', 'reviewer'], { cwd: worktree })
  assert.match(reviewer.stdout, /Fresh-context, read-only review\. Do not implement fixes\./)
  assert.match(reviewer.stdout, /Recommend accept, reopen, or needs-human/)
  assert.match(reviewer.stdout, new RegExp(`Worker cd: cd ${worktree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
})

test('scope-check covers committed and dirty paths and both sides of renames', () => {
  const { repo, script, worktrees } = fixture()
  ticket(repo, script, worktrees)
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'add governed ticket')
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'main')
  execute(process.execPath, [script, 'ticket-worktree', 'BRN-1001'], { cwd: repo })

  const worktree = join(worktrees, 'BRN-1001-portable-ticket-lifecycle')
  const worktreeScript = join(worktree, 'scripts/ticket-system.mjs')
  execute(process.execPath, [worktreeScript, 'claim', 'BRN-1001'], {
    cwd: worktree,
    env: { PROCESS_AGENT: 'contract-test' },
  })
  writeFileSync(join(worktree, 'owned.txt'), 'committed\n')
  git(worktree, 'add', '.')
  git(worktree, 'commit', '-qm', 'claim and add allowed path')
  writeFileSync(join(worktree, 'dirty.txt'), 'dirty\n')

  const reviewPacket = execute(process.execPath, [worktreeScript, 'ticket-review-packet', 'BRN-1001'], { cwd: worktree })
  assert.match(reviewPacket.stdout, /Committed changed paths:[\s\S]*owned\.txt/)

  const combined = execute(process.execPath, [
    worktreeScript,
    'scope-check',
    '--committed-plus-dirty',
    '--target', 'main',
    'BRN-1001',
  ], { cwd: worktree })
  assert.match(combined.stdout, /committed-plus-dirty path\(s\)/)

  writeFileSync(join(worktree, 'token.txt'), 'forbidden change\n')
  const forbidden = execute(process.execPath, [worktreeScript, 'scope-check', 'BRN-1001'], {
    cwd: worktree,
    expect: 1,
  })
  assert.match(forbidden.stderr, /token\.txt forbidden by BRN-1001/)
  git(worktree, 'checkout', '--', 'token.txt')

  git(worktree, 'mv', 'outside.txt', 'allowed-renamed.txt')
  const refused = execute(process.execPath, [worktreeScript, 'scope-check', 'BRN-1001'], {
    cwd: worktree,
    expect: 1,
  })
  assert.match(refused.stderr, /outside\.txt outside allowed_paths/)
})

test('review queue is evidence-aware and transition cannot self-accept', () => {
  const { repo, script, worktrees } = fixture()
  ticket(repo, script, worktrees)
  execute(process.execPath, [script, 'claim', 'BRN-1001'], {
    cwd: repo,
    env: { PROCESS_AGENT: 'specialist' },
  })
  execute(process.execPath, [script, 'transition', 'BRN-1001', 'in-review'], { cwd: repo })

  let queue = execute(process.execPath, [script, 'review-queue'], { cwd: repo })
  assert.match(queue.stdout, /BRN-1001 \| needs-evidence/)

  writeFileSync(join(repo, 'coding-sessions/reports/BRN-1001-technical-report.md'), `# BRN-1001 Technical Report

## Files Changed

- owned.txt

## Verification

- test: PASS

## Risks / Follow-Ups

- none
`)
  writeFileSync(join(repo, 'coding-sessions/human-report/BRN-1001-human-report.md'), `# BRN-1001 Human Report

## Why This Mattered

Bounded work.

## What Changed

One file.

## What I Should Know

Nothing hidden.

## What To Check

The test.

## Recommended Next Move

Review.
`)
  queue = execute(process.execPath, [script, 'review-queue'], { cwd: repo })
  assert.match(queue.stdout, /BRN-1001 \| needs-reviewer/)

  writeFileSync(join(repo, 'coding-sessions/reports/BRN-1001-reviewer-note.md'), `# BRN-1001 Reviewer Note

## Review Result

Pass.

## Findings

- none

## Verification Reviewed

- test: PASS

## Required Changes

- none

## Recommendation

Recommend accept. This note does not accept the ticket.
`)
  queue = execute(process.execPath, [script, 'review-queue'], { cwd: repo })
  assert.match(queue.stdout, /BRN-1001 \| acceptance-candidate/)
  assert.match(execute(process.execPath, [script, 'report-lint', 'BRN-1001'], { cwd: repo }).stdout, /report-lint: ok/)

  const refused = execute(process.execPath, [script, 'transition', 'BRN-1001', 'accepted'], {
    cwd: repo,
    expect: 2,
  })
  assert.match(refused.stderr, /never accepts tickets/)
})

test('tracked CLI and docs retain exact v05 source provenance', () => {
  assert.match(readFileSync(SOURCE_SCRIPT, 'utf8'), /\/home\/quetza\/palari-v05 at commit 764cafbb/)
  assert.match(
    readFileSync(join(PROJECT_ROOT, 'docs/TICKET-WORKFLOW.md'), 'utf8'),
    /\/home\/quetza\/palari-v05` commit `764cafbb`/,
  )
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.ticket, 'node scripts/ticket-system.mjs')
})
