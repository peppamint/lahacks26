import type { ReadingLevel } from '../constants/readingLevels'
import { LEVEL_LABELS, READING_LEVELS } from '../constants/readingLevels'
import type { Domain } from '../constants/domains'
import { DOMAIN_LABELS } from '../constants/domains'
import type { Message, Question, StumbleResult, StumbledWord } from '../types'
import type { PassageFeedback, GoalProfile } from '../modules/diagnostic/types'

export const SONNET = 'claude-sonnet-4-5'
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

// ─── Diagnostic: Step 1 — Goal conversation ───────────────────────────────────

// Drives a single turn of the multi-turn goal conversation.
// Claude responds conversationally and, once it has enough info, embeds a
// <PROFILE> JSON block at the end of its message.
//
// Returns the cleaned reply (tag stripped) and the parsed profile (or null
// if Claude isn't ready yet). Call in a loop until profile is non-null,
// or the user hits the skip button after GOAL_TURN_LIMIT turns.
export async function conductGoalTurn(
  messages: Message[],
): Promise<{ reply: string; profile: GoalProfile | null }> {
  const raw = await callProxy({
    model: SONNET,
    system: `Your name is Reid. You are a warm, friendly literacy coach helping an adult learner.
Ask exactly two questions, one at a time:
1. What motivates you to improve your reading?
2. What are your interests or hobbies?

Keep each response to 1–2 sentences. Only ask a follow-up if their answer is genuinely unclear or too brief (e.g. just "yes" or "idk"). Do not try to categorize or box in their answers.

Once you have both their motivation and interests, append EXACTLY this at the end of your message (the user will not see it):
<PROFILE>{"motivation":"...","interests":"...","domain":"legal|work|parenting|news|social"}</PROFILE>

For "domain", silently infer the closest fit from their interests — do NOT ask the user about it.
Do not include <PROFILE> until you have both answers.`,
    messages,
    max_tokens: 512,
  })

  // Extract the hidden <PROFILE> block if present.
  const profileMatch = raw.match(/<PROFILE>([\s\S]*?)<\/PROFILE>/)
  let profile: GoalProfile | null = null
  if (profileMatch) {
    try {
      profile = JSON.parse(profileMatch[1].replace(/```json|```/g, '').trim()) as GoalProfile
    } catch {
      console.error('[conductGoalTurn] Failed to parse profile:', profileMatch[1])
    }
  }

  // Strip the tag from the displayed message.
  const reply = raw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>/, '').trim()
  return { reply, profile }
}

// ─── Diagnostic: Step 3 — Domain passage generation ──────────────────────────

// Generates a short real-world snippet from the learner's chosen domain
// at their detected reading level. Used for domain-specific calibration.
//
// To add domain-specific context or templates, extend the domainContext map below.
export async function generateDomainPassage(domain: Domain, level: ReadingLevel): Promise<string> {
  const domainContext: Record<Domain, string> = {
    legal:     'a lease clause, a court notice, or a government form',
    work:      'a workplace memo, a job description, or an HR policy',
    parenting: 'a school newsletter, a pediatric health tip, or a bedtime story excerpt',
    news:      'a short news article, a weather report, or a community announcement',
    social:    'a text message thread, a social media post, or an everyday conversation',
  }
  return callProxy({
    model: HAIKU,
    system: 'You are a reading assessment tool. Return only the passage text, no title, no explanation.',
    messages: [
      {
        role: 'user',
        content: `Write a realistic ${domainContext[domain]} (3–5 sentences) at a "${LEVEL_LABELS[level]}" reading level. It should feel authentic to the ${DOMAIN_LABELS[domain]} domain.`,
      },
    ],
    max_tokens: 256,
  })
}

// ─── Diagnostic: Finalization helpers ────────────────────────────────────────

// Analyzes all stumbled words across the diagnostic and returns 1–3 skill
// weakness labels (e.g. 'multi-syllable words', 'punctuation pausing').
// Returns [] immediately if there are no stumbles — no API call made.
//
// To change the output format, edit the JSON shape in the prompt below.
export async function analyzeWeakAreas(stumbles: StumbledWord[]): Promise<string[]> {
  if (stumbles.length === 0) return []
  const wordList = stumbles.map((s) => `"${s.word}" (context: "${s.context}")`).join(', ')
  const raw = await callProxy({
    model: HAIKU,
    system: 'You are a reading assessment tool. Return only valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Based on these stumbled words, identify 1–3 reading skill weak areas.\nWords: ${wordList}\nReturn JSON: {"weakAreas": ["...", "..."]}`,
      },
    ],
    max_tokens: 128,
  })
  try {
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { weakAreas: string[] }
    return result.weakAreas ?? []
  } catch {
    console.error('[analyzeWeakAreas] Failed to parse:', raw)
    return []
  }
}

// Generates a personalized 2-sentence first lesson suggestion for the learner
// based on their goal, domain, detected reading level, and weak areas.
// Uses Sonnet for richer, more personalized output.
export async function generateFirstLesson(
  goal: string,
  domain: Domain,
  level: ReadingLevel,
  weakAreas: string[],
): Promise<string> {
  const weakAreaText = weakAreas.length > 0 ? `Weak areas: ${weakAreas.join(', ')}.` : ''
  return callProxy({
    model: SONNET,
    system: 'Your name is Reid. You are a literacy coach. In exactly 2 sentences, suggest the learner\'s first lesson. Be specific, encouraging, and practical.',
    messages: [
      {
        role: 'user',
        content: `Learner goal: "${goal}". Domain: ${DOMAIN_LABELS[domain]}. Reading level: ${LEVEL_LABELS[level]}. ${weakAreaText} What should their first lesson be?`,
      },
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
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as StumbleResult
}
