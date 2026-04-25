import React from 'react'
import { View, Text, FlatList } from 'react-native'
import { useStore } from '../../store'
import type { WordBankEntry } from '../../types'

export function WordBank() {
  const wordBank = useStore((s) => s.wordBank)

  function renderItem({ item }: { item: WordBankEntry }) {
    return (
      <View>
        <Text>{item.word}</Text>
        <Text>{item.context}</Text>
      </View>
    )
  }

  return (
    <View>
      <Text>Word Bank</Text>
      <FlatList data={wordBank} keyExtractor={(item) => item.id} renderItem={renderItem} />
    </View>
  )
}
