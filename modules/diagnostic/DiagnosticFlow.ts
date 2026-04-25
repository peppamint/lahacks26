import { READING_LEVELS } from '../../constants/readingLevels'
import { generateReadingPassage, estimateReadingLevel } from '../../services/claude'
import type { DiagnosticResult } from '../../types'
import type { PassageFeedback, PassageRating, GeneratedPassage } from './types'
import type { ReadingLevel } from '../../constants/readingLevels'

// ─── Configuration ────────────────────────────────────────────────────────────

// Number of passages shown to the user during the diagnostic.
// Increase for a more accurate estimate; decrease for a faster onboarding.
export const PASSAGE_COUNT = 5

// The reading level of the very first passage shown.
// 'grade5' is the midpoint of the 7-level scale, making it a neutral starting point.
// Change to 'grade1' to start easier, or 'grade8' to start harder.
export const START_LEVEL: ReadingLevel = 'grade5'

// ─── Passage selection ────────────────────────────────────────────────────────

// Determines the level of the next passage using a simple binary-search-style
// adaptive algorithm:
//   - "too easy"  → step one level UP
//   - "too hard"  → step one level DOWN
//   - "just right" → stay at the same level
//
// To change the step size (e.g. jump two levels at a time), replace
// Math.min(idx + 1, ...) with Math.min(idx + 2, ...) and similarly for down.
export async function fetchNextPassage(
  currentLevel: ReadingLevel,
  lastRating: PassageRating | null,
): Promise<GeneratedPassage> {
  let level = currentLevel

  if (lastRating === 'too_easy') {
    // Move up one level — capped at the highest level ('adult')
    const idx = READING_LEVELS.indexOf(currentLevel)
    level = READING_LEVELS[Math.min(idx + 1, READING_LEVELS.length - 1)]
  } else if (lastRating === 'too_hard') {
    // Move down one level — capped at the lowest level ('pre-k')
    const idx = READING_LEVELS.indexOf(currentLevel)
    level = READING_LEVELS[Math.max(idx - 1, 0)]
  }
  // 'just_right' leaves the level unchanged

  const text = await generateReadingPassage(level)
  return { level, text }
}

// ─── Result calculation ───────────────────────────────────────────────────────

// Called once all passages have been rated. Sends the full feedback array
// to Claude (Haiku) which weighs all ratings to produce a final ReadingLevel.
//
// stumbledWords is reserved for future Whisper-based voice input — pass []
// until the speech module is integrated.
export async function finalizeDiagnostic(
  feedback: PassageFeedback[],
  stumbledWords: DiagnosticResult['stumbledWords'],
): Promise<DiagnosticResult> {
  // To swap in a local algorithm instead of Claude, replace this call with
  // your own logic over the feedback array, e.g. pick the most common
  // 'just_right' level, or average the level indices.
  const estimatedLevel = await estimateReadingLevel(feedback)

  return {
    estimatedLevel,
    stumbledWords,
    completedAt: new Date().toISOString(),
  }
}
