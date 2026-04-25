import { createClient } from '@supabase/supabase-js'

console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL)

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
)

export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!blob || blob.size === 0) {
    throw new Error('transcribeAudio requires a non-empty audio blob')
  }

  const { data, error } = await supabase.functions.invoke('whisper-api', {
    body: blob,
  })

  if (error) {
    console.error('[services/whisper] function invoke error', error)
    const status = (error as any)?.status ?? 'unknown'
    const details = JSON.stringify(error, null, 2)
    throw new Error(`Transcription failed: ${error.message} (status=${status})\n${details}`)
  }

  if (!data?.transcript) {
    console.error('[services/whisper] invalid function response', data)
    throw new Error('Empty transcription returned')
  }

  return data.transcript
}