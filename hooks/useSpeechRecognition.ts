import { useState, useRef } from 'react'
import { Audio } from 'expo-av'
import type { SpeechConfig, StumbleResult } from '../types'
import { transcribeAudio } from '../services/whisper'
import { detectStumbleFromTranscript } from '../services/claude'
import { addToVocabBank } from '../services/vocabBank'

export function useSpeechRecognition(config: SpeechConfig) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recordingRef = useRef<Audio.Recording | null>(null)

  async function startRecording() {
    await Audio.requestPermissionsAsync()
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    })

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    recordingRef.current = recording
    setIsRecording(true)
  }

  async function stopRecording(): Promise<string> {
    setIsRecording(false)

    const recording = recordingRef.current
    if (!recording) throw new Error('No active recording')

    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()
    if (!uri) throw new Error('Recording URI is missing')

    const response = await fetch(uri)
    const blob = await response.blob()

    const result = await transcribeAudio(blob)
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