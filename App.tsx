import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MicroLesson } from './modules/micro-lessons/MicroLesson'
import { MacroLesson } from './modules/macro-lessons/MacroLesson'
import { DiagnosticScreen } from './modules/diagnostic/DiagnosticScreen'
import { useStore } from './store'
import LessonMap from './screens/LessonMap'
import { LoadingScreen } from './components/LoadingScreen'
import { ensureLearnerProfile, getCurrentUser, signInAnonymously } from './services/supabase'
import {
  buildMacroLessonConfig,
  buildMicroLessonConfig,
  LESSON_DEFINITIONS,
  getLessonDefinition,
  getNextLessonId,
} from './constants/lessonLibrary'
import {
  buildPersonalizedLessonMapItems,
  buildMacroLessonFromSource,
  buildMicroLessonFromSource,
  ensureDemoAdvancedLesson,
  fetchLessonMapItems,
  fetchLessonQuestionsWithPersonalization,
  type LessonMapItem,
  type LessonQuestion,
} from './services/lessons'

const DIAGNOSTIC_KEY = 'diagnostic_complete'
const SKIP_DIAGNOSTIC = true    // DEV: set true to bypass diagnostic on every boot
const DEV_UNLOCK_LAST_LESSON = true // DEV: set true to jump straight to the last lesson

