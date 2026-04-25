import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface Props {
  audioBuffer?: ArrayBuffer
  label?: string
}

export function AudioPlayer({ label }: Props) {
  // TODO: wire up expo-av playback from audioBuffer
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.icon}>▶</Text>
      </TouchableOpacity>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  icon: { color: '#fff', fontSize: 16 },
  label: { fontSize: 14, color: '#374151' },
})
