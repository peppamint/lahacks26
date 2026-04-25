
import { File, Paths } from 'expo-file-system'

// ?? operator: if value is undefined/null, use following value (e.g. empty string)
const ELEVENLABS_API_KEY = process.env['ELEVENLABS_API_KEY'] ?? ''
const ELEVENLABS_VOICE_ID = process.env['EXPO_PUBLIC_ELEVENLABS_VOICE_ID'] ?? '21m00Tcm4TlvDq8ikWAM'
const ELEVENLABS_MODEL_ID = process.env['EXPO_PUBLIC_ELEVENLABS_MODEL_ID'] ?? 'eleven_multilingual_v2'

// creates unique cache filename from input text + voice model settings
function makeTtsCacheFile(text: string): File {
  // Deterministic hash so the same text+voice+model resolves to same cache file.
  const key = `${ELEVENLABS_VOICE_ID}::${ELEVENLABS_MODEL_ID}::${text}`
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  const safeHash = Math.abs(hash)
  return new File(Paths.cache, `tts-${safeHash}.mp3`)
}

// given text (name of the text to speak) and offline (if offline or not), returns ArrayBuffer (output audio data)
export async function synthesizeSpeech(text: string, offline: boolean): Promise<ArrayBuffer> {
  const cacheFile = makeTtsCacheFile(text)
  
  // errors
  if (!text.trim()) {
    throw new Error('synthesizeSpeech requires non-empty text')
  }

  if (offline) {
    if (!cacheFile.exists) {
      throw new Error('Offline TTS unavailable: no cached audio for this text yet')
    }
    const bytes = await cacheFile.bytes()
    return bytes.buffer
  }

  if (!ELEVENLABS_API_KEY) {
    throw new Error('Missing ELEVENLABS_API_KEY')
  }

  // endpoint URL (address of specific backend function on a server)
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`
  
  // fetch = JS way to make HTTP network requests (fetch = messenger, URL = destination address)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`ElevenLabs TTS error (${response.status}): ${message}`)
  }

  const audioBuffer = await response.arrayBuffer()
  cacheFile.create({ intermediates: true, overwrite: true })
  cacheFile.write(new Uint8Array(audioBuffer))
  return audioBuffer
}
