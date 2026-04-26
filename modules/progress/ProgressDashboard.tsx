import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useProgress } from './hooks/useProgress'
import { fetchTodayProgress } from '../../services/progress'
import { useStore } from '../../store'
import type { ProgressStats } from '../../types'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  todaySection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  overallSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  overallTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItemLabel: {
    fontSize: 16,
    color: '#666',
  },
  statItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },

  wordsImprovementSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  wordEntry: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  wordEntryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  wordEntryContext: {
    fontSize: 14,
    color: '#4b5563',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export function ProgressDashboard() {
  const { stats, wordBank } = useProgress()
  const userId = useStore((state) => state.userId)
  const [todayProgress, setTodayProgress] = useState({
    wordsLearnedToday: 0,
    grammarStructuresLearned: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProgressData()
  }, [userId])

  async function loadProgressData() {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const todayData = await fetchTodayProgress(userId)
      setTodayProgress(todayData)
    } catch (error) {
      console.error('Error loading progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Your Progress</Text>

      {/* Today's Progress */}
      <View style={styles.todaySection}>
        <Text style={styles.todayTitle}>Today's Learning</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{todayProgress.wordsLearnedToday}</Text>
            <Text style={styles.statLabel}>New Words</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{todayProgress.grammarStructuresLearned}</Text>
            <Text style={styles.statLabel}>Lessons Done</Text>
          </View>
        </View>
      </View>

      {/* Overall Statistics */}
      {stats && (
        <View style={styles.overallSection}>
          <Text style={styles.overallTitle}>Overall Stats</Text>

          <View style={styles.statItem}>
            <Text style={styles.statItemLabel}>Total Lessons Completed</Text>
            <Text style={styles.statItemValue}>{stats.lessonsCompleted}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statItemLabel}>Words in Bank</Text>
            <Text style={styles.statItemValue}>{stats.wordsLearned}</Text>
          </View>

          <View style={[styles.statItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.statItemLabel}>Average Score</Text>
            <Text style={styles.statItemValue}>{stats.averageScore}%</Text>
          </View>

          <View style={styles.wordsImprovementSection}>
            <Text style={styles.overallTitle}>Words to Improve</Text>
            {wordBank.length > 0 ? (
              wordBank.slice(0, 5).map((entry) => (
                <View key={entry.id} style={styles.wordEntry}>
                  <Text style={styles.wordEntryText}>{entry.word}</Text>
                  <Text style={styles.wordEntryContext}>{entry.context}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No struggled words yet. Read aloud to build your review bank.
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  )
}
