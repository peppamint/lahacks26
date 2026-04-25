// ─── Public API for the diagnostic module ────────────────────────────────────
// Other modules should only import from here, never from internal files.
// DiagnosticScreen is consumed directly by the navigator in App.tsx.

export { DiagnosticScreen } from './DiagnosticScreen'
export type { DiagnosticResult, UserProfile } from '../../types'
export type { GoalProfile } from './types'
