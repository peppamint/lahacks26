import type { ReadingLevel } from '../constants/readingLevels'
import { LEVEL_LABELS, READING_LEVELS } from '../constants/readingLevels'
import type { Message, Question, StumbleResult } from '../types'
import type { PassageFeedback } from '../modules/diagnostic/types'

export const SONNET = 'claude-sonnet-4-20250514'
export const HAIKU = 'claude-haiku-4-5-20251001'

// Reads from env — must be a server-side proxy URL; never embed ANTHROPIC_API_KEY in the bundle.
// EXPO_PUBLIC_* is inlined when Metro bundles; after changing .env run: npx expo start -c
const PROXY_TIMEOUT_MS = 15000

function getClaudeProxyUrl(): string {
  return process.env.EXPO_PUBLIC_CLAUDE_PROXY_URL ?? ''
}

async function callProxy(body: {
  model: string
  messages: Message[]
  system?: string
  max_tokens?: number
}): Promise<string> {
  const proxyUrl = getClaudeProxyUrl().trim()
  if (!proxyUrl) {
    throw new Error(
      'Missing EXPO_PUBLIC_CLAUDE_PROXY_URL. Add it to .env, then restart Metro with: npx expo start -c',
    )
  }
  if (!proxyUrl.startsWith('https://') || !proxyUrl.includes('/functions/v1/')) {
    throw new Error(
      'EXPO_PUBLIC_CLAUDE_PROXY_URL should look like: https://<project-ref>.supabase.co/functions/v1/<function-name>',
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Claude request timed out after ${PROXY_TIMEOUT_MS / 1000}s.`)
    }
    throw error
  }).finally(() => {
    clearTimeout(timeout)
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Claude proxy error: ${res.status} ${errorBody}`)
  }

  const data: unknown = await res.json()
  return extractAssistantTextFromAnthropicResponse(data)
}

/** Anthropic success uses `content[]`; errors use `error` and may omit `content`. */
function extractAssistantTextFromAnthropicResponse(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Claude proxy returned an empty response.')
  }

  const record = data as Record<string, unknown>

  if (record.type === 'error' && record.error && typeof record.error === 'object') {
    const err = record.error as { message?: string }
    throw new Error(err.message ?? 'Claude API returned an error.')
  }

  const content = record.content
  if (!Array.isArray(content)) {
    throw new Error('Claude response missing content array.')
  }

  const block = content.find(
    (b): b is { type: string; text?: string } =>
      typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text',
  )
  const text = typeof block?.text === 'string' ? block.text.trim() : ''
  if (!text) {
    throw new Error('Claude response had no text block.')
  }
  return text
}

/** When Claude is unavailable or JSON is wrong, infer level from passage ratings. */
export function heuristicReadingLevelFromFeedback(feedback: PassageFeedback[]): ReadingLevel {
  if (feedback.length === 0) return 'grade5'

  const justRight = feedback.filter((f) => f.rating === 'just_right')
  if (justRight.length > 0) {
    const idxs = justRight
      .map((f) => READING_LEVELS.indexOf(f.level))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)
    if (idxs.length === 0) return 'grade5'
    return READING_LEVELS[idxs[Math.floor(idxs.length / 2)]]
  }

  const last = feedback[feedback.length - 1]
  const idx = Math.max(0, READING_LEVELS.indexOf(last.level))
  if (last.rating === 'too_hard') return READING_LEVELS[Math.max(0, idx - 1)]
  if (last.rating === 'too_easy') return READING_LEVELS[Math.min(READING_LEVELS.length - 1, idx + 1)]
  return last.level
}

// ─── Sonnet calls ─────────────────────────────────────────────────────────────

export async function simplifyText(text: string, targetLevel: ReadingLevel): Promise<string> {
  const levelLabel = LEVEL_LABELS[targetLevel]
  return callProxy({
    model: SONNET,
    system: 'You are a literacy tutor. Return only the rewritten text, no explanation.',
    messages: [
      {
        role: 'user',
        content: `Rewrite the following text so it is clear and accessible at a "${levelLabel}" reading level.\n\nTEXT:\n${text}`,
      },
    ],
    max_tokens: 2048,
  })
}

