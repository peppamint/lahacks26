import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import type { MacroLessonConfig } from '../../types'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'

interface Props {
  config: MacroLessonConfig
  userId: string
}

export function MacroLesson({ config, userId }: Props) {
  const { isRecording, transcript, startRecording, stopRecording, analyzeStumbles } =
    useSpeechRecognition({ offline: false })

  const [stumbledWords, setStumbledWords] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentChapter = config.chapters[0]

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
      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.chapterTitle}>{currentChapter.title}</Text>

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
        <ActivityIndicator size="large" style={styles.spinner} />
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

      {stumbledWords.length > 0 && (
        <Text style={styles.hint}>
          Words in red have been saved to your vocab bank.
        </Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  chapterTitle: { fontSize: 16, color: '#666', marginTop: -12 },
  textBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16 },
  passage: { fontSize: 16, lineHeight: 26, flexWrap: 'wrap' },
  word: { color: '#1a1a1a' },
  stumbled: { color: '#e53935', fontWeight: '600' },
  transcriptBox: { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 16 },
  transcriptLabel: { fontWeight: '600', marginBottom: 4 },
  transcript: { fontSize: 15, color: '#333' },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonRecording: { backgroundColor: '#e53935' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  spinner: { marginTop: 16 },
  error: { color: '#e53935' },
  hint: { color: '#888', fontSize: 13, textAlign: 'center' },
})