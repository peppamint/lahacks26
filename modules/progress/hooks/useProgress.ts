import { useEffect } from 'react'
import { bus } from '../../../utils/eventBus'
import { useStore } from '../../../store'
import { supabase } from '../../../services/supabase'

export function useProgress() {
  const { stats, wordBank, setStats, addWordBankEntry } = useStore()

  useEffect(() => {
    bus.on('lesson:completed', async (data) => {
      if (!supabase) {
        console.error('Supabase is not configured.')
        return
      }

      // TODO: save progress event to Supabase and refresh stats
      const { error } = await supabase.from('progress_events').insert({
        lesson_id: data.lessonId,
        lesson_type: data.type,
        score: data.score,
      })
      if (error) console.error('Failed to save progress:', error)
    })

    bus.on('word:stumbled', (word) => {
      addWordBankEntry({
        id: `${Date.now()}`,
        word: word.word,
        context: word.context,
        createdAt: word.timestamp,
      })
    })

    return () => {
      bus.off('lesson:completed')
      bus.off('word:stumbled')
    }
  }, [])

  return { stats, wordBank }
}
