#!/usr/bin/env node

// Adapted for palari-brain from /home/quetza/palari-v05 at commit 764cafbb.
// Source surfaces: scripts/process/process.sh, coding-sessions/tickets/ticket-schema.md,
// and coding-sessions/templates/worktree-per-ticket-protocol.md.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OPEN_DIR = 'coding-sessions/tickets/open'
const CLOSED_DIR = 'coding-sessions/tickets/closed'
const REPORTS_DIR = 'coding-sessions/reports'
const HUMAN_REPORTS_DIR = 'coding-sessions/human-report'
const HANDOFFS_DIR = 'coding-sessions/handoffs'

const REQUIRED_FIELDS = [
  'id',
  'title',
  'stream',
  'level',
  'parent_id',
  'root_id',
  'children',
  'status',
  'risk',
  'priority',
  'agents_allowed',
  'claimed_by',
  'claimed_at',
  'target_branch',
  'branch',
  'worktree',
  'allowed_paths',
  'forbidden_paths',
  'requires_human_confirmation',
  'requires_review',
  'verification',
  'created',
  'updated',
]
const REQUIRED_HEADINGS = [
  'Goal',
  'Scope',
  'Out Of Scope',
  'Acceptance Criteria',
  'Verification',
  'Stop Conditions',
]
const VALID_STATUSES = new Set([
  'open',
  'claimed',
  'blocked',
  'needs-human',
  'in-review',
  'reopened',
  'accepted',
])
const VALID_RISKS = new Set(['R0', 'R1', 'R2', 'R3', 'R4'])
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3'])
const DEFAULT_FORBIDDEN_PATHS = [
  '.env',
  '.env.*',
  '*.key',
  '**/*.key',
  'secrets/**',
  '**/secrets/**',
  '*secret*',
  '**/*secret*',
  '*token*',
  '**/*token*',
  'infra/prod/**',
  'prod/**',
  'runtime-data/**',
  '.palari-probe/**',
  '.palari-regression/**',
  'data/**',
  'evals/results/**',
]

class TicketError extends Error {
  constructor(message, exitCode = 2) {
    super(message)
    this.exitCode = exitCode
  }
}

function fail(message, exitCode = 2) {
  throw new TicketError(message, exitCode)
}

function out(line = '') {
  process.stdout.write(`${line}\n`)
}

function repoPath(path) {
  return join(ROOT, path)
}

function repoRelative(path) {
  return relative(ROOT, path).replaceAll('\\', '/')
}

function requireFolders() {
  for (const directory of [
    OPEN_DIR,
    CLOSED_DIR,
    REPORTS_DIR,
    HUMAN_REPORTS_DIR,
    HANDOFFS_DIR,
  ]) {
    if (!existsSync(repoPath(directory))) {
      fail(`missing required folder: ${directory}`)
    }
  }
}

function unquote(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      fail(`invalid quoted frontmatter value: ${trimmed}`)
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }
  return trimmed
}

function parseTicket(path) {
  const text = readFileSync(path, 'utf8')
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') {
    return { path, text, data: {}, keys: new Set(), body: text, frontmatterEnd: -1 }
  }

  const data = {}
  const keys = new Set()
  let currentKey = null
  let frontmatterEnd = -1
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === '---') {
      frontmatterEnd = index
      break
    }
    const field = line.match(/^([A-Za-z0-9_]+):(.*)$/)
    if (field) {
      currentKey = field[1]
      keys.add(currentKey)
      const raw = field[2].trim()
      data[currentKey] = raw === '[]' ? [] : unquote(raw)
      continue
    }
    const item = line.match(/^\s+-\s+(.+)$/)
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = []
      data[currentKey].push(unquote(item[1]))
    }
  }
  if (frontmatterEnd < 0) {
    return { path, text, data: {}, keys: new Set(), body: text, frontmatterEnd: -1 }
  }
  return {
    path,
    text,
    lines,
    data,
    keys,
    body: lines.slice(frontmatterEnd + 1).join('\n'),
    frontmatterEnd,
  }
}

function markdownFiles(directory) {
  const absolute = repoPath(directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name) && entry.name !== 'README.md')
    .map((entry) => join(absolute, entry.name))
    .sort()
}

function ticketEntries({ includeClosed = true } = {}) {
  requireFolders()
  const paths = [
    ...markdownFiles(OPEN_DIR),
    ...(includeClosed ? markdownFiles(CLOSED_DIR) : []),
  ]
  return paths.map(parseTicket)
}

function findTicket(ticket) {
  const match = ticketEntries().find((entry) => {
    const name = entry.path.split('/').at(-1)
    return entry.data.id === ticket || name === ticket || name === `${ticket}.md`
  })
  if (!match) fail(`ticket not found: ${ticket}`)
  return match
}

function validTicketId(id) {
  return /^[A-Z]{3}-[0-9]{4}(?:-[A-Z]+){0,2}$/.test(id)
}

function ticketLevel(id) {
  if (!validTicketId(id)) return null
  return id.split('-').length - 1
}

function ticketRoot(id) {
  return id.slice(0, 8)
}

