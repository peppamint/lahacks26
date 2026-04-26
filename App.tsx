/*import React from 'react'
import { View, Text, StyleSheet, Button } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useTextToSpeech } from './modules/speech/hooks/useTextToSpeech'

export default function App() {
  const { speak, isSpeaking } = useTextToSpeech()
  const [status, setStatus] = React.useState('Tap Test Online TTS.')
  const sampleText = 'Hello Chloe, this is a text to speech test.'

  async function handleOnlinePress() {
    try {
      await speak(sampleText)
      setStatus('Online TTS request succeeded.')
    } catch (error) {
      setStatus(`Online TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>Adult Literacy App</Text>
      <View style={styles.buttonGroup}>
        <Button
          title={isSpeaking ? 'Working...' : 'Test Online TTS'}
          onPress={() => void handleOnlinePress()}
          disabled={isSpeaking}
        />
      </View>
      <Text style={styles.status}>{status}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  buttonGroup: { marginTop: 20, width: '80%' },
  status: { marginTop: 16, paddingHorizontal: 24, color: '#374151', textAlign: 'center' },
})*/

/*import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>Adult Literacy App</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
})*/

import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Button } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { ProgressDashboard } from './modules/progress/ProgressDashboard'
import { MicroLesson } from './modules/micro-lessons/MicroLesson'
import { useStore } from './store'

export default function App() {
  const [showLesson, setShowLesson] = useState(false)
  const setUserId = useStore((state) => state.setUserId)

  useEffect(() => {
    setUserId('550e8400-e29b-41d4-a716-446655440000') // Valid UUID for test user
  }, [setUserId])

  const lessonConfig = {
    lessonId: '001',
    documentText: `Explorers sent a robot two miles under the ocean's surface near Alaska to look for odd creatures, and unexpectedly struck gold. To be more specific, they found a golden blob, smooth and shiny with a perplexing hole in it, stuck to a rock on the seafloor. Was it coral? A sea sponge? An alien? No, the explorers concluded. After more than two years of investigation, the U.S. National Oceanic and Atmospheric Administration said this week that researchers had identified it as a part of a deep-sea anemone. The "golden orb," as many newspapers and science magazines called it after it was found in 2023, perplexed researchers and enthusiasts of the deep sea around the world.`,
    readingLevel: 'grade8' as const,
    domain: 'general' as const,
  }

  return (
    <View style={styles.container}>
      {showLesson ? (
        <MicroLesson userId="550e8400-e29b-41d4-a716-446655440000" config={lessonConfig} />
      ) : (
        <View style={styles.dashboardWrapper}>
          <ProgressDashboard />
          <View style={styles.buttonWrapper}>
            <Button title="Start Lesson" onPress={() => setShowLesson(true)} />
          </View>
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  dashboardWrapper: { flex: 1 },
  buttonWrapper: { padding: 16, backgroundColor: '#fff' },
})