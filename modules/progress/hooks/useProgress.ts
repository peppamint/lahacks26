import { useEffect } from 'react'
import { bus } from '../../../utils/eventBus'
import { useStore } from '../../../store'
import { supabase } from '../../../services/supabase'
import { fetchProgressStats, fetchWordBank } from '../../../services/progress'

export function useProgress() {
  const { stats, wordBank, setStats, addWordBankEntry, userId } = useStore()

  // Load initial data on mount
  useEffect(() => {
    if (userId) {
      loadInitialData()
    }
  }, [userId])

  async function loadInitialData() {
    if (!userId) return
    try {
      const [progressStats, wordBankData] = await Promise.all([
        fetchProgressStats(userId),
        fetchWordBank(userId),
      ])
      if (progressStats) {
        setStats(progressStats)
      }
      // Sync word bank with fetched data
      wordBankData.forEach((entry) => {
        addWordBankEntry(entry)
      })
    } catch (error) {
      console.error('Error loading initial progress data:', error)
    }
  }

  // Listen for real-time lesson completion events
  useEffect(() => {
    bus.on('lesson:completed', async (data) => {
      try {
        // Save progress event to Supabase
        const { error } = await supabase.from('progress_events').insert({
          user_id: userId,
          lesson_id: data.lessonId,
          lesson_type: data.type,
          score: data.score,
        })
        if (error) console.error('Failed to save progress:', error)
        else if (userId) {
          // Refresh stats after saving
          const updated = await fetchProgressStats(userId)
          if (updated) setStats(updated)
        }
      } catch (error) {
        console.error('Error handling lesson completion:', error)
      }
    })

    bus.on('word:stumbled', async (word) => {
      try {
        // Save stumbled word to Supabase
        const { error } = await supabase.from('word_bank').insert({
          user_id: userId,
          word: word.word,
          context: word.context,
          pronunciation_url: word.pronunciationUrl,
        })
        if (error) console.error('Failed to save stumbled word:', error)
        else {
          // Add to local state
          addWordBankEntry({
            id: `${Date.now()}`,
            word: word.word,
            context: word.context,
            pronunciationUrl: word.pronunciationUrl,
            createdAt: new Date().toISOString(),
          })
        }
      } catch (error) {
        console.error('Error saving stumbled word:', error)
      }
    })

    return () => {
      bus.off('lesson:completed')
      bus.off('word:stumbled')
    }
  }, [userId, setStats, addWordBankEntry])

  return { stats, wordBank }
}
