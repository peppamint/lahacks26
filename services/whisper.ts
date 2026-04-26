import { Audio } from 'expo-av'

// ─── Configuration ────────────────────────────────────────────────────────────
// DEV NOTE: This calls the OpenAI Whisper API directly from the client.
// In production, proxy this through a Supabase Edge Function (like the Claude
// proxy) so the key is never in the app bundle.
// Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.
const OPENAI_API_KEY = process.env['EXPO_PUBLIC_OPENAI_API_KEY'] ?? ''
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'

// ─── Permissions ──────────────────────────────────────────────────────────────
// Call this before starting any recording. Returns true if granted.
// Best called at the start of the baseline_loading phase so the permission
// dialog appears before the user needs to record.
export async function requestAudioPermissions(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync()
  return status === 'granted'
}

// ─── Recording ────────────────────────────────────────────────────────────────
// Call startRecording() on button press-in and stopAndTranscribe() on press-out.
// The Audio.Recording object is held in component state between the two calls.

export async function startRecording(): Promise<Audio.Recording> {
  // Required on iOS: allow recording even when the device is silenced.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  })
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  )
  return recording
}

// Stops the recording and sends the audio to OpenAI Whisper for transcription.
// Returns the transcribed text. Throws on network or API errors.
//
// To swap in a different STT service, replace the fetch call below with your
// own API call. The function signature (returns Promise<string>) stays the same.
export async function stopAndTranscribe(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync()
  // Reset audio mode so playback works normally after recording.
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false })

  const uri = recording.getURI()
  if (!uri) throw new Error('No audio URI after recording')

  // Build multipart form — Whisper expects the audio file + model name.
  const formData = new FormData()
  formData.append('file', {
    uri,
    type: 'audio/m4a',
    name: 'reading.m4a',
  } as any)
  formData.append('model', 'whisper-1')

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Whisper API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { text: string }
  return data.text.trim()
}

// ─── Legacy stub (kept for offline module compatibility) ──────────────────────
// The offline/ module calls this signature. It will be replaced when offline
// whisper.cpp support is added.
export async function transcribeAudio(_blob: Blob, _offline: boolean): Promise<string> {
  throw new Error('transcribeAudio(blob) not implemented — use stopAndTranscribe(recording) instead')
}
