function getTtsProxyUrl() {
  return process.env['EXPO_PUBLIC_TTS_PROXY_URL'] ?? ''
}

function getElevenLabsApiKey() {
  return process.env['EXPO_PUBLIC_ELEVENLABS_API_KEY'] ?? ''
}

function getElevenLabsVoiceId() {
  return process.env['EXPO_PUBLIC_ELEVENLABS_VOICE_ID'] ?? '21m00Tcm4TlvDq8ikWAM'
}

function getElevenLabsModelId() {
  return process.env['EXPO_PUBLIC_ELEVENLABS_MODEL_ID'] ?? 'eleven_multilingual_v2'
}

// given text (name of the text to speak), returns ArrayBuffer (output audio data)
export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  // errors
  if (!text.trim()) {
    throw new Error('synthesizeSpeech requires non-empty text')
  }

  // endpoint URL (address of specific backend function on a server)
  const ttsProxyUrl = getTtsProxyUrl()
  const apiKey = getElevenLabsApiKey()
  const voiceId = getElevenLabsVoiceId()
  const modelId = getElevenLabsModelId()
  const useProxy = Boolean(ttsProxyUrl) && !ttsProxyUrl.includes('<your-project>')
  const url = useProxy
    ? ttsProxyUrl
    : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

  if (!useProxy && !apiKey) {
    throw new Error('Missing EXPO_PUBLIC_ELEVENLABS_API_KEY (or set EXPO_PUBLIC_TTS_PROXY_URL)')
  }
  
  // fetch = JS way to make HTTP network requests (fetch = messenger, URL = destination address)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      ...(useProxy ? {} : { 'xi-api-key': apiKey }),
    },
    body: JSON.stringify({
      text,
      ...(useProxy ? { voice_id: voiceId } : {}),
      model_id: modelId,
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