function ticketParent(id) {
  return id.includes('-') ? id.slice(0, id.lastIndexOf('-')) : ''
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

function quote(value) {
  return JSON.stringify(String(value))
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function plausibleGitRef(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    && !value.includes('..')
    && !value.includes('@{')
    && !value.endsWith('.')
    && !value.endsWith('/')
    && !value.includes('//')
}

function validRepoGlob(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !/[\r\n\0]/.test(value)
    && !value.split('/').includes('..')
}

function isBooleanText(value) {
  return value === 'true' || value === 'false'
}

function hasHeading(body, heading) {
  return body.split(/\r?\n/).some((line) => line.trim() === `## ${heading}`)
}

function validateOne(entry) {
  const issues = []
  const rel = repoRelative(entry.path)
  if (entry.frontmatterEnd < 0) return [`${rel}: missing YAML frontmatter`]

  for (const field of REQUIRED_FIELDS) {
    if (!entry.keys.has(field)) issues.push(`${rel}: missing required field: ${field}`)
  }

  const { data } = entry
  if (data.id && !validTicketId(data.id)) {
    issues.push(`${rel}: invalid id; expected ABC-0001 with up to two -A suffixes`)
  }
  if (!VALID_STATUSES.has(data.status)) issues.push(`${rel}: invalid status: ${data.status || 'missing'}`)
  if (!VALID_RISKS.has(data.risk)) issues.push(`${rel}: invalid risk: ${data.risk || 'missing'}`)
  if (!VALID_PRIORITIES.has(data.priority)) issues.push(`${rel}: invalid priority: ${data.priority || 'missing'}`)
  if (!['1', '2', '3'].includes(data.level)) issues.push(`${rel}: invalid level: ${data.level || 'missing'}`)
  if (!/^\d+$/.test(data.agents_allowed) || Number(data.agents_allowed) < 1) {
    issues.push(`${rel}: agents_allowed must be a positive integer`)
  }
  if (!isBooleanText(data.requires_human_confirmation)) {
    issues.push(`${rel}: requires_human_confirmation must be true or false`)
  }
  if (!isBooleanText(data.requires_review)) {
    issues.push(`${rel}: requires_review must be true or false`)
  }
  for (const field of ['created', 'updated']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data[field] || '')) {
      issues.push(`${rel}: ${field} must use YYYY-MM-DD`)
    }
  }
  for (const field of ['allowed_paths', 'forbidden_paths', 'verification']) {
    if (asList(data[field]).length === 0) issues.push(`${rel}: ${field} must contain at least one item`)
  }
  for (const pattern of asList(data.allowed_paths)) {
    if (!validRepoGlob(pattern)) issues.push(`${rel}: allowed_paths must use non-traversing repo-relative globs: ${pattern}`)
  }
  if (!Array.isArray(data.children)) issues.push(`${rel}: children must be a list or []`)
  if (!data.target_branch) issues.push(`${rel}: target_branch must not be blank`)
  if (!data.branch) issues.push(`${rel}: branch must not be blank`)
  if (!data.worktree || !isAbsolute(data.worktree)) issues.push(`${rel}: worktree must be an absolute path`)
  if (data.target_branch && !plausibleGitRef(data.target_branch)) issues.push(`${rel}: invalid target_branch`)
  if (data.branch && !plausibleGitRef(data.branch)) issues.push(`${rel}: invalid branch`)
  if (data.id && data.branch && !data.branch.startsWith(`ticket/${data.id}-`)) {
    issues.push(`${rel}: branch must start with ticket/${data.id}-`)
  }

  if (data.id && validTicketId(data.id)) {
    const expectedLevel = String(ticketLevel(data.id))
    const expectedRoot = ticketRoot(data.id)
    if (data.level !== expectedLevel) issues.push(`${rel}: level must be ${expectedLevel} for ${data.id}`)
    if (data.root_id !== expectedRoot) issues.push(`${rel}: root_id must be ${expectedRoot}`)
    if (expectedLevel === '1' && data.parent_id !== '') issues.push(`${rel}: level 1 parent_id must be blank`)
    if (expectedLevel !== '1' && data.parent_id !== ticketParent(data.id)) {
      issues.push(`${rel}: parent_id must be ${ticketParent(data.id)}`)
    }
  }

  if (data.status === 'claimed') {
    if (!data.claimed_by) issues.push(`${rel}: claimed ticket missing claimed_by`)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.claimed_at || '')) {
      issues.push(`${rel}: claimed ticket needs an ISO UTC claimed_at`)
    }
  } else if (data.claimed_by || data.claimed_at) {
    issues.push(`${rel}: claimed_by and claimed_at must be blank unless status is claimed`)
  }

  const open = rel.startsWith(`${OPEN_DIR}/`)
  if (open && data.status === 'accepted') issues.push(`${rel}: accepted ticket must live in ${CLOSED_DIR}`)
  if (!open && data.status !== 'accepted') issues.push(`${rel}: closed ticket must have status accepted`)
  if (['R3', 'R4'].includes(data.risk)) {
    if (data.requires_human_confirmation !== 'true') issues.push(`${rel}: ${data.risk} requires human confirmation`)
    if (data.requires_review !== 'true') issues.push(`${rel}: ${data.risk} requires review`)
  }

  for (const heading of REQUIRED_HEADINGS) {
    if (!hasHeading(entry.body, heading)) issues.push(`${rel}: missing heading: ## ${heading}`)
  }
  return issues
}

function lintEntries(entries, { checkHierarchy = true, references = entries } = {}) {
  const issues = entries.flatMap(validateOne)
  if (!checkHierarchy) return issues

  const byId = new Map()
  for (const entry of references) {
    const id = entry.data.id
    if (!id) continue
    if (byId.has(id)) {
      issues.push(`duplicate ticket id ${id}: ${repoRelative(byId.get(id).path)} and ${repoRelative(entry.path)}`)
    } else {
      byId.set(id, entry)
    }
  }
  for (const entry of entries) {
    const { id, parent_id: parentId, children, level, root_id: rootId } = entry.data
    if (!id) continue
    if (parentId) {
      const parent = byId.get(parentId)
      if (!parent) {
        issues.push(`${repoRelative(entry.path)}: parent does not exist: ${parentId}`)
      } else {
        if (!asList(parent.data.children).includes(id)) {
          issues.push(`${repoRelative(parent.path)}: children must list ${id}`)
        }
        if (Number(parent.data.level) + 1 !== Number(level)) {
          issues.push(`${repoRelative(entry.path)}: parent ${parentId} is not the direct parent level`)
        }
        if (level === '3' && parent.data.root_id !== rootId) {
          issues.push(`${repoRelative(entry.path)}: root_id must equal parent root_id`)
        }
      }
    }
    for (const childId of asList(children)) {
      const child = byId.get(childId)
      if (!child) {
        issues.push(`${repoRelative(entry.path)}: child does not exist: ${childId}`)
      } else if (child.data.parent_id !== id) {
        issues.push(`${repoRelative(entry.path)}: child ${childId} does not point back to ${id}`)
      }
    }
  }
  return issues
}

