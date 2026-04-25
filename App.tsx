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

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { MicroLesson } from './modules/micro-lessons/MicroLesson'

export default function App() {
  return (
    <View style={styles.container}>
      <MicroLesson
        userId="test-user"
        config={{
          lessonId: '001',
          documentText: `Explorers sent a robot two miles under the ocean's surface near Alaska to look for odd creatures, and unexpectedly struck gold. To be more specific, they found a golden blob, smooth and shiny with a perplexing hole in it, stuck to a rock on the seafloor. Was it coral? A sea sponge? An alien? No, the explorers concluded. After more than two years of investigation, the U.S. National Oceanic and Atmospheric Administration said this week that researchers had identified it as a part of a deep-sea anemone. The "golden orb," as many newspapers and science magazines called it after it was found in 2023, perplexed researchers and enthusiasts of the deep sea around the world.`,
          readingLevel: 'grade8',
          domain: 'general',
        }}
      />
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
})