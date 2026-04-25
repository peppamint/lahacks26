import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LEVEL_LABELS, READING_LEVELS, type ReadingLevel } from '../../constants/readingLevels'
import { SKILL_CATEGORY_LABELS, type SkillCategory } from '../../constants/skills'
import { useStore } from '../../store'

const SKILL_ORDER: SkillCategory[] = [
  'activeSelfRegulation',
  'bridgingProcesses',
  'languageComprehension',
  'wordRecognition',
]

function levelProgressPercent(level: ReadingLevel): number {
  const index = READING_LEVELS.indexOf(level)
  if (index < 0) return 0
  return Math.round((index / (READING_LEVELS.length - 1)) * 100)
}

export function ProgressDashboard() {
  const stats = useStore((s) => s.stats)
  const skillLevels = useStore((s) => s.skillLevels)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress Dashboard</Text>
      {stats ? (
        <Text style={styles.summary}>Lessons completed: {stats.lessonsCompleted}</Text>
      ) : (
        <Text style={styles.summary}>Complete a lesson to populate summary stats.</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skill Breakdown</Text>
        {SKILL_ORDER.map((category) => {
          const level = skillLevels[category]
          const percent = levelProgressPercent(level)
          return (
            <View key={category} style={styles.skillCard}>
              <View style={styles.skillHeader}>
                <Text style={styles.skillName}>{SKILL_CATEGORY_LABELS[category]}</Text>
                <Text style={styles.levelLabel}>{LEVEL_LABELS[level]}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4F46E5',
  },
  summary: {
    color: '#374151',
    lineHeight: 20,
  },
  section: {
    marginTop: 6,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  skillCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    gap: 8,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  skillName: {
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  levelLabel: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'right',
  },
  track: {
    backgroundColor: '#E5E7EB',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#4F46E5',
    height: '100%',
    borderRadius: 999,
  },
})