function printIssues(command, issues) {
  if (issues.length === 0) return
  for (const issue of issues) process.stderr.write(`${command}: ${issue}\n`)
  fail(`${command} failed with ${issues.length} issue(s)`, 1)
}

function cmdLint(args) {
  const all = args.includes('--all')
  const ticket = args.find((arg) => arg !== '--all')
  if (ticket) {
    const entry = findTicket(ticket)
    printIssues('ticket-lint-one', lintEntries([entry], { checkHierarchy: false }))
    out(`ticket-lint-one: ok for ${entry.data.id}`)
    return
  }
  const entries = ticketEntries({ includeClosed: all })
  printIssues(
    all ? 'ticket-lint-all' : 'ticket-lint',
    lintEntries(entries, { references: all ? entries : ticketEntries() }),
  )
  out(`${all ? 'ticket-lint-all' : 'ticket-lint'}: ok`)
}

function parseOptions(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    if (!name.startsWith('--')) fail(`unexpected argument: ${name}`)
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`${name} requires a value`)
    const key = name.slice(2)
    if (!values.has(key)) values.set(key, [])
    values.get(key).push(value)
    index += 1
  }
  return {
    one(name, fallback = '') {
      const found = values.get(name) || []
      if (found.length > 1) fail(`--${name} may be supplied only once`)
      return found[0] ?? fallback
    },
    many(name) {
      return values.get(name) || []
    },
    assertKnown(names) {
      for (const key of values.keys()) if (!names.includes(key)) fail(`unknown option: --${key}`)
    },
  }
}

function defaultWorktree(id, title) {
  const canonical = canonicalRepoRoot()
  const base = process.env.PALARI_WORKTREE_ROOT || `${canonical}-worktrees`
  if (!isAbsolute(base)) fail('PALARI_WORKTREE_ROOT must be absolute')
  return join(base, `${id}-${slug(title)}`)
}

function cmdCreate(args) {
  requireFolders()
  const options = parseOptions(args)
  options.assertKnown([
    'id', 'title', 'stream', 'risk', 'priority', 'agents-allowed',
    'allowed-path', 'forbidden-path', 'verification',
    'requires-human-confirmation', 'requires-review', 'target-branch',
    'branch', 'worktree',
  ])
  const id = options.one('id')
  const title = options.one('title')
  const stream = options.one('stream')
  const risk = options.one('risk')
  const priority = options.one('priority')
  if (!validTicketId(id)) fail(`invalid ticket id: ${id}`)
  if (!title || /[\r\n]/.test(title)) fail('--title must be one non-empty line')
  if (!/^[a-z][a-z0-9-]*$/.test(stream)) fail(`invalid stream: ${stream}`)
  if (!VALID_RISKS.has(risk)) fail(`invalid risk: ${risk}`)
  if (!VALID_PRIORITIES.has(priority)) fail(`invalid priority: ${priority}`)
  const agentsAllowed = options.one('agents-allowed', '1')
  if (!/^\d+$/.test(agentsAllowed) || Number(agentsAllowed) < 1) {
    fail('--agents-allowed must be a positive integer')
  }
  if (ticketEntries().some((entry) => entry.data.id === id)) fail(`ticket ID already exists: ${id}`)

  const level = ticketLevel(id)
  const rootId = ticketRoot(id)
  const parentId = level === 1 ? '' : ticketParent(id)
  if (parentId) {
    const parent = findTicket(parentId)
    if (Number(parent.data.level) !== level - 1) fail(`parent has wrong hierarchy level: ${parentId}`)
    if (!asList(parent.data.children).includes(id)) {
      fail(`parent ${parentId} must declare child ${id} before creation`)
    }
  }

  const suppliedAllowed = options.many('allowed-path')
  if (suppliedAllowed.length === 0) fail('ticket-create requires at least one --allowed-path')
  for (const pattern of suppliedAllowed) {
    if (!validRepoGlob(pattern)) fail(`allowed path must be a non-traversing repo-relative glob: ${pattern}`)
  }
  const adminAllowed = [
    `${OPEN_DIR}/${id}-*.md`,
    `${CLOSED_DIR}/${id}-*.md`,
    `${REPORTS_DIR}/${id}-*.md`,
    `${HUMAN_REPORTS_DIR}/${id}-*.md`,
    `${HANDOFFS_DIR}/${id}-*.md`,
  ]
  const allowedPaths = [...new Set([...suppliedAllowed, ...adminAllowed])]
  const forbiddenPaths = [...new Set([...DEFAULT_FORBIDDEN_PATHS, ...options.many('forbidden-path')])]
  const verification = options.many('verification')
  if (verification.length === 0) fail('ticket-create requires at least one --verification')

  const requiresHuman = options.one(
    'requires-human-confirmation',
    ['R3', 'R4'].includes(risk) ? 'true' : 'false',
  )
  const requiresReview = options.one(
    'requires-review',
    ['R2', 'R3', 'R4'].includes(risk) ? 'true' : 'false',
  )
  if (!isBooleanText(requiresHuman)) fail('--requires-human-confirmation must be true or false')
  if (!isBooleanText(requiresReview)) fail('--requires-review must be true or false')
  if (['R3', 'R4'].includes(risk) && requiresHuman !== 'true') fail(`${risk} requires human confirmation`)
  if (['R3', 'R4'].includes(risk) && requiresReview !== 'true') fail(`${risk} requires review`)

  const ticketSlug = slug(title)
  if (!ticketSlug) fail('--title must contain at least one letter or digit')
  const targetBranch = options.one('target-branch', 'main')
  const branch = options.one('branch', `ticket/${id}-${ticketSlug}`)
  const worktree = options.one('worktree', defaultWorktree(id, title))
  if (!plausibleGitRef(targetBranch)) fail(`invalid target branch: ${targetBranch}`)
  if (!plausibleGitRef(branch) || !branch.startsWith(`ticket/${id}-`)) {
    fail(`branch must start with ticket/${id}- and be a valid git ref`)
  }
  if (!isAbsolute(worktree)) fail('worktree must be an absolute path')
  const canonical = canonicalRepoRoot()
  if (resolve(worktree) === canonical || resolve(worktree).startsWith(`${canonical}/`)) {
    fail('ticket worktree must be outside the canonical checkout')
  }
  const date = new Date().toISOString().slice(0, 10)
  const destination = repoPath(`${OPEN_DIR}/${id}-${ticketSlug}.md`)
  const renderList = (name, items) => `${name}:\n${items.map((item) => `  - ${quote(item)}`).join('\n')}`
  const text = `---
id: ${id}
title: ${quote(title)}
stream: ${stream}
level: ${level}
parent_id: ${parentId}
root_id: ${rootId}
children: []
status: open
risk: ${risk}
priority: ${priority}
agents_allowed: ${agentsAllowed}
claimed_by:
claimed_at:
target_branch: ${quote(targetBranch)}
branch: ${quote(branch)}
worktree: ${quote(worktree)}
${renderList('allowed_paths', allowedPaths)}
${renderList('forbidden_paths', forbiddenPaths)}
requires_human_confirmation: ${requiresHuman}
requires_review: ${requiresReview}
${renderList('verification', verification)}
created: ${date}
updated: ${date}
---

# ${id} ${title}

## Goal

TODO

## Scope

- TODO

## Out Of Scope

- TODO

## Acceptance Criteria

1. TODO

## Verification

- TODO

## Stop Conditions

- Stop if the work needs a path outside \`allowed_paths\` or touches \`forbidden_paths\`.
`
  try {
    writeFileSync(destination, text, { encoding: 'utf8', flag: 'wx', mode: 0o644 })
  } catch (error) {
    if (error.code === 'EEXIST') fail(`ticket path already exists: ${repoRelative(destination)}`)
    throw error
  }
  out('ticket-create: ok')
  out(`Ticket: ${id}`)
  out(`Path: ${repoRelative(destination)}`)
}

