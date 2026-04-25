import { useEffect } from 'react'
import { useOfflineStatus } from '../modules/offline/hooks/useOfflineStatus'
import { syncPendingResults } from '../modules/offline/sync'

export function useOfflineSync() {
  const isOffline = useOfflineStatus()

  useEffect(() => {
    if (!isOffline) {
      syncPendingResults().catch(console.error)
    }
  }, [isOffline])

  return { isOffline }
}
