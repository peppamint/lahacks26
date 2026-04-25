import type { ReadingLevel } from '../../constants/readingLevels'

export interface PlainEnglishConfig {
  url?: string
  rawText?: string
  targetLevel: ReadingLevel
}

export interface DocumentTemplate {
  id: string
  label: string
  sampleText: string
}
