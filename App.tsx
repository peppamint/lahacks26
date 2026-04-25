import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { DiagnosticScreen } from './modules/diagnostic'
import { ensureAuthSession } from './services/supabase'
import { useStore } from './store'

export default function App() {
  // Simple local screen state until full navigation is added.
  const [screen, setScreen] = useState<'home' | 'diagnostic'>('home')
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [authMessage, setAuthMessage] = useState('')
  const setUserId = useStore((state) => state.setUserId)

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const { userId } = await ensureAuthSession()
        setUserId(userId)
        setAuthStatus('ready')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize auth session.'
        setAuthStatus('error')
        setAuthMessage(message)
      }
    }

    void bootstrapAuth()
  }, [setUserId])

  if (screen === 'diagnostic') {
    return (
      <>
        <DiagnosticScreen onBack={() => setScreen('home')} />
        <StatusBar style="auto" />
      </>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>Adult Literacy App</Text>
      <Text style={styles.authStatus}>
        {authStatus === 'loading' && 'Connecting to Supabase...'}
        {authStatus === 'ready' && 'Supabase session ready'}
        {authStatus === 'error' && `Auth error: ${authMessage}`}
      </Text>
      <Pressable style={styles.button} onPress={() => setScreen('diagnostic')}>
        <Text style={styles.buttonText}>Start Diagnostic</Text>
      </Pressable>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  authStatus: {
    marginTop: 12,
    color: '#374151',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
