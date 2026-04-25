import { useState } from 'react'
import { synthesizeSpeech } from '../../../services/elevenlabs'

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)

  async function speak(text: string, offline = false) {
    setIsSpeaking(true)
    try {
      const _audio = await synthesizeSpeech(text, offline)
      // TODO: play ArrayBuffer via expo-av Audio
    } finally {
      setIsSpeaking(false)
    }
  }

  function stop() {
    setIsSpeaking(false)
    // TODO: stop expo-av playback
  }

  return { isSpeaking, speak, stop }
}
