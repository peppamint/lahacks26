import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

interface Props {
  title?: string
  content: string
  fontSize?: number
}

export function ReadingCard({ title, content, fontSize = 18 }: Props) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.title}>{title}</Text>}
      <ScrollView>
        <Text style={[styles.content, { fontSize }]}>{content}</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  content: { lineHeight: 28, color: '#374151' },
})
