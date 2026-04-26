import * as FileSystem from 'expo-file-system/legacy'

const ELEVENLABS_API_KEY = process.env['EXPO_PUBLIC_ELEVENLABS_API_KEY'] ?? ''
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Arnold (crisp)
const TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`

// Returns a local file URI suitable for expo-av playback.
// offline flag reserved for future Kokoro integration.
export async function synthesizeSpeech(text: string, _offline: boolean): Promise<string> {
  if (!ELEVENLABS_API_KEY) throw new Error('EXPO_PUBLIC_ELEVENLABS_API_KEY is not set — restart the Expo dev server')
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      speed: 0.75,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error ${res.status}: ${err}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)
  const uri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' })
  return uri
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
