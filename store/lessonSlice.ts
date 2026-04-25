import type { StateCreator } from 'zustand'
import type { StumbledWord } from '../types'

export interface LessonState {
  activeLessonId: string | null
  currentChapter: number
  stumbledWords: StumbledWord[]
  setActiveLessonId: (id: string | null) => void
  setCurrentChapter: (chapter: number) => void
  addStumbledWord: (word: StumbledWord) => void
  clearStumbledWords: () => void
}

export const createLessonSlice: StateCreator<LessonState> = (set) => ({
  activeLessonId: null,
  currentChapter: 0,
  stumbledWords: [],
  setActiveLessonId: (id) => set({ activeLessonId: id }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  addStumbledWord: (word) => set((s) => ({ stumbledWords: [...s.stumbledWords, word] })),
  clearStumbledWords: () => set({ stumbledWords: [] }),
})
