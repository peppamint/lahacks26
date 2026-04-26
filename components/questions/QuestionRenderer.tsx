import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { LessonQuestion } from '../../services/lessons'
import { APP_THEME } from '../../constants/theme'

const DG = APP_THEME.colors.darkGreen
const BG = APP_THEME.colors.background
const BORDER_C = APP_THEME.colors.border

interface Props {
  question: LessonQuestion
  onSubmit: (payload: { score: number; isCorrect: boolean | null; response: unknown }) => void
}

export function QuestionRenderer({ question, onSubmit }: Props) {
  const [textValue, setTextValue] = useState('')

  if (question.interactionMode === 'mcq' && question.choices.length > 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        {question.choices.map((choice, idx) => (
          <TouchableOpacity
            key={`${question.id}-${idx}`}
            style={styles.choice}
            onPress={() => {
              const isCorrect = question.answerKey.correctIndex === idx
              onSubmit({
                score: isCorrect ? 100 : 0,
                isCorrect,
                response: { mode: 'mcq', selectedIndex: idx, choice },
              })
            }}
          >
            <Text style={styles.choiceText}>{choice}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{question.prompt}</Text>
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
        onPress={() =>
          onSubmit({
            score: textValue.trim().length > 0 ? 100 : 0,
            isCorrect: null,
            response: { mode: question.interactionMode === 'speech' ? 'text_fallback' : 'text', text: textValue },
          })
        }
      >
        <Text style={styles.submitText}>Submit Answer</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: BG, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: BORDER_C },
  prompt: { fontSize: 16, fontWeight: '700', color: DG },
  choice: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: BORDER_C },
  choiceText: { color: DG, fontSize: 15 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_C,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    color: DG,
  },
  submit: { backgroundColor: DG, borderRadius: 10, padding: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
})
