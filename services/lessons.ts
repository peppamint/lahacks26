import { ensureLearnerProfile, supabase } from './supabase'
import type { MacroLessonConfig, MicroLessonConfig } from '../types'
import type { ReadingLevel } from '../constants/readingLevels'
import { buildMacroLessonConfig, buildMicroLessonConfig } from '../constants/lessonLibrary'
import {
  generatePersonalizedLessonDraft,
  generatePersonalizedLessonTitles,
  generatePersonalizedQuestionDraft,
} from './claude'

export interface LessonMapItem {
  id: string
  title: string
  kind: 'micro' | 'macro'
}

export type InteractionMode = 'mcq' | 'text' | 'speech' | 'hybrid'

export interface LessonQuestion {
  id: string
  questionTypeId: string
  prompt: string
  choices: string[]
  answerKey: { correctIndex?: number; [key: string]: unknown }
  interactionMode: InteractionMode
  difficulty: number
}

interface LessonAttemptRow {
  id: string
}

interface RemoteLessonRow {
  id: string
  slug: string
  title: string
  lesson_type: 'micro' | 'macro'
  lesson_passages: Array<{
    id: string
    passage_order: number
    title: string | null
    content: string
  }>
}

const personalizedDraftCache = new Map<string, { title: string; passages: Array<{ title: string; content: string }> }>()
const personalizedQuestionCache = new Map<string, LessonQuestion[]>()
const activePersonalizationByLesson = new Map<
  string,
  { cacheKey: string; lessonType: 'micro' | 'macro'; interests: string; readingLevel: ReadingLevel }
>()

const DEMO_ADVANCED_LESSON_ID = '15'
const DEMO_ADVANCED_MACRO: MacroLessonConfig = {
  lessonId: DEMO_ADVANCED_LESSON_ID,
  title: 'Advanced: Tax Planning Under Uncertainty',
  readingLevel: 'adult',
  chapters: [
    {
      chapterId: '15-a',
      index: 0,
      title: 'Withholding, Estimated Payments, and Cash Flow',
      content:
        'Jordan works a salaried job and also earns freelance income that varies by quarter. Her paycheck withholding appears high, but her side income is not covered by payroll withholding and may trigger additional self-employment tax obligations. She must decide whether to increase withholding on her W-4 or make quarterly estimated payments to avoid underpayment penalties. If she overpays, she may receive a refund, but that also means reduced monthly liquidity for operating costs in her freelance business. A careful strategy compares projected annual tax liability, expected deductions, and timing of income spikes across quarters.',
    },
    {
      chapterId: '15-b',
      index: 1,
      title: 'Deductions, Filing Status, and Penalty Risk',
      content:
        'Two taxpayers with similar gross income can owe very different tax amounts because filing status, deductible expenses, and credits interact in non-obvious ways. Itemizing may outperform the standard deduction in one year but not the next, especially when medical expenses, mortgage interest, or state taxes shift. Late or inaccurate filings can also produce compounding outcomes: interest accrues on unpaid balances while penalty calculations depend on both timing and amount due. Strong tax decision-making therefore requires scenario analysis, not rule-of-thumb assumptions, and should include a plan for documentation quality in case of notice review.',
    },
  ],
}

