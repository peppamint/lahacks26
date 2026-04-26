import { useState, useRef } from 'react'
import { Audio } from 'expo-av'
import { synthesizeSpeech } from '../../../services/elevenlabs'

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const genRef = useRef(0)

  async function stop() {
    genRef.current += 1
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {})
      await soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    setIsSpeaking(false)
  }

  async function speak(text: string, offline = false) {
    await stop()
    const gen = genRef.current
    setIsSpeaking(true)
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false })
      const uri = await synthesizeSpeech(text, offline)
      if (gen !== genRef.current) return
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true })
      if (gen !== genRef.current) { sound.unloadAsync().catch(() => {}); return }
      soundRef.current = sound
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false)
          sound.unloadAsync().catch(() => {})
          soundRef.current = null
        }
      })
    } catch (e) {
      if (gen !== genRef.current) return
      console.error('[useTextToSpeech] speak error:', e)
      setIsSpeaking(false)
    }
  }

  return { isSpeaking, speak, stop }
}
