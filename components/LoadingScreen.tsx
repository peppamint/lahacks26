import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { APP_THEME } from '../constants/theme'

const DG = APP_THEME.colors.darkGreen
const BG = APP_THEME.colors.background

interface Props {
  message?: string
  fullScreen?: boolean
  size?: number
}

export function LoadingScreen({ message, fullScreen = false, size = 96 }: Props) {
  const containerStyle = fullScreen ? styles.full : styles.inline
  return (
    <View style={containerStyle}>
      <Image
        source={require('../assets/loading.gif')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  message: {
    color: DG,
    fontFamily: 'Arial',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },
})
