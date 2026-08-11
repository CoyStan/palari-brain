// Evaluation-only OpenAI embeddings transport. It reserves a conservative
// aggregate dollar amount before every dispatch, never retries, and keeps a
// failed dispatch's reservation. Callers should place the content-addressed
// cache in front of this adapter so tuning never repeats provider work.

export const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings'

const DEFAULT_MAX_BATCH_INPUTS = 512
const DEFAULT_MAX_BATCH_TOKEN_UNITS = 200_000
const DEFAULT_TIMEOUT_MS = 60_000
const USD_TOLERANCE = 1e-9

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

function positiveFinite(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`)
  }
  return number
}

function nonnegativeFinite(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${label} must be a finite nonnegative number.`)
  }
  return number
}

function normalizedTexts(values) {
  if (!Array.isArray(values) || values.length < 1) {
    throw new TypeError('OpenAI embed requires a non-empty text array.')
  }
  return values.map((value, index) => {
    const text = String(value ?? '')
    if (!text.trim()) {
      throw new TypeError(`texts[${index}] must be a non-empty string.`)
    }
    return text
  })
}

function roundedUsd(value, direction = 'nearest') {
  const scaled = value * 1e12
  const rounded = direction === 'up' ? Math.ceil(scaled) : Math.round(scaled)
  return rounded / 1e12
}

export function estimateEmbeddingTokenUpperBound(rawTexts) {
  const texts = normalizedTexts(rawTexts)
  // Every tokenizer token consumes at least one UTF-8 byte. The fixed margin
  // covers array/request accounting even though the embeddings endpoint bills
  // input tokens, not JSON framing. This intentionally over-reserves.
  return texts.reduce((total, text) =>
    total + Buffer.byteLength(text, 'utf8') + 32,
  0)
}

function partitionTexts(texts, { maxBatchInputs, maxBatchTokenUnits }) {
  const batches = []
  let current = []
  let currentUnits = 0
  for (const text of texts) {
    const units = estimateEmbeddingTokenUpperBound([text])
    if (units > maxBatchTokenUnits) {
      throw new TypeError(
        'one embedding input exceeds maxBatchTokenUnits before dispatch.',
      )
    }
    if (current.length > 0 &&
        (current.length >= maxBatchInputs ||
          currentUnits + units > maxBatchTokenUnits)) {
      batches.push(current)
      current = []
      currentUnits = 0
    }
    current.push(text)
    currentUnits += units
  }
  if (current.length > 0) batches.push(current)
  return batches
}

function safeHeader(headers, name) {
  const value = headers?.get?.(name)
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:/-]{1,160}$/u.test(value)) {
    return null
  }
  return value
}