function updateFrontmatter(entry, updates) {
  const lines = [...entry.lines]
  const pending = new Set(Object.keys(updates))
  for (let index = 1; index < entry.frontmatterEnd; index += 1) {
    const field = lines[index].match(/^([A-Za-z0-9_]+):/)
    if (!field || !pending.has(field[1])) continue
    lines[index] = `${field[1]}: ${updates[field[1]]}`
    pending.delete(field[1])
  }
  if (pending.size > 0) fail(`cannot update missing frontmatter field(s): ${[...pending].join(', ')}`)
  const temporary = `${entry.path}.tmp-${process.pid}`
  writeFileSync(temporary, lines.join('\n'), { encoding: 'utf8', mode: 0o644 })
  renameSync(temporary, entry.path)
}

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function today() {
  return utcNow().slice(0, 10)
}

function ensureOpen(entry) {
  if (!repoRelative(entry.path).startsWith(`${OPEN_DIR}/`)) fail(`cannot mutate closed ticket: ${entry.data.id}`)
}

function cmdClaim(ticket) {
  if (!ticket) fail('claim requires a ticket ID')
  const entry = findTicket(ticket)
  ensureOpen(entry)
  if (!['open', 'reopened'].includes(entry.data.status)) {
    fail(`ticket ${entry.data.id} is not open or reopened; current status: ${entry.data.status}`)
  }
  const agent = process.env.PROCESS_AGENT || process.env.USER || 'unknown'
  updateFrontmatter(entry, {
    status: 'claimed',
    claimed_by: quote(agent),
    claimed_at: utcNow(),
    updated: today(),
  })
  out(`claimed ${entry.data.id} as ${agent}`)
}

function cmdUnclaim(ticket) {
  if (!ticket) fail('unclaim requires a ticket ID')
  const entry = findTicket(ticket)
  ensureOpen(entry)
  if (entry.data.status !== 'claimed') fail(`ticket ${entry.data.id} is not claimed`)
  updateFrontmatter(entry, { status: 'open', claimed_by: '', claimed_at: '', updated: today() })
  out(`unclaimed ${entry.data.id}`)
}

function cmdTransition(ticket, next) {
  if (!ticket || !next) fail('transition requires a ticket ID and target status')
  if (next === 'accepted') fail('this tool never accepts tickets; only the founder or an authorized reviewer may do that')
  const entry = findTicket(ticket)
  ensureOpen(entry)
  const allowed = new Set([
    'claimed->blocked',
    'claimed->needs-human',
    'claimed->in-review',
    'blocked->open',
    'needs-human->open',
    'in-review->reopened',
  ])
  if (!allowed.has(`${entry.data.status}->${next}`)) {
    fail(`invalid transition: ${entry.data.status} -> ${next}`)
  }
  updateFrontmatter(entry, { status: next, claimed_by: '', claimed_at: '', updated: today() })
  out(`transitioned ${entry.data.id}: ${entry.data.status} -> ${next}`)
}

