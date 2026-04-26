import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import type { LessonQuestion } from '../../services/lessons'
import { APP_THEME } from '../../constants/theme'
import { useTextToSpeech } from '../../modules/speech/hooks/useTextToSpeech'

const DG       = APP_THEME.colors.darkGreen
const BG       = APP_THEME.colors.background
const BORDER_C = APP_THEME.colors.border
const GREEN    = '#22c55e'
const RED      = '#ef4444'

interface Props {
  question: LessonQuestion
  onSubmit: (payload: { score: number; isCorrect: boolean | null; response: unknown }) => void
  autoSpeak?: boolean
}

export function QuestionRenderer({ question, onSubmit, autoSpeak = false }: Props) {
  const [textValue, setTextValue]       = useState('')
  const [selectedIdx, setSelectedIdx]   = useState<number | null>(null)
  const [revealed, setRevealed]         = useState(false)
  const { isSpeaking, speak, stop }     = useTextToSpeech()

  // Scale animations per choice
  const scales = useRef(
    (question.choices ?? []).map(() => new Animated.Value(1))
  ).current

  useEffect(() => {
    setTextValue('')
    setSelectedIdx(null)
    setRevealed(false)
    scales.forEach(s => s.setValue(1))
    if (autoSpeak && question?.prompt) speak(question.prompt).catch(() => {})
    return () => { stop().catch(() => {}) }
  }, [question.id])

  function bounceChoice(idx: number) {
    Animated.sequence([
      Animated.timing(scales[idx], { toValue: 1.06, duration: 120, useNativeDriver: true }),
      Animated.timing(scales[idx], { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start()
  }

  function handleChoicePress(idx: number) {
    if (revealed) return
    bounceChoice(idx)
    setSelectedIdx(idx)
    setRevealed(true)

    const isCorrect = question.answerKey.correctIndex === idx
    stop().catch(() => {})

    // Delay onSubmit slightly so feedback is visible before advancing
    setTimeout(() => {
      onSubmit({ score: isCorrect ? 100 : 0, isCorrect, response: { mode: 'mcq', selectedIndex: idx } })
    }, 2000)
  }

  function choiceStyle(idx: number) {
    if (!revealed) return styles.choice
    const correct = question.answerKey.correctIndex === idx
    const picked  = selectedIdx === idx
    if (correct)           return styles.choiceCorrect
    if (picked && !correct) return styles.choiceWrong
    return styles.choice
  }

  function choiceTextStyle(idx: number) {
    if (!revealed) return styles.choiceText
    const correct = question.answerKey.correctIndex === idx
    const picked  = selectedIdx === idx
    if (correct || (picked && !correct)) return styles.choiceTextLight
    return styles.choiceText
  }

  const isCorrectAnswer = revealed && selectedIdx === question.answerKey.correctIndex

  function ListenButton() {
    return (
      <TouchableOpacity
        style={styles.listenBtn}
        onPress={() => (isSpeaking ? stop() : speak(question.prompt))}
      >
        <Text style={styles.listenText}>{isSpeaking ? '⏸ Pause' : '🔊 Listen'}</Text>
      </TouchableOpacity>
    )
  }

  if (question.interactionMode === 'mcq' && question.choices.length > 0) {
    return (
      <View style={styles.card}>
        {isCorrectAnswer && (
          <ConfettiCannon
            count={80}
            origin={{ x: Dimensions.get('window').width / 2, y: 0 }}
            autoStart
            fadeOut
          />
        )}

        <View style={styles.promptRow}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <ListenButton />
        </View>

        {question.choices.map((choice, idx) => (
          <Animated.View key={`${question.id}-${idx}`} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={choiceStyle(idx)}
              onPress={() => handleChoicePress(idx)}
              activeOpacity={revealed ? 1 : 0.7}
            >
              <Text style={choiceTextStyle(idx)}>{choice}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.promptRow}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <ListenButton />
      </View>
      <TextInput
        style={styles.input}
        multiline
        placeholder={
          question.interactionMode === 'speech'
            ? 'Speech fallback: type your answer here'
            : 'Type your answer'
        }
        value={textValue}
        onChangeText={setTextValue}
      />
      <TouchableOpacity
        style={styles.submit}
        onPress={() => {
          stop().catch(() => {})
          onSubmit({
            score: textValue.trim().length > 0 ? 100 : 0,
            isCorrect: null,
            response: { mode: question.interactionMode === 'speech' ? 'text_fallback' : 'text', text: textValue },
          })
        }}
      >
        <Text style={styles.submitText}>Submit Answer</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card:       { backgroundColor: BG, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: BORDER_C },
  promptRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  prompt:     { flex: 1, fontSize: 20, fontWeight: '700', color: DG, fontFamily: 'Arial', lineHeight: 28 },
  listenBtn:  { backgroundColor: DG, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  listenText: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Arial' },

  choice:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: BORDER_C },
  choiceCorrect:  { backgroundColor: GREEN,  borderRadius: 12, padding: 16, borderWidth: 2, borderColor: GREEN },
  choiceWrong:    { backgroundColor: RED,    borderRadius: 12, padding: 16, borderWidth: 2, borderColor: RED },
  choiceText:     { color: DG,     fontSize: 18, fontFamily: 'Arial', lineHeight: 24 },
  choiceTextLight:{ color: '#fff', fontSize: 18, fontFamily: 'Arial', lineHeight: 24, fontWeight: '700' },

  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_C,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    color: DG,
    fontSize: 17,
    fontFamily: 'Arial',
  },
  submit:     { backgroundColor: DG, borderRadius: 12, padding: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: 'Arial' },
})
