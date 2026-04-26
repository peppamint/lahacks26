import React from 'react'
import { View, Text, FlatList, StyleSheet, ScrollView } from 'react-native'
import { useStore } from '../../store'
import type { WordBankEntry } from '../../types'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 16,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  wordCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  word: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 8,
  },
  context: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
})

export function WordBank() {
  const wordBank = useStore((s) => s.wordBank)

  function renderItem({ item }: { item: WordBankEntry }) {
    const createdDate = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <View style={styles.wordCard}>
        <Text style={styles.word}>{item.word}</Text>
        {item.context && <Text style={styles.context}>"{item.context}"</Text>}
        <Text style={styles.timestamp}>Added: {createdDate}</Text>
      </View>
    )
  }

  if (wordBank.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Your Word Bank</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No words learned yet. Complete lessons to build your word bank!
          </Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Word Bank ({wordBank.length})</Text>
      <FlatList
        data={wordBank}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        scrollEnabled={true}
      />
    </View>
  )
}
