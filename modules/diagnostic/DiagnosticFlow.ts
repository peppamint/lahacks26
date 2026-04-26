import { READING_LEVELS } from '../../constants/readingLevels'
import {
  generateReadingPassage,
  generateDomainPassage,
  analyzeWeakAreas,
  generateFirstLesson,
} from '../../services/claude'
import type { DiagnosticResult, StumbledWord } from '../../types'
import type { ReadingLevel } from '../../constants/readingLevels'
import type { GoalProfile, GeneratedPassage, BaselineRoundResult } from './types'

// ─── Step 1 Configuration ─────────────────────────────────────────────────────

// Maximum number of goal conversation turns before a "Skip to Reading Test"
// button appears, letting the user bypass the chat if needed.
export const GOAL_TURN_LIMIT = 8

// ─── Step 2 Configuration ─────────────────────────────────────────────────────

// The levels shown in order during the baseline reading test.
// Passages are generated in parallel when baseline_loading begins.
// To change the difficulty spread, reorder or replace these levels.
export const BASELINE_LEVELS: ReadingLevel[] = ['pre-k', 'grade1', 'grade3', 'grade5', 'grade8']

// ─── Step 3 Configuration ─────────────────────────────────────────────────────

// Number of domain-specific passages shown after the baseline.
// These calibrate domain vocabulary gaps at the learner's detected level.
export const DOMAIN_PASSAGE_COUNT = 3

// ─── Step 2 — Baseline passage generation ────────────────────────────────────

// Pre-generates all baseline passages in parallel so the user never waits
// between passages. Called once when baseline_loading begins.
export async function generateBaselinePassages(): Promise<GeneratedPassage[]> {
  return Promise.all(
    BASELINE_LEVELS.map(async (level) => ({
      level,
      text: await generateReadingPassage(level),
    })),
  )
}

// ─── Step 2 — Level locking from ratings ─────────────────────────────────────

// Determines the learner's reading level from the baseline rating results.
//
// Rules (in priority order):
//   "too_hard" on first passage → pre-k
//   "too_hard" on later passage  → level of the previous passage
//   last "just_right"            → that level
//   all "too_easy"               → highest level tested
//
// To change the locking logic, modify the conditions below.
export function determineLevelFromRatings(ratings: BaselineRoundResult[]): ReadingLevel {
  if (ratings.length === 0) return 'grade1'

  const tooHardIndex = ratings.findIndex((r) => r.rating === 'too_hard')
  if (tooHardIndex === 0) return 'pre-k'
  if (tooHardIndex > 0) return ratings[tooHardIndex - 1].level

  const lastJustRight = [...ratings].reverse().find((r) => r.rating === 'just_right')
  if (lastJustRight) return lastJustRight.level

  // All "too_easy" — use the highest level tested.
  return ratings[ratings.length - 1].level
}

// ─── Step 3 — Domain passage generation ──────────────────────────────────────

// Generates DOMAIN_PASSAGE_COUNT real-world snippets from the learner's domain
// at their detected reading level. Called once when domain_loading begins.
export async function generateDomainPassages(
  interests: string,
  level: ReadingLevel,
): Promise<string[]> {
  return Promise.all(
    Array.from({ length: DOMAIN_PASSAGE_COUNT }, () =>
      generateDomainPassage(interests, level),
    ),
  )
}

// ─── Step 4 — Speaking passage generation ────────────────────────────────────

// Generates the single passage used for the oral reading assessment.
// Re-uses generateDomainPassage so it matches the learner's interests and level.
export async function generateSpeakingPassage(
  interests: string,
  level: ReadingLevel,
): Promise<string> {
  return generateDomainPassage(interests, level)
}

// ─── Finalization ─────────────────────────────────────────────────────────────

// Builds the final DiagnosticResult from all collected data.
// Runs weak area analysis and first lesson generation in parallel for speed.
// allStumbles now comes exclusively from the Step 4 speaking phase.
export async function buildDiagnosticResult(
  goalProfile: GoalProfile,
  baselineLevel: ReadingLevel,
  allStumbles: StumbledWord[],
): Promise<DiagnosticResult> {
  const [weakAreas, firstLessonSuggestion] = await Promise.all([
    analyzeWeakAreas(allStumbles),
    generateFirstLesson(goalProfile.motivation, goalProfile.interests, baselineLevel, []),
  ])

  // Learners at grade3 and below get short micro-lessons (5–10 min);
  // more advanced learners get longer macro-lessons (chapters + comprehension Qs).
  // To change this threshold, adjust the indexOf comparison below.
  const recommendedLessonType: 'micro' | 'macro' =
    READING_LEVELS.indexOf(baselineLevel) <= READING_LEVELS.indexOf('grade3')
      ? 'micro'
      : 'macro'

  return {
    readingLevel: baselineLevel,
    interests: goalProfile.interests,
    weakAreas,
    recommendedLessonType,
    firstLessonSuggestion,
    completedAt: new Date().toISOString(),
  }
}