function runGit(args, { cwd = ROOT, encoding = 'utf8' } = {}) {
  try {
    return execFileSync('git', args, { cwd, encoding, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message
    fail(`git ${args.join(' ')} failed: ${detail}`)
  }
}

function isGitRepo(cwd = ROOT) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function canonicalRepoRoot() {
  if (!isGitRepo(ROOT)) fail(`not inside a git worktree: ${ROOT}`)
  let common = runGit(['rev-parse', '--git-common-dir']).trim()
  if (!common.startsWith('/')) common = realpathSync(join(ROOT, common))
  if (common.endsWith('/.git')) return dirname(common)
  fail(`unable to resolve canonical checkout from ${common}`)
}

function parseNameStatus(buffer) {
  const fields = buffer.toString('utf8').split('\0')
  const paths = []
  for (let index = 0; index < fields.length;) {
    const status = fields[index++]
    if (!status) break
    const source = fields[index++]
    if (source) paths.push(source)
    if (/^[RC]/.test(status)) {
      const destination = fields[index++]
      if (destination) paths.push(destination)
    }
  }
  return paths
}

function gitChangedPaths({ target = '' } = {}) {
  if (!isGitRepo(ROOT)) fail(`not inside a git worktree: ${ROOT}`)
  const paths = []
  if (target) {
    runGit(['rev-parse', '--verify', `${target}^{commit}`])
    paths.push(...parseNameStatus(runGit(
      ['diff', '--name-status', '-z', '--relative', `${target}...HEAD`, '--', '.'],
      { encoding: 'buffer' },
    )))
  }
  paths.push(...parseNameStatus(runGit(
    ['diff', '--name-status', '-z', '--relative', '--', '.'],
    { encoding: 'buffer' },
  )))
  paths.push(...parseNameStatus(runGit(
    ['diff', '--name-status', '-z', '--cached', '--relative', '--', '.'],
    { encoding: 'buffer' },
  )))
  const untracked = runGit(
    ['ls-files', '--others', '--exclude-standard', '-z', '--', '.'],
    { encoding: 'buffer' },
  ).toString('utf8').split('\0').filter(Boolean)
  paths.push(...untracked)
  return [...new Set(paths.map((path) => path.replace(/^\.\//, '')))].sort()
}

function globRegex(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      while (pattern[index + 1] === '*') index += 1
      source += '.*'
    } else if (character === '?') {
      source += '.'
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}

function matchingPattern(path, patterns) {
  return patterns.find((pattern) => globRegex(pattern.replace(/^\.\//, '')).test(path)) || ''
}

function selectScopeTicket(ticket) {
  if (ticket) return findTicket(ticket)
  const claimed = ticketEntries({ includeClosed: false }).filter((entry) => entry.data.status === 'claimed')
  if (claimed.length === 0) fail('scope-check requires a claimed ticket or explicit ticket ID')
  if (claimed.length > 1) fail('multiple claimed tickets found; pass an explicit ticket ID')
  return claimed[0]
}

function scopeCheck({ ticket = '', target = '' } = {}) {
  const entry = selectScopeTicket(ticket)
  const allowed = asList(entry.data.allowed_paths)
  const forbidden = asList(entry.data.forbidden_paths)
  const paths = gitChangedPaths({ target })
  const issues = []
  for (const path of paths) {
    const forbiddenRule = matchingPattern(path, forbidden)
    if (forbiddenRule) {
      issues.push(`${path} forbidden by ${entry.data.id} (rule: ${forbiddenRule})`)
      continue
    }
    if (!matchingPattern(path, allowed)) {
      issues.push(`${path} outside allowed_paths for ${entry.data.id}`)
    }
  }
  printIssues('scope-check', issues)
  if (target) out(`scope-check: ok for ${entry.data.id} (${paths.length} committed-plus-dirty path(s), target ${target})`)
  else out(`scope-check: ok for ${entry.data.id} (${paths.length} changed path(s))`)
}

function cmdScope(args) {
  let ticket = ''
  let target = ''
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--committed-plus-dirty') continue
    if (args[index] === '--target') {
      target = args[index + 1] || fail('--target requires a ref')
      index += 1
      continue
    }
    if (args[index].startsWith('--')) fail(`unknown scope-check option: ${args[index]}`)
    if (ticket) fail('scope-check accepts at most one ticket ID')
    ticket = args[index]
  }
  if (args.includes('--committed-plus-dirty') && !target) {
    target = selectScopeTicket(ticket).data.target_branch || 'main'
  }
  if (target && !args.includes('--committed-plus-dirty')) fail('--target requires --committed-plus-dirty')
  scopeCheck({ ticket, target })
}

function assertClean(cwd, label) {
  const changed = runGit(['status', '--short', '--', '.'], { cwd }).trim()
  if (changed) fail(`${label} is dirty; commit or otherwise resolve its changes first`)
}

function assertSyncedMain(canonical) {
  runGit(['rev-parse', '--verify', 'main'], { cwd: canonical })
  runGit(['rev-parse', '--verify', 'origin/main'], { cwd: canonical })
  const counts = runGit(['rev-list', '--left-right', '--count', 'main...origin/main'], { cwd: canonical }).trim()
  if (!/^0\s+0$/.test(counts)) fail(`main and origin/main are not synchronized: ${counts}`)
}

function ticketBranch(entry) {
  const branch = entry.data.branch || `ticket/${entry.data.id}-${slug(entry.data.title)}`
  if (!plausibleGitRef(branch)) fail(`ticket ${entry.data.id} has an invalid branch`)
  return branch
}

function ticketWorktree(entry) {
  return entry.data.worktree || defaultWorktree(entry.data.id, entry.data.title)
}

function assertWorktreeReady(entry, { clean = true } = {}) {
  const worktree = ticketWorktree(entry)
  if (!existsSync(worktree) || !isGitRepo(worktree)) fail(`ticket worktree missing: ${worktree}`)
  const actualBranch = runGit(['branch', '--show-current'], { cwd: worktree }).trim()
  const expectedBranch = ticketBranch(entry)
  if (actualBranch !== expectedBranch) fail(`worktree branch mismatch: expected ${expectedBranch}, got ${actualBranch || 'detached'}`)
  if (clean) assertClean(worktree, 'ticket worktree')
  return worktree
}

function cmdWorktree(ticket) {
  if (!ticket) fail('ticket-worktree requires a ticket ID')
  const entry = findTicket(ticket)
  ensureOpen(entry)
  const canonical = canonicalRepoRoot()
  if (realpathSync(ROOT) !== realpathSync(canonical)) fail(`ticket-worktree must run from canonical checkout: ${canonical}`)
  assertClean(canonical, 'canonical checkout')
  assertSyncedMain(canonical)
  const target = entry.data.target_branch || 'main'
  runGit(['rev-parse', '--verify', target], { cwd: canonical })
  const branch = ticketBranch(entry)
  const worktree = ticketWorktree(entry)
  let branchExists = true
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: canonical })
  } catch {
    branchExists = false
  }
  if (branchExists) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', target, branch], { cwd: canonical, stdio: 'ignore' })
    } catch {
      fail(`ticket branch ${branch} does not contain current target ${target}`)
    }
  }
  if (existsSync(worktree) && !isGitRepo(worktree)) fail(`worktree path exists but is not a git worktree: ${worktree}`)
  if (!existsSync(worktree)) {
    mkdirSync(dirname(worktree), { recursive: true })
    const args = branchExists
      ? ['worktree', 'add', worktree, branch]
      : ['worktree', 'add', '-b', branch, worktree, target]
    runGit(args, { cwd: canonical })
  }
  assertWorktreeReady(entry)
  out('ticket-worktree: ok')
  out(`Ticket: ${entry.data.id} - ${entry.data.title}`)
  out(`Target branch: ${target}`)
  out(`Ticket branch: ${branch}`)
  out(`Ticket worktree: ${worktree}`)
  out(`Worker cd: cd ${worktree}`)
}

function sectionExcerpt(body, heading, limit = 6) {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start < 0) return ['  (missing)']
  const result = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break
    if (line.trim()) result.push(`  ${line}`)
    if (result.length === limit) break
  }
  return result.length ? result : ['  (empty)']
}

function printList(label, values) {
  out(`${label}:`)
  for (const value of values) out(`  - ${value}`)
}

function reportFilesFor(id) {
  const matching = (directory) => markdownFiles(directory).filter((path) => path.split('/').at(-1).startsWith(`${id}-`))
  const reports = matching(REPORTS_DIR)
  const byHeadings = (headings) => reports.find((path) => {
    const text = readFileSync(path, 'utf8')
    return headings.every((heading) => text.includes(`## ${heading}`))
  }) || ''
  return {
    technical: byHeadings(['Files Changed', 'Verification', 'Risks / Follow-Ups']),
    reviewer: byHeadings(['Review Result', 'Findings', 'Required Changes', 'Recommendation']),
    human: matching(HUMAN_REPORTS_DIR)[0] || '',
    handoff: matching(HANDOFFS_DIR)[0] || '',
  }
}

function markdownSection(text, heading) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start < 0) return ''
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break
    body.push(line)
  }
  return body.join('\n').trim()
}

