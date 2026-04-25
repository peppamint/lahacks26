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

const FALLBACK_PASSAGES: Record<ReadingLevel, string> = {
  'pre-k': 'Sam has a red hat. Sam pets a cat. The cat is soft. Sam smiles.',
  grade1: 'Mia rides the bus to work. She sits by the window and reads signs. At her stop, she thanks the driver.',
  grade3: 'Jordan checks the weather before leaving home. It might rain this afternoon, so Jordan packs a small umbrella in a backpack.',
  grade5: 'At the community center, volunteers set up tables for a food drive. Neighbors bring canned soup, rice, and pasta, and each donation is sorted by type.',
  grade8: 'During a busy shift, Elena reviews a checklist before closing the store. She verifies the register totals, restocks low items, and leaves notes for the morning team.',
  grade10: 'When city buses changed routes, many riders were confused for a week. The transit office posted updated maps online and at each station, which gradually reduced delays.',
  adult: 'Before signing a lease, Marcus compared monthly rent, utility terms, and maintenance clauses across three apartments. By calculating total annual cost instead of rent alone, he avoided an option with hidden fees.',
}

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

  const text = await generateReadingPassage(level).catch((error) => {
    console.error('[fetchNextPassage] Falling back to local passage:', error)
    return FALLBACK_PASSAGES[level]
  })
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
