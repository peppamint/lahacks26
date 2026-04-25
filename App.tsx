import React, { useEffect, useState } from 'react'
import { Pressable, Text, StyleSheet, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ensureAuthSession, saveProgressEvent } from './services/supabase'
import { useStore } from './store'
import { DiagnosticScreen } from './modules/diagnostic'
import { ProgressDashboard } from './modules/progress/ProgressDashboard'
import { MicroLesson, buildMicroLessonPlan, type MicroLessonResult } from './modules/micro-lessons'
import { LEVEL_LABELS } from './constants/readingLevels'
import { SKILL_CATEGORY_LABELS, type SkillCategory } from './constants/skills'

type RootStackParamList = {
  Diagnostic: undefined
  Home: undefined
  LessonPlan: undefined
  Progress: undefined
  MicroLesson: { targetCategory: SkillCategory }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>Welcome back! Pick what you want to work on today.</Text>

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('LessonPlan')}>
        <Text style={styles.primaryButtonText}>Open Lesson Plan</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Progress')}>
        <Text style={styles.secondaryButtonText}>View Progress</Text>
      </Pressable>

      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

function LessonPlanScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'LessonPlan'>) {
  const readingLevel = useStore((s) => s.readingLevel)
  const profile = useStore((s) => s.profile)
  const skillLevels = useStore((s) => s.skillLevels)
  const lessonCategories: SkillCategory[] = [
    'activeSelfRegulation',
    'bridgingProcesses',
    'languageComprehension',
    'wordRecognition',
  ]

  return (
    <SafeAreaView style={styles.screenContainer} edges={['top', 'bottom']}>
      <Text style={styles.screenTitle}>Lesson Plan</Text>
      <Text style={styles.screenText}>
        Focus on a personalized micro-lesson sequence tuned to your diagnostic level.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today&apos;s Focus</Text>
        <Text style={styles.cardText}>- Target difficulty: {LEVEL_LABELS[readingLevel]}</Text>
        <Text style={styles.cardText}>- 3 short reading questions</Text>
        <Text style={styles.cardText}>- Final 2-question quiz</Text>
        <Text style={styles.cardText}>- Goal context: {profile?.goal ?? 'General practice'}</Text>
      </View>

      <Text style={styles.cardTitle}>Pick a target skill category</Text>
      {lessonCategories.map((category) => (
        <Pressable
          key={category}
          style={styles.primaryButton}
          onPress={() => navigation.navigate('MicroLesson', { targetCategory: category })}
        >
          <Text style={styles.primaryButtonText}>
            {SKILL_CATEGORY_LABELS[category]} ({skillLevels[category]})
          </Text>
        </Pressable>
      ))}

      <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function ProgressScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Progress'>) {
  return (
    <SafeAreaView style={styles.screenContainer} edges={['top', 'bottom']}>
      <Text style={styles.screenTitle}>Your Progress</Text>
      <View style={styles.card}>
        <ProgressDashboard />
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function MicroLessonScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MicroLesson'>) {
  const targetCategory = route.params.targetCategory
  const userId = useStore((s) => s.userId)
  const profile = useStore((s) => s.profile)
  const skillLevels = useStore((s) => s.skillLevels)
  const setSkillLevels = useStore((s) => s.setSkillLevels)

  const lessonPlan = buildMicroLessonPlan({
    lessonId: `micro-${Date.now()}`,
    domain: profile?.domain ?? 'general',
    targetCategory,
    skillLevels,
  })

  const handleComplete = async (result: MicroLessonResult) => {
    setSkillLevels({
      ...skillLevels,
      [result.targetCategory]: result.recommendedNextLevel,
    })
    if (userId) {
      try {
        await saveProgressEvent(
          userId,
          result.lessonId,
          'micro',
          result.scorePercent,
          result.recommendedNextLevel,
        )
      } catch (error) {
        console.error('[MicroLesson] Failed to save progress event:', error)
      }
    }
  }

  return (
    <SafeAreaView style={styles.screenContainer} edges={['top', 'bottom']}>
      <MicroLesson lesson={lessonPlan} onComplete={handleComplete} onBack={() => navigation.replace('LessonPlan')} />
    </SafeAreaView>
  )
}

export default function App() {
  const setUserId = useStore((s) => s.setUserId)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function initAuth() {
      try {
        const { userId } = await ensureAuthSession()
        setUserId(userId)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize auth session.'
        setAuthError(message)
      } finally {
        setReady(true)
      }
    }

    void initAuth()
  }, [setUserId])

  return (
    <SafeAreaProvider>
      {!ready ? (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <Text style={styles.title}>GetLit</Text>
          <Text style={styles.subtitle}>Connecting to Supabase...</Text>
        </SafeAreaView>
      ) : authError ? (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <Text style={styles.title}>GetLit</Text>
          <Text style={styles.subtitle}>{authError}</Text>
        </SafeAreaView>
      ) : (
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Diagnostic" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Diagnostic">
              {({ navigation }: NativeStackScreenProps<RootStackParamList, 'Diagnostic'>) => (
                <DiagnosticScreen onComplete={() => navigation.replace('Home')} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="LessonPlan" component={LessonPlanScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen name="MicroLesson" component={MicroLessonScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, paddingHorizontal: 24, textAlign: 'center' },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3730A3',
    fontSize: 16,
    fontWeight: '700',
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 10,
  },
  screenText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 4,
  },
})
