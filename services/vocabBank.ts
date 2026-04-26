import { supabase } from './supabase'
import type { StumbledWord } from '../types'

export async function addToVocabBank(userId: string, word: StumbledWord): Promise<void> {
  await supabase.from('word_bank').insert({
    user_id: userId,
    word: word.word,
    context: word.context,
    created_at: word.timestamp,
  })
}

export async function getVocabBank(userId: string) {
  const { data, error } = await supabase
    .from('word_bank')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch vocab bank: ${error.message}`)
  return data
}