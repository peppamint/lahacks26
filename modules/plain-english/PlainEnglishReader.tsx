import React from 'react'
import { View, Text } from 'react-native'
import type { PlainEnglishConfig } from './types'

interface Props {
  config: PlainEnglishConfig
}

export function PlainEnglishReader({ config }: Props) {
  // TODO: fetch URL content, strip nav/ads, simplify via Claude Sonnet,
  //       render with tap-to-define (Claude Haiku), real-world document templates
  return (
    <View>
      <Text>Plain English Reader — level: {config.targetLevel}</Text>
    </View>
  )
}
