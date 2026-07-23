// Contrast arm: a deliberately naive shared-memory list.
// It accepts every scripted candidate, has no user scope or write boundary,
// and retrieves by any case-insensitive word-token overlap. This is not an
// implementation recommendation; it makes the value of governance visible.

const tokens = (value) => new Set(
  String(value ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [],
)

export function createUngovernedArm() {
  let rows = []
  return {
    name: 'ungoverned-baseline',
    async open() {
      rows = []
    },
    async ingestTurn(turn) {
      const candidates = turn.candidates ?? []
      rows.push(...candidates.map((candidate) => ({ ...candidate })))
      return { memoriesWritten: candidates.length }
    },
    async forget(topic) {
      const needle = String(topic ?? '').toLowerCase()
      const before = rows.length
      rows = rows.filter((row) => !String(row.content ?? '').toLowerCase().includes(needle))
      return { count: before - rows.length }
    },
    async answer({ question }) {
      const questionTokens = tokens(question)
      const matches = rows.filter((row) => {
        for (const token of tokens(row.content)) {
          if (questionTokens.has(token)) return true
        }
        return false
      })
      if (matches.length === 0) {
        return {
          abstained: true,
          answer: 'I have no stored memories relevant to this question.',
        }
      }
      return {
        abstained: false,
        answer: matches.map((row) => row.content).join('\n'),
      }
    },
    async close() {
      rows = []
    },
  }
}
