import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MicroLessonPlan, MicroLessonQuestion, MicroLessonResult } from './types'
import { recommendNextReadingLevel } from './lessonData'
import { SKILL_CATEGORY_LABELS } from '../../constants/skills'

interface Props {
  lesson: MicroLessonPlan
  onComplete: (result: MicroLessonResult) => void
  onBack: () => void
}

export function MicroLesson({ lesson, onComplete, onBack }: Props) {
  const allQuestions = useMemo<MicroLessonQuestion[]>(
    () => [...lesson.items.map((item) => item.question), ...lesson.quiz],
    [lesson.items, lesson.quiz],
  )
  const [index, setIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [showSummary, setShowSummary] = useState(false)

  const totalCount = allQuestions.length
  const currentQuestion = allQuestions[index]
  const currentItem = index < lesson.items.length ? lesson.items[index] : null
  const inQuiz = index >= lesson.items.length

  const handleSubmitAnswer = () => {
    if (selectedIndex === null) return

    const wasCorrect = selectedIndex === currentQuestion.correctIndex
    const nextCorrectCount = wasCorrect ? correctCount + 1 : correctCount
    setCorrectCount(nextCorrectCount)

    const nextIndex = index + 1
    if (nextIndex >= totalCount) {
      setShowSummary(true)
      const scorePercent = Math.round((nextCorrectCount / totalCount) * 100)
      onComplete({
        lessonId: lesson.lessonId,
        targetCategory: lesson.targetCategory,
        targetSkillLevel: lesson.targetSkillLevel,
        scorePercent,
        correctCount: nextCorrectCount,
        totalCount,
        recommendedNextLevel: recommendNextReadingLevel(lesson.targetSkillLevel, scorePercent),
      })
      return
    }

    setIndex(nextIndex)
    setSelectedIndex(null)
  }

  if (showSummary) {
    const scorePercent = Math.round((correctCount / totalCount) * 100)
    const recommendedLevel = recommendNextReadingLevel(lesson.targetSkillLevel, scorePercent)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Lesson Complete</Text>
        <Text style={styles.subtitle}>
          Score: {correctCount}/{totalCount} ({scorePercent}%)
        </Text>
        <Text style={styles.bodyText}>
          {SKILL_CATEGORY_LABELS[lesson.targetCategory]} recommended level: {recommendedLevel}
        </Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Back to Lesson Plan</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.subtitle}>
        {inQuiz ? 'Final Quiz' : `Reading Question ${index + 1} of ${lesson.items.length}`}
      </Text>
      <Text style={styles.subtitle}>
        Target skill: {SKILL_CATEGORY_LABELS[lesson.targetCategory]} ({lesson.targetSkillLevel})
      </Text>

      {currentItem ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passage</Text>
          <Text style={styles.bodyText}>{currentItem.passage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{currentQuestion.prompt}</Text>
        {currentQuestion.options.map((option, optionIndex) => (
          <Pressable
            key={option}
            style={[styles.optionButton, selectedIndex === optionIndex && styles.optionButtonSelected]}
            onPress={() => setSelectedIndex(optionIndex)}
          >
            <Text style={[styles.optionText, selectedIndex === optionIndex && styles.optionTextSelected]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, selectedIndex === null && styles.buttonDisabled]}
        disabled={selectedIndex === null}
        onPress={handleSubmitAnswer}
      >
        <Text style={styles.primaryButtonText}>{index + 1 >= totalCount ? 'Finish Lesson' : 'Next Question'}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Back to Lesson Plan</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  optionButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionText: {
    color: '#374151',
    lineHeight: 20,
  },
  optionTextSelected: {
    color: '#3730A3',
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3730A3',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
})
