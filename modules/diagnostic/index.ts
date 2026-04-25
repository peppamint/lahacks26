// ─── Public API for the diagnostic module ────────────────────────────────────
// Other modules should only import from here, never from internal files.
// The DiagnosticScreen is wired into navigation in App.tsx — it does not need
// to be exported from this index since it's consumed directly by the navigator.

// DiagnosticFlow exports passage/finalization helpers consumed by the screen.
export { fetchNextPassage, finalizeDiagnostic, START_LEVEL, PASSAGE_COUNT } from './DiagnosticFlow'
export { DiagnosticScreen } from './DiagnosticScreen'
export type { UserProfile, DiagnosticResult } from '../../types'
