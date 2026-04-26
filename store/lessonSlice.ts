/*import type { StateCreator } from 'zustand'
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
})*/

import type { StateCreator } from 'zustand'
import type { StumbledWord } from '../types'

// Status of each lesson on the map. Keyed by lesson ID.
export type LessonStatus = 'completed' | 'current' | 'locked'

export interface LessonProgressEntry {
  status: LessonStatus
  stars: number // 0–3
}

export interface LessonState {
  activeLessonId: string | null
  currentChapter: number
  stumbledWords: StumbledWord[]
  // Map progress: lessonId → { status, stars }
  lessonProgress: Record<string, LessonProgressEntry>

  setActiveLessonId: (id: string | null) => void
  setCurrentChapter: (chapter: number) => void
  addStumbledWord: (word: StumbledWord) => void
  clearStumbledWords: () => void
  // Call this when a lesson is completed (e.g. at end of lesson screen)
  completeLesson: (lessonId: string, stars: number, nextLessonId: string | null) => void
  // Seed initial progress (e.g. after fetching from Supabase)
  setLessonProgress: (progress: Record<string, LessonProgressEntry>) => void
}

export const createLessonSlice: StateCreator<LessonState> = (set) => ({
  activeLessonId: null,
  currentChapter: 0,
  stumbledWords: [],
  lessonProgress: {},

  setActiveLessonId: (id) => set({ activeLessonId: id }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  addStumbledWord: (word) => set((s) => ({ stumbledWords: [...s.stumbledWords, word] })),
  clearStumbledWords: () => set({ stumbledWords: [] }),
  setLessonProgress: (progress) => set({ lessonProgress: progress }),

  completeLesson: (lessonId, stars, nextLessonId) =>
    set((s) => ({
      activeLessonId: nextLessonId,
      lessonProgress: {
        ...s.lessonProgress,
        [lessonId]: { status: 'completed', stars },
        // Unlock the next lesson
        ...(nextLessonId && s.lessonProgress[nextLessonId]?.status === 'locked'
          ? { [nextLessonId]: { status: 'current', stars: 0 } }
          : {}),
      },
    })),
})