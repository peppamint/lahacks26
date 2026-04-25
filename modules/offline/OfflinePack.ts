import type { OfflinePackManifest } from './types'

export async function downloadPack(_lessonIds: string[]): Promise<OfflinePackManifest> {
  // TODO: fetch lesson text + audio, store in Expo SQLite, return manifest
  throw new Error('downloadPack not implemented')
}

export const OfflinePack = { downloadPack }
