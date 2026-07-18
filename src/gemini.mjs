// Gemini REST transport for live evals. Authorization keys travel only
// in x-goog-api-key, never in URLs, logs, result files, or prompts.

export function buildGeminiGenerateRequest({ apiKey, body, model } = {}) {
  const key = String(apiKey ?? '').trim()
  const modelId = String(model ?? '').trim()
  if (!key) throw new Error('Gemini API key is required.')
  if (!modelId) throw new Error('Gemini model is required.')
  return {
    init: {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      method: 'POST',
    },
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
  }
}
