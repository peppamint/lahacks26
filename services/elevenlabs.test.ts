import 'dotenv/config'
import assert from 'node:assert'
import { synthesizeSpeech } from './elevenlabs.ts'

const originalFetch = globalThis.fetch

function mockFetch(fn: typeof fetch) {
  ;(globalThis as any).fetch = fn
}

function restoreFetch() {
  ;(globalThis as any).fetch = originalFetch
}

async function testMissingText() {
  console.log('› testMissingText')
  await assert.rejects(
    async () => {
      await synthesizeSpeech('')
    },
    {
      message: 'synthesizeSpeech requires non-empty text',
    }
  )
}

async function testDirectElevenLabsRequest() {
  console.log('› testDirectElevenLabsRequest')
  process.env.EXPO_PUBLIC_TTS_PROXY_URL = ''
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-api-key'
  process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
  process.env.EXPO_PUBLIC_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'

  mockFetch(async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : input.toString()
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM')
    assert.equal(init?.method, 'POST')
    assert.equal((init?.headers as any)['xi-api-key'], 'test-api-key')

    const body = typeof init?.body === 'string' ? init.body : ''
    const payload = JSON.parse(body)
    assert.equal(payload.text, 'hello world')
    assert.equal(payload.model_id, 'eleven_multilingual_v2')
    assert.equal(payload.voice_id, undefined)
    assert.deepEqual(payload.voice_settings, {
      stability: 0.5,
      similarity_boost: 0.75,
    })

    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  })

  const result = await synthesizeSpeech('hello world')
  assert.equal(result.byteLength, 3)
}

async function testProxyRequest() {
  console.log('› testProxyRequest')
  process.env.EXPO_PUBLIC_TTS_PROXY_URL = 'https://example-proxy.test'
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = ''
  process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
  process.env.EXPO_PUBLIC_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'

  mockFetch(async (input, init) => {
    assert.equal(input, 'https://example-proxy.test')
    assert.equal(init?.method, 'POST')

    const body = typeof init?.body === 'string' ? init.body : ''
    const payload = JSON.parse(body)
    assert.equal(payload.text, 'proxy test')
    assert.equal(payload.voice_id, '21m00Tcm4TlvDq8ikWAM')
    assert.equal(payload.model_id, 'eleven_multilingual_v2')
    assert.deepEqual(payload.voice_settings, {
      stability: 0.5,
      similarity_boost: 0.75,
    })

    return new Response(new Uint8Array([4, 5, 6]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  })

  const result = await synthesizeSpeech('proxy test')
  assert.equal(result.byteLength, 3)
}

async function testRemoteErrorResponse() {
  console.log('› testRemoteErrorResponse')
  process.env.EXPO_PUBLIC_TTS_PROXY_URL = ''
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-api-key'
  process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
  process.env.EXPO_PUBLIC_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'

  mockFetch(async () => {
    return new Response('Rate limit', { status: 429, headers: { 'Content-Type': 'text/plain' } })
  })

  await assert.rejects(
    async () => {
      await synthesizeSpeech('error test')
    },
    {
      message: /ElevenLabs error \(429\): Rate limit|TTS proxy error \(429\): Rate limit/,
    }
  )
}

async function runAll() {
  try {
    await testMissingText()
    await testDirectElevenLabsRequest()
    await testProxyRequest()
    await testRemoteErrorResponse()
    console.log('All elevenlabs tests passed ✅')
  } catch (error) {
    console.error('Elevenlabs tests failed:', error)
    process.exitCode = 1
  } finally {
    restoreFetch()
  }
}

runAll()
