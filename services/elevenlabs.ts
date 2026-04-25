// ?? operator: if value is undefined/null, use following value (e.g. empty string)
const TTS_PROXY_URL = process.env['EXPO_PUBLIC_TTS_PROXY_URL'] ?? ''
const ELEVENLABS_API_KEY = process.env['EXPO_PUBLIC_ELEVENLABS_API_KEY'] ?? ''
const ELEVENLABS_VOICE_ID = process.env['EXPO_PUBLIC_ELEVENLABS_VOICE_ID'] ?? '21m00Tcm4TlvDq8ikWAM'
const ELEVENLABS_MODEL_ID = process.env['EXPO_PUBLIC_ELEVENLABS_MODEL_ID'] ?? 'eleven_multilingual_v2'

// given text (name of the text to speak), returns ArrayBuffer (output audio data)
export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  // errors
  if (!text.trim()) {
    throw new Error('synthesizeSpeech requires non-empty text')
  }

  // endpoint URL (address of specific backend function on a server)
  const useProxy = Boolean(TTS_PROXY_URL) && !TTS_PROXY_URL.includes('<your-project>')
  const url = useProxy
    ? TTS_PROXY_URL
    : `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`

  if (!useProxy && !ELEVENLABS_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_ELEVENLABS_API_KEY (or set EXPO_PUBLIC_TTS_PROXY_URL)')
  }
  
  // fetch = JS way to make HTTP network requests (fetch = messenger, URL = destination address)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      ...(useProxy ? {} : { 'xi-api-key': ELEVENLABS_API_KEY }),
    },
    body: JSON.stringify({
      text,
      ...(useProxy ? { voice_id: ELEVENLABS_VOICE_ID } : {}),
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`${useProxy ? 'TTS proxy' : 'ElevenLabs'} error (${response.status}): ${message}`)
  }

  return response.arrayBuffer()
}
