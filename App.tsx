import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { signInAnonymously, getCurrentUser, supabase } from './services/supabase'
import { useStore } from './store'
import { DiagnosticScreen } from './modules/diagnostic/DiagnosticScreen'

const Stack = createNativeStackNavigator()

function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GetLit</Text>
      <Text style={styles.subtitle}>You're all set! Lessons coming soon.</Text>
      <StatusBar style="auto" />
    </View>
  )
}

export default function App() {
  const setUserId = useStore((s) => s.setUserId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function initAuth() {
      // DEV: always start fresh so the diagnostic reruns on every launch
      await supabase.auth.signOut()
      const user = await signInAnonymously()
      if (user) setUserId(user.id)
      setReady(true)
    }
    initAuth()
  }, [])

  if (!ready) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>GetLit</Text>
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Diagnostic" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Diagnostic">
          {({ navigation }: any) => (
            <DiagnosticScreen onComplete={() => navigation.replace('Home')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
})
