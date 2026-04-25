import { createClient } from '@supabase/supabase-js'
import type { UserProfile } from '../types'
import type { WordBankEntry } from '../types'
import type { ReadingLevel } from '../constants/readingLevels'

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? ''
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const hasSupabaseEnv = supabaseUrl.length > 0 && supabaseAnonKey.length > 0

export const supabase = hasSupabaseEnv ? createClient(supabaseUrl, supabaseAnonKey) : null

function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error(
      'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart with "npx expo start -c".',
    )
  }
}

function getSupabaseClient() {
  assertSupabaseConfigured()
  const client = supabase
  if (!client) {
    throw new Error('Supabase client is not initialized.')
  }
  return client
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnonymously() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  return data.user
}

export async function signUpWithEmail(email: string, password: string) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return data.user
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function getCurrentUser() {
  const client = getSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

export async function getOrCreateUserId(): Promise<string> {
  const client = getSupabaseClient()

  const {
    data: { user },
    error: getUserError,
  } = await client.auth.getUser()

  if (getUserError) {
    const isMissingSession = getUserError.message.toLowerCase().includes('auth session missing')
    if (!isMissingSession) {
      throw new Error(getUserError.message)
    }
  }

  if (user?.id) {
    return user.id
  }

  const {
    data: { user: anonymousUser },
    error: anonError,
  } = await client.auth.signInAnonymously()

  if (anonError) {
    throw new Error(
      `Could not create an anonymous auth session. Enable Anonymous sign-ins in Supabase Auth settings. ${anonError.message}`,
    )
  }

  if (!anonymousUser?.id) {
    throw new Error('Supabase auth returned no user id.')
  }

  return anonymousUser.id
}

export async function ensureAuthSession(): Promise<{ userId: string }> {
  const userId = await getOrCreateUserId()
  return { userId }
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function upsertProfile(profile: UserProfile): Promise<void> {
  const client = getSupabaseClient()
  const { error } = await client.from('profiles').upsert({
    id: profile.userId,
    goal: profile.goal,
    domain: profile.domain,
    reading_level: profile.readingLevel,
  })
  if (error) throw error
}

export const saveProfile = upsertProfile

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return {
    userId: data.id,
    goal: data.goal,
    domain: data.domain,
    readingLevel: data.reading_level,
  }
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function saveProgressEvent(
  userId: string,
  lessonId: string,
  lessonType: 'micro' | 'macro',
  score: number,
  readingLevel: ReadingLevel,
): Promise<void> {
  const client = getSupabaseClient()
  const { error } = await client.from('progress_events').insert({
    user_id: userId,
    lesson_id: lessonId,
    lesson_type: lessonType,
    score,
    reading_level: readingLevel,
  })
  if (error) throw error
}

// ─── Word Bank ────────────────────────────────────────────────────────────────

export async function saveWord(userId: string, word: string, context: string): Promise<void> {
  const client = getSupabaseClient()
  const { error } = await client.from('word_bank').insert({ user_id: userId, word, context })
  if (error) throw error
}

export async function getWordBank(userId: string): Promise<WordBankEntry[]> {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('word_bank')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    word: row.word,
    context: row.context,
    pronunciationUrl: row.pronunciation_url,
    createdAt: row.created_at,
  }))
}
