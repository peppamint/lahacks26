export type ReadingLevel =
  | 'pre-k'
  | 'grade1'
  | 'grade3'
  | 'grade5'
  | 'grade8'
  | 'grade10'
  | 'adult'

export const LEVEL_LABELS: Record<ReadingLevel, string> = {
  'pre-k':   'Beginning (Pre-K)',
  'grade1':  'Early Reader (Grade 1–2)',
  'grade3':  'Developing (Grade 3–4)',
  'grade5':  'Intermediate (Grade 5–6)',
  'grade8':  'Confident (Grade 7–8)',
  'grade10': 'Advanced (Grade 9–10)',
  'adult':   'Proficient Adult',
}

export const READING_LEVELS: ReadingLevel[] = [
  'pre-k', 'grade1', 'grade3', 'grade5', 'grade8', 'grade10', 'adult',
]
