import React from 'react'
import { View, Text } from 'react-native'
import type { MicroLessonConfig } from '../../types'

interface Props {
  config: MicroLessonConfig
}

export function MicroLesson({ config }: Props) {
  // TODO: simplify document via Claude Haiku, voice-input answers via Whisper,
  //       stumble detection, emit lesson:completed event
  return (
    <View>
      <Text>Micro Lesson: {config.lessonId}</Text>
    </View>
  )
}
