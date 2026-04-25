import type { ReadingLevel } from '../constants/readingLevels'
import { LEVEL_LABELS, READING_LEVELS } from '../constants/readingLevels'
import type { Message, Question, StumbleResult } from '../types'
import type { PassageFeedback } from '../modules/diagnostic/types'

export const SONNET = 'claude-sonnet-4-20250514'
export const HAIKU = 'claude-haiku-4-5-20251001'

// Reads from env — must be a server-side proxy URL; never embed ANTHROPIC_API_KEY in the bundle.
const PROXY_URL = process.env['EXPO_PUBLIC_CLAUDE_PROXY_URL'] ?? ''

async function callProxy(body: {
  model: string
  messages: Message[]
  system?: string
  max_tokens?: number
}): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Claude proxy error: ${res.status}`)
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const block = data.content.find((b) => b.type === 'text')
  return block?.text ?? ''
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
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned) as { level: ReadingLevel }
    if (READING_LEVELS.includes(result.level)) return result.level
  } catch {
    console.error('[estimateReadingLevel] Failed to parse Claude response:', raw)
  }
  // Fallback: pick the most common 'just_right' level, or the middle level.
  const justRight = feedback.find((f) => f.rating === 'just_right')
  return justRight?.level ?? 'grade5'
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
