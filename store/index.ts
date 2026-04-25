import { create } from 'zustand'
import { createUserSlice, type UserState } from './userSlice'
import { createLessonSlice, type LessonState } from './lessonSlice'
import { createProgressSlice, type ProgressState } from './progressSlice'

type StoreState = UserState & LessonState & ProgressState

export const useStore = create<StoreState>()((...args) => ({
  ...createUserSlice(...args),
  ...createLessonSlice(...args),
  ...createProgressSlice(...args),
}))
