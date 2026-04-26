import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import type { MicroLessonConfig } from '../../types'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { useTextToSpeech } from '../../modules/speech/hooks/useTextToSpeech'
import { LoadingScreen } from '../../components/LoadingScreen'
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
  config: MicroLessonConfig
  userId: string
  onComplete?: (stumbleCount: number) => void
  onExit?: () => void
  prefetchedQuestions?: LessonQuestion[]
}

export function MicroLesson({ config, userId, onComplete, onExit, prefetchedQuestions }: Props) {
  const { isRecording, transcript, startRecording, stopRecording, analyzeStumbles } =
    useSpeechRecognition({ offline: false })
  const { isSpeaking, speak, stop: stopSpeaking } = useTextToSpeech()

  const [stumbledWords, setStumbledWords] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [questions, setQuestions] = useState<LessonQuestion[]>(prefetchedQuestions ?? [])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(!prefetchedQuestions)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [questionScore, setQuestionScore] = useState(0)
  const [lessonAttemptId, setLessonAttemptId] = useState<string | null>(null)
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now())

  useEffect(() => {
    if (prefetchedQuestions) return  // already have questions, skip fetch
    async function loadQuestions() {
      setIsLoadingQuestions(true)
      const items = await fetchLessonQuestionsWithPersonalization(
        config.lessonId,
        config.readingLevel,
        config.interests,
        'micro',
      )
      setQuestions(items)
      setIsLoadingQuestions(false)
    }
    loadQuestions()
  }, [config.lessonId])

  useEffect(() => {
    if (questions.length === 0 || !userId) return
    async function startAttempt() {
      const id = await createLessonAttempt(userId, config.lessonId, config.readingLevel, 0.5)
      setLessonAttemptId(id)
      setQuestionStartedAt(Date.now())
    }
    startAttempt()
  }, [questions.length, userId, config.lessonId, config.readingLevel])

  const activeQuestion = questions[questionIdx] ?? null
  const questionModeEnabled = questions.length > 0

  async function handleStop() {
    try {
      setIsAnalyzing(true)
      const result = await stopRecording()
      const analysis = await analyzeStumbles(userId, config.documentText, result)
      setStumbledWords(analysis.stumbledWords.map(w => w.word.toLowerCase()))
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const scorePercent = useMemo(() => {
    if (questions.length === 0) return 0
    return Math.round(questionScore / questions.length)
  }, [questionScore, questions.length])

  function renderHighlightedText() {
    return config.documentText.split(' ').map((word, i) => {
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
    <View style={styles.root}>
      <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
        <Text style={styles.exitText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={styles.container}>
      <Text style={styles.lessonId}>Lesson {config.lessonId} · Reading Practice</Text>

      {isLoadingQuestions ? (
        <LoadingScreen message="Loading questions…" />
      ) : questionModeEnabled && !done ? (
        <View style={styles.stepPill}>
          <Text style={styles.stepText}>
            Question {questionIdx + 1} of {questions.length}
          </Text>
        </View>
      ) : !questionModeEnabled ? (
        <View style={styles.textBox}>
          <TouchableOpacity
            style={styles.listenBtn}
            onPress={() => (isSpeaking ? stopSpeaking() : speak(config.documentText))}
          >
            <Text style={styles.listenBtnText}>
              {isSpeaking ? '⏸ Pause' : '🔊 Listen to passage'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.passage}>{renderHighlightedText()}</Text>
        </View>
      ) : null}

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
                  interests: config.interests,
                  lessonType: 'micro',
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
        <LoadingScreen message="Analyzing your reading…" />
      ) : done ? (
        <>
          <ConfettiCannon
            count={120}
            origin={{ x: Dimensions.get('window').width / 2, y: 0 }}
            autoStart
            fadeOut
          />
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>
              {questionModeEnabled
                ? `✅ Questions complete. Score: ${scorePercent}%`
                : stumbledWords.length === 0
                ? '🎉 Great job! No stumbles detected.'
                : `📚 ${stumbledWords.length} word${stumbledWords.length > 1 ? 's' : ''} saved to your vocab bank.`}
            </Text>
            {onComplete ? (
              <TouchableOpacity style={styles.finishButton} onPress={() => onComplete(stumbledWords.length)}>
                <Text style={styles.finishButtonText}>Back to Lessons</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
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

      {done && stumbledWords.length > 0 && (
        <Text style={styles.hint}>
          Words in red were saved to your vocab bank for review.
        </Text>
      )}
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  exitBtn: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  exitText: { color: DG, fontSize: 16, fontWeight: '700', fontFamily: 'Arial' },
  container: { padding: 24, gap: 18, backgroundColor: BG, flexGrow: 1, justifyContent: 'center', alignItems: 'stretch' },
  lessonId: { fontSize: 26, fontWeight: '900', color: DG, fontFamily: 'Arial', textAlign: 'center' },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER_C,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stepText: { color: DG, fontSize: 13, fontWeight: '700', fontFamily: 'Arial' },
  textBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER_C, gap: 14, alignSelf: 'stretch' },
  listenBtn: {
    alignSelf: 'flex-start',
    backgroundColor: DG,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listenBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Arial' },
  passage: { fontSize: 20, lineHeight: 32, color: DG, fontFamily: 'Arial', width: '100%' },
  word: { color: DG, fontFamily: 'Arial' },
  stumbled: { color: DANGER, fontWeight: '700', fontFamily: 'Arial' },
  transcriptBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER_C },
  transcriptLabel: { fontWeight: '600', marginBottom: 4, color: DG, fontFamily: 'Arial' },
  transcript: { fontSize: 16, color: DG, fontFamily: 'Arial' },
  button: {
    backgroundColor: DG,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  buttonRecording: { backgroundColor: DANGER },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: 'Arial' },
  error: { color: DANGER, textAlign: 'center', fontFamily: 'Arial' },
  doneBox: { backgroundColor: '#fff', borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: BORDER_C },
  doneText: { fontSize: 17, fontWeight: '600', color: DG, textAlign: 'center', fontFamily: 'Arial' },
  finishButton: {
    marginTop: 14,
    backgroundColor: DG,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  finishButtonText: { color: '#fff', fontWeight: '700', fontFamily: 'Arial' },
  hint: { color: DG, opacity: 0.55, fontSize: 14, textAlign: 'center', fontFamily: 'Arial' },
})