export async function generateComprehensionQuestions(chapter: string): Promise<Question[]> {
  const raw = await callProxy({
    model: SONNET,
    system: 'You are a literacy tutor. Return only valid JSON — an array of question objects.',
    messages: [
      {
        role: 'user',
        content: `Generate 4 SAT-style multiple-choice comprehension questions for the following text. Return JSON array with shape: [{id, text, options: [string x4], correctIndex: number}].\n\nTEXT:\n${chapter}`,
      },
    ],
    max_tokens: 1024,
  })
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as Question[]
}

export async function runGoalConversation(messages: Message[]): Promise<string> {
  return callProxy({
    model: SONNET,
    system: 'You are a friendly literacy coach helping an adult learner set reading goals. Ask one clarifying question at a time. Be warm and encouraging.',
    messages,
    max_tokens: 512,
  })
}

// ─── Haiku calls ─────────────────────────────────────────────────────────────

export async function defineWord(word: string, context: string): Promise<string> {
  return callProxy({
    model: HAIKU,
    system: 'You are a literacy tutor. Give a short, plain-English definition (1–2 sentences) suitable for an adult learner.',
    messages: [
      { role: 'user', content: `Define "${word}" as used in this sentence: "${context}"` },
    ],
    max_tokens: 128,
  })
}

export async function generateReadingPassage(level: ReadingLevel): Promise<string> {
  const levelLabel = LEVEL_LABELS[level]
  return callProxy({
    model: HAIKU,
    system: 'You are a reading assessment tool. Return only the passage text, no title, no explanation, no quotes.',
    messages: [
      {
        role: 'user',
        content: `Write a short self-contained reading passage (3–5 sentences) at a "${levelLabel}" reading level. The passage should be about an everyday topic (nature, food, community, weather, work) and require no outside context to understand.`,
      },
    ],
    max_tokens: 256,
  })
}

export async function respondPositively(userInput: string, topic: 'goal' | 'interest'): Promise<string> {
  const context = topic === 'goal'
    ? 'The user just shared their reading goals or motivation.'
    : 'The user just shared their personal interests or hobbies.'
  return callProxy({
    model: HAIKU,
    system: 'Your name is Reid. You are a warm, encouraging literacy tutor. Respond in exactly 1 sentence. Be genuine and specific to what they said. Do not ask a follow-up question.',
    messages: [
      { role: 'user', content: `${context} They said: "${userInput}"` },
    ],
    max_tokens: 96,
  })
}

export async function estimateReadingLevel(feedback: PassageFeedback[]): Promise<ReadingLevel> {
  const levels = READING_LEVELS
  const summary = feedback
    .map((f) => `Passage at "${LEVEL_LABELS[f.level]}": user said "${f.rating.replace('_', ' ')}"`)
    .join('\n')

  try {
    const raw = await callProxy({
      model: HAIKU,
      system: 'You are a reading assessment tool. Return only valid JSON.',
      messages: [
        {
          role: 'user',
          content: `Based on this learner's passage ratings, estimate their reading level.\n\n${summary}\n\nValid levels: ${levels.join(', ')}\nReturn JSON: {"level": "<one of the valid levels>"}`,
        },
      ],
      max_tokens: 64,
    })
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned) as { level?: ReadingLevel }
    if (result.level && READING_LEVELS.includes(result.level)) {
      return result.level
    }
  } catch (error) {
    console.warn('[estimateReadingLevel] Claude unavailable or parse failed; using heuristic.', error)
  }

  return heuristicReadingLevelFromFeedback(feedback)
}

export async function detectStumbleFromTranscript(
  expected: string,
  actual: string,
): Promise<StumbleResult> {
  const raw = await callProxy({
    model: HAIKU,
    system: 'You are a reading assessment tool. Return only valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Compare the expected text with the learner's actual reading. Identify stumbled or mispronounced words.\nExpected: "${expected}"\nActual: "${actual}"\nReturn JSON: {stumbledWords: [{word, context, timestamp: ""}], confidence: number (0-1), transcript: string}`,
      },
    ],
    max_tokens: 512,
  })
  return JSON.parse(raw) as StumbleResult
}
