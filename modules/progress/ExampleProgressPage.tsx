/**
 * Example Progress Page
 * 
 * This page demonstrates how to use the progress module to display
 * a user's learning statistics, daily progress, and word bank.
 * 
 * Usage:
 * Import this component and add it to your app's navigation stack.
 * The page automatically fetches and displays:
 * - Today's new words learned
 * - Today's lessons completed
 * - Overall statistics (total lessons, words, average score, reading level)
 * - Word bank with all stumbled/learned words
 */

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { ProgressDashboard, WordBank, useProgress } from './index'
import { useStore } from '../../store'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
})

type TabType = 'dashboard' | 'wordbank'

/**
 * Example Progress Page Component
 * 
 * Shows how to integrate the progress dashboard and word bank
 * in a tabbed interface with real data from the backend.
 */
export function ExampleProgressPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const { stats, wordBank } = useProgress()
  const profile = useStore((s: any) => s.profile)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Welcome, {profile?.goal ? profile.goal.split(' ')[0] : 'Learner'}!
        </Text>
        <Text style={styles.headerSubtext}>Keep learning and growing your skills</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>
            📊 Progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'wordbank' && styles.activeTab]}
          onPress={() => setActiveTab('wordbank')}
        >
          <Text style={[styles.tabText, activeTab === 'wordbank' && styles.activeTabText]}>
            📚 Words ({wordBank.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'dashboard' ? <ProgressDashboard /> : <WordBank />}
      </View>
    </View>
  )
}

/**
 * Example demonstrating direct usage of progress functions:
 * 
 * import {
 *   fetchProgressStats,
 *   fetchTodayProgress,
 *   fetchWordBank,
 *   fetchReadingLevelTrend,
 * } from '../modules/progress'
 * 
 * // In a component:
 * const [todayStats, setTodayStats] = useState(null)
 * 
 * useEffect(() => {
 *   async function loadData() {
 *     // Example: Get today's progress for user Bob
 *     const today = await fetchTodayProgress('bob-user-id')
 *     // Expected output:
 *     // {
 *     //   wordsLearnedToday: 5,
 *     //   grammarStructuresLearned: 2
 *     // }
 *     setTodayStats(today)
 *   }
 *   loadData()
 * }, [])
 * 
 * return (
 *   <View>
 *     <Text>Words learned today: {todayStats?.wordsLearnedToday}</Text>
 *     <Text>Grammar structures: {todayStats?.grammarStructuresLearned}</Text>
 *   </View>
 * )
 */
