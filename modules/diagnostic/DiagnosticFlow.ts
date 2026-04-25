import type { UserProfile, DiagnosticResult } from '../../types'

export async function runDiagnostic(): Promise<DiagnosticResult> {
  // TODO: multi-turn Claude goal conversation + adaptive quiz via Whisper
  throw new Error('runDiagnostic not implemented')
}

export type { UserProfile, DiagnosticResult }
