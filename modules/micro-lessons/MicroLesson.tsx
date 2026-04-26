import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import type { MicroLessonConfig } from '../../types'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'

interface Props {
  config: MicroLessonConfig
  userId: string
}

export function MicroLesson({ config, userId }: Props) {
  const { isRecording, transcript, startRecording, stopRecording, analyzeStumbles } =
    useSpeechRecognition({ offline: false })

  const [stumbledWords, setStumbledWords] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>READ ALOUD</Text>
      <Text style={styles.lessonId}>Lesson {config.lessonId}</Text>

      <View style={styles.textBox}>
        <Text style={styles.passage}>{renderHighlightedText()}</Text>
      </View>

      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcript}>{transcript}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isAnalyzing ? (
        <ActivityIndicator size="large" color="#4f46e5" style={styles.spinner} />
      ) : done ? (
        <View style={styles.doneBox}>
          <Text style={styles.doneText}>
            {stumbledWords.length === 0
              ? '🎉 Great job! No stumbles detected.'
              : `📚 ${stumbledWords.length} word${stumbledWords.length > 1 ? 's' : ''} saved to your vocab bank.`}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, isRecording && styles.buttonRecording]}
          onPress={isRecording ? handleStop : startRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? '⏹ Stop & Analyze' : '🎙 Start Reading'}
          </Text>
        </TouchableOpacity>
      )}

      {done && stumbledWords.length > 0 && (
        <Text style={styles.hint}>
          Words in red were saved to your vocab bank for review.
        </Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#9ca3af' },
  lessonId: { fontSize: 22, fontWeight: '700', color: '#111827' },
  textBox: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  passage: { fontSize: 17, lineHeight: 28, flexWrap: 'wrap', color: '#1f2937' },
  word: { color: '#1f2937' },
  stumbled: { color: '#ef4444', fontWeight: '700' },
  transcriptBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  transcriptLabel: { fontWeight: '600', marginBottom: 4, color: '#166534' },
  transcript: { fontSize: 15, color: '#166534' },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonRecording: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  spinner: { marginTop: 16 },
  error: { color: '#ef4444', textAlign: 'center' },
  doneBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, alignItems: 'center' },
  doneText: { fontSize: 16, fontWeight: '600', color: '#1d4ed8', textAlign: 'center' },
  hint: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },
})