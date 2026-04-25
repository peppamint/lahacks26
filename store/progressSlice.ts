import type { StateCreator } from 'zustand'
import type { ProgressStats, WordBankEntry } from '../types'

export interface ProgressState {
  stats: ProgressStats | null
  wordBank: WordBankEntry[]
  lastSynced: Date | null
  setStats: (stats: ProgressStats) => void
  addWordBankEntry: (entry: WordBankEntry) => void
  setLastSynced: (date: Date) => void
}

export const createProgressSlice: StateCreator<ProgressState> = (set) => ({
  stats: null,
  wordBank: [],
  lastSynced: null,
  setStats: (stats) => set({ stats }),
  addWordBankEntry: (entry) => set((s) => ({ wordBank: [...s.wordBank, entry] })),
  setLastSynced: (date) => set({ lastSynced: date }),
})
