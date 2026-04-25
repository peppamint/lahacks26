export async function transcribeAudio(_blob: Blob, _offline: boolean): Promise<string> {
  // TODO: online → OpenAI Whisper API; offline → whisper.cpp on-device
  throw new Error('transcribeAudio not implemented')
}
