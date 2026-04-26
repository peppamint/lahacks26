import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native'
import type { StyleProp, TextStyle } from 'react-native'
import { conductGoalTurn, detectStumbleFromTranscript } from '../../services/claude'
import { startRecording, stopAndTranscribe, requestAudioPermissions } from '../../services/whisper'
import { saveProfile } from '../../services/supabase'
import { useStore } from '../../store'
import { LEVEL_LABELS } from '../../constants/readingLevels'
import { DOMAIN_LABELS } from '../../constants/domains'
import {
  GOAL_TURN_LIMIT,
  BASELINE_LEVELS,
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
  ChatMessage,
} from './types'
import type { ReadingLevel } from '../../constants/readingLevels'
import type { StumbledWord } from '../../types'
import type { Audio } from 'expo-av'

// ─── AnimatedBubble ───────────────────────────────────────────────────────────
// Slides in from below and fades in when first mounted.
function AnimatedBubble({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(18)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      {children}
    </Animated.View>
  )
}

// ─── Typewriter config ────────────────────────────────────────────────────────
const TYPEWRITER_INTERVAL = 150 // ms per word

// Returns how long a full typewriter animation takes plus an optional trailing pause.
function typewriterDelay(text: string, trailingMs = 350): number {
  return text.split(' ').length * TYPEWRITER_INTERVAL + trailingMs
}

// ─── TypewriterText ───────────────────────────────────────────────────────────
// Renders the full text immediately (so the bubble is correctly sized from the
// start), then fades each word in one at a time using staggered opacity animations.
// Words that haven't appeared yet are invisible but still occupy layout space.
function TypewriterText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const words = text.split(' ')
  // Initialise one Animated.Value per word — stable across re-renders.
  const opacities = useRef(words.map(() => new Animated.Value(0))).current

  useEffect(() => {
    Animated.parallel(
      opacities.map((opacity, i) =>
        Animated.sequence([
          Animated.delay(i * TYPEWRITER_INTERVAL),
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: false }),
        ]),
      ),
    ).start()
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onComplete: () => void
}

// ─── Fallback goal profile ─────────────────────────────────────────────────────
// Used if the user skips the goal chat or Claude fails to extract a profile.
const DEFAULT_GOAL_PROFILE: GoalProfile = {
  motivation: 'improve my reading',
  interests: 'general topics',
  domain: 'social',
}

