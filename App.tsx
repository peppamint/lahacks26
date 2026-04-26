import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { MicroLesson } from './modules/micro-lessons/MicroLesson'
import { useStore } from './store'
import LessonMap from './screens/LessonMap'

export default function App() {
  const setUserId      = useStore((s) => s.setUserId)
  const activeLessonId = useStore((s) => s.activeLessonId)
  const setActiveLessonId = useStore((s) => s.setActiveLessonId)

  useEffect(() => {
    setUserId('550e8400-e29b-41d4-a716-446655440000') // TODO: replace with real auth
  }, [setUserId])

  // Build lesson config from whichever lesson the user tapped on the map.
  // TODO: swap documentText for a real Supabase fetch keyed on activeLessonId.
  const lessonConfig = {
    lessonId: activeLessonId ?? '001',
    documentText: `Explorers sent a robot two miles under the ocean's surface near Alaska to look for odd creatures, and unexpectedly struck gold. To be more specific, they found a golden blob, smooth and shiny with a perplexing hole in it, stuck to a rock on the seafloor. Was it coral? A sea sponge? An alien? No, the explorers concluded. After more than two years of investigation, the U.S. National Oceanic and Atmospheric Administration said this week that researchers had identified it as a part of a deep-sea anemone. The "golden orb," as many newspapers and science magazines called it after it was found in 2023, perplexed researchers and enthusiasts of the deep sea around the world.`,
    readingLevel: 'grade8' as const,
    domain: 'general' as const,
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {activeLessonId ? (
        // ── LESSON SCREEN ──────────────────────────────────────────
        // Shown when the user taps "Start Lesson" on the map.
        // onComplete returns them to the map and clears the active lesson.
        <MicroLesson
          userId="550e8400-e29b-41d4-a716-446655440000"
          config={lessonConfig}
          onComplete={() => setActiveLessonId(null)}
        />
      ) : (
        // ── HOME / MAP SCREEN ───────────────────────────────────────
        <LessonMap />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1628' },
})