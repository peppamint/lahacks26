import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import type { MacroLessonConfig } from '../../types'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import {
  applyIncrementalSkillMasteryForAttempt,
  completeLessonAttempt,
  createLessonAttempt,
  fetchLessonQuestionsWithPersonalization,
  fetchUserLearningSnapshot,
  generateNextLessonIfNeeded,
  saveQuestionAttempt,
  type LessonQuestion,
} from '../../services/lessons'
import { QuestionRenderer } from '../../components/questions/QuestionRenderer'
import { APP_THEME } from '../../constants/theme'

const DG = APP_THEME.colors.darkGreen
const BG = APP_THEME.colors.background
const BORDER_C = APP_THEME.colors.border
const DANGER = APP_THEME.colors.danger

interface Props {
  config: MacroLessonConfig
  userId: string
  onComplete?: (stumbleCount: number) => void
}

export function MacroLesson({ config, userId, onComplete }: Props) {
  const { isRecording, transcript, startRecording, stopRecording, analyzeStumbles } =
    useSpeechRecognition({ offline: false })

  const [stumbledWords, setStumbledWords] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<LessonQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [questionScore, setQuestionScore] = useState(0)
  const [done, setDone] = useState(false)
  const [lessonAttemptId, setLessonAttemptId] = useState<string | null>(null)
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now())

  const currentChapter = config.chapters[0]
  const activeQuestion = questions[questionIdx] ?? null
  const questionModeEnabled = questions.length > 0

  useEffect(() => {
    async function loadQuestions() {
      setIsLoadingQuestions(true)
      const items = await fetchLessonQuestionsWithPersonalization(
        config.lessonId,
        config.readingLevel,
        config.title,
        'macro',
      )
      setQuestions(items)
      setIsLoadingQuestions(false)
    }
    loadQuestions()
  }, [config.lessonId])

  useEffect(() => {
    if (questions.length === 0 || !userId) return
    async function startAttempt() {
      const id = await createLessonAttempt(userId, config.lessonId, config.readingLevel, 0.6)
      setLessonAttemptId(id)
      setQuestionStartedAt(Date.now())
    }
    startAttempt()
  }, [questions.length, userId, config.lessonId, config.readingLevel])

  const scorePercent = useMemo(() => {
    if (questions.length === 0) return 0
    return Math.round(questionScore / questions.length)
  }, [questionScore, questions.length])

  async function handleStop() {
    try {
      setIsAnalyzing(true)
      const result = await stopRecording()
      const analysis = await analyzeStumbles(userId, currentChapter.content, result)
      setStumbledWords(analysis.stumbledWords.map(w => w.word.toLowerCase()))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  function renderHighlightedText() {
    return currentChapter.content.split(' ').map((word, i) => {
      const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase()
      const isStumbled = stumbledWords.includes(clean)
      return (
        <Text key={i} style={[styles.word, isStumbled && styles.stumbled]}>
          {word}{' '}
        </Text>
      )
    })
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>LESSON TRACK</Text>
      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.chapterTitle}>{currentChapter.title}</Text>

      {isLoadingQuestions ? (
        <ActivityIndicator size="large" color={DG} style={styles.spinner} />
      ) : questionModeEnabled ? (
        <View style={styles.stepPill}>
          <Text style={styles.stepText}>
            Question {questionIdx + 1} of {questions.length}
          </Text>
        </View>
      ) : (
        <View style={styles.textBox}>
          <Text style={styles.passage}>{renderHighlightedText()}</Text>
        </View>
      )}

      {!isLoadingQuestions && questionModeEnabled && !done && activeQuestion ? (
        <QuestionRenderer
          question={activeQuestion}
          onSubmit={async ({ score, isCorrect, response }) => {
            setQuestionScore((prev) => prev + score)
            if (lessonAttemptId) {
              await saveQuestionAttempt({
                userId,
                lessonAttemptId,
                questionId: activeQuestion.id,
                response,
                isCorrect,
                score,
                responseTimeMs: Date.now() - questionStartedAt,
              })
            }
            if (questionIdx >= questions.length - 1) {
              const finalScore = Math.round((questionScore + score) / questions.length)
              if (lessonAttemptId) {
                await completeLessonAttempt(lessonAttemptId, finalScore)
                await applyIncrementalSkillMasteryForAttempt(userId, lessonAttemptId)
                await generateNextLessonIfNeeded({
                  userId,
                  currentLessonId: config.lessonId,
                  readingLevel: config.readingLevel,
                  interests: config.title,
                  lessonType: 'macro',
                })
                const snapshot = await fetchUserLearningSnapshot(userId)
                console.log('[learning-snapshot]', snapshot)
              }
              setDone(true)
              return
            }
            setQuestionIdx((prev) => prev + 1)
            setQuestionStartedAt(Date.now())
          }}
        />
      ) : null}

      {!isLoadingQuestions && !questionModeEnabled && transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcript}>{transcript}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoadingQuestions && !questionModeEnabled && isAnalyzing ? (
        <ActivityIndicator size="large" style={styles.spinner} />
      ) : !isLoadingQuestions && !questionModeEnabled ? (
        <TouchableOpacity
          style={[styles.button, isRecording && styles.buttonRecording]}
          onPress={isRecording ? handleStop : startRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? '⏹ Stop & Analyze' : '🎙 Start Reading'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {stumbledWords.length > 0 && (
        <Text style={styles.hint}>
          Words in red have been saved to your vocab bank.
        </Text>
      )}

      {done && questionModeEnabled ? (
        <View style={styles.doneBox}>
          <Text style={styles.doneText}>✅ Questions complete. Score: {scorePercent}%</Text>
        </View>
      ) : null}

      {onComplete && (done || !questionModeEnabled) ? (
        <TouchableOpacity
          style={styles.finishButton}
          onPress={() => onComplete(questionModeEnabled ? 0 : stumbledWords.length)}
        >
          <Text style={styles.finishButtonText}>Back to Lessons</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20, backgroundColor: BG, minHeight: '100%' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: DG, opacity: 0.45 },
  title: { fontSize: 24, fontWeight: '900', color: DG },
  chapterTitle: { fontSize: 15, color: DG, opacity: 0.6, marginTop: -12 },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER_C,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepText: { color: DG, fontSize: 12, fontWeight: '700' },
  textBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER_C },
  passage: { fontSize: 16, lineHeight: 26, flexWrap: 'wrap', color: DG },
  word: { color: DG },
  stumbled: { color: DANGER, fontWeight: '600' },
  transcriptBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER_C },
  transcriptLabel: { fontWeight: '600', marginBottom: 4, color: DG },
  transcript: { fontSize: 15, color: DG },
  button: {
    backgroundColor: DG,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonRecording: { backgroundColor: DANGER },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  spinner: { marginTop: 16 },
  error: { color: DANGER },
  hint: { color: DG, opacity: 0.55, fontSize: 13, textAlign: 'center' },
  doneBox: { backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: BORDER_C },
  doneText: { color: DG, fontWeight: '700' },
  finishButton: {
    backgroundColor: DG,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  finishButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})