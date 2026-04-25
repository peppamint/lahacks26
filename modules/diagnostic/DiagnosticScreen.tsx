import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { respondPositively } from '../../services/claude'
import { saveProfile } from '../../services/supabase'
import { useStore } from '../../store'
import { LEVEL_LABELS } from '../../constants/readingLevels'
import { fetchNextPassage, finalizeDiagnostic, START_LEVEL, PASSAGE_COUNT } from './DiagnosticFlow'
import type { DiagnosticPhase, ChatMessage, GeneratedPassage, PassageFeedback, PassageRating } from './types'
import type { ReadingLevel } from '../../constants/readingLevels'

// ─── Props ────────────────────────────────────────────────────────────────────
// onComplete is called after the final result is shown and the user is ready
// to move on. In App.tsx this navigates to the Home screen.
interface Props {
  onComplete: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DiagnosticScreen({ onComplete }: Props) {
  // Pull only the specific store values we need — do NOT destructure into one
  // object selector, as that creates a new object every render and causes an
  // infinite re-render loop.
  const userId = useStore((s) => s.userId)
  const setProfile = useStore((s) => s.setProfile)
  const setReadingLevel = useStore((s) => s.setReadingLevel)

  // ─── Conversation state ──────────────────────────────────────────────────
  // phase drives which UI (text input vs. rating buttons) is visible.
  // See types.ts for the full phase order.
  const [phase, setPhase] = useState<DiagnosticPhase>('name')

  // messages is the full chat history rendered as bubbles.
  // The opening message from Reid is pre-seeded here.
  // To change Reid's greeting, edit the text below.
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'reid', text: "Hello! My name is Reid! What should I call you?" },
  ])

  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('')

  // ─── Passage state ───────────────────────────────────────────────────────
  // currentPassageLevel tracks the level of the last fetched passage so the
  // adaptive algorithm knows where to step up or down from.
  const [currentPassageLevel, setCurrentPassageLevel] = useState<ReadingLevel>(START_LEVEL)
  const [currentPassage, setCurrentPassage] = useState<GeneratedPassage | null>(null)

  // passageFeedback accumulates one entry per round; sent to Claude at the end.
  const [passageFeedback, setPassageFeedback] = useState<PassageFeedback[]>([])

  // passageIndex counts completed rounds (0-based). When it reaches PASSAGE_COUNT
  // the diagnostic is finalized.
  const [passageIndex, setPassageIndex] = useState(0)

  const scrollRef = useRef<ScrollView>(null)

  // Auto-scroll to the bottom whenever a new message or passage appears.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages, currentPassage])

  // Appends a single message to the chat history.
  function addMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg])
  }

  // ─── Scripted conversation handler ───────────────────────────────────────
  // Handles user text input for the name → goal → interest phases.
  // Each phase adds Reid's scripted replies, then advances to the next phase.
  // To add a new phase, add a new else-if block and a matching DiagnosticPhase value.
  async function handleSend() {
    const text = inputText.trim()
    if (!text || loading) return
    setInputText('')
    addMessage({ role: 'user', text })

    setLoading(true)
    try {
      if (phase === 'name') {
        const name = text
        setUserName(name)
        // Scripted replies — edit these strings to change Reid's wording.
        addMessage({ role: 'reid', text: `Nice to meet you, ${name}!` })
        await pause(400)
        addMessage({ role: 'reid', text: "Before we begin your journey, I would like to get to know your goals, motivation, and interests." })
        await pause(400)
        addMessage({ role: 'reid', text: "What are your reading goals or motivation? For example: reading to your children, understanding the news, fiction, professional writing, or general improvement." })
        setPhase('goal')

      } else if (phase === 'goal') {
        // Claude (Haiku) generates a warm 1-sentence response to the user's goal.
        // To make this scripted instead, replace the respondPositively call with
        // a hardcoded string: addMessage({ role: 'reid', text: 'Great goal!' })
        const reply = await respondPositively(text, 'goal')
        addMessage({ role: 'reid', text: reply })
        await pause(400)
        addMessage({ role: 'reid', text: "What are your interests? For example: cooking, politics, sports, science, or anything else you enjoy." })
        setPhase('interest')

      } else if (phase === 'interest') {
        // Same pattern as goal — Claude responds positively to the user's interests.
        const reply = await respondPositively(text, 'interest')
        addMessage({ role: 'reid', text: reply })
        await pause(400)
        // This is the last text-input phase. After this message the passage loop starts.
        addMessage({ role: 'reid', text: "Great! Now let's figure out the best starting point for you. I'll show you a few short passages — just tell me if each one feels too easy, about right, or a bit tough." })
        setPhase('passage_intro')
        await loadNextPassage(START_LEVEL, null)
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Passage loader ───────────────────────────────────────────────────────
  // Fetches the next passage from DiagnosticFlow (which calls Claude Haiku).
  // lastRating is null on the first load; subsequent calls pass the user's rating
  // so DiagnosticFlow can step the level up or down.
  async function loadNextPassage(level: ReadingLevel, lastRating: PassageRating | null) {
    setLoading(true)
    setCurrentPassage(null)
    try {
      const passage = await fetchNextPassage(level, lastRating)
      setCurrentPassageLevel(passage.level)
      setCurrentPassage(passage)
      setPhase('passage')
    } finally {
      setLoading(false)
    }
  }

  // ─── Passage rating handler ───────────────────────────────────────────────
  // Called when the user taps one of the three rating buttons.
  // Records the feedback, tells the user what level the passage was at,
  // then either loads the next passage or finalizes the diagnostic.
  async function handlePassageRating(rating: PassageRating) {
    if (!currentPassage || loading) return

    const ratingLabel = rating === 'too_easy' ? 'Too Easy' : rating === 'just_right' ? 'Just Right' : 'Too Hard'
    addMessage({ role: 'user', text: ratingLabel })

    const passageLevel = currentPassage.level
    const passageLevelLabel = LEVEL_LABELS[passageLevel]

    // Accumulate this round's feedback.
    const newFeedback: PassageFeedback[] = [
      ...passageFeedback,
      { level: passageLevel, rating },
    ]
    setPassageFeedback(newFeedback)
    setCurrentPassage(null)

    // Tell the user what level they just read.
    // To hide this disclosure, remove the two lines below.
    addMessage({ role: 'reid', text: `That passage was at a ${passageLevelLabel} reading level.` })
    await pause(400)

    const nextIndex = passageIndex + 1
    setPassageIndex(nextIndex)

    if (nextIndex < PASSAGE_COUNT) {
      await loadNextPassage(currentPassageLevel, rating)
    } else {
      // All passages complete — calculate the final result.
      await handleFinalize(newFeedback)
    }
  }

  // ─── Finalization ─────────────────────────────────────────────────────────
  // Called after all passage rounds are complete. Sends feedback to Claude,
  // saves the result to Zustand + Supabase, announces the result in chat,
  // then calls onComplete() to navigate away.
  async function handleFinalize(feedback: PassageFeedback[]) {
    setLoading(true)
    try {
      const result = await finalizeDiagnostic(feedback, []).catch((err) => {
        console.error('[handleFinalize] finalizeDiagnostic threw:', err)
        throw err
      })
      const level = result.estimatedLevel
      const levelLabel = LEVEL_LABELS[level]
      console.log(`[Diagnostic] Estimated reading level: ${level} (${levelLabel})`)

      // Persist to global state and Supabase.
      // goal and domain are left empty here — they can be filled in later
      // once the goal/interest text is wired into a structured UserProfile.
      setReadingLevel(level)
      await saveProfile({
        userId,
        goal: '',
        domain: 'general',
        readingLevel: level,
      })

      // Announce the result across three messages for a more natural cadence.
      // To change the result messaging, edit the strings below.
      addMessage({ role: 'reid', text: `Based on your responses, I'd estimate your current reading level is:` })
      await pause(300)
      addMessage({ role: 'reid', text: `📖 ${levelLabel}` })
      await pause(600)
      addMessage({ role: 'reid', text: `That's a great starting point! We'll build your skills from here. Let's get started!` })
      setPhase('result')

      // Pause so the user can read the result before the screen transitions.
      // Increase this value (ms) if the transition feels too abrupt.
      await pause(2500)
      onComplete()
    } catch (err) {
      console.error('[Diagnostic] handleFinalize error:', err)
      addMessage({ role: 'reid', text: "Sorry, something went wrong calculating your result. Please restart the app and try again." })
    } finally {
      setLoading(false)
    }
  }

  // ─── Render logic ─────────────────────────────────────────────────────────
  // showInput: text input + send button are visible during the scripted phases.
  // showPassageButtons: rating buttons are visible only when a passage is loaded.
  const showInput = phase === 'name' || phase === 'goal' || phase === 'interest'
  const showPassageButtons = phase === 'passage' && currentPassage !== null && !loading

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* ── Chat bubble list ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.bubble, msg.role === 'reid' ? styles.reidBubble : styles.userBubble]}
          >
            {/* Avatar only shown for Reid's messages */}
            {msg.role === 'reid' && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>R</Text>
              </View>
            )}
            <View style={[styles.bubbleText, msg.role === 'reid' ? styles.reidText : styles.userText]}>
              <Text style={msg.role === 'reid' ? styles.reidMessage : styles.userMessage}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {/* Typing indicator — shown while waiting for any Claude response */}
        {loading && (
          <View style={[styles.bubble, styles.reidBubble]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>R</Text>
            </View>
            <View style={[styles.bubbleText, styles.reidText]}>
              <ActivityIndicator size="small" color="#6B7280" />
            </View>
          </View>
        )}

        {/* Passage card — rendered below chat bubbles during the passage phase */}
        {currentPassage && !loading && (
          <View style={styles.passageCard}>
            <Text style={styles.passageText}>{currentPassage.text}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Rating buttons (passage phase only) ── */}
      {showPassageButtons && (
        <View style={styles.ratingRow}>
          {(['too_easy', 'just_right', 'too_hard'] as PassageRating[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.ratingBtn, r === 'just_right' && styles.ratingBtnMiddle]}
              onPress={() => handlePassageRating(r)}
            >
              <Text style={styles.ratingBtnText}>
                {r === 'too_easy' ? 'Too Easy' : r === 'just_right' ? 'Just Right' : 'Too Hard'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Text input (scripted conversation phases only) ── */}
      {showInput && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type here..."
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────
// Small delay used between consecutive Reid messages to simulate a natural
// typing cadence. Adjust the ms values in handleSend/handleFinalize to change pacing.
function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Primary brand color is #4F46E5 (indigo). To retheme, replace all occurrences
// of #4F46E5 / #C7D2FE / #EEF2FF with your new palette.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  reidBubble: { justifyContent: 'flex-start' },
  userBubble: { justifyContent: 'flex-end' },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bubbleText: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  reidText: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  userText: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },

  reidMessage: { color: '#111827', fontSize: 15, lineHeight: 22 },
  userMessage: { color: '#fff', fontSize: 15, lineHeight: 22 },

  passageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  passageText: { fontSize: 16, lineHeight: 26, color: '#1F2937' },

  ratingRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  ratingBtnMiddle: { backgroundColor: '#EEF2FF' },
  ratingBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  sendBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7D2FE' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
