import type { StumbleResult } from '../../types'
import { detectStumbleFromTranscript } from '../../services/claude'

export async function detectStumbles(expected: string, actual: string): Promise<StumbleResult> {
  return detectStumbleFromTranscript(expected, actual)
}
