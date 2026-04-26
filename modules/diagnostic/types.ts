export type { UserProfile, DiagnosticResult, StumbledWord, StumbleResult } from '../../types'
export type { ReadingLevel } from '../../constants/readingLevels'

// ─── Conversation phase ───────────────────────────────────────────────────────
// Controls which UI is active in DiagnosticScreen at any moment.
//
// Full flow:
//   goal_chat
//     → baseline_loading → baseline_reading   (Step 2: rate passages)
//     → domain_loading   → domain_reading      (Step 3: rate domain passages)
//     → speaking_loading → speaking            (Step 4: read aloud)
//     → finalizing → result
//
// To add a new step, insert a value here and add a matching handler in DiagnosticScreen.
export type DiagnosticPhase =
  | 'goal_chat'         // Step 1: multi-turn Claude Sonnet goal conversation
  | 'baseline_loading'  // Pre-fetching all baseline passages in parallel
  | 'baseline_reading'  // Step 2: passage card + Too Easy / Just Right / Too Hard buttons
  | 'domain_loading'    // Pre-fetching domain-specific passages
  | 'domain_reading'    // Step 3: domain passage card + rating buttons
  | 'speaking_loading'  // Generating the speaking passage + requesting mic permission
  | 'speaking'          // Step 4: passage card + hold-to-record button
  | 'finalizing'        // Building the DiagnosticResult from all collected data
  | 'result'            // Displaying the final result to the user

// ─── Goal profile ─────────────────────────────────────────────────────────────
// Extracted by Claude Sonnet from the goal conversation.
// Claude embeds this as <PROFILE>{...}</PROFILE> in its response when ready.
// If extraction fails, the screen falls back to defaults (see DiagnosticScreen).
export interface GoalProfile {
  motivation: string  // free-form: why they want to improve reading
  interests: string   // free-form: hobbies, topics, life context
}

// ─── Passage ──────────────────────────────────────────────────────────────────
// A Claude-generated reading passage tied to a specific level.
export interface GeneratedPassage {
  level: import('../../constants/readingLevels').ReadingLevel
  text: string
}

// ─── Passage rating ───────────────────────────────────────────────────────────
// The three-button response a learner gives after reading a passage silently.
export type PassageRating = 'too_easy' | 'just_right' | 'too_hard'

// ─── Passage feedback (claude.ts compatibility) ───────────────────────────────
// Used by estimateReadingLevel in services/claude.ts.
export interface PassageFeedback {
  level: import('../../constants/readingLevels').ReadingLevel
  rating: PassageRating
}

// ─── Baseline round result ────────────────────────────────────────────────────
// Records the outcome of one silent-reading passage in the baseline (Step 2)
// or domain (Step 3) phase. Level locking uses these ratings.
export interface BaselineRoundResult {
  level: import('../../constants/readingLevels').ReadingLevel
  rating: PassageRating
}

// ─── Chat message ─────────────────────────────────────────────────────────────
// One bubble in the chat UI. 'reid' renders left with avatar; 'user' renders right.
export interface ChatMessage {
  role: 'reid' | 'user'
  text: string
}
