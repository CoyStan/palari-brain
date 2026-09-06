import test from 'node:test'
import assert from 'node:assert/strict'
import { createEvidenceSession } from '../src/evidence-session.mjs'

test('evidence ownership keeps variants, identities and routing anchors separate', () => {
  const session = createEvidenceSession()
  session.addRoutingAnchor('route', 'Routing only')
  assert.equal(session.sources('route'), undefined)
  assert.deepEqual(session.routingSources('route'), ['Routing only'])
  session.register({ matches: [{ evidenceId: 'a', text: 'First text', speaker: 'user', order: 1 }] })
  session.register({ matches: [{ evidenceId: 'a', text: 'Other excerpt', speaker: 'user', order: 1 }] })
  assert.equal(session.count, 1)
  assert.deepEqual(session.ids, ['a'])
  assert.deepEqual(session.sources('a'), ['First text', 'Other excerpt'])
  assert.equal(session.reviewRows.length, 1)
  assert.equal(session.sources('foreign'), undefined)
  assert.throws(() => session.ids.push('forged'), TypeError)
  assert.throws(() => session.sources('a').push('forged'), TypeError)
})

test('provider Array constructor hooks cannot observe private registry arrays', () => {
  const session = createEvidenceSession()
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'constructor')
  let observed = 0
  try {
    Object.defineProperty(Array.prototype, 'constructor', {
      configurable: true,
      get() { observed += 1; this[0] = 'Forged'; return Array },
    })
    session.register({ matches: [{ evidenceId: 'a', text: 'Original', speaker: 'user', order: 1 }] })
    const sources = session.sources('a')
    const ids = session.ids
    // Avoid assertion-library internals while the realm is modified.
    if (observed !== 0 || sources[0] !== 'Original' || ids[0] !== 'a') {
      throw new Error('Private evidence crossed a constructor hook')
    }
  } finally {
    Object.defineProperty(Array.prototype, 'constructor', descriptor)
  }
  assert.deepEqual(session.sources('a'), ['Original'])
})