export default function App() {
  const userId         = useStore((s) => s.userId)
  const setUserId      = useStore((s) => s.setUserId)
  const activeLessonId = useStore((s) => s.activeLessonId)
  const setActiveLessonId = useStore((s) => s.setActiveLessonId)
  const completeLesson = useStore((s) => s.completeLesson)
  const setLessonProgress = useStore((s) => s.setLessonProgress)
  const readingLevel = useStore((s) => s.readingLevel)
  const interests = useStore((s) => s.profile?.interests ?? 'general literacy')

  // null = loading, false = needs diagnostic, true = done
  const [diagnosticDone, setDiagnosticDone] = useState<boolean | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [lessonMapItems, setLessonMapItems] = useState<LessonMapItem[]>([])
  const [microConfig, setMicroConfig] = useState<ReturnType<typeof buildMicroLessonConfig> | null>(null)
  const [macroConfig, setMacroConfig] = useState<ReturnType<typeof buildMacroLessonConfig> | null>(null)
  const [microQuestions, setMicroQuestions] = useState<LessonQuestion[] | null>(null)

  // DEV: unlock all lessons so the last one is immediately accessible
  useEffect(() => {
    if (!DEV_UNLOCK_LAST_LESSON) return
    const ids = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15']
    const devProgress = Object.fromEntries(
      ids.map((id, i) => [
        id,
        i < ids.length - 1
          ? { status: 'completed' as const, stars: 3 }
          : { status: 'current' as const, stars: 0 },
      ])
    )
    setLessonProgress(devProgress)
  }, [])

  useEffect(() => {
    async function init() {
      //await AsyncStorage.removeItem(DIAGNOSTIC_KEY)
      try {
        let user = await getCurrentUser()
        if (!user) user = await signInAnonymously()
        if (user) {
          setUserId(user.id)
          await ensureLearnerProfile(user.id)
        }
      } catch (e) {
        console.error('[Auth] anonymous sign-in failed:', e)
      } finally {
        setAuthReady(true)
      }
      try {
        const val = await AsyncStorage.getItem(DIAGNOSTIC_KEY)
        setDiagnosticDone(SKIP_DIAGNOSTIC || val === 'true')
      } catch {
        setDiagnosticDone(false)
      }
    }
    init()
  }, [setUserId])

  function handleDiagnosticComplete() {
    AsyncStorage.setItem(DIAGNOSTIC_KEY, 'true').catch(() => {})
    setDiagnosticDone(true)
  }

  const activeDefinition = activeLessonId ? getLessonDefinition(activeLessonId) : undefined
  const activeRemoteType = lessonMapItems.find((lesson) => lesson.id === activeLessonId)?.kind
  const activeLessonType = activeRemoteType ?? activeDefinition?.kind

  useEffect(() => {
    if (!diagnosticDone) return
    async function loadLessonMapItems() {
      // Demo helper: ensure one explicitly high-mastery advanced lesson exists.
      await ensureDemoAdvancedLesson(interests)
      const remoteItems = await fetchLessonMapItems()
      if (remoteItems.length > 0) {
        const personalized = await buildPersonalizedLessonMapItems(remoteItems, readingLevel, interests)
        setLessonMapItems(personalized)
        return
      }
      const personalizedFallback = LESSON_DEFINITIONS.map((lesson) => ({
        id: lesson.id,
        kind: lesson.kind,
        title: `${lesson.title} · ${interests.slice(0, 24) || 'General'}`,
      }))
      setLessonMapItems(personalizedFallback)
    }
    loadLessonMapItems()
  }, [diagnosticDone, interests, readingLevel])

  useEffect(() => {
    let cancelled = false
    async function resolveConfigs() {
      if (!activeLessonId || !activeLessonType) {
        setMicroConfig(null)
        setMacroConfig(null)
        setMicroQuestions(null)
        return
      }
      if (activeLessonType === 'micro') {
        const config = await buildMicroLessonFromSource(activeLessonId, readingLevel, interests)
        if (cancelled) return
        const questions = await fetchLessonQuestionsWithPersonalization(
          config.lessonId, config.readingLevel, config.interests, 'micro'
        )
        if (!cancelled) {
          setMicroConfig(config)
          setMicroQuestions(questions)
          setMacroConfig(null)
        }
        return
      }
      const config = await buildMacroLessonFromSource(activeLessonId, readingLevel, interests)
      if (!cancelled) {
        setMacroConfig(config)
        setMicroConfig(null)
        setMicroQuestions(null)
      }
    }
    resolveConfigs()
    return () => {
      cancelled = true
    }
  }, [activeLessonId, activeLessonType, readingLevel, interests])

  function handleLessonComplete(stumbleCount: number) {
    if (!activeLessonId) return
    const nextLessonId = getNextLessonId(activeLessonId)
    const stars = stumbleCount === 0 ? 3 : stumbleCount <= 2 ? 2 : 1
    completeLesson(activeLessonId, stars, nextLessonId)
    if (nextLessonId) {
      setActiveLessonId(null)
    }
  }

  if (!authReady || !userId || diagnosticDone === null) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <LoadingScreen fullScreen message="Getting things ready…" />
      </View>
    )
  }

  const lessonPending =
    !!activeLessonId &&
    ((activeLessonType === 'micro' && (!microConfig || !microQuestions)) ||
      (activeLessonType === 'macro' && !macroConfig) ||
      !activeLessonType)

  return (
    <View style={styles.root}>
      <StatusBar style={diagnosticDone ? 'light' : 'dark'} />

      {!diagnosticDone ? (
        // ── DIAGNOSTIC ─────────────────────────────────────────────
        <DiagnosticScreen onComplete={handleDiagnosticComplete} />
      ) : lessonPending ? (
        // ── LOADING — stays up until config + questions are both ready ──
        <LoadingScreen fullScreen message="Preparing your lesson…" />
      ) : activeLessonId && activeLessonType === 'micro' && microConfig && microQuestions ? (
        // ── LESSON SCREEN ──────────────────────────────────────────
        <MicroLesson
          userId={userId}
          config={microConfig}
          prefetchedQuestions={microQuestions}
          onComplete={handleLessonComplete}
          onExit={() => setActiveLessonId(null)}
        />
      ) : activeLessonId && macroConfig ? (
        <MacroLesson userId={userId} config={macroConfig} onComplete={handleLessonComplete} onExit={() => setActiveLessonId(null)} />
      ) : (
        // ── HOME / MAP SCREEN ───────────────────────────────────────
        <LessonMap lessons={lessonMapItems} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2EFE6' },
})