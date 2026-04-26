import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MicroLesson } from './modules/micro-lessons/MicroLesson'
import { DiagnosticScreen } from './modules/diagnostic/DiagnosticScreen'
import { useStore } from './store'
import LessonMap from './screens/LessonMap'
import { getCurrentUser, signInAnonymously } from './services/supabase'

const DIAGNOSTIC_KEY = 'diagnostic_complete'

export default function App() {
  const userId         = useStore((s) => s.userId)
  const setUserId      = useStore((s) => s.setUserId)
  const activeLessonId = useStore((s) => s.activeLessonId)
  const setActiveLessonId = useStore((s) => s.setActiveLessonId)

  // null = loading, false = needs diagnostic, true = done
  const [diagnosticDone, setDiagnosticDone] = useState<boolean | null>(null)

  useEffect(() => {
    async function init() {
      try {
        let user = await getCurrentUser()
        if (!user) user = await signInAnonymously()
        if (user) setUserId(user.id)
      } catch (e) {
        console.error('[Auth] anonymous sign-in failed:', e)
      }
      try {
        const val = await AsyncStorage.getItem(DIAGNOSTIC_KEY)
        setDiagnosticDone(val === 'true')
      } catch {
        setDiagnosticDone(false)
      }
    }
    init()
  }, [setUserId])

  async function handleDiagnosticComplete() {
    await AsyncStorage.setItem(DIAGNOSTIC_KEY, 'true')
    setDiagnosticDone(true)
  }

  // Build lesson config from whichever lesson the user tapped on the map.
  // TODO: swap documentText for a real Supabase fetch keyed on activeLessonId.
  const lessonConfig = {
    lessonId: activeLessonId ?? '001',
    documentText: `Explorers sent a robot two miles under the ocean's surface near Alaska to look for odd creatures, and unexpectedly struck gold. To be more specific, they found a golden blob, smooth and shiny with a perplexing hole in it, stuck to a rock on the seafloor. Was it coral? A sea sponge? An alien? No, the explorers concluded. After more than two years of investigation, the U.S. National Oceanic and Atmospheric Administration said this week that researchers had identified it as a part of a deep-sea anemone. The "golden orb," as many newspapers and science magazines called it after it was found in 2023, perplexed researchers and enthusiasts of the deep sea around the world.`,
    readingLevel: 'grade8' as const,
    domain: 'general' as const,
  }

  if (diagnosticDone === null) return null

  return (
    <View style={styles.root}>
      <StatusBar style={diagnosticDone ? 'light' : 'dark'} />

      {!diagnosticDone ? (
        // ── DIAGNOSTIC ─────────────────────────────────────────────
        <DiagnosticScreen onComplete={handleDiagnosticComplete} />
      ) : activeLessonId ? (
        // ── LESSON SCREEN ──────────────────────────────────────────
        <MicroLesson
          userId={userId}
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