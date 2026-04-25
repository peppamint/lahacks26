import { supabase } from '../../services/supabase'

export async function syncPendingResults(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  // TODO: read pending progress_events from SQLite, upload to Supabase, mark synced
  const { error } = await supabase.from('progress_events').select('id').limit(1)
  if (error) throw error
}
