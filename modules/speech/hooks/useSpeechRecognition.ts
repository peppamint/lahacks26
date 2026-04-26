import { useState, useRef } from 'react'
import { Audio } from 'expo-av'
import type { SpeechConfig, StumbleResult } from '../../../types'
import {
  requestAudioPermissions,
  startRecording as whisperStart,
  stopAndTranscribe,
} from '../../../services/whisper'
import { detectStumbleFromTranscript } from '../../../services/claude'

export function useSpeechRecognition(config: SpeechConfig) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)

  async function startRecording(): Promise<boolean> {
    setError(null)
    try {
      const granted = await requestAudioPermissions()
      setHasPermission(granted)
      if (!granted) {
        setError('Microphone permission denied')
        return false
      }
      recordingRef.current = await whisperStart()
      setIsRecording(true)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording')
      return false
    }
  }

  async function stopRecording(): Promise<string> {
    if (!recordingRef.current) return transcript
    setIsRecording(false)
    try {
      const result = await stopAndTranscribe(recordingRef.current)
      recordingRef.current = null
      setTranscript(result)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to transcribe audio')
      recordingRef.current = null
      return ''
    }
  }

  async function analyzeStumbles(expected: string, actual: string): Promise<StumbleResult> {
    return detectStumbleFromTranscript(expected, actual)
  }

  return { isRecording, transcript, error, hasPermission, startRecording, stopRecording, analyzeStumbles }
}
