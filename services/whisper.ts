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

  if (error) throw new Error(`Transcription failed: ${error.message}`)
  if (!data?.transcript) throw new Error('Empty transcription returned')

  return data.transcript
}