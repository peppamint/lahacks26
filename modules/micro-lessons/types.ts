import type { ReadingLevel } from '../../constants/readingLevels'
import type { Domain } from '../../constants/domains'
import type { SkillCategory } from '../../constants/skills'

export interface MicroLessonQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}

export interface MicroLessonItem {
  id: string
  passage: string
  question: MicroLessonQuestion
}

export interface MicroLessonPlan {
  lessonId: string
  title: string
  domain: Domain
  targetCategory: SkillCategory
  targetSkillLevel: ReadingLevel
  items: MicroLessonItem[]
  quiz: MicroLessonQuestion[]
}

export interface MicroLessonResult {
  lessonId: string
  targetCategory: SkillCategory
  targetSkillLevel: ReadingLevel
  scorePercent: number
  correctCount: number
  totalCount: number
  recommendedNextLevel: ReadingLevel
}
