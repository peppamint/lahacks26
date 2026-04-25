import mitt from 'mitt'
import type { ReadingLevel } from '../constants/readingLevels'
import type { StumbledWord } from '../types'

type Events = {
  'lesson:completed': { lessonId: string; type: 'micro' | 'macro'; score: number }
  'word:stumbled': StumbledWord
  'reading-level:updated': ReadingLevel
}

export const bus = mitt<Events>()
