import { useState } from 'react'
import type { SpeechConfig, StumbleResult } from '../../../types'
import { transcribeAudio } from '../../../services/whisper'
import { detectStumbleFromTranscript } from '../../../services/claude'

export function useSpeechRecognition(config: SpeechConfig) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')

  async function startRecording() {
    setIsRecording(true)
    // TODO: record audio via expo-av and pass blob to transcribeAudio
  }

  async function stopRecording(): Promise<string> {
    setIsRecording(false)
    // TODO: stop recording, get blob, call transcribeAudio
    return transcript
  }

  async function analyzeStumbles(expected: string, actual: string): Promise<StumbleResult> {
    return detectStumbleFromTranscript(expected, actual)
  }

  return { isRecording, transcript, startRecording, stopRecording, analyzeStumbles }
}