export function DiagnosticScreen({ onComplete }: Props) {
  // Pull store values as individual selectors to avoid infinite re-render loops.
  const userId = useStore((s) => s.userId)
  const setReadingLevel = useStore((s) => s.setReadingLevel)
  const setProfile = useStore((s) => s.setProfile)

  // ─── Phase & chat state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState<DiagnosticPhase>('goal_chat')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'reid', text: "Hello! My name is Reid! What should I call you?" },
  ])
  // conversationHistory is the raw Message[] sent to Claude (role: user/assistant).
  // Separate from `messages` which is the displayed chat bubbles.
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)

  // ─── Step 1 state ────────────────────────────────────────────────────────
  const [goalTurnCount, setGoalTurnCount] = useState(0)
  const [goalProfile, setGoalProfile] = useState<GoalProfile | null>(null)

  // ─── Step 2 state ────────────────────────────────────────────────────────
  const [baselinePassages, setBaselinePassages] = useState<GeneratedPassage[]>([])
  const [currentBaselineIndex, setCurrentBaselineIndex] = useState(0)
  const [baselineRatings, setBaselineRatings] = useState<BaselineRoundResult[]>([])
  const [lockedLevel, setLockedLevel] = useState<ReadingLevel | null>(null)

  // ─── Step 3 state ────────────────────────────────────────────────────────
  const [domainPassages, setDomainPassages] = useState<string[]>([])
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0)

  // ─── Step 4 state ────────────────────────────────────────────────────────
  const [speakingPassage, setSpeakingPassage] = useState<string | null>(null)
  const [allStumbles, setAllStumbles] = useState<StumbledWord[]>([])
  const [activeRecording, setActiveRecording] = useState<ReturnType<typeof startRecording> extends Promise<infer T> ? T : never | null>(null as any)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages, phase])

  function addMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg])
  }

  // ─── Step 1: Goal conversation ───────────────────────────────────────────
  // Each send goes to Claude Sonnet. When Claude embeds <PROFILE>, we
  // auto-advance to baseline. The skip button appears after GOAL_TURN_LIMIT turns.
  async function handleGoalSend() {
    const text = inputText.trim()
    if (!text || loading) return
    setInputText('')
    addMessage({ role: 'user', text })

    const nextHistory = [...conversationHistory, { role: 'user' as const, content: text }]
    setConversationHistory(nextHistory)
    setGoalTurnCount((n) => n + 1)

    setLoading(true)
    try {
      const { reply, profile } = await conductGoalTurn(nextHistory)
      addMessage({ role: 'reid', text: reply })
      setConversationHistory([...nextHistory, { role: 'assistant', content: reply }])

      if (profile) {
        setGoalProfile(profile)
        await pause(600)
        await advanceToBaseline(profile)
      }
    } catch (err) {
      console.error('[Goal] conductGoalTurn error:', err)
      addMessage({ role: 'reid', text: "Sorry, I had trouble with that. Could you try again?" })
    } finally {
      setLoading(false)
    }
  }

  async function handleGoalSkip() {
    const profile = goalProfile ?? DEFAULT_GOAL_PROFILE
    setGoalProfile(profile)
    await advanceToBaseline(profile)
  }

  // ─── Baseline transition ──────────────────────────────────────────────────
  async function advanceToBaseline(profile: GoalProfile) {
    const msg1 = "Thanks for sharing that! Now let me find the best starting point for you."
    addMessage({ role: 'reid', text: msg1 })
    await pause(typewriterDelay(msg1))
    const msg2 = "I'll show you a few short passages. Read each one and let me know if it feels too easy, just right, or too hard."
    addMessage({ role: 'reid', text: msg2 })
    await pause(typewriterDelay(msg2))
    setPhase('baseline_loading')
    setLoading(true)
    try {
      const passages = await generateBaselinePassages()
      setBaselinePassages(passages)
      setPhase('baseline_reading')
    } catch (err) {
      console.error('[Baseline] generateBaselinePassages error:', err)
      addMessage({ role: 'reid', text: "Something went wrong loading the passages. Please restart the app." })
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 2: Baseline rating ─────────────────────────────────────────────
  // User rates each passage with one of three buttons.
  // "too_hard" or "just_right" stops the baseline early and locks the level.
  // "too_easy" advances to the next passage.
  async function handleBaselineRating(rating: PassageRating) {
    const passage = baselinePassages[currentBaselineIndex]
    const result: BaselineRoundResult = { level: passage.level, rating }
    const newRatings = [...baselineRatings, result]
    setBaselineRatings(newRatings)

    const ratingMsg =
      rating === 'too_easy' ? "Let's try something a bit more challenging." :
      rating === 'just_right' ? "Perfect — that's a great match for your level." :
      "No worries, I'll find a better fit."
    addMessage({ role: 'reid', text: ratingMsg })
    await pause(typewriterDelay(ratingMsg))

    if (rating === 'too_hard' || rating === 'just_right') {
      const level = determineLevelFromRatings(newRatings)
      setLockedLevel(level)
      await advanceToDomain(level, goalProfile ?? DEFAULT_GOAL_PROFILE)
      return
    }

    // too_easy: advance or finish
    const nextIndex = currentBaselineIndex + 1
    if (nextIndex >= baselinePassages.length) {
      const level = determineLevelFromRatings(newRatings)
      setLockedLevel(level)
      await advanceToDomain(level, goalProfile ?? DEFAULT_GOAL_PROFILE)
    } else {
      setCurrentBaselineIndex(nextIndex)
    }
  }

  // ─── Domain transition ────────────────────────────────────────────────────
  async function advanceToDomain(level: ReadingLevel, profile: GoalProfile) {
    addMessage({ role: 'reid', text: `Now I'll show you a few texts from the ${DOMAIN_LABELS[profile.domain]} world — the kind of reading you actually want to do.` })
    setPhase('domain_loading')
    setLoading(true)
    try {
      const passages = await generateDomainPassages(profile.domain, level)
      setDomainPassages(passages)
      setPhase('domain_reading')
    } catch (err) {
      console.error('[Domain] generateDomainPassages error:', err)
      addMessage({ role: 'reid', text: "Something went wrong. Moving on to the speaking portion." })
      await advanceToSpeaking(level, profile)
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 3: Domain rating ────────────────────────────────────────────────
  // All DOMAIN_PASSAGE_COUNT passages are shown regardless of rating.
  // Ratings calibrate domain vocabulary comfort — they don't change the locked level.
  async function handleDomainRating(rating: PassageRating) {
    const domainMsg =
      rating === 'too_easy' ? "Good — that vocabulary feels familiar to you." :
      rating === 'just_right' ? "Great, that's a solid match for your domain." :
      "We'll work on building that domain vocabulary."
    addMessage({ role: 'reid', text: domainMsg })
    await pause(typewriterDelay(domainMsg))

    const nextIndex = currentDomainIndex + 1
    if (nextIndex >= DOMAIN_PASSAGE_COUNT) {
      await advanceToSpeaking(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE)
    } else {
      setCurrentDomainIndex(nextIndex)
    }
  }

  // ─── Speaking transition ──────────────────────────────────────────────────
  async function advanceToSpeaking(level: ReadingLevel, profile: GoalProfile) {
    addMessage({ role: 'reid', text: "One last step — I'll have you read a short passage aloud so I can hear your voice." })
    setPhase('speaking_loading')
    setLoading(true)
    try {
      const granted = await requestAudioPermissions()
      if (!granted) {
        addMessage({ role: 'reid', text: "Microphone permission is needed. Please enable it in Settings and restart the app." })
        await handleFinalize(level, profile)
        return
      }
      const passage = await generateSpeakingPassage(profile.domain, level)
      setSpeakingPassage(passage)
      setPhase('speaking')
    } catch (err) {
      console.error('[Speaking] generation error:', err)
      addMessage({ role: 'reid', text: "Something went wrong. Moving on to your results." })
      await handleFinalize(level, profile)
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 4: Speaking — record start ────────────────────────────────────
  async function handleRecordStart() {
    if (isRecording || isTranscribing) return
    try {
      const rec = await startRecording()
      setActiveRecording(rec)
      setIsRecording(true)
    } catch (err) {
      console.error('[Speaking] startRecording error:', err)
    }
  }

  // ─── Step 4: Speaking — record stop ─────────────────────────────────────
  async function handleSpeakingRecordStop() {
    if (!activeRecording || !isRecording) return
    setIsRecording(false)
    setIsTranscribing(true)

    try {
      const transcript = await stopAndTranscribe(activeRecording)
      setActiveRecording(null as any)

      const stumbleResult = await detectStumbleFromTranscript(speakingPassage!, transcript)
      const stumbles = stumbleResult.stumbledWords
      setAllStumbles(stumbles)

      const stumbleMsg = stumbles.length > 0
        ? "Great effort! I have everything I need to build your plan."
        : "Excellent reading — that was really clear!"
      addMessage({ role: 'reid', text: stumbleMsg })
      await pause(typewriterDelay(stumbleMsg))
      await handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE)
    } catch (err) {
      console.error('[Speaking] recording/analysis error:', err)
      addMessage({ role: 'reid', text: "I had trouble hearing that. Moving on to your results." })
      await handleFinalize(lockedLevel ?? 'grade5', goalProfile ?? DEFAULT_GOAL_PROFILE)
    } finally {
      setIsTranscribing(false)
    }
  }

  // ─── Finalization ─────────────────────────────────────────────────────────
  async function handleFinalize(level: ReadingLevel, profile: GoalProfile) {
    setPhase('finalizing')
    addMessage({ role: 'reid', text: "Let me put together your results..." })
    setLoading(true)

    try {
      const result = await buildDiagnosticResult(profile, level, allStumbles)
      console.log('[Diagnostic] Result:', JSON.stringify(result, null, 2))

      setReadingLevel(result.readingLevel)
      await saveProfile({
        userId,
        goal: profile.motivation,
        domain: profile.domain,
        readingLevel: result.readingLevel,
      })

      console.log('[Diagnostic] Collected info:', JSON.stringify({
        motivation: profile.motivation,
        interests: profile.interests,
        domain: profile.domain,
        readingLevel: result.readingLevel,
        weakAreas: result.weakAreas,
        firstLessonSuggestion: result.firstLessonSuggestion,
      }, null, 2))

      addMessage({ role: 'reid', text: result.firstLessonSuggestion })
      setPhase('result')
    } catch (err) {
      console.error('[Diagnostic] handleFinalize error:', err)
      addMessage({ role: 'reid', text: "Something went wrong calculating your results. Please restart and try again." })
    } finally {
      setLoading(false)
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  const showGoalInput = phase === 'goal_chat' && !loading
  const showSkipButton = showGoalInput && goalTurnCount >= GOAL_TURN_LIMIT

  const currentPassageText =
    phase === 'baseline_reading' ? baselinePassages[currentBaselineIndex]?.text :
    phase === 'domain_reading'   ? domainPassages[currentDomainIndex] :
    phase === 'speaking'         ? speakingPassage :
    null

  const passageLabel =
    phase === 'baseline_reading' ? `Passage ${currentBaselineIndex + 1} of ${BASELINE_LEVELS.length}` :
    phase === 'domain_reading'   ? `Domain passage ${currentDomainIndex + 1} of ${DOMAIN_PASSAGE_COUNT}` :
    'Read this aloud'

  const showRatingButtons = (phase === 'baseline_reading' || phase === 'domain_reading') && !loading
  const showRecordButton  = phase === 'speaking' && !loading
  const onRating = phase === 'baseline_reading' ? handleBaselineRating : handleDomainRating

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* ── Chat history ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((msg, i) => (
          <AnimatedBubble key={i}>
            <View style={[styles.bubble, msg.role === 'reid' ? styles.reidBubble : styles.userBubble]}>
              {msg.role === 'reid' && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>R</Text>
                </View>
              )}
              <View style={[styles.bubbleText, msg.role === 'reid' ? styles.reidText : styles.userText]}>
                {msg.role === 'reid' ? (
                  <TypewriterText text={msg.text} style={styles.reidMessage} />
                ) : (
                  <Text style={styles.userMessage}>{msg.text}</Text>
                )}
              </View>
            </View>
          </AnimatedBubble>
        ))}

        {/* Typing indicator while waiting for Claude or transcribing */}
        {(loading || isTranscribing) && (
          <AnimatedBubble>
            <View style={[styles.bubble, styles.reidBubble]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>R</Text></View>
              <View style={[styles.bubbleText, styles.reidText]}>
                <ActivityIndicator size="small" color="#6B7280" />
              </View>
            </View>
          </AnimatedBubble>
        )}

        {/* Passage card — shown during Steps 2, 3, and 4 */}
        {currentPassageText != null && (
          <View style={styles.passageCard}>
            <Text style={styles.passageLabel}>{passageLabel}</Text>
            <Text style={styles.passageText}>{currentPassageText}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Step 2 & 3: Rating buttons ── */}
      {showRatingButtons && (
        <View style={styles.ratingRow}>
          <TouchableOpacity
            style={[styles.ratingBtn, styles.tooEasyBtn]}
            onPress={() => onRating('too_easy')}
          >
            <Text style={styles.ratingBtnText}>Too Easy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ratingBtn, styles.justRightBtn]}
            onPress={() => onRating('just_right')}
          >
            <Text style={styles.ratingBtnText}>Just Right</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ratingBtn, styles.tooHardBtn]}
            onPress={() => onRating('too_hard')}
          >
            <Text style={styles.ratingBtnText}>Too Hard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 4: Record button ── */}
      {showRecordButton && (
        <View style={styles.recordRow}>
          <Pressable
            onPressIn={handleRecordStart}
            onPressOut={handleSpeakingRecordStop}
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            disabled={isTranscribing}
          >
            <Text style={styles.recordBtnText}>
              {isRecording ? '🎙 Recording...' : 'Hold to Read Aloud'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Result: Continue button ── */}
      {phase === 'result' && (
        <View style={styles.continueRow}>
          <TouchableOpacity style={styles.continueBtn} onPress={onComplete}>
            <Text style={styles.continueBtnText}>Let's get started →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 1: Goal conversation input ── */}
      {showGoalInput && (
        <View style={styles.inputArea}>
          {showSkipButton && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleGoalSkip}>
              <Text style={styles.skipBtnText}>Skip to Reading Test →</Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type here..."
              placeholderTextColor="#9CA3AF"
              onSubmitEditing={handleGoalSend}
              returnKeyType="send"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
              onPress={handleGoalSend}
              disabled={!inputText.trim() || loading}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Brand color: #4F46E5 (indigo). Replace all occurrences to retheme.
// Recording active state uses #DC2626 (red) to signal the mic is live.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  reidBubble: { justifyContent: 'flex-start' },
  userBubble: { justifyContent: 'flex-end' },

  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bubbleText: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  reidText: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  userText: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  reidMessage: { color: '#111827', fontSize: 15, lineHeight: 22 },
  userMessage: { color: '#fff', fontSize: 15, lineHeight: 22 },

  passageCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 8,
    borderLeftWidth: 4, borderLeftColor: '#4F46E5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  passageLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  passageText: { fontSize: 17, lineHeight: 28, color: '#1F2937' },

  // ── Rating buttons (Steps 2 & 3) ──
  ratingRow: {
    flexDirection: 'row', gap: 8, padding: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  ratingBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  tooEasyBtn: { backgroundColor: '#D1FAE5' },   // green tint
  justRightBtn: { backgroundColor: '#4F46E5' },  // indigo
  tooHardBtn: { backgroundColor: '#FEE2E2' },    // red tint
  ratingBtnText: { fontWeight: '700', fontSize: 13, color: '#111827' },

  // ── Record button (Step 4) ──
  recordRow: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  recordBtn: {
    backgroundColor: '#4F46E5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  recordBtnActive: { backgroundColor: '#DC2626' },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Continue button (result phase) ──
  continueRow: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  continueBtn: {
    backgroundColor: '#4F46E5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Goal input (Step 1) ──
  inputArea: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  skipBtn: { paddingHorizontal: 16, paddingTop: 10 },
  skipBtnText: { color: '#6B7280', fontSize: 13, textDecorationLine: 'underline' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8 },
  input: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111827',
  },
  sendBtn: {
    backgroundColor: '#4F46E5', borderRadius: 24,
    paddingHorizontal: 20, justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7D2FE' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
