import { useState, useRef } from 'react'
import { Audio } from 'expo-av'
import type { SpeechConfig, StumbleResult } from '../types'
import {
  requestAudioPermissions,
  startRecording as whisperStartRecording,
  stopAndTranscribe,
} from '../services/whisper'
import { detectStumbleFromTranscript } from '../services/claude'
import { addToVocabBank } from '../services/vocabBank'

export function useSpeechRecognition(config: SpeechConfig) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recordingRef = useRef<Audio.Recording | null>(null)

  async function startRecording() {
    const granted = await requestAudioPermissions()
    if (!granted) throw new Error('Microphone permission denied')
    recordingRef.current = await whisperStartRecording()
    setIsRecording(true)
  }

  async function stopRecording(): Promise<string> {
    setIsRecording(false)

    const recording = recordingRef.current
    if (!recording) throw new Error('No active recording')

    const result = await stopAndTranscribe(recording)
    setTranscript(result)
    recordingRef.current = null
    return result
  }

  async function analyzeStumbles(
    userId: string,
    expected: string,
    actual: string
  ): Promise<StumbleResult> {
    const result = await detectStumbleFromTranscript(expected, actual)

    for (const word of result.stumbledWords) {
      await addToVocabBank(userId, word)
    }

    return result
  }

  return { isRecording, transcript, startRecording, stopRecording, analyzeStumbles }
}