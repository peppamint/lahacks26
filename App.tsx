import React, { useEffect, useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ensureAuthSession } from './services/supabase'
import { useStore } from './store'
import { DiagnosticScreen } from './modules/diagnostic'

type RootStackParamList = {
  Diagnostic: undefined
  Home: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>You're all set! Lessons coming soon.</Text>
      <StatusBar style="auto" />
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
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, paddingHorizontal: 24, textAlign: 'center' },
})