function reviewerRequestsReopen(path) {
  const text = readFileSync(path, 'utf8')
  const result = markdownSection(text, 'Review Result')
  const required = markdownSection(text, 'Required Changes')
    .replace(/^[-*]\s*/gm, '')
    .trim()
  const recommendation = markdownSection(text, 'Recommendation')
  if (/\b(?:fail(?:ed|ure)?|reopen|needs-human)\b/i.test(result)) return true
  if (/\brecommend\s+(?:reopen|needs-human)\b/i.test(recommendation)) return true
  return Boolean(required && !/^(?:none|n\/a|not required)[.!]?$/i.test(required))
}

function printArtifact(label, path) {
  out(`${label}: ${path ? repoRelative(path) : 'not detected'}`)
}

function refExists(cwd, ref) {
  if (!plausibleGitRef(ref)) return false
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function committedTicketFacts(entry) {
  const canonical = canonicalRepoRoot()
  const branch = ticketBranch(entry)
  const target = entry.data.target_branch || 'main'
  if (!refExists(canonical, branch) || !refExists(canonical, target)) {
    return { head: 'not detected', commits: 'not detected', paths: [] }
  }
  return {
    head: runGit(['rev-parse', '--short', branch], { cwd: canonical }).trim(),
    commits: runGit(['rev-list', '--count', `${target}..${branch}`], { cwd: canonical }).trim(),
    paths: parseNameStatus(runGit(
      ['diff', '--name-status', '-z', `${target}...${branch}`, '--', '.'],
      { cwd: canonical, encoding: 'buffer' },
    )),
  }
}

function cmdReviewPacket(ticket) {
  if (!ticket) fail('ticket-review-packet requires a ticket ID')
  const entry = findTicket(ticket)
  const reports = reportFilesFor(entry.data.id)
  const committed = committedTicketFacts(entry)
  out('Palari Brain ticket review packet')
  out(`Ticket: ${entry.data.id} - ${entry.data.title}`)
  out(`Path: ${repoRelative(entry.path)}`)
  out(`Status: ${entry.data.status}`)
  out(`Risk / priority: ${entry.data.risk} / ${entry.data.priority}`)
  out(`Requires review: ${entry.data.requires_review}`)
  out(`Requires human confirmation: ${entry.data.requires_human_confirmation}`)
  out(`Target branch: ${entry.data.target_branch}`)
  out(`Ticket branch: ${ticketBranch(entry)}`)
  out(`Ticket worktree: ${ticketWorktree(entry)}`)
  out(`Ticket branch HEAD: ${committed.head}`)
  out(`Commits ahead of target: ${committed.commits}`)
  printList('Committed changed paths', committed.paths.length ? committed.paths : ['not detected'])
  printList('Allowed paths', asList(entry.data.allowed_paths))
  printList('Forbidden paths', asList(entry.data.forbidden_paths))
  printList('Verification required', asList(entry.data.verification))
  printArtifact('Technical report', reports.technical)
  printArtifact('Reviewer note', reports.reviewer)
  printArtifact('Human report', reports.human)
  printArtifact('Handoff', reports.handoff)
  out('Acceptance authority: founder or explicitly authorized reviewer; never automatic')
}

function cmdAgentPacket(ticket, role) {
  if (!ticket) fail('agent-packet requires a ticket ID')
  if (!['specialist', 'reviewer', 'mediator'].includes(role)) {
    fail('agent-packet role must be specialist, reviewer, or mediator')
  }
  const entry = findTicket(ticket)
  const canonical = canonicalRepoRoot()
  assertClean(canonical, 'canonical checkout')
  assertSyncedMain(canonical)
  const worktree = assertWorktreeReady(entry)
  const branch = ticketBranch(entry)
  const target = entry.data.target_branch || 'main'
  if (!plausibleGitRef(target)) fail(`ticket ${entry.data.id} has an invalid target_branch`)
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', target, branch], { cwd: canonical, stdio: 'ignore' })
  } catch {
    fail(`ticket branch ${branch} does not contain current target ${target}`)
  }

  out('Palari Brain agent mission packet')
  out(`Role: ${role}`)
  out(`Ticket: ${entry.data.id} - ${entry.data.title}`)
  out(`Ticket path: ${repoRelative(entry.path)}`)
  out(`Status: ${entry.data.status}`)
  out(`Risk / priority: ${entry.data.risk} / ${entry.data.priority}`)
  out('')
  out('Git context:')
  out(`  Canonical repo: ${canonical}`)
  out(`  Target branch: ${target}`)
  out(`  Ticket branch: ${branch}`)
  out(`  Ticket worktree: ${worktree}`)
  out(`  Worktree HEAD: ${runGit(['rev-parse', '--short', 'HEAD'], { cwd: worktree }).trim()}`)
  out(`  Worker cd: cd ${worktree}`)
  const committed = committedTicketFacts(entry)
  printList('  Committed changed paths', committed.paths.length ? committed.paths : ['none'])
  out('')
  out('Mission:')
  for (const line of sectionExcerpt(entry.body, 'Goal')) out(line)
  out('')
  out('Authority:')
  if (role === 'specialist') {
    out('  Implement only inside this ticket scope. You may move ready work to in-review; never accept your own work.')
  } else if (role === 'reviewer') {
    out('  Fresh-context, read-only review. Do not implement fixes. Recommend accept, reopen, or needs-human.')
  } else {
    out('  Frame options and implications for the blocker. Do not execute the blocked implementation.')
  }
  out('')
  out('Read scope:')
  out('  Read AGENTS.md and this ticket first. Then read only the changed diff, named reports, verification evidence, and source/tests needed for this mission.')
  printList('Allowed paths', asList(entry.data.allowed_paths))
  printList('Forbidden paths', asList(entry.data.forbidden_paths))
  printList('Verification', asList(entry.data.verification))
  const reports = reportFilesFor(entry.data.id)
  printArtifact('Technical report', reports.technical)
  printArtifact('Reviewer note', reports.reviewer)
  printArtifact('Human report', reports.human)
  printArtifact('Handoff', reports.handoff)
  out('Stop conditions:')
  out('  - any needed edit is outside allowed_paths or touches forbidden_paths')
  out('  - actual risk exceeds the ticket risk or authority is unclear')
  out('  - live services, secrets, destructive work, or founder-gated activity becomes necessary')
  out('  - the agent would need to accept its own work')
  out('Closeout: result state; changed paths; verification; blockers; risks; recommended next action.')
}

