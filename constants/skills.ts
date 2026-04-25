import { READING_LEVELS, type ReadingLevel } from './readingLevels'

export type SkillCategory =
  | 'activeSelfRegulation'
  | 'bridgingProcesses'
  | 'languageComprehension'
  | 'wordRecognition'

export type SkillLevels = Record<SkillCategory, ReadingLevel>

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  activeSelfRegulation: 'Active Self Regulation',
  bridgingProcesses: 'Bridging Processes',
  languageComprehension: 'Language Comprehension',
  wordRecognition: 'Word Recognition',
}

export function buildInitialSkillLevels(level: ReadingLevel): SkillLevels {
  return {
    activeSelfRegulation: level,
    bridgingProcesses: level,
    languageComprehension: level,
    wordRecognition: level,
  }
}

export function adjustReadingLevel(level: ReadingLevel, delta: -1 | 0 | 1): ReadingLevel {
  const index = READING_LEVELS.indexOf(level)
  if (index < 0 || delta === 0) return level
  if (delta > 0) return READING_LEVELS[Math.min(index + 1, READING_LEVELS.length - 1)]
  return READING_LEVELS[Math.max(index - 1, 0)]
}
