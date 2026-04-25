import React from 'react'
import { View, Text } from 'react-native'
import type { MacroLessonConfig } from '../../types'

interface Props {
  config: MacroLessonConfig
}

export function MacroLesson({ config }: Props) {
  // TODO: chapter-by-chapter reading, ElevenLabs TTS, Claude Sonnet comprehension Qs,
  //       chapter completion tracking, emit lesson:completed event
  return (
    <View>
      <Text>Macro Lesson: {config.title}</Text>
    </View>
  )
}
