export type { ReadingLevel } from '../constants/readingLevels'
export type { Domain } from '../constants/domains'

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string
  goal: string
  domain: import('../constants/domains').Domain
  readingLevel: import('../constants/readingLevels').ReadingLevel
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  readingLevel: import('../constants/readingLevels').ReadingLevel
  domain: import('../constants/domains').Domain
  // Patterns identified from stumbled words across all reading phases,
  // e.g. ['multi-syllable words', 'punctuation pausing']
  weakAreas: string[]
  // 'micro' for grade3 and below; 'macro' for grade5 and above
  recommendedLessonType: 'micro' | 'macro'
  // Claude-generated 2-sentence personalized first lesson description
  firstLessonSuggestion: string
  completedAt: string
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── Comprehension ────────────────────────────────────────────────────────────

export interface Question {
  id: string
  text: string
  options: string[]
  correctIndex: number
}

// ─── Speech / Stumble ─────────────────────────────────────────────────────────

export interface StumbledWord {
  word: string
  context: string
  timestamp: string
}

export interface StumbleResult {
  stumbledWords: StumbledWord[]
  confidence: number
  transcript: string
}

export interface SpeechConfig {
  offline: boolean
  language?: string
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export interface MicroLessonConfig {
  lessonId: string
  documentText: string
  readingLevel: import('../constants/readingLevels').ReadingLevel
  domain: import('../constants/domains').Domain
}

export interface MacroLessonConfig {
  lessonId: string
  title: string
  chapters: Chapter[]
  readingLevel: import('../constants/readingLevels').ReadingLevel
}

export interface Chapter {
  chapterId: string
  index: number
  title: string
  content: string
}

export interface ComprehensionQuestion extends Question {
  chapterId: string
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressStats {
  lessonsCompleted: number
  wordsLearned: number
  averageScore: number
  readingLevel: import('../constants/readingLevels').ReadingLevel
  lastUpdated: string
}

export interface WordBankEntry {
  id: string
  word: string
  context: string
  pronunciationUrl?: string
  createdAt: string
}
