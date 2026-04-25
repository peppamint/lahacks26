import type { ReadingLevel } from '../constants/readingLevels'
import { LEVEL_LABELS } from '../constants/readingLevels'
import type { Message, Question, StumbleResult } from '../types'

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
  return JSON.parse(raw) as Question[]
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