function integerHeader(headers, name) {
  const value = headers?.get?.(name)
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function rateLimitHeaders(headers) {
  return Object.freeze({
    limitRequests: integerHeader(headers, 'x-ratelimit-limit-requests'),
    limitTokens: integerHeader(headers, 'x-ratelimit-limit-tokens'),
    remainingRequests: integerHeader(headers, 'x-ratelimit-remaining-requests'),
    remainingTokens: integerHeader(headers, 'x-ratelimit-remaining-tokens'),
  })
}

async function failedResponseError(response) {
  let code = null
  try {
    const payload = await response.json()
    const candidate = String(payload?.error?.code ?? payload?.error?.type ?? '')
    if (/^[a-zA-Z0-9_.:-]{1,100}$/u.test(candidate)) code = candidate
  } catch {
    // The body may be non-JSON. Never include it because it could echo input.
  }
  const requestId = safeHeader(response.headers, 'x-request-id')
  const details = [
    `HTTP ${response.status}`,
    code ? `code ${code}` : null,
    requestId ? `request ${requestId}` : null,
  ].filter(Boolean).join(', ')
  return new Error(`OpenAI embeddings request failed (${details}).`)
}

function validatedVectors(payload, expectedCount, dimensions) {
  if (!Array.isArray(payload?.data) || payload.data.length !== expectedCount) {
    throw new Error('OpenAI embeddings response has the wrong vector count.')
  }
  const vectors = Array(expectedCount)
  for (const [position, item] of payload.data.entries()) {
    const index = Number(item?.index)
    if (!Number.isSafeInteger(index) || index < 0 || index >= expectedCount ||
        vectors[index] !== undefined) {
      throw new Error('OpenAI embeddings response has invalid vector indexes.')
    }
    if (!Array.isArray(item.embedding) || item.embedding.length !== dimensions) {
      throw new Error(
        `OpenAI embedding ${position} must contain ${dimensions} dimensions.`,
      )
    }
    vectors[index] = item.embedding.map((value) => Number(value))
    if (vectors[index].some((value) => !Number.isFinite(value))) {
      throw new Error(`OpenAI embedding ${position} contains a non-finite value.`)
    }
  }
  return vectors
}

export function createCappedOpenAIEmbeddingAdapter({
  apiKey,
  budgetStore,
  dimensions = 1_536,
  endpoint = OPENAI_EMBEDDINGS_ENDPOINT,
  fetchImpl = fetch,
  maxBatchInputs = DEFAULT_MAX_BATCH_INPUTS,
  maxBatchTokenUnits = DEFAULT_MAX_BATCH_TOKEN_UNITS,
  maxDollar,
  model = 'text-embedding-3-small',
  pacer = null,
  priceUsdPerMillionTokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const key = String(apiKey ?? '').trim()
  const modelName = String(model ?? '').trim()
  const endpointUrl = String(endpoint ?? '').trim()
  if (!key) throw new TypeError('apiKey is required.')
  if (!modelName) throw new TypeError('model is required.')
  if (!endpointUrl) throw new TypeError('endpoint is required.')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required.')
  if (!budgetStore || typeof budgetStore.load !== 'function' ||
      typeof budgetStore.reserve !== 'function' ||
      typeof budgetStore.settle !== 'function') {
    throw new TypeError('budgetStore must provide load, reserve, and settle.')
  }
  if (pacer !== null && typeof pacer?.pace !== 'function') {
    throw new TypeError('pacer must provide pace(units).')
  }
  const vectorDimensions = positiveSafeInteger(dimensions, 'dimensions')
  const inputLimit = positiveSafeInteger(maxBatchInputs, 'maxBatchInputs')
  const batchUnitLimit = positiveSafeInteger(
    maxBatchTokenUnits,
    'maxBatchTokenUnits',
  )
  const capUsd = nonnegativeFinite(maxDollar, 'maxDollar')
  const unitPrice = positiveFinite(
    priceUsdPerMillionTokens,
    'priceUsdPerMillionTokens',
  )
  const requestTimeout = positiveSafeInteger(timeoutMs, 'timeoutMs')
  let requests = 0
  let providerInputs = 0
  let inputBytes = 0
  let totalTokens = 0
  let costUsd = 0
  let reservedUsd = 0
  let accountedUsd = null
  let lastRateLimit = null

  async function embed(rawTexts) {
    const texts = normalizedTexts(rawTexts)
    const opening = nonnegativeFinite(
      await budgetStore.load(),
      'opening accounted spend',
    )
    if (opening > capUsd + USD_TOLERANCE) {
      throw new Error(
        `OpenAI maxDollar is below prior accounted spend $${opening}.`,
      )
    }
    accountedUsd = opening
    const batches = partitionTexts(texts, {
      maxBatchInputs: inputLimit,
      maxBatchTokenUnits: batchUnitLimit,
    })
    const output = []

    for (const batch of batches) {
      const tokenUpperBound = estimateEmbeddingTokenUpperBound(batch)
      const reservationUsd = roundedUsd(
        tokenUpperBound * unitPrice / 1_000_000,
        'up',
      )
      await pacer?.pace(tokenUpperBound)
      const reservedAccountedUsd = await budgetStore.reserve(
        reservationUsd,
        capUsd,
      )
      if (reservedAccountedUsd == null) {
        throw new Error(
          `OpenAI embedding budget would exceed the aggregate $${capUsd} cap.`,
        )
      }
      accountedUsd = nonnegativeFinite(
        reservedAccountedUsd,
        'reserved accounted spend',
      )
      reservedUsd = roundedUsd(reservedUsd + reservationUsd)
      requests += 1
      let response
      try {
        response = await fetchImpl(endpointUrl, {
          body: JSON.stringify({
            dimensions: vectorDimensions,
            encoding_format: 'float',
            input: batch,
            model: modelName,
          }),
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(requestTimeout),
        })
      } catch {
        // A dispatch may have reached the provider. Keep the full reservation.
        throw new Error(
          'OpenAI embeddings transport failed before a validated response.',
        )
      }
      lastRateLimit = rateLimitHeaders(response.headers)
      if (!response.ok) throw await failedResponseError(response)

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new Error('OpenAI embeddings response was not valid JSON.')
      }
      const vectors = validatedVectors(payload, batch.length, vectorDimensions)
      const usedTokens = positiveSafeInteger(
        payload?.usage?.total_tokens,
        'OpenAI usage.total_tokens',
      )
      const actualUsd = roundedUsd(usedTokens * unitPrice / 1_000_000)
      if (actualUsd > reservationUsd + USD_TOLERANCE) {
        throw new Error(
          'OpenAI reported token usage above the conservative reservation.',
        )
      }
      accountedUsd = nonnegativeFinite(
        await budgetStore.settle(reservationUsd, actualUsd),
        'settled accounted spend',
      )
      providerInputs += batch.length
      inputBytes += batch.reduce((total, text) =>
        total + Buffer.byteLength(text, 'utf8'),
      0)
      totalTokens += usedTokens
      costUsd = roundedUsd(costUsd + actualUsd)
      output.push(...vectors)
    }
    return output
  }

  return Object.freeze({
    embed,
    get stats() {
      return Object.freeze({
        accountedUsd,
        costUsd,
        inputBytes,
        lastRateLimit,
        providerInputs,
        requests,
        reservedUsd,
        totalTokens,
      })
    },
  })
}
