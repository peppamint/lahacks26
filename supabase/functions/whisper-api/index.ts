const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  console.log('[whisper-api] method=', req.method)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    console.error('[whisper-api] invalid method:', req.method)
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const openaiApiKey = denoEnv?.get('OPENAI_API_KEY') ?? ''
  if (!openaiApiKey) {
    console.error('[whisper-api] missing OPENAI_API_KEY secret')
    return new Response('Missing OPENAI_API_KEY in function secrets', {
      status: 500,
      headers: corsHeaders,
    })
  }
Deno.env
  const contentType = req.headers.get('content-type') ?? 'application/octet-stream'
  let requestBody: ArrayBuffer
  try {
    requestBody = await req.arrayBuffer()
  } catch (error) {
    console.error('[whisper-api] failed to read request body', error)
    return new Response('Unable to read audio body', { status: 400, headers: corsHeaders })
  }

  const url = 'https://api.openai.com/v1/audio/transcriptions'
  const formData = new FormData()
  const audioBlob = new Blob([requestBody], { type: contentType })
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('model', 'whisper-1')

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: formData,
  })

  const responseText = await upstream.text()
  if (!upstream.ok) {
    console.error('[whisper-api] upstream error', upstream.status, responseText)
    return new Response(responseText, {
      status: upstream.status,
      headers: corsHeaders,
    })
  }

  try {
    const data = JSON.parse(responseText) as { text?: string }
    if (!data.text) {
      console.error('[whisper-api] invalid OpenAI response', data)
      return new Response('Invalid transcription response', {
        status: 500,
        headers: corsHeaders,
      })
    }
    return new Response(JSON.stringify({ transcript: data.text }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[whisper-api] JSON parse failure', error, responseText)
    return new Response('Failed to parse transcription response', {
      status: 500,
      headers: corsHeaders,
    })
  }
})
