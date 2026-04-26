import { supabase } from './supabase'
import type { ProgressStats, WordBankEntry } from '../types'

/**
 * Fetch all progress stats for the current user
 */
export async function fetchProgressStats(userId: string): Promise<ProgressStats | null> {
  try {
    // Try to get profile data, but don't fail if it doesn't exist
    const { data: profileData } = await supabase
      .from('profiles')
      .select('reading_level, created_at')
      .eq('id', userId)
      .single()

    // Count lessons completed
    const { count: lessonsCompleted } = await supabase
      .from('progress_events')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)

    // Count unique words learned
    const { count: wordsLearned } = await supabase
      .from('word_bank')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)

    // Calculate average score
    const { data: scoreData } = await supabase
      .from('progress_events')
      .select('score')
      .eq('user_id', userId)

    const avgScore =
      scoreData && scoreData.length > 0
        ? scoreData.reduce((sum, row) => sum + (row.score || 0), 0) / scoreData.length
        : 0

    return {
      lessonsCompleted: lessonsCompleted || 0,
      wordsLearned: wordsLearned || 0,
      averageScore: Math.round(avgScore),
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error fetching progress stats:', error)
    return null
  }
}

/**
 * Fetch progress for today (words learned + grammar structures)
 */
export async function fetchTodayProgress(userId: string): Promise<{
  wordsLearnedToday: number
  grammarStructuresLearned: number
}> {
  try {
    // First check if user exists in profiles table
    const { data: userExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!userExists) {
      console.log('User not found in database, returning zero progress')
      return {
        wordsLearnedToday: 0,
        grammarStructuresLearned: 0,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startOfToday = today.toISOString()

    // Count words learned today
    const { count: wordsToday } = await supabase
      .from('word_bank')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startOfToday)

    // Count lessons (grammar structures) completed today
    const { count: lessonsToday } = await supabase
      .from('progress_events')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('completed_at', startOfToday)

    return {
      wordsLearnedToday: wordsToday || 0,
      grammarStructuresLearned: lessonsToday || 0,
    }
  } catch (error) {
    console.error('Error fetching today progress:', error)
    return {
      wordsLearnedToday: 0,
      grammarStructuresLearned: 0,
    }
  }
}

/**
 * Fetch word bank entries for the current user
 */
export async function fetchWordBank(userId: string): Promise<WordBankEntry[]> {
  try {
    // First check if user exists in profiles table
    const { data: userExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!userExists) {
      console.log('User not found in database, returning empty word bank')
      return []
    }

    const { data, error } = await supabase
      .from('word_bank')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching word bank:', error)
      return []
    }

    return (
      data?.map((row) => ({
        id: row.id,
        word: row.word,
        context: row.context,
        pronunciationUrl: row.pronunciation_url,
        createdAt: row.created_at,
      })) || []
    )
  } catch (error) {
    console.error('Error fetching word bank:', error)
    return []
  }
}

/**
 * Fetch reading level progression over time (last 7 days)
 */
export async function fetchReadingLevelTrend(
  userId: string
): Promise<{ date: string; level: string }[]> {
  try {
    const { data, error } = await supabase
      .from('progress_events')
      .select('completed_at, reading_level')
      .eq('user_id', userId)
      .order('completed_at', { ascending: true })

    if (error || !data) return []

    // Group by date and get last reading level for each date
    const trendMap = new Map<string, string>()
    data.forEach((row) => {
      const date = new Date(row.completed_at).toISOString().split('T')[0]
      trendMap.set(date, row.reading_level)
    })

    return Array.from(trendMap.entries()).map(([date, level]) => ({
      date,
      level,
    }))
  } catch (error) {
    console.error('Error fetching reading level trend:', error)
    return []
  }
}
