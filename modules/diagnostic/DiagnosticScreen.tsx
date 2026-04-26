import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Keyboard,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import type { StyleProp, TextStyle } from 'react-native'
import { conductGoalTurn, detectStumbleFromTranscript } from '../../services/claude'
import { useSpeechRecognition } from '../speech'
import { useTextToSpeech } from '../speech/hooks/useTextToSpeech'
import { saveProfile } from '../../services/supabase'
import { useStore } from '../../store'
import {
  DOMAIN_PASSAGE_COUNT,
  generateBaselinePassages,
  generateDomainPassages,
  generateSpeakingPassage,
  determineLevelFromRatings,
  buildDiagnosticResult,
} from './DiagnosticFlow'
import type {
  DiagnosticPhase,
  GoalProfile,
  GeneratedPassage,
  BaselineRoundResult,
  PassageRating,
} from './types'
import type { ReadingLevel } from '../../constants/readingLevels'
import type { StumbledWord } from '../../types'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     '#F2EDE3',
  green:  '#1B3028',
  border: '#C8BDA8',
  muted:  '#6B7280',
}

// ─── TypewriterText ───────────────────────────────────────────────────────────
// Renders all words immediately (preserving layout), then fades each in one-by-one.
// Use a changing `key` prop to reset the animation when the message changes.
function TypewriterText({
  text,
  style,
  onComplete,
}: {
  text: string
  style?: StyleProp<TextStyle>
  onComplete?: () => void
}) {
  const words = text.split(' ')
  const opacities = useRef(words.map(() => new Animated.Value(0))).current

  React.useEffect(() => {
    opacities.forEach((o) => o.setValue(0))
    Animated.parallel(
      opacities.map((opacity, i) =>
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]),
      ),
    ).start(({ finished }) => { if (finished) onComplete?.() })
  }, [])

  return (
    <Text style={style}>
      {words.map((word, i) => (
        <Animated.Text key={i} style={{ opacity: opacities[i] }}>
          {word}{i < words.length - 1 ? ' ' : ''}
        </Animated.Text>
      ))}
    </Text>
  )
}

// ─── ReidIcon ─────────────────────────────────────────────────────────────────
// Two-bar mark from reid_icon.svg: one angled bar, one straight bar.
function ReidIcon({ size = 28 }: { size?: number }) {
  const barW = size * 0.85
  const barH = size * 0.22
  const barRadius = size * 0.04
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'flex-start', gap: size * 0.14 }}>
      <View style={{ width: barW, height: barH, backgroundColor: '#003310', borderRadius: barRadius, transform: [{ rotate: '-12deg' }] }} />
      <View style={{ width: barW, height: barH, backgroundColor: '#003310', borderRadius: barRadius }} />
    </View>
  )
}

// ─── LoadingGif ───────────────────────────────────────────────────────────────
function LoadingGif({ size = 80 }: { size?: number }) {
  return (
    <Image
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require('../../assets/loading.gif')}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  )
}

// ─── ProgressHeader ───────────────────────────────────────────────────────────
const TOTAL_STEPS = 8

function ProgressHeader({ current }: { current: number }) {
  return (
    <View style={hdr.row}>
      <View style={hdr.side}>
        <ReidIcon size={28} />
      </View>
      <View style={hdr.center}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View key={i} style={[hdr.dot, i < current ? hdr.filled : hdr.empty]} />
        ))}
      </View>
      <View style={[hdr.side, { alignItems: 'flex-end' }]}>
        <Text style={hdr.counter}>{current} / {TOTAL_STEPS}</Text>
      </View>
    </View>
  )
}

const hdr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  side:    { flex: 1 },
  center:  { flex: 2, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:     { width: 7, height: 7, borderRadius: 4 },
  filled:  { backgroundColor: '#1B3028' },
  empty:   { backgroundColor: '#C8BDA8' },
  logo:    { fontSize: 22, color: '#1B3028', fontWeight: '800' },
  counter: { fontSize: 13, color: '#6B7280' },
})

