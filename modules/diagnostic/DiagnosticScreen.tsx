import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { DOMAINS, DOMAIN_LABELS, type Domain } from '../../constants/domains'
import { useStore } from '../../store'
import type { UserProfile } from '../../types'
import { getOrCreateUserId, upsertProfile } from '../../services/supabase'

interface DiagnosticScreenProps {
  onBack: () => void
}

export function DiagnosticScreen({ onBack }: DiagnosticScreenProps) {
  const setProfile = useStore((state) => state.setProfile)
  const setUserId = useStore((state) => state.setUserId)
  const setReadingLevel = useStore((state) => state.setReadingLevel)
  const [goal, setGoal] = useState('')
  const [domain, setDomain] = useState<Domain | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const canSubmit = useMemo(() => goal.trim().length > 0 && domain !== null, [goal, domain])

  const handleSave = async () => {
    if (!domain || !canSubmit) return

    setSaving(true)
    setStatus(null)

    try {
      const userId = await getOrCreateUserId()
      const profile: UserProfile = {
        userId,
        goal: goal.trim(),
        domain,
        readingLevel: 'grade1',
      }

      await upsertProfile(profile)
      setUserId(profile.userId)
      setProfile(profile)
      setReadingLevel(profile.readingLevel)
      setStatus('Saved profile. Next step: build reading-level questions.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile.'
      const normalizedMessage = message.toLowerCase().includes('auth session missing')
        ? 'Save failed: no auth session. Ensure Anonymous auth is enabled in Supabase and restart Expo.'
        : `Save failed: ${message}`
      setStatus(normalizedMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Diagnostic</Text>
      <Text style={styles.description}>Tell us your goal and topic area to personalize lessons.</Text>

      <Text style={styles.label}>What is your learning goal?</Text>
      <TextInput
        value={goal}
        onChangeText={setGoal}
        placeholder="Example: Read work emails confidently"
        style={styles.input}
      />

      <Text style={styles.label}>Choose your domain</Text>
      <View style={styles.domainWrap}>
        {DOMAINS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setDomain(option)}
            style={[styles.chip, domain === option && styles.chipSelected]}
          >
            <Text style={[styles.chipText, domain === option && styles.chipTextSelected]}>
              {DOMAIN_LABELS[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.button, (!canSubmit || saving) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!canSubmit || saving}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save and Continue'}</Text>
      </Pressable>

      {status ? <Text style={styles.statusText}>{status}</Text> : null}

      <Pressable style={styles.button} onPress={onBack}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  domainWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  chipText: {
    color: '#374151',
  },
  chipTextSelected: {
    color: '#3730A3',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusText: {
    marginTop: 12,
    marginBottom: 8,
    color: '#374151',
    lineHeight: 20,
  },
})
