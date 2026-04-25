import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { defineWord } from './services/claude'

export default function App() {
  const [result, setResult] = useState('Testing Claude...')

  useEffect(() => {
    defineWord('prescription', 'Take this prescription to the pharmacy.')
      .then((def) => setResult(def))
      .catch((err) => setResult(`Error: ${err.message}`))
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>Adult Literacy App</Text>
      <Text style={styles.result}>{result}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  result: { fontSize: 14, color: '#374151', marginTop: 24, paddingHorizontal: 32, textAlign: 'center' },
})
