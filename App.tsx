import React from 'react'
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
})
