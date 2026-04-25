const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type TtsRequest = {
  text: string
  voice_id?: string
  model_id?: string
  voice_settings?: {
    stability?: number
    similarity_boost?: number
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY') ?? ''
  if (!elevenLabsApiKey) {
    return new Response('Missing ELEVENLABS_API_KEY in function secrets', {
      status: 500,
      headers: corsHeaders,
    })
  }

  let body: TtsRequest
  try {
    body = await req.json() as TtsRequest
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  if (!body.text?.trim()) {
    return new Response('text is required', { status: 400, headers: corsHeaders })
  }

  const voiceId = body.voice_id ?? '21m00Tcm4TlvDq8ikWAM'
  const modelId = body.model_id ?? 'eleven_multilingual_v2'
  const voiceSettings = body.voice_settings ?? { stability: 0.5, similarity_boost: 0.75 }

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: body.text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  })

  if (!upstream.ok) {
    const message = await upstream.text()
    return new Response(message, {
      status: upstream.status,
      headers: corsHeaders,
    })
  }

  const audioBytes = await upstream.arrayBuffer()
  return new Response(audioBytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
})