const DEMO_ADVANCED_QUESTIONS: LessonQuestion[] = [
  {
    id: 'demo-15-q1',
    questionTypeId: 'identify_intertextual_relationships',
    interactionMode: 'mcq',
    difficulty: 0.9,
    prompt:
      'Why can increasing paycheck withholding and making quarterly estimated payments both be rational, depending on income structure?',
    choices: [
      'Because either method eliminates all tax penalties regardless of final liability.',
      'Because withholding only applies to wage income, while estimated payments can cover non-wage volatility.',
      'Because quarterly payments are required only for taxpayers who itemize deductions.',
      'Because estimated payments reduce self-employment tax to zero when paid on time.',
    ],
    answerKey: { correctIndex: 1 },
  },
  {
    id: 'demo-15-q2',
    questionTypeId: 'identify_main_idea',
    interactionMode: 'mcq',
    difficulty: 0.88,
    prompt:
      'What is the strongest main idea across both passages?',
    choices: [
      'Tax outcomes are mostly fixed once gross income is known.',
      'Refund maximization should always be prioritized over liquidity.',
      'Effective tax planning requires scenario-based decisions across timing, income type, and documentation.',
      'Filing status is less important than withholding strategy in all cases.',
    ],
    answerKey: { correctIndex: 2 },
  },
  {
    id: 'demo-15-q3',
    questionTypeId: 'identify_authors_purpose',
    interactionMode: 'mcq',
    difficulty: 0.9,
    prompt:
      'What is the author’s purpose in emphasizing both penalty risk and documentation quality?',
    choices: [
      'To show that tax strategy includes compliance behavior, not only arithmetic.',
      'To argue that deductions are irrelevant in audited returns.',
      'To prove that late filing is harmless if estimated payments are made.',
      'To discourage taxpayers from using standard deductions.',
    ],
    answerKey: { correctIndex: 0 },
  },
  {
    id: 'demo-15-q4',
    questionTypeId: 'summarize_text',
    interactionMode: 'text',
    difficulty: 0.92,
    prompt:
      'In 2-3 sentences, summarize how liquidity constraints and penalty avoidance can conflict in tax planning decisions.',
    choices: ['A', 'B', 'C', 'D'],
    answerKey: { correctIndex: 0 },
  },
]

