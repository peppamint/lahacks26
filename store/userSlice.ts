import type { StateCreator } from 'zustand'
import type { UserProfile } from '../types'
import type { ReadingLevel } from '../constants/readingLevels'
import { buildInitialSkillLevels, type SkillLevels } from '../constants/skills'

export interface UserState {
  userId: string
  profile: UserProfile | null
  readingLevel: ReadingLevel
  skillLevels: SkillLevels
  setUserId: (id: string) => void
  setProfile: (profile: UserProfile) => void
  setReadingLevel: (level: ReadingLevel) => void
  setSkillLevels: (skillLevels: SkillLevels) => void
}

export const createUserSlice: StateCreator<UserState> = (set) => ({
  userId: '',
  profile: null,
  readingLevel: 'grade1',
  skillLevels: buildInitialSkillLevels('grade1'),
  setUserId: (id) => set({ userId: id }),
  setProfile: (profile) => set({ profile }),
  setReadingLevel: (readingLevel) => set({ readingLevel }),
  setSkillLevels: (skillLevels) => set({ skillLevels }),
})