function reviewLabel(entry) {
  const reports = reportFilesFor(entry.data.id)
  if (entry.data.requires_human_confirmation === 'true' && !reports.human) return 'needs-human'
  if (entry.data.level === '1' && ['R1', 'R2', 'R3', 'R4'].includes(entry.data.risk) && !reports.human) {
    return 'needs-evidence'
  }
  if (!reports.technical) return 'needs-evidence'
  if (reports.reviewer && reviewerRequestsReopen(reports.reviewer)) return 'reopen-candidate'
  if (entry.data.requires_review === 'true' && !reports.reviewer) return 'needs-reviewer'
  return 'acceptance-candidate'
}

function cmdReviewQueue() {
  const entries = ticketEntries({ includeClosed: false }).filter((entry) => entry.data.status === 'in-review')
  out(`Review queue: ${entries.length} in-review ticket(s)`)
  out('Mode: read-only classification; never accepts, closes, reopens, merges, pushes, or edits tickets.')
  out('ID | label | risk | priority | updated | title')
  for (const entry of entries) {
    out(`${entry.data.id} | ${reviewLabel(entry)} | ${entry.data.risk} | ${entry.data.priority} | ${entry.data.updated} | ${entry.data.title}`)
    out(`  packet: npm run ticket -- ticket-review-packet ${entry.data.id}`)
  }
}

function fileHasHeadings(path, headings) {
  if (!path) return false
  const text = readFileSync(path, 'utf8')
  return headings.every((heading) => text.split(/\r?\n/).includes(`## ${heading}`))
}

function reportIssues(entry) {
  const issues = []
  const reports = reportFilesFor(entry.data.id)
  const reviewReady = ['in-review', 'accepted'].includes(entry.data.status)
  if (reviewReady && entry.data.level === '1' && ['R1', 'R2', 'R3', 'R4'].includes(entry.data.risk) && !reports.human) {
    issues.push(`${entry.data.id}: missing Level 1 human report`)
  }
  if (reviewReady && ['R3', 'R4'].includes(entry.data.risk) && !reports.technical) {
    issues.push(`${entry.data.id}: missing technical report`)
  }
  if (reviewReady && entry.data.requires_review === 'true' && !reports.reviewer) {
    issues.push(`${entry.data.id}: missing reviewer note`)
  }
  if (reviewReady && entry.data.requires_human_confirmation === 'true' && !reports.human) {
    issues.push(`${entry.data.id}: missing human confirmation report`)
  }
  if (['blocked', 'needs-human'].includes(entry.data.status) && !reports.handoff) {
    issues.push(`${entry.data.id}: ${entry.data.status} ticket needs a handoff`)
  }
  if (reports.human && !fileHasHeadings(reports.human, [
    'Why This Mattered', 'What Changed', 'What I Should Know', 'What To Check', 'Recommended Next Move',
  ])) issues.push(`${entry.data.id}: human report is missing required headings`)
  if (reports.technical && !fileHasHeadings(reports.technical, [
    'Files Changed', 'Verification', 'Risks / Follow-Ups',
  ])) issues.push(`${entry.data.id}: technical report is missing required headings`)
  if (reports.reviewer && !fileHasHeadings(reports.reviewer, [
    'Review Result', 'Findings', 'Verification Reviewed', 'Required Changes', 'Recommendation',
  ])) issues.push(`${entry.data.id}: reviewer note is missing required headings`)
  return issues
}

