// Official-compatible LongMemEval answer-accuracy prompts.
//
// Adapted from:
//   https://github.com/xiaowu0162/LongMemEval
//   commit 9e0b455f4ef0e2ab8f2e582289761153549043fc
//   src/evaluation/evaluate_qa.py
//   SHA-256 ecce9c4c79dc89d99534ac17b383a5cbb5b9f0c69ee98adaf0684742e3d95251
//
// Upstream license: MIT, Copyright (c) 2024 Di Wu. The license verdict
// and dataset provenance are recorded in docs/DECISIONS.md.

export const LONGMEMEVAL_JUDGE_MODEL = 'gpt-4o-2024-08-06'
export const LONGMEMEVAL_JUDGE_REQUEST = Object.freeze({
  maxTokens: 10,
  n: 1,
  temperature: 0,
})

export const longMemEvalJudgeProvenance = Object.freeze({
  license: 'MIT',
  sourceCommit: '9e0b455f4ef0e2ab8f2e582289761153549043fc',
  sourceFile: 'src/evaluation/evaluate_qa.py',
  sourceSha256: 'ecce9c4c79dc89d99534ac17b383a5cbb5b9f0c69ee98adaf0684742e3d95251',
  sourceUrl: 'https://github.com/xiaowu0162/LongMemEval',
})

const STANDARD_TEMPLATE = 'I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. \n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.'

const TEMPORAL_TEMPLATE = 'I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model\'s response is still correct. \n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.'

const UPDATE_TEMPLATE = 'I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.\n\nQuestion: {}\n\nCorrect Answer: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.'

const PREFERENCE_TEMPLATE = 'I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user\'s personal information correctly.\n\nQuestion: {}\n\nRubric: {}\n\nModel Response: {}\n\nIs the model response correct? Answer yes or no only.'

const ABSTENTION_TEMPLATE = 'I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.\n\nQuestion: {}\n\nExplanation: {}\n\nModel Response: {}\n\nDoes the model correctly identify the question as unanswerable? Answer yes or no only.'

const standardTypes = new Set([
  'single-session-user',
  'single-session-assistant',
  'multi-session',
])

function formatPythonTemplate(template, values) {
  let index = 0
  const formatted = template.replaceAll('{}', () => String(values[index++] ?? ''))
  if (index !== values.length) {
    throw new Error('LongMemEval judge template/value arity mismatch.')
  }
  return formatted
}

export function buildLongMemEvalJudgePrompt({
  answer,
  hypothesis,
  isAbstention = false,
  question,
  questionType,
} = {}) {
  const values = [question, answer, hypothesis]
  if (isAbstention) return formatPythonTemplate(ABSTENTION_TEMPLATE, values)
  if (standardTypes.has(questionType)) {
    return formatPythonTemplate(STANDARD_TEMPLATE, values)
  }
  if (questionType === 'temporal-reasoning') {
    return formatPythonTemplate(TEMPORAL_TEMPLATE, values)
  }
  if (questionType === 'knowledge-update') {
    return formatPythonTemplate(UPDATE_TEMPLATE, values)
  }
  if (questionType === 'single-session-preference') {
    return formatPythonTemplate(PREFERENCE_TEMPLATE, values)
  }
  throw new Error(`Unsupported LongMemEval judge question type "${questionType}".`)
}

// This deliberately mirrors upstream's:
//   label = 'yes' in eval_response.lower()
// A stricter parser would create a scoring-protocol deviation.
export function parseLongMemEvalJudgeLabel(responseText) {
  return String(responseText ?? '').toLowerCase().includes('yes')
}