// ─── Phase labels ─────────────────────────────────────────────────────────────
const PHASE_LABELS: Partial<Record<DiagnosticPhase, string>> = {
  goal_chat:        'DIAGNOSTIC · GOAL',
  baseline_loading: 'DIAGNOSTIC · READING',
  baseline_reading: 'DIAGNOSTIC · READING',
  domain_loading:   'DIAGNOSTIC · READING',
  domain_reading:   'DIAGNOSTIC · READING',
  speaking_loading: 'DIAGNOSTIC · SPEECH',
  speaking:         'DIAGNOSTIC · SPEECH',
  finalizing:       'DIAGNOSTIC · RESULTS',
  result:           'DIAGNOSTIC · RESULTS',
}

// ─── View modes ───────────────────────────────────────────────────────────────
// Controls what the center content area shows, independent of phase.
type ViewMode = 'goal-input' | 'message' | 'reading' | 'speaking' | 'loading'

// ─── Fallback goal profile ────────────────────────────────────────────────────
const DEFAULT_GOAL_PROFILE: GoalProfile = {
  motivation: 'improve my reading',
  interests:  'general topics',
}

// Builds a GoalProfile from raw conversation history when Claude omits <PROFILE>.
// User turns: [0]=name, [1]=motivation, [2]=interests.
function buildFallbackProfile(messages: { role: string; content: string }[]): GoalProfile {
  const userMsgs = messages.filter((m) => m.role === 'user').map((m) => m.content)
  return {
    motivation: userMsgs[1] ?? DEFAULT_GOAL_PROFILE.motivation,
    interests:  userMsgs[2] ?? DEFAULT_GOAL_PROFILE.interests,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props { onComplete: () => void }

// ─── DiagnosticScreen ─────────────────────────────────────────────────────────
export function DiagnosticScreen({ onComplete }: Props) {
  const userId          = useStore((s) => s.userId)
  const setReadingLevel = useStore((s) => s.setReadingLevel)

  // ── View / phase ──────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<DiagnosticPhase>('goal_chat')
  const [viewMode, setViewMode]       = useState<ViewMode>('goal-input')
  const [currentReidMessage, setMsg]  = useState("Hello! My name is Reid! What should I call you?")
  const [isAnimating, setIsAnimating] = useState(true)
  const [loading, setLoading]         = useState(false)
  const [goalQuestionStep, setGoalQuestionStep] = useState(1)

  // pendingNext: resolved when user presses "Next ▶|"
  const pendingNextRef = useRef<(() => void) | null>(null)
  const [hasPendingNext, setHasPendingNext] = useState(false)

  // ── Goal state ────────────────────────────────────────────────────────────
  const convHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [inputText, setInputText]     = useState('')
  const [goalProfile, setGoalProfile] = useState<GoalProfile | null>(null)

  // ── Baseline state ────────────────────────────────────────────────────────
  const [baselinePassages, setBaselinePassages]         = useState<GeneratedPassage[]>([])
  const [currentBaselineIndex, setCurrentBaselineIndex] = useState(0)
  const [baselineRatings, setBaselineRatings]           = useState<BaselineRoundResult[]>([])
  const [lockedLevel, setLockedLevel]                   = useState<ReadingLevel | null>(null)

  // ── Domain state ──────────────────────────────────────────────────────────
  const [domainPassages, setDomainPassages]           = useState<string[]>([])
  const [currentDomainIndex, setCurrentDomainIndex]   = useState(0)

  // ── Speaking state ────────────────────────────────────────────────────────
  const [speakingPassage, setSpeakingPassage] = useState<string | null>(null)
  const { startRecording, stopRecording, isRecording } = useSpeechRecognition({ offline: false })

  // ── Voice text-input state ────────────────────────────────────────────────
  const {
    startRecording: startVoiceInput,
    stopRecording:  stopVoiceInput,
    isRecording:    isVoiceInputRecording,
  } = useSpeechRecognition({ offline: false })
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false)
  const voicePulseAnim = useRef(new Animated.Value(1)).current
  const voicePulseLoop = useRef<Animated.CompositeAnimation | null>(null)

  // ── TTS ───────────────────────────────────────────────────────────────────
  const { speak: ttSpeak, stop: ttsStop } = useTextToSpeech()
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [isTranscribing, setIsTranscribing]   = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Keyboard animation ────────────────────────────────────────────────────
  // Translates only the input row upward so the skip button stays put and
  // gets covered by the keyboard instead of being pushed up.
  // We subtract the height of the content below the input (skip button area)
  // so the input lands just above the keyboard rather than overshooting.
  const inputTranslateY = useRef(new Animated.Value(0)).current
  const belowInputHeight = useRef(0)

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(inputTranslateY, {
        toValue: -(e.endCoordinates.height - belowInputHeight.current - 30),
        duration: e.duration ?? 250,
        useNativeDriver: true,
      }).start()
    })
    const hideSub = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(inputTranslateY, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: true,
      }).start()
    })
    return () => { showSub.remove(); hideSub.remove() }
  }, [inputTranslateY])

  useEffect(() => {
    if (isVoiceInputRecording) {
      voicePulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(voicePulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(voicePulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ]),
      )
      voicePulseLoop.current.start()
    } else {
      voicePulseLoop.current?.stop()
      Animated.timing(voicePulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start()
    }
  }, [isVoiceInputRecording])

  async function handleVoiceInputPress() {
    if (isVoiceTranscribing) return
    if (!isVoiceInputRecording) {
      Keyboard.dismiss()
      await startVoiceInput()
    } else {
      setIsVoiceTranscribing(true)
      try {
        const text = await stopVoiceInput()
        if (text) setInputText(text)
      } finally {
        setIsVoiceTranscribing(false)
      }
    }
  }

  // ── showReidMessage ───────────────────────────────────────────────────────
  // Displays text as the main content and returns a Promise that resolves
  // when the user presses "Next ▶|".
  function showReidMessage(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      setMsg(text)
      setIsAnimating(true)
      setViewMode('message')
      setHasPendingNext(true)
      pendingNextRef.current = () => {
        setHasPendingNext(false)
        resolve()
      }
    })
  }

  // ── handleNext / handleSkip ───────────────────────────────────────────────
  function handleNext() {
    ttsStop()
    if (pendingNextRef.current) {
      const fn = pendingNextRef.current
      pendingNextRef.current = null
      fn()
    } else {
      handleSkip()
    }
  }

  function handleSkip() {
    if (phase === 'baseline_reading') {
      handleBaselineRating('too_easy')
    } else if (phase === 'domain_reading') {
      handleDomainRating('too_easy')
    } else if (phase === 'speaking') {
      handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE, [])
    }
  }

  // ── Step 1: Goal conversation ─────────────────────────────────────────────
  async function handleGoalSend() {
    const text = inputText.trim()
    if (!text || loading) return
    setInputText('')
    setGoalQuestionStep((s) => Math.min(s + 1, 3))

    const nextHistory = [...convHistoryRef.current, { role: 'user' as const, content: text }]
    convHistoryRef.current = nextHistory

    const userTurnCount = nextHistory.filter((m) => m.role === 'user').length

    setLoading(true)
    try {
      const { reply, profile } = await conductGoalTurn(nextHistory)
      convHistoryRef.current = [...nextHistory, { role: 'assistant', content: reply }]

      // If Claude has all the info (≥3 user turns: name + motivation + interests)
      // but didn't return a profile, build a fallback and advance rather than hanging.
      const resolvedProfile = profile ?? (userTurnCount >= 3 ? buildFallbackProfile(nextHistory) : null)

      // Clear loading before showing Reid's next message so the text is visible.
      setLoading(false)

      if (resolvedProfile) {
        setGoalProfile(resolvedProfile)
        await advanceToBaseline(resolvedProfile)
      } else {
        setMsg(reply)
        setIsAnimating(true)
      }
    } catch (err) {
      console.error('[Goal] conductGoalTurn error:', err)
      setLoading(false)
      setMsg("Sorry, I had trouble with that. Could you try again?")
      setIsAnimating(true)
    }
  }

  // ── Baseline transition ───────────────────────────────────────────────────
  async function advanceToBaseline(profile: GoalProfile) {
    setPhase('baseline_loading')
    await showReidMessage("Thanks for sharing that! Now let me find the best starting point for you.")
    await showReidMessage("I'll show you a few short passages. Read each one and tell me if it feels too easy, just right, or too hard.")
    setViewMode('loading')
    setLoading(true)
    try {
      const passages = await generateBaselinePassages()
      setBaselinePassages(passages)
      setPhase('baseline_reading')
      setViewMode('reading')
    } catch (err) {
      console.error('[Baseline] generateBaselinePassages error:', err)
      setMsg("Something went wrong loading the passages. Please restart the app.")
      setIsAnimating(true)
      setViewMode('message')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Baseline rating ───────────────────────────────────────────────
  async function handleBaselineRating(rating: PassageRating) {
    ttsStop()
    const passage = baselinePassages[currentBaselineIndex]
    if (!passage) return
    const result: BaselineRoundResult = { level: passage.level, rating }
    const newRatings = [...baselineRatings, result]
    setBaselineRatings(newRatings)

    const msg =
      rating === 'too_easy'   ? "Let's try something a bit more challenging." :
      rating === 'just_right' ? "Perfect — that's a great match for your level." :
                                "No worries, I'll find a better fit."
    await showReidMessage(msg)

    if (rating === 'too_hard' || rating === 'just_right') {
      const level = determineLevelFromRatings(newRatings)
      setLockedLevel(level)
      await advanceToDomain(level, goalProfile ?? DEFAULT_GOAL_PROFILE)
      return
    }

    const nextIndex = currentBaselineIndex + 1
    if (nextIndex >= baselinePassages.length) {
      const level = determineLevelFromRatings(newRatings)
      setLockedLevel(level)
      await advanceToDomain(level, goalProfile ?? DEFAULT_GOAL_PROFILE)
    } else {
      setCurrentBaselineIndex(nextIndex)
      setViewMode('reading')
    }
  }

  // ── Domain transition ─────────────────────────────────────────────────────
  async function advanceToDomain(level: ReadingLevel, profile: GoalProfile) {
    setPhase('domain_loading')
    await showReidMessage("Now I'll show you a few texts related to your interests.")
    setViewMode('loading')
    setLoading(true)
    try {
      const passages = await generateDomainPassages(profile.interests, level)
      setDomainPassages(passages)
      setPhase('domain_reading')
      setViewMode('reading')
    } catch (err) {
      console.error('[Domain] generateDomainPassages error:', err)
      await advanceToSpeaking(level, profile)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Domain rating ─────────────────────────────────────────────────
  async function handleDomainRating(rating: PassageRating) {
    ttsStop()
    const msg =
      rating === 'too_easy'   ? "Good — that vocabulary feels familiar to you." :
      rating === 'just_right' ? "Great, that's a solid match for your domain." :
                                "We'll work on building that domain vocabulary."
    await showReidMessage(msg)

    const nextIndex = currentDomainIndex + 1
    if (nextIndex >= DOMAIN_PASSAGE_COUNT) {
      await advanceToSpeaking(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE)
    } else {
      setCurrentDomainIndex(nextIndex)
      setViewMode('reading')
    }
  }

  // ── Speaking transition ───────────────────────────────────────────────────
  async function advanceToSpeaking(level: ReadingLevel, profile: GoalProfile) {
    setPhase('speaking_loading')
    await showReidMessage("One last step, I'll have you read a short passage aloud so I can hear your voice.")
    setViewMode('loading')
    setLoading(true)
    try {
      const passage = await generateSpeakingPassage(profile.interests, level)
      setSpeakingPassage(passage)
      ttsStop()
      setTtsEnabled(false)
      setPhase('speaking')
      setViewMode('speaking')
    } catch (err) {
      console.error('[Speaking] generation error:', err)
      await handleFinalize(level, profile, [])
    } finally {
      setLoading(false)
    }
  }

  // ── Step 4: Speaking — tap to start, tap to stop ──────────────────────────
  async function handleMicPress() {
    if (isTranscribing) return
    if (!isRecording) {
      const started = await startRecording()
      if (!started) {
        // Permission denied — skip speaking step
        await handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE, [])
        return
      }
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      await handleSpeakingStop()
    }
  }

  async function handleSpeakingStop() {
    setIsTranscribing(true)
    try {
      const text = await stopRecording()
      const stumbleResult = await detectStumbleFromTranscript(speakingPassage!, text)
      const stumbles = stumbleResult.stumbledWords
      const msg = stumbles.length > 0
        ? "Great effort! I have everything I need to build your plan."
        : "Excellent reading — that was really clear!"
      await showReidMessage(msg)
      await handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE, stumbles)
    } catch (err) {
      console.error('[Speaking] recording/analysis error:', err)
      await showReidMessage("I had trouble hearing that. Moving on to your results.")
      await handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE, [])
    } finally {
      setIsTranscribing(false)
    }
  }

  // ── Finalization ──────────────────────────────────────────────────────────
  // Takes stumbles as a parameter to avoid stale closure over allStumbles state.
  async function handleFinalize(level: ReadingLevel, profile: GoalProfile, stumbles: StumbledWord[]) {
    setPhase('finalizing')
    setViewMode('loading')
    setLoading(true)
    try {
      const result = await buildDiagnosticResult(profile, level, stumbles)
      console.log('[Diagnostic] Result:', JSON.stringify(result, null, 2))
      setReadingLevel(result.readingLevel)
      await saveProfile({ userId, goal: profile.motivation, interests: profile.interests, readingLevel: result.readingLevel })
      setPhase('result')
      setLoading(false)
      // Show result message; user presses Next → "Let's get started" button appears
      await showReidMessage(result.firstLessonSuggestion)
    } catch (err) {
      console.error('[Diagnostic] handleFinalize error:', err)
      setPhase('result')
      setLoading(false)
      await showReidMessage("Something went wrong calculating your results. Please restart and try again.")
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const currentPassageText =
    viewMode === 'reading' && phase === 'baseline_reading' ? baselinePassages[currentBaselineIndex]?.text :
    viewMode === 'reading' && phase === 'domain_reading'   ? domainPassages[currentDomainIndex] :
    null

  // Auto-speak new Reid messages and passages when TTS is enabled
  useEffect(() => { if (ttsEnabled && !loading) ttSpeak(currentReidMessage) }, [currentReidMessage, ttsEnabled])
  useEffect(() => { if (ttsEnabled && currentPassageText) ttSpeak(currentPassageText) }, [currentPassageText, ttsEnabled])

  const currentStep = (() => {
    switch (phase) {
      case 'goal_chat':        return goalQuestionStep
      case 'baseline_loading':
      case 'baseline_reading': return 4
      case 'domain_loading':
      case 'domain_reading':   return 5
      case 'speaking_loading':
      case 'speaking':         return 6
      case 'finalizing':       return 7
      case 'result':           return 8
      default:                 return 1
    }
  })()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>

      {/* ── Progress header ── */}
      <ProgressHeader current={currentStep} />

      {/* ── Phase label ── */}
      <Text style={s.phaseLabel}>{PHASE_LABELS[phase] ?? 'DIAGNOSTIC'}</Text>

      {/* ── Main centered area — text + TTS as a unit ── */}
      <View style={s.main}>
        {viewMode === 'loading' ? (
          <LoadingGif size={80} />
        ) : (viewMode === 'reading' || viewMode === 'speaking') ? (
          <>
            {/* Faded scrollable box — reading and speaking diagnostics only */}
            <View style={s.textBox}>
              <ScrollView
                style={s.textScroll}
                contentContainerStyle={s.textScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardDismissMode="on-drag"
              >
                {viewMode === 'reading' && currentPassageText != null && (
                  <Text style={s.passageText}>{currentPassageText}</Text>
                )}
                {viewMode === 'speaking' && speakingPassage != null && (
                  <Text style={s.passageText}>{speakingPassage}</Text>
                )}
              </ScrollView>
              <View style={s.fadeTop} pointerEvents="none">
                <LinearGradient colors={['rgba(242,237,227,1)', 'rgba(242,237,227,0)']} style={s.fadeFill} />
              </View>
              <View style={s.fadeBottom} pointerEvents="none">
                <LinearGradient colors={['rgba(242,237,227,0)', 'rgba(242,237,227,1)']} style={s.fadeFill} />
              </View>
            </View>

            {/* TTS button — reading only, not speaking */}
            {viewMode === 'reading' && (
              <TouchableOpacity
                style={[s.speakerBtn, ttsEnabled && s.speakerBtnActive]}
                activeOpacity={0.7}
                onPress={() => {
                  if (ttsEnabled) { ttsStop(); setTtsEnabled(false) }
                  else setTtsEnabled(true)
                }}
              >
                <Ionicons name="megaphone" size={22} color={ttsEnabled ? C.bg : C.green} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Goal chat / message — plain centered text, no box */}
            {/* Pressable only here (non-scroll mode) so tapping background dismisses keyboard */}
            <Pressable onPress={Keyboard.dismiss} style={s.messagePressable}>
            {loading ? (
              <LoadingGif size={60} />
            ) : (
              <TypewriterText
                key={currentReidMessage}
                text={currentReidMessage}
                style={s.mainText}
                onComplete={() => setIsAnimating(false)}
              />
            )}
            </Pressable>

            {/* TTS button directly below text — hidden while loading */}
            {!loading && (
              <TouchableOpacity
                style={[s.speakerBtn, ttsEnabled && s.speakerBtnActive]}
                activeOpacity={0.7}
                onPress={() => {
                  if (ttsEnabled) { ttsStop(); setTtsEnabled(false) }
                  else setTtsEnabled(true)
                }}
              >
                <Ionicons name="megaphone" size={22} color={ttsEnabled ? C.bg : C.green} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ── Bottom action area — pinned to bottom ── */}
      <View style={s.bottomArea}>

        {/* Rating buttons — reading phases */}
        {viewMode === 'reading' && currentPassageText != null && (
          <View style={s.ratingRow}>
            {(['too_easy', 'just_right', 'too_hard'] as PassageRating[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={s.ratingBtn}
                activeOpacity={0.7}
                onPress={() => phase === 'domain_reading' ? handleDomainRating(r) : handleBaselineRating(r)}
              >
                <Text style={s.ratingBtnText}>
                  {r === 'too_easy' ? 'Too easy' : r === 'just_right' ? 'Just right' : 'Too hard'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Mic button — speaking phase */}
        {viewMode === 'speaking' && (
          <View style={s.micArea}>
            {isRecording && (
              <Text style={s.recordingTimer}>{recordingSeconds}s</Text>
            )}
            {isTranscribing ? (
              <LoadingGif size={72} />
            ) : (
              <TouchableOpacity
                style={[s.micBtn, isRecording && s.micBtnActive]}
                activeOpacity={0.8}
                onPress={handleMicPress}
              >
                <Text style={s.micIcon}>🎙</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Text input — animates up with keyboard; skip stays put and is covered */}
        {viewMode === 'goal-input' && (
          <Animated.View style={{ transform: [{ translateY: inputTranslateY }] }}>
            <View style={[s.inputRow, isVoiceInputRecording && s.inputRowRecording]}>
              <TextInput
                style={s.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={isVoiceInputRecording ? 'Listening...' : 'Type response, or speak it →'}
                placeholderTextColor={isVoiceInputRecording ? C.green : C.muted}
                onSubmitEditing={handleGoalSend}
                returnKeyType="send"
                editable={!loading && !isVoiceInputRecording && !isVoiceTranscribing}
              />
              <TouchableOpacity
                style={s.inputMicBtn}
                activeOpacity={0.7}
                onPress={handleVoiceInputPress}
                disabled={isVoiceTranscribing}
              >
                {isVoiceTranscribing ? (
                  <ActivityIndicator size="small" color={C.green} />
                ) : (
                  <Animated.View style={{ transform: [{ scale: voicePulseAnim }] }}>
                    <Ionicons
                      name={isVoiceInputRecording ? 'stop-circle' : 'mic'}
                      size={24}
                      color={isVoiceInputRecording ? '#E53E3E' : C.green}
                    />
                  </Animated.View>
                )}
              </TouchableOpacity>
              {!!inputText.trim() && (
                <TouchableOpacity
                  style={s.inputSubmitBtn}
                  activeOpacity={0.8}
                  onPress={handleGoalSend}
                  disabled={loading}
                >
                  <Ionicons name="arrow-up" size={18} color={C.bg} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        {/* Wrapper measured so keyboard translation lands input just above keyboard */}
        <View onLayout={(e) => { belowInputHeight.current = e.nativeEvent.layout.height }}>
          {/* Let's get started — result phase */}
          {phase === 'result' && (
            <TouchableOpacity style={s.continueBtn} activeOpacity={0.8} onPress={onComplete}>
              <Text style={s.continueBtnText}>Let's get started →</Text>
            </TouchableOpacity>
          )}

          {/* Next ▶| — always shown when pending. Skip ▶| — reading and speaking only. */}
          {phase !== 'result' && (hasPendingNext || phase === 'baseline_reading' || phase === 'domain_reading' || phase === 'speaking') && (
            <TouchableOpacity style={s.nextRow} onPress={handleNext}>
              <Text style={s.nextText}>{hasPendingNext ? 'Next' : 'Skip'}{'  ▶|'}</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  phaseLabel: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.muted,
    fontWeight: '600',
    marginBottom: 4,
  },

  // ── Main centered area ──
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // ── Scrollable text box ──
  // flex:1 on textBox gives it a determined height from main (flex:1 parent),
  // which allows the inner ScrollView to also use flex:1 and actually scroll.
  // maxHeight:390 caps it on large screens.
  textBox: {
    flex: 1,
    maxHeight: 390,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    position: 'relative',
  },
  textScroll: {
    flex: 1,
  },
  textScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  fadeFill: { flex: 1 },

  messagePressable: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },

  mainText: {
    fontSize: 28,
    fontWeight: '600',
    color: C.green,
    textAlign: 'center',
    lineHeight: 40,
    paddingHorizontal: 32,
  },

  passageText: {
    fontSize: 22,
    fontWeight: '500',
    color: C.green,
    textAlign: 'center',
    lineHeight: 34,
  },

  // ── TTS button — sits directly below textBox via gap in main ──
  speakerBtn: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  speakerBtnActive: {
    backgroundColor: C.green,
  },

  // ── Rating buttons ──
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  ratingBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.green,
    borderRadius: 20,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: C.bg,
  },
  ratingBtnText: { color: C.green, fontWeight: '500', fontSize: 13 },

  // ── Mic button ──
  micArea: { alignItems: 'center', paddingVertical: 8, gap: 12 },
  recordingTimer: { fontSize: 16, color: C.green, fontWeight: '600' },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  micBtnActive: { backgroundColor: C.green },
  micIcon: { fontSize: 28 },

  // ── Goal input ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: C.bg,
  },
  inputRowRecording: {
    borderColor: C.green,
    borderWidth: 2,
  },
  input: { flex: 1, fontSize: 15, color: C.green },
  inputMicBtn: { padding: 8, marginRight: 4 },
  inputMicIcon: { fontSize: 18 },
  inputSubmitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Continue (result) ──
  continueBtn: {
    marginHorizontal: 20,
    backgroundColor: C.green,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  continueBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // ── Bottom area ──
  bottomArea: { paddingBottom: 8, gap: 4 },

  // ── Next / Skip ──
  nextRow: { alignItems: 'center', paddingVertical: 12 },
  nextText: { color: C.muted, fontSize: 14 },
})
