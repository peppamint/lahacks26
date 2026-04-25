import { createClient } from '@supabase/supabase-js'
import type { UserProfile } from '../types'

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

export async function getOrCreateUserId(): Promise<string> {
  assertSupabaseConfigured()
  const client = supabase

  if (!client) {
    throw new Error('Supabase client is not initialized.')
  }

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

export async function upsertProfile(profile: UserProfile): Promise<void> {
  assertSupabaseConfigured()
  const client = supabase

  if (!client) {
    throw new Error('Supabase client is not initialized.')
  }

  const { error } = await client.from('profiles').upsert({
    id: profile.userId,
    goal: profile.goal,
    domain: profile.domain,
    reading_level: profile.readingLevel,
  })

  if (error) {
    throw new Error(error.message)
  }
}
