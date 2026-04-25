import { createClient } from '@supabase/supabase-js'
import type { UserProfile, ProgressStats, WordBankEntry } from '../types'

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? ''
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.user
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.user
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function saveProfile(profile: UserProfile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    id: profile.userId,
    goal: profile.goal,
    domain: profile.domain,
    reading_level: profile.readingLevel,
  })
  if (error) throw error
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
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
  readingLevel: string,
): Promise<void> {
  const { error } = await supabase.from('progress_events').insert({
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
  const { error } = await supabase.from('word_bank').insert({ user_id: userId, word, context })
  if (error) throw error
}

export async function getWordBank(userId: string): Promise<WordBankEntry[]> {
  const { data, error } = await supabase
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