function cmdReportLint(ticket = '') {
  const entries = ticket ? [findTicket(ticket)] : ticketEntries()
  const issues = entries.flatMap(reportIssues)
  printIssues('report-lint', issues)
  out(ticket ? `report-lint: ok for ${ticket}` : 'report-lint: ok')
}

function cmdList() {
  const entries = ticketEntries({ includeClosed: false })
  out(`Active tickets: ${entries.length}`)
  out('ID | status | risk | priority | stream | claimed-by | title')
  for (const entry of entries) {
    out([
      entry.data.id,
      entry.data.status,
      entry.data.risk,
      entry.data.priority,
      entry.data.stream,
      entry.data.claimed_by || '-',
      entry.data.title,
    ].join(' | '))
  }
}

function cmdStatus() {
  const active = ticketEntries({ includeClosed: false })
  const counts = Object.fromEntries([...VALID_STATUSES].map((status) => [status, 0]))
  for (const entry of active) counts[entry.data.status] = (counts[entry.data.status] || 0) + 1
  out(`Ticket system: ${active.length} active / ${ticketEntries().length - active.length} accepted`)
  out([...VALID_STATUSES].filter((status) => status !== 'accepted').map((status) => `${status}=${counts[status]}`).join(' '))
  out(`Branch: ${isGitRepo() ? runGit(['branch', '--show-current']).trim() || 'detached' : 'not-a-repo'}`)
  out(`Changed paths: ${isGitRepo() ? gitChangedPaths().length : 'unknown'}`)
}

function cmdStaleClaims() {
  const hours = Number(process.env.STALE_CLAIM_HOURS || 24)
  const now = Date.now()
  const stale = ticketEntries({ includeClosed: false }).filter((entry) => {
    if (entry.data.status !== 'claimed') return false
    const claimed = Date.parse(entry.data.claimed_at)
    return !Number.isFinite(claimed) || now - claimed > hours * 60 * 60 * 1000
  })
  if (stale.length === 0) out(`stale-claims: none older than ${hours}h`)
  for (const entry of stale) out(`${entry.data.id} | ${entry.data.claimed_at || 'invalid'} | ${entry.data.claimed_by} | ${entry.data.title}`)
}

function cmdWorktreeClean() {
  const paths = gitChangedPaths()
  if (paths.length) {
    for (const path of paths) process.stderr.write(`  ${path}\n`)
    fail(`worktree-clean failed with ${paths.length} changed path(s)`, 1)
  }
  out('worktree-clean: ok')
}

function cmdCheck(ticket) {
  if (!ticket) fail('check requires an explicit ticket ID')
  const allEntries = ticketEntries()
  printIssues('ticket-lint-all', lintEntries(allEntries))
  scopeCheck({ ticket })
  cmdReportLint(ticket)
  out(`check: ok for ${ticket}`)
}

function usage() {
  out(`usage: npm run ticket -- COMMAND

commands:
  status                              Show ticket and git status.
  tickets                             List active tickets.
  ticket-create FLAGS                 Create one validated ticket atomically.
  ticket-lint [ID]                    Lint active tickets or one ticket.
  ticket-lint-all                     Lint active and accepted tickets.
  claim ID                            Claim an open or reopened ticket.
  unclaim ID                          Return a claimed ticket to open.
  transition ID STATUS                Move through non-acceptance lifecycle states.
  stale-claims                        Show claims older than 24 hours.
  ticket-worktree ID                  Create/verify the isolated ticket worktree.
  agent-packet ID ROLE                Print specialist/reviewer/mediator packet.
  ticket-review-packet ID             Print a read-only review packet.
  review-queue                        Classify in-review tickets read-only.
  scope-check [OPTIONS] [ID]          Enforce allowed/forbidden changed paths.
  report-lint [ID]                    Check evidence required for ticket state/risk.
  worktree-clean                      Fail when the current worktree is dirty.
  check ID                            Lint, scope-check, and report-lint one ticket.

scope options:
  --committed-plus-dirty [--target REF]

ticket-create required flags:
  --id BRN-0001 --title TEXT --stream NAME --risk R0..R4 --priority P0..P3
  --allowed-path GLOB (repeatable) --verification TEXT (repeatable)

See docs/TICKET-WORKFLOW.md for lifecycle, risk, review, and acceptance rules.`)
}

function main(args) {
  const [command, ...rest] = args
  switch (command) {
    case 'status': return cmdStatus()
    case 'tickets': return cmdList()
    case 'ticket-create': return cmdCreate(rest)
    case 'ticket-lint': return cmdLint(rest)
    case 'ticket-lint-all': return cmdLint(['--all'])
    case 'claim': return cmdClaim(rest[0])
    case 'unclaim': return cmdUnclaim(rest[0])
    case 'transition': return cmdTransition(rest[0], rest[1])
    case 'stale-claims': return cmdStaleClaims()
    case 'ticket-worktree': return cmdWorktree(rest[0])
    case 'agent-packet': return cmdAgentPacket(rest[0], rest[1])
    case 'ticket-review-packet': return cmdReviewPacket(rest[0])
    case 'review-queue': return cmdReviewQueue()
    case 'scope-check': return cmdScope(rest)
    case 'report-lint': return cmdReportLint(rest[0] || '')
    case 'worktree-clean': return cmdWorktreeClean()
    case 'check': return cmdCheck(rest[0])
    case 'help':
    case '--help':
    case '-h': return usage()
    case undefined:
      usage()
      fail('missing command')
      break
    default:
      usage()
      fail(`unknown command: ${command}`)
  }
}

try {
  main(process.argv.slice(2))
} catch (error) {
  if (error instanceof TicketError) {
    process.stderr.write(`error: ${error.message}\n`)
    process.exitCode = error.exitCode
  } else {
    throw error
  }
}
