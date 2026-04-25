import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'

interface Props {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onPress, disabled = false, variant = 'primary' }: Props) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: '#4F46E5' },
  secondary: { backgroundColor: '#E5E7EB' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', color: '#fff' },
})
