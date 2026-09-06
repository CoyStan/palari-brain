import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../src/core.mjs'
import * as answers from '../src/answers.mjs'
import * as legacy from '../src/index.mjs'

test('curated entrypoints retain the same kernel and existing answer functions', () => {
  assert.equal(core.createPalariBrain, legacy.createPalariBrain)
  assert.equal(core.ingestChatTurn, legacy.ingestChatTurn)
  assert.equal(answers.answerWithRetrieval, legacy.answerWithRetrieval)
  assert.equal(answers.answerQuestion, legacy.answerQuestion)
  assert.equal(core.answerWithRetrieval, undefined)
  assert.equal(typeof answers.answerWithSingleSearch, 'function')
})
