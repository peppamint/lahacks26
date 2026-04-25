// ─── Re-exports from shared types ─────────────────────────────────────────────
// These are defined in /types/index.ts and /constants/ — imported here so the
// rest of the diagnostic module only needs to import from one place.
export type { UserProfile, DiagnosticResult, StumbledWord } from '../../types'
export type { ReadingLevel } from '../../constants/readingLevels'

// ─── Conversation phase ───────────────────────────────────────────────────────
// Controls which UI is shown and how handleSend() behaves in DiagnosticScreen.
//
// Phase order:
//   name → goal → interest → passage_intro → passage (×N) → result
//
// To add a new conversation step (e.g. ask for age), insert a new value here
// and add a matching branch in DiagnosticScreen's handleSend().
export type DiagnosticPhase =
  | 'name'          // Reid asks for the user's name
  | 'goal'          // Reid asks about reading goals/motivation
  | 'interest'      // Reid asks about personal interests
  | 'passage_intro' // Transition phase — no input, triggers first passage load
  | 'passage'       // Passage is shown; user taps a rating button (no text input)
  | 'result'        // Final level announced; navigates away after a short pause

// ─── Passage rating ───────────────────────────────────────────────────────────
// The three options shown as buttons during the passage phase.
// To add a rating option (e.g. 'way_too_hard'), add it here, add a button in
// DiagnosticScreen's ratingRow, and update fetchNextPassage() in DiagnosticFlow.ts.
export type PassageRating = 'too_easy' | 'just_right' | 'too_hard'

// ─── Passage ──────────────────────────────────────────────────────────────────
// A single passage fetched from Claude, paired with the level it was generated at.
// The level is stored so DiagnosticFlow can report it back to the user after rating.
export interface GeneratedPassage {
  level: import('../../constants/readingLevels').ReadingLevel
  text: string
}

// ─── Chat message ─────────────────────────────────────────────────────────────
// One bubble in the chat UI. 'reid' renders on the left with an avatar;
// 'user' renders on the right in indigo.
// To add a third speaker (e.g. a system notification), add its role here and
// handle the new style in DiagnosticScreen's bubble renderer.
export interface ChatMessage {
  role: 'reid' | 'user'
  text: string
}

// ─── Passage feedback ─────────────────────────────────────────────────────────
// One entry per passage round — records what level was shown and how the user
// rated it. The full array is passed to estimateReadingLevel() in DiagnosticFlow
// so Claude can weigh all rounds together.
export interface PassageFeedback {
  level: import('../../constants/readingLevels').ReadingLevel
  rating: PassageRating
}
