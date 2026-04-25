// ─── Public API for the diagnostic module ────────────────────────────────────
// Other modules should only import from here, never from internal files.
// The DiagnosticScreen is wired into navigation in App.tsx — it does not need
// to be exported from this index since it's consumed directly by the navigator.

// runDiagnostic is the programmatic entry point if you ever want to trigger the
// diagnostic flow from outside the screen (e.g. a "retake diagnostic" button).
export { runDiagnostic } from './DiagnosticFlow'

// Core types consumed by other modules (e.g. progress/ saving the result).
export type { UserProfile, DiagnosticResult } from '../../types'
