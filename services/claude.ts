import type { ReadingLevel } from '../constants/readingLevels'
import { LEVEL_LABELS, READING_LEVELS } from '../constants/readingLevels'
import type { Message, Question, StumbleResult, StumbledWord } from '../types'
import type { PassageFeedback, GoalProfile } from '../modules/diagnostic/types'

export const SONNET = 'claude-sonnet-4-5'
export const HAIKU = 'claude-haiku-4-5-20251001'

// Reads from env — must be a server-side proxy URL; never embed ANTHROPIC_API_KEY in the bundle.
const PROXY_URL = process.env['EXPO_PUBLIC_CLAUDE_PROXY_URL'] ?? ''

// Strips common markdown from Claude output before displaying to the user.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/_(.+?)_/g, '$1')          // _italic_
    .replace(/^#{1,6}\s+/gm, '')        // # headings
    .replace(/^[-*]\s+/gm, '')          // - bullet points
    .replace(/`(.+?)`/g, '$1')          // `code`
    .trim()
}

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

function parseJsonFromModel<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fallback: extract first JSON array/object region.
    const arrayStart = cleaned.indexOf('[')
    const arrayEnd = cleaned.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1)) as T
      } catch {
        // continue
      }
    }
    const objStart = cleaned.indexOf('{')
    const objEnd = cleaned.lastIndexOf('}')
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      try {
        return JSON.parse(cleaned.slice(objStart, objEnd + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
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
    system: 'You are a reading assessment tool. Output the passage text only — no title, no heading, no label, no quotes, no explanation.',
    messages: [
      {
        role: 'user',
        content: `Write a short self-contained reading passage (3–5 sentences) at a "${levelLabel}" reading level about an everyday topic (nature, food, community, weather, or work). No title or heading.`,
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
  // Count how many user messages have been sent to determine conversation stage.
  const userTurnCount = messages.filter((m) => m.role === 'user').length

  const raw = await callProxy({
    model: SONNET,
    system: `Your name is Reid. You are a warm, casual literacy coach helping an adult learner.

The conversation has three user turns:
- Turn 1: The user tells you their name. Greet them and ask what motivates them to improve their reading.
- Turn 2: The user answers the motivation question. Ask what their interests or hobbies are.
- Turn 3: The user answers the interests question. Give a one-sentence warm acknowledgment AND append the <PROFILE> block below. Do NOT ask any more questions.

After turn 3 you MUST include this block at the very end of your reply (the user will not see it):
<PROFILE>{"motivation":"...","interests":"..."}</PROFILE>

Copy "motivation" and "interests" verbatim from what the user said — do not paraphrase or categorize.
Do not include <PROFILE> before turn 3. Plain language only — no markdown, no lists, no bold. 1 sentence max per reply.`,
    messages,
    max_tokens: 256,
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

  // Strip the tag and any markdown from the displayed message.
  const reply = stripMarkdown(raw.replace(/<PROFILE>[\s\S]*?<\/PROFILE>/, ''))
  return { reply, profile }
}

// ─── Diagnostic: Step 3 — Domain passage generation ──────────────────────────

// Generates a short real-world snippet from the learner's chosen domain
// at their detected reading level. Used for domain-specific calibration.
//
// To add domain-specific context or templates, extend the domainContext map below.
export async function generateDomainPassage(interests: string, level: ReadingLevel): Promise<string> {
  return callProxy({
    model: HAIKU,
    system: 'You are a reading assessment tool. Output the passage text only — no title, no heading, no label, no quotes, no explanation.',
    messages: [
      {
        role: 'user',
        content: `Write a realistic 3–5 sentence passage at a "${LEVEL_LABELS[level]}" reading level. Make it relevant to someone with these interests: "${interests}". No title or heading.`,
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
  interests: string,
  level: ReadingLevel,
  weakAreas: string[],
): Promise<string> {
  const weakAreaText = weakAreas.length > 0 ? `Weak areas: ${weakAreas.join(', ')}.` : ''
  const raw = await callProxy({
    model: SONNET,
    system: 'You are a literacy coach. Write 1 short, friendly sentence expressing excitement to start learning, mentioning user\'s name. No markdown, no lists, no bold.',
    messages: [
      {
        role: 'user',
        content: `Learner goal: "${goal}".`,
      },
    ],
    max_tokens: 128,
  })
  return stripMarkdown(raw)
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

export interface PersonalizedLessonDraft {
  title: string
  passages: Array<{
    title: string
    content: string
  }>
}

export async function generatePersonalizedLessonDraft(args: {
  lessonId: string
  lessonType: 'micro' | 'macro'
  readingLevel: ReadingLevel
  interests: string
  focusTopic?: string
  passageLengthHint?: 'short' | 'long'
  difficultyHint?: 'standard' | 'advanced'
}): Promise<PersonalizedLessonDraft | null> {
  const levelLabel = LEVEL_LABELS[args.readingLevel]
  const passageHint =
    args.passageLengthHint === 'long'
      ? 'Use longer passages: 8-12 sentences each with richer detail.'
      : 'Use concise passages: 3-5 sentences each.'
  const difficultyHint =
    args.difficultyHint === 'advanced'
      ? 'Increase cognitive complexity: include inference-heavy and multi-step reasoning content.'
      : 'Keep difficulty aligned to the learner profile.'
  const raw = await callProxy({
    model: SONNET,
    system:
      'You are an adult literacy lesson planner. Return only valid JSON. No markdown fences, no commentary.',
    messages: [
      {
        role: 'user',
        content:
          `Create a personalized ${args.lessonType} lesson draft for learner profile.\n` +
          `Lesson ID: ${args.lessonId}\n` +
          `Reading level: ${levelLabel}\n` +
          `Interests: ${args.interests || 'general daily life'}\n` +
          `Focus topic: ${args.focusTopic || 'everyday literacy'}\n\n` +
          `${passageHint}\n` +
          `${difficultyHint}\n\n` +
          'Return JSON with shape:\n' +
          '{"title":"string","passages":[{"title":"string","content":"3-5 sentences"}]}\n' +
          'For micro: 1 passage. For macro: 2 short passages.',
      },
    ],
    max_tokens: 800,
  })

  try {
    const parsed = parseJsonFromModel<PersonalizedLessonDraft>(raw)
    if (!parsed?.title || !Array.isArray(parsed.passages) || parsed.passages.length === 0) return null
    return parsed
  } catch (error) {
    console.error('[generatePersonalizedLessonDraft] parse error', error)
    return null
  }
}

export interface PersonalizedQuestionDraft {
  prompt: string
  choices: string[]
  correctIndex: number
  questionTypeId: string
  interactionMode: 'mcq' | 'text' | 'speech' | 'hybrid'
}

export async function generatePersonalizedQuestionDraft(args: {
  lessonId: string
  lessonType: 'micro' | 'macro'
  readingLevel: ReadingLevel
  interests: string
  focusTopic?: string
  difficultyHint?: 'standard' | 'advanced'
}): Promise<PersonalizedQuestionDraft[] | null> {
  const levelLabel = LEVEL_LABELS[args.readingLevel]
  const difficultyHint =
    args.difficultyHint === 'advanced'
      ? 'Questions should be difficult: inference, distractor quality, and applied reasoning.'
      : 'Questions should be moderate difficulty and learner-friendly.'
  const raw = await callProxy({
    model: SONNET,
    system:
      'You are an adult literacy tutor. Return only valid JSON. No markdown. Keep language practical and respectful.',
    messages: [
      {
        role: 'user',
        content:
          `Create 3 personalized practice questions for lesson ${args.lessonId}.\n` +
          `Lesson type: ${args.lessonType}\n` +
          `Reading level: ${levelLabel}\n` +
          `Interests: ${args.interests || 'general daily life'}\n` +
          `Focus topic: ${args.focusTopic || 'everyday literacy'}\n\n` +
          `${difficultyHint}\n\n` +
          'Allowed questionTypeId values:\n' +
          'identify_main_idea, identify_authors_purpose, identify_intended_audience, summarize_text, identify_vocabulary_meaning, identify_intertextual_relationships, identify_figurative_language_meaning\n\n' +
          'When difficulty is advanced, include at least 2 inference-heavy items and 1 cause/effect or contrast relationship item.\n\n' +
          'Return JSON array shape:\n' +
          '[{"prompt":"...","choices":["a","b","c","d"],"correctIndex":0,"questionTypeId":"identify_main_idea","interactionMode":"mcq"}]\n' +
          'Use interactionMode "mcq" for multiple choice and "text" for summarize_text. Return JSON only.',
      },
    ],
    max_tokens: 1000,
  })

  try {
    const parsed = parseJsonFromModel<PersonalizedQuestionDraft[]>(raw)
    if (!parsed) return null
    const valid = (parsed ?? []).filter(
      (item) =>
        Boolean(item?.prompt) &&
        Array.isArray(item?.choices) &&
        item.choices.length === 4 &&
        typeof item.correctIndex === 'number' &&
        item.correctIndex >= 0 &&
        item.correctIndex < 4 &&
        Boolean(item.questionTypeId),
    )
    return valid.length > 0 ? valid : null
  } catch (error) {
    console.error('[generatePersonalizedQuestionDraft] parse error', error)
    return null
  }
}

export async function generatePersonalizedLessonTitles(args: {
  lessonCount: number
  readingLevel: ReadingLevel
  interests: string
}): Promise<string[] | null> {
  const levelLabel = LEVEL_LABELS[args.readingLevel]
  const raw = await callProxy({
    model: HAIKU,
    system: 'Return only valid JSON. No markdown.',
    messages: [
      {
        role: 'user',
        content:
          `Generate ${args.lessonCount} short lesson titles for an adult literacy plan.\n` +
          `Reading level: ${levelLabel}\n` +
          `Interests: ${args.interests || 'general daily life'}\n` +
          'Titles should be practical and specific.\n' +
          'Return JSON array of strings only.',
      },
    ],
    max_tokens: 400,
  })

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as string[]
    const titles = parsed.filter((item) => typeof item === 'string' && item.trim().length > 0)
    return titles.length > 0 ? titles : null
  } catch (error) {
    console.error('[generatePersonalizedLessonTitles] parse error', error)
    return null
  }
}