function parseLessonIdFromSlug(slug: string): string | null {
  const match = slug.match(/^lesson-(\d+)$/)
  return match ? match[1] : null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function fetchRemoteLessonRow(lessonId: string): Promise<RemoteLessonRow | null> {
  const slug = `lesson-${lessonId}`
  const { data, error } = await supabase
    .from('lessons')
    .select(
      `
      id,
      slug,
      title,
      lesson_type,
      lesson_passages (
        id,
        passage_order,
        title,
        content
      )
    `,
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_published', true)
    .single()

  if (error || !data) return null
  return data as RemoteLessonRow
}

export async function fetchLessonMapItems(): Promise<LessonMapItem[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('slug,title,lesson_type')
    .eq('is_active', true)
    .eq('is_published', true)
    .order('slug', { ascending: true })

  if (error || !data) return []

  const items = data
    .map((row) => {
      const id = parseLessonIdFromSlug(row.slug)
      if (!id) return null
      return { id, title: row.title, kind: row.lesson_type as 'micro' | 'macro' }
    })
    .filter((item): item is LessonMapItem => Boolean(item))

  return items
}

export async function buildPersonalizedLessonMapItems(
  items: LessonMapItem[],
  readingLevel: ReadingLevel,
  interests: string,
): Promise<LessonMapItem[]> {
  if (items.length === 0) return items
  try {
    const titles = await generatePersonalizedLessonTitles({
      lessonCount: items.length,
      readingLevel,
      interests,
    })
    if (!titles || titles.length === 0) return items
    return items.map((item, idx) => ({
      ...item,
      title: titles[idx] ?? item.title,
    }))
  } catch (error) {
    console.error('[buildPersonalizedLessonMapItems] failed', error)
    return items
  }
}

export async function buildMicroLessonFromSource(
  lessonId: string,
  readingLevel: ReadingLevel,
  interests: string,
): Promise<MicroLessonConfig> {
  const cacheKey = `micro:${lessonId}:${readingLevel}:${interests}`
  const cached = personalizedDraftCache.get(cacheKey)
  if (cached?.passages?.[0]) {
    return {
      lessonId,
      documentText: cached.passages[0].content,
      readingLevel,
      interests: interests || 'general literacy',
    }
  }

  try {
    const personalized = await generatePersonalizedLessonDraft({
      lessonId,
      lessonType: 'micro',
      readingLevel,
      interests,
      focusTopic: interests,
      difficultyHint: 'standard',
    })
    if (personalized?.passages?.[0]) {
      personalizedDraftCache.set(cacheKey, personalized)
      activePersonalizationByLesson.set(lessonId, {
        cacheKey,
        lessonType: 'micro',
        interests,
        readingLevel,
      })
      return {
        lessonId,
        documentText: personalized.passages[0].content,
        readingLevel,
        interests: interests || 'general literacy',
      }
    }
  } catch (error) {
    console.error('[buildMicroLessonFromSource] personalization failed', error)
  }

  const remote = await fetchRemoteLessonRow(lessonId)
  if (!remote || remote.lesson_type !== 'micro' || remote.lesson_passages.length === 0) {
    return buildMicroLessonConfig(lessonId, readingLevel, interests)
  }

  const firstPassage = [...remote.lesson_passages].sort((a, b) => a.passage_order - b.passage_order)[0]
  return {
    lessonId,
    documentText: firstPassage.content,
    readingLevel,
    interests: interests || 'general literacy',
  }
}

export async function buildMacroLessonFromSource(
  lessonId: string,
  readingLevel: ReadingLevel,
  interests: string,
): Promise<MacroLessonConfig> {
  if (lessonId === DEMO_ADVANCED_LESSON_ID) {
    return DEMO_ADVANCED_MACRO
  }
  const cachePrefix = `macro:${lessonId}:${readingLevel}`
  const cacheEntry = [...personalizedDraftCache.entries()].find(([key]) => key.startsWith(cachePrefix))
  if (cacheEntry?.[1]?.passages?.length) {
    const cached = cacheEntry[1]
    return {
      lessonId,
      title: cached.title,
      chapters: cached.passages.map((passage, index) => ({
        chapterId: `${lessonId}-p-${index + 1}`,
        index,
        title: passage.title || `Chapter ${index + 1}`,
        content: passage.content,
      })),
      readingLevel,
    }
  }

  try {
    const personalized = await generatePersonalizedLessonDraft({
      lessonId,
      lessonType: 'macro',
      readingLevel,
      interests,
      focusTopic: interests,
      difficultyHint: 'standard',
    })
    if (personalized?.passages?.length) {
      personalizedDraftCache.set(`${cachePrefix}:default`, personalized)
      activePersonalizationByLesson.set(lessonId, {
        cacheKey: `${cachePrefix}:default`,
        lessonType: 'macro',
        interests,
        readingLevel,
      })
      return {
        lessonId,
        title: personalized.title,
        chapters: personalized.passages.map((passage, index) => ({
          chapterId: `${lessonId}-p-${index + 1}`,
          index,
          title: passage.title || `Chapter ${index + 1}`,
          content: passage.content,
        })),
        readingLevel,
      }
    }
  } catch (error) {
    console.error('[buildMacroLessonFromSource] personalization failed', error)
  }

  const remote = await fetchRemoteLessonRow(lessonId)
  if (!remote || remote.lesson_type !== 'macro' || remote.lesson_passages.length === 0) {
    return buildMacroLessonConfig(lessonId, readingLevel)
  }

  const chapters = [...remote.lesson_passages]
    .sort((a, b) => a.passage_order - b.passage_order)
    .map((passage, index) => ({
      chapterId: passage.id,
      index,
      title: passage.title ?? `Chapter ${index + 1}`,
      content: passage.content,
    }))

  return {
    lessonId,
    title: remote.title,
    chapters,
    readingLevel,
  }
}

export async function fetchLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  const cacheHit = personalizedQuestionCache.get(`q:${lessonId}`)
  if (cacheHit && cacheHit.length > 0) return cacheHit

  const slug = `lesson-${lessonId}`
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_published', true)
    .single()

  if (lessonError || !lesson) return []

  const { data, error } = await supabase
    .from('questions')
    .select('id,question_type_id,prompt,choices,answer_key,interaction_mode,difficulty,question_order')
    .eq('lesson_id', lesson.id)
    .eq('is_active', true)
    .order('question_order', { ascending: true })

  if (error) return []

  const dbQuestions = (data ?? []).map((row) => ({
    id: row.id,
    questionTypeId: row.question_type_id,
    prompt: row.prompt,
    choices: Array.isArray(row.choices) ? (row.choices as string[]) : [],
    answerKey: (row.answer_key as { correctIndex?: number }) ?? {},
    interactionMode: (row.interaction_mode as InteractionMode) ?? 'mcq',
    difficulty: row.difficulty ?? 0.5,
  }))
  if (dbQuestions.length > 0) return dbQuestions
  return []
}

export async function fetchLessonQuestionsWithPersonalization(
  lessonId: string,
  readingLevel: ReadingLevel,
  interests: string,
  lessonType: 'micro' | 'macro',
): Promise<LessonQuestion[]> {
  if (lessonId === DEMO_ADVANCED_LESSON_ID) {
    return DEMO_ADVANCED_QUESTIONS
  }
  const activeSet = activePersonalizationByLesson.get(lessonId)
  const personalizationKey = activeSet
    ? `q:${lessonId}:${activeSet.readingLevel}:${activeSet.interests}:${activeSet.lessonType}`
    : `q:${lessonId}:${readingLevel}:${interests}:${lessonType}`
  const cacheKey = personalizationKey
  const cached = personalizedQuestionCache.get(cacheKey)
  if (cached?.length) return cached

  try {
    const generated = await generatePersonalizedQuestionDraft({
      lessonId,
      lessonType: activeSet?.lessonType ?? lessonType,
      readingLevel: activeSet?.readingLevel ?? readingLevel,
      interests: activeSet?.interests ?? interests,
      focusTopic: activeSet?.interests ?? interests,
      difficultyHint: 'standard',
    })
    if (generated && generated.length > 0) {
      const localQuestions: LessonQuestion[] = generated.map((q, idx) => ({
        id: `generated-${lessonId}-${idx + 1}`,
        questionTypeId: q.questionTypeId,
        prompt: q.prompt,
        choices: q.choices,
        answerKey: { correctIndex: q.correctIndex },
        interactionMode: q.interactionMode,
        difficulty: 0.5,
      }))

      const activeLessonDraft = activeSet ? personalizedDraftCache.get(activeSet.cacheKey) : null
      const persistedQuestions = await persistPersonalizedLessonPack({
        lessonId,
        lessonType: activeSet?.lessonType ?? lessonType,
        title: activeLessonDraft?.title ?? `Lesson ${lessonId}`,
        passages:
          activeLessonDraft?.passages ??
          [{ title: `Lesson ${lessonId} Passage`, content: generated[0]?.prompt ?? 'Generated lesson content.' }],
        generatedQuestions: generated,
      })

      const finalQuestions = persistedQuestions ?? localQuestions
      personalizedQuestionCache.set(cacheKey, finalQuestions)
      return finalQuestions
    }

    const dbQuestions = await fetchLessonQuestions(lessonId)
    return dbQuestions
  } catch (error) {
    console.error('[fetchLessonQuestionsWithPersonalization] failed', error)
    return fetchLessonQuestions(lessonId)
  }
}

async function fetchPublishedLessonDbId(lessonId: string): Promise<string | null> {
  const slug = `lesson-${lessonId}`
  const { data, error } = await supabase
    .from('lessons')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_published', true)
    .single()

  if (error || !data) return null
  return data.id as string
}

async function persistPersonalizedLessonPack(args: {
  lessonId: string
  lessonType: 'micro' | 'macro'
  title: string
  forceRefresh?: boolean
  passages: Array<{ title: string; content: string }>
  generatedQuestions: Array<{
    prompt: string
    choices: string[]
    correctIndex: number
    questionTypeId: string
    interactionMode: InteractionMode
  }>
}): Promise<LessonQuestion[] | null> {
  const baseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? ''
  if (!baseUrl) return null

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      console.warn('[persistPersonalizedLessonPack] missing session access token')
      return null
    }

    const res = await fetch(`${baseUrl}/functions/v1/lesson-persist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(args),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.warn('[persistPersonalizedLessonPack] function call failed', res.status, detail)
      return null
    }

    const json = await res.json() as {
      questions?: Array<{
        id: string
        question_type_id: string
        prompt: string
        choices: string[]
        answer_key: { correctIndex?: number }
        interaction_mode: InteractionMode
        difficulty: number
      }>
    }
    const persistedQuestions = (json.questions ?? []).map((q) => ({
      id: q.id,
      questionTypeId: q.question_type_id,
      prompt: q.prompt,
      choices: Array.isArray(q.choices) ? q.choices : [],
      answerKey: q.answer_key ?? {},
      interactionMode: q.interaction_mode ?? 'mcq',
      difficulty: q.difficulty ?? 0.5,
    }))
    return persistedQuestions.length > 0 ? persistedQuestions : null
  } catch (error) {
    console.warn('[persistPersonalizedLessonPack] function exception', error)
    return null
  }
}

export async function createLessonAttempt(
  userId: string,
  lessonId: string,
  readingLevel: ReadingLevel,
  assignedDifficulty = 0.5,
): Promise<string | null> {
  if (!userId) {
    console.warn('[createLessonAttempt] missing userId')
    return null
  }
  await ensureLearnerProfile(userId)

  const lessonDbId = await fetchPublishedLessonDbId(lessonId)
  if (!lessonDbId) {
    console.warn('[createLessonAttempt] no published lesson for slug', `lesson-${lessonId}`)
    return null
  }

  const { data, error } = await supabase
    .from('user_lesson_attempts')
    .insert({
      user_id: userId,
      lesson_id: lessonDbId,
      assigned_difficulty: assignedDifficulty,
      reading_level_at_attempt: readingLevel,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createLessonAttempt]', error.message, error)
    return null
  }
  if (!data) return null
  return (data as LessonAttemptRow).id
}

export async function completeLessonAttempt(lessonAttemptId: string, overallScore: number): Promise<void> {
  const { error } = await supabase
    .from('user_lesson_attempts')
    .update({
      completed_at: new Date().toISOString(),
      overall_score: overallScore,
    })
    .eq('id', lessonAttemptId)
  if (error) console.error('[completeLessonAttempt]', error.message, error)
}

export async function saveQuestionAttempt(args: {
  userId: string
  lessonAttemptId: string
  questionId: string
  response: unknown
  isCorrect: boolean | null
  score: number
  responseTimeMs: number
}): Promise<void> {
  if (!isUuid(args.questionId)) {
    console.warn('[saveQuestionAttempt] skipped non-persisted question id', args.questionId)
    return
  }
  const { error } = await supabase.from('user_question_attempts').insert({
    user_id: args.userId,
    lesson_attempt_id: args.lessonAttemptId,
    question_id: args.questionId,
    response: args.response,
    is_correct: args.isCorrect,
    score: args.score,
    response_time_ms: args.responseTimeMs,
  })
  if (error) console.error('[saveQuestionAttempt]', error.message, error)
}

export async function applyIncrementalSkillMasteryForAttempt(
  userId: string,
  lessonAttemptId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('user_question_attempts')
    .select(
      `
      score,
      questions (
        question_type_id
      )
    `,
    )
    .eq('user_id', userId)
    .eq('lesson_attempt_id', lessonAttemptId)

  if (error || !data) return

  const questionTypes = [...new Set(
    data
      .map((row) => (row.questions as { question_type_id?: string } | null)?.question_type_id)
      .filter((id): id is string => Boolean(id)),
  )]
  if (questionTypes.length === 0) return

  const { data: mappings, error: mappingError } = await supabase
    .from('question_type_skill_categories')
    .select('question_type_id,skill_category_id,weight')
    .in('question_type_id', questionTypes)

  if (mappingError || !mappings) return

  const mappingByType = new Map<string, Array<{ skill: string; weight: number }>>()
  for (const row of mappings) {
    const existing = mappingByType.get(row.question_type_id) ?? []
    existing.push({ skill: row.skill_category_id, weight: row.weight ?? 1 })
    mappingByType.set(row.question_type_id, existing)
  }

  const buckets = new Map<string, { weightedScore: number; totalWeight: number; attempts: number }>()
  for (const row of data) {
    const questionType = (row.questions as { question_type_id?: string } | null)?.question_type_id
    if (!questionType) continue
    const mapped = mappingByType.get(questionType) ?? []
    const score = Number(row.score ?? 0)
    for (const item of mapped) {
      const current = buckets.get(item.skill) ?? { weightedScore: 0, totalWeight: 0, attempts: 0 }
      current.weightedScore += score * item.weight
      current.totalWeight += item.weight
      current.attempts += 1
      buckets.set(item.skill, current)
    }
  }

  for (const [skill, stats] of buckets.entries()) {
    const lessonScore = stats.totalWeight > 0 ? Number((stats.weightedScore / stats.totalWeight).toFixed(2)) : 0
    const { data: currentRow } = await supabase
      .from('user_skill_mastery')
      .select('mastery_score,confidence')
      .eq('user_id', userId)
      .eq('skill_category_id', skill)
      .single()

    const previousMastery = Number(currentRow?.mastery_score ?? 0)
    const previousConfidence = Number(currentRow?.confidence ?? 0)

    // EMA-style update: confidence controls stability.
    const alpha = Math.max(0.15, 1 - previousConfidence / 120)
    const newMastery = Number((previousMastery + alpha * (lessonScore - previousMastery)).toFixed(2))
    const newConfidence = Math.min(100, Number((previousConfidence + Math.max(5, stats.attempts * 4)).toFixed(2)))

    const { error: masteryErr } = await supabase.from('user_skill_mastery').upsert(
      {
        user_id: userId,
        skill_category_id: skill,
        mastery_score: newMastery,
        confidence: newConfidence,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,skill_category_id' },
    )
    if (masteryErr) console.error('[applyIncrementalSkillMastery] mastery upsert', masteryErr.message, masteryErr)

    const { error: eventErr } = await supabase.from('user_skill_mastery_events').insert({
      user_id: userId,
      lesson_attempt_id: lessonAttemptId,
      skill_category_id: skill,
      lesson_score: lessonScore,
      previous_mastery_score: previousMastery,
      new_mastery_score: newMastery,
      previous_confidence: previousConfidence,
      new_confidence: newConfidence,
    })
    if (eventErr) console.error('[applyIncrementalSkillMastery] event insert', eventErr.message, eventErr)
  }
}

export async function fetchUserLearningSnapshot(userId: string): Promise<{
  attempts: number
  answers: number
  masteryRows: number
  trendRows: number
}> {
  const [{ count: attempts }, { count: answers }, { count: masteryRows }, { count: trendRows }] = await Promise.all([
    supabase.from('user_lesson_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_question_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_skill_mastery').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_skill_mastery_events').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    attempts: attempts ?? 0,
    answers: answers ?? 0,
    masteryRows: masteryRows ?? 0,
    trendRows: trendRows ?? 0,
  }
}

export async function generateNextLessonIfNeeded(args: {
  userId: string
  currentLessonId: string
  readingLevel: ReadingLevel
  interests: string
  lessonType: 'micro' | 'macro'
}): Promise<void> {
  const currentId = Number(args.currentLessonId)
  if (!Number.isFinite(currentId)) return
  const nextLessonId = String(currentId + 1)
  const nextSlug = `lesson-${nextLessonId}`

  const { data: existing } = await supabase
    .from('lessons')
    .select('id')
    .eq('slug', nextSlug)
    .eq('is_active', true)
    .eq('is_published', true)
    .maybeSingle()
  if (existing?.id) return

  const draft = await generatePersonalizedLessonDraft({
    lessonId: nextLessonId,
    lessonType: args.lessonType,
    readingLevel: args.readingLevel,
    interests: args.interests,
  })
  const questions = await generatePersonalizedQuestionDraft({
    lessonId: nextLessonId,
    lessonType: args.lessonType,
    readingLevel: args.readingLevel,
    interests: args.interests,
  })
  if (!draft || !questions || questions.length === 0) return

  await persistPersonalizedLessonPack({
    lessonId: nextLessonId,
    lessonType: args.lessonType,
    title: draft.title,
    passages: draft.passages,
    generatedQuestions: questions,
  })
}

export async function ensureDemoAdvancedLesson(interests: string): Promise<void> {
  const lessonId = '15'
  // Force refresh demo lesson every launch so stale persisted content never appears.
  for (const key of [...personalizedQuestionCache.keys()]) {
    if (key.includes(`:${lessonId}:`)) personalizedQuestionCache.delete(key)
  }
  for (const key of [...personalizedDraftCache.keys()]) {
    if (key.includes(`:${lessonId}:`)) personalizedDraftCache.delete(key)
  }
  activePersonalizationByLesson.delete(lessonId)

  const advancedInterests =
    `${interests || 'general literacy'}, taxes, withholding, deductions, filing deadlines, audit notices`

  const draft = await generatePersonalizedLessonDraft({
    lessonId,
    lessonType: 'macro',
    readingLevel: 'adult',
    interests: advancedInterests,
    focusTopic: 'US personal income taxes and filing decisions',
    passageLengthHint: 'long',
    difficultyHint: 'advanced',
  })
  let questions = await generatePersonalizedQuestionDraft({
    lessonId,
    lessonType: 'macro',
    readingLevel: 'adult',
    interests: advancedInterests,
    focusTopic: 'US personal income taxes and filing decisions',
    difficultyHint: 'advanced',
  })

  if (!questions || questions.length < 4) {
    // Retry once with stronger constraints before falling back.
    questions = await generatePersonalizedQuestionDraft({
      lessonId,
      lessonType: 'macro',
      readingLevel: 'adult',
      interests: `${advancedInterests}, IRS notices, schedule C, quarterly estimated taxes`,
      focusTopic:
        'Advanced tax scenarios: withholding vs estimated payments, deductions, filing-status tradeoffs, penalties',
      difficultyHint: 'advanced',
    })
  }

  if (!draft || !questions || questions.length === 0) {
    console.warn('[ensureDemoAdvancedLesson] unable to generate advanced demo lesson')
    return
  }

  // Ensure sufficiently rich demo difficulty.
  let upgradedQuestions = questions.map((q) => ({
    ...q,
    interactionMode: (q.questionTypeId === 'summarize_text' ? 'text' : 'mcq') as InteractionMode,
  }))
  if (upgradedQuestions.length < 4) {
    console.warn('[ensureDemoAdvancedLesson] generated too few advanced questions, using deterministic fallback set')
    upgradedQuestions = [
      {
        prompt:
          'A freelancer had $18,000 withheld through part-time wages and also earned self-employment income. Why might they still owe taxes at filing?',
        choices: [
          'Withholding always covers all tax liabilities, so they cannot owe.',
          'Self-employment income may require estimated payments and includes self-employment tax.',
          'Tax liability depends only on filing status, not income type.',
          'They can avoid all additional tax by claiming standard deduction twice.',
        ],
        correctIndex: 1,
        questionTypeId: 'identify_intertextual_relationships',
        interactionMode: 'mcq' as InteractionMode,
      },
      {
        prompt:
          'Which option best explains the tradeoff between choosing itemized deductions and the standard deduction?',
        choices: [
          'Itemizing is always better because it gives bigger refunds regardless of expenses.',
          'Standard deduction is only for business owners with Schedule C income.',
          'Taxpayers compare total itemized amounts against standard deduction and choose the higher deduction value.',
          'Choosing standard deduction prevents claiming any tax credits.',
        ],
        correctIndex: 2,
        questionTypeId: 'identify_main_idea',
        interactionMode: 'mcq' as InteractionMode,
      },
      {
        prompt:
          'A taxpayer receives a CP14 balance-due notice after filing. What is the strongest immediate action?',
        choices: [
          'Ignore it unless a second notice arrives.',
          'Review the notice details against filed return and pay or arrange a payment plan promptly.',
          'File a new return with lower income estimates.',
          'Claim exempt status retroactively to remove penalties.',
        ],
        correctIndex: 1,
        questionTypeId: 'identify_authors_purpose',
        interactionMode: 'mcq' as InteractionMode,
      },
      {
        prompt:
          'Summarize in 2-3 sentences how under-withholding and missed estimated payments can jointly lead to year-end tax debt.',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        questionTypeId: 'summarize_text',
        interactionMode: 'text' as InteractionMode,
      },
    ]
  }

  await persistPersonalizedLessonPack({
    lessonId,
    lessonType: 'macro',
    title: `Advanced: ${draft.title}`,
    forceRefresh: true,
    passages: draft.passages,
    generatedQuestions: upgradedQuestions,
  })
}
