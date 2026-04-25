import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { ProgressStats } from '../types'

interface Props {
  stats: ProgressStats
}

export function ProgressChart({ stats }: Props) {
  // TODO: replace with Victory Native charts
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Reading Level: {stats.readingLevel}</Text>
      <Text style={styles.label}>Lessons: {stats.lessonsCompleted}</Text>
      <Text style={styles.label}>Words Learned: {stats.wordsLearned}</Text>
      <Text style={styles.label}>Avg Score: {Math.round(stats.averageScore * 100)}%</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#F9FAFB', borderRadius: 8 },
  label: { fontSize: 14, color: '#374151', marginBottom: 4 },
})
