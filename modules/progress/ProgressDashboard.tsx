import React from 'react'
import { View, Text } from 'react-native'
import { useStore } from '../../store'

export function ProgressDashboard() {
  const stats = useStore((s) => s.stats)
  // TODO: bar/line charts (Victory Native), reading level over time, lessons completed, words mastered
  return (
    <View>
      <Text>Progress Dashboard</Text>
      {stats && <Text>Lessons completed: {stats.lessonsCompleted}</Text>}
    </View>
  )
}
