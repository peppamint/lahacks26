import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { fetchNewsArticles } from '../services/guardian'
import { rewriteArticleAtLevel, defineWord } from '../services/claude'
import { synthesizeSpeech } from '../services/elevenlabs'
import { getProfile } from '../services/supabase'
import { useStore } from '../store'
import type { NewsArticle } from '../services/claude'
import type { ReadingLevel as GlobalReadingLevel } from '../constants/readingLevels'

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const DG      = '#003310'
const LG      = '#C7EF4E'
const BG      = '#F2EFE6'
const MUTED   = '#B0ACA4'
const CARD_BG = '#FFFFFF'

const SCREEN_W = Dimensions.get('window').width
const SCREEN_H = Dimensions.get('window').height
const CARD_W   = (SCREEN_W - 18 * 2 - 10) / 2

type ArticleLevel = 'simplest' | 'simpler' | 'standard' | 'original' | 'myLevel'

const ARTICLE_LABELS: Record<ArticleLevel, string> = {
  simplest: 'Simplest',
  simpler:  'Simpler',
  standard: 'Standard',
  original: 'Original',
  myLevel:  'My Level',
}

// Maps selectable complexity options to the ReadingLevel used for rewriting
const ARTICLE_TO_READING: Record<'simplest' | 'simpler' | 'standard', GlobalReadingLevel> = {
  simplest: 'grade1',
  simpler:  'grade5',
  standard: 'grade8',
}

const SLIDER_LEVELS = ['simplest', 'simpler', 'standard', 'original'] as const
type SliderLevel = typeof SLIDER_LEVELS[number]
const SNAP_FRACS  = [0, 1 / 3, 2 / 3, 1]
const THUMB_SIZE  = 26

// ─── GEAR ICON ────────────────────────────────────────────────────────────────
function GearIcon({ size = 22, color = DG }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

// ─── MEGAPHONE ICON ───────────────────────────────────────────────────────────
function MegaphoneIcon({ size = 20, color = DG }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5L6 9H2v6h4l5 4V5z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  )
}

// ─── STOP ICON ────────────────────────────────────────────────────────────────
function StopIcon({ size = 20, color = DG }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} />
    </Svg>
  )
}

// ─── FADE-IN WORDS ───────────────────────────────────────────────────────────
interface FadeInWordsProps {
  text: string
  style?: object
}

function FadeInWords({ text, style }: FadeInWordsProps) {
  const words = useMemo(() => text.split(' '), [text])
  const animsRef = useRef<Animated.Value[]>([])

  // Rebuild anim array whenever word count changes
  if (animsRef.current.length !== words.length) {
    animsRef.current = words.map(() => new Animated.Value(0))
  }

  useEffect(() => {
    animsRef.current.forEach((a) => a.setValue(0))
    Animated.stagger(
      150,
      animsRef.current.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    ).start()
  }, [text])

  return (
    <Text style={style}>
      {words.map((word, i) => (
        <Animated.Text key={i} style={{ opacity: animsRef.current[i] }}>
          {word}{i < words.length - 1 ? ' ' : ''}
        </Animated.Text>
      ))}
    </Text>
  )
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#C7EF4E', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#A78BFA', '#F472B6', '#FB923C']
const PARTICLE_COUNT  = 42

interface Particle {
  id: number
  x: Animated.Value
  y: Animated.Value
  opacity: Animated.Value
  rotate: Animated.Value
  color: string
  size: number
  isCircle: boolean
  targetX: number
  peakY: number
  fallY: number
  spinDeg: string
  durationOut: number
  durationFall: number
}

function makeParticle(i: number): Particle {
  // Fan particles in a 130° upward arc centred at straight-up (270°)
  const angleDeg = 205 + (i / PARTICLE_COUNT) * 130 + (Math.random() - 0.5) * 20
  const angleRad = (angleDeg * Math.PI) / 180
  const dist     = 90 + Math.random() * 190
  const peakX    = Math.cos(angleRad) * dist
  const peakY    = Math.sin(angleRad) * dist   // negative = upward
  return {
    id:          i,
    x:           new Animated.Value(0),
    y:           new Animated.Value(0),
    opacity:     new Animated.Value(1),
    rotate:      new Animated.Value(0),
    color:       CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size:        5 + Math.random() * 8,
    isCircle:    Math.random() > 0.5,
    targetX:     peakX,
    peakY,
    fallY:       peakY + 360 + Math.random() * 260,
    spinDeg:     `${270 + Math.floor(Math.random() * 5) * 90}deg`,
    durationOut: 330 + Math.random() * 90,
    durationFall:700 + Math.random() * 200,
  }
}

function ConfettiBurst({ originY }: { originY: number }) {
  const particles = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => makeParticle(i)),
  ).current

  useEffect(() => {
    Animated.stagger(
      14,
      particles.map((p) =>
        Animated.parallel([
          Animated.timing(p.x, {
            toValue: p.targetX,
            duration: p.durationOut + p.durationFall,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.y, {
              toValue: p.peakY,
              duration: p.durationOut,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(p.y, {
              toValue: p.fallY,
              duration: p.durationFall,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(p.durationOut + 160),
            Animated.timing(p.opacity, { toValue: 0, duration: 480, useNativeDriver: true }),
          ]),
          Animated.timing(p.rotate, {
            toValue: 1,
            duration: p.durationOut + p.durationFall,
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start()
  }, [])

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents="none">
      {particles.map((p) => {
        const spin = p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spinDeg] })
        return (
          <Animated.View
            key={p.id}
            style={{
              position: 'absolute',
              left: SCREEN_W / 2 - p.size / 2,
              top: originY,
              width: p.size,
              height: p.isCircle ? p.size : p.size * 0.55,
              borderRadius: p.isCircle ? p.size / 2 : 1,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: spin }],
            }}
          />
        )
      })}
    </View>
  )
}

// ─── ANIMATED CARD ────────────────────────────────────────────────────────────
interface AnimatedCardProps {
  article: NewsArticle
  index: number
  finished: boolean
  onPress: () => void
}

function AnimatedCard({ article, index, finished, onPress }: AnimatedCardProps) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: index * 70,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start()
  }, [])

  const opacity     = anim
  const translateY  = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] })

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        style={({ pressed }) => [s.card, finished && s.cardFinished, pressed && { opacity: 0.82 }]}
        onPress={onPress}
      >
        <Text style={s.cardTitle} numberOfLines={5}>{article.title}</Text>
        {finished && <Text style={s.cardFinishedBadge}>Finished</Text>}
      </Pressable>
    </Animated.View>
  )
}

// ─── COMPLEXITY SLIDER ───────────────────────────────────────────────────────
interface ComplexitySliderProps {
  value: ArticleLevel
  onChange: (level: ArticleLevel) => void
}

function ComplexitySlider({ value, onChange }: ComplexitySliderProps) {
  const [trackWidth, setTrackWidth] = useState(0)
  const trackWidthRef               = useRef(0)
  const thumbX                      = useRef(new Animated.Value(0)).current
  const startX                      = useRef(0)

  const snapIdx = value === 'myLevel'
    ? SLIDER_LEVELS.indexOf('standard')
    : Math.max(0, SLIDER_LEVELS.indexOf(value as SliderLevel))

  useEffect(() => {
    if (trackWidth === 0) return
    const x = SNAP_FRACS[snapIdx] * trackWidth
    startX.current = x
    Animated.spring(thumbX, {
      toValue: x, useNativeDriver: false, tension: 80, friction: 10,
    }).start()
  }, [snapIdx, trackWidth])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      thumbX.stopAnimation((v) => { startX.current = v })
    },
    onPanResponderMove: (_, gs) => {
      thumbX.setValue(Math.max(0, Math.min(trackWidthRef.current, startX.current + gs.dx)))
    },
    onPanResponderRelease: (_, gs) => {
      const w = trackWidthRef.current
      if (w === 0) return
      const finalX   = Math.max(0, Math.min(w, startX.current + gs.dx))
      const frac     = finalX / w
      const nearest  = SNAP_FRACS.reduce(
        (best, f, i) => Math.abs(f - frac) < Math.abs(SNAP_FRACS[best] - frac) ? i : best, 0,
      )
      const snapX = SNAP_FRACS[nearest] * w
      startX.current = snapX
      Animated.spring(thumbX, {
        toValue: snapX, useNativeDriver: false, tension: 80, friction: 10,
      }).start()
      onChange(SLIDER_LEVELS[nearest])
    },
  })).current

  return (
    <View style={s.sliderOuter}>
      <View style={s.sliderLabelRow}>
        <Text style={s.sliderLabel}>Less Complex</Text>
        <Text style={s.sliderLabel}>More Complex</Text>
      </View>
      <View
        style={s.sliderTrackArea}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w === trackWidthRef.current) return
          trackWidthRef.current = w
          setTrackWidth(w)
          const x = SNAP_FRACS[snapIdx] * w
          startX.current = x
          thumbX.setValue(x)
        }}
      >
        {/* Track background */}
        <View style={s.sliderTrackBg} />
        {/* Filled portion */}
        <Animated.View style={[s.sliderTrackFill, { width: thumbX }]} />
        {/* Thumb */}
        <Animated.View
          style={[
            s.sliderThumb,
            value === 'myLevel' && { opacity: 0.45 },
            { transform: [{ translateX: thumbX }] },
          ]}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  )
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
interface SettingsPanelProps {
  visible: boolean
  level: ArticleLevel
  onClose: () => void
  onSelect: (level: ArticleLevel) => void
}

function SettingsPanel({ visible, level, onClose, onSelect }: SettingsPanelProps) {
  const slideY = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
    } else {
      slideY.setValue(300)
    }
  }, [visible])

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View style={[s.panel, { transform: [{ translateY: slideY }] }]}>
          <Pressable>
            <View style={s.handle} />
            <Text style={s.panelLabel}>ARTICLE COMPLEXITY</Text>
            <ComplexitySlider value={level} onChange={onSelect} />
            <Pressable
              style={[s.myLevelBtn, level === 'myLevel' && s.myLevelBtnActive]}
              onPress={() => onSelect('myLevel')}
            >
              <Text style={[s.myLevelBtnText, level === 'myLevel' && s.myLevelBtnTextActive]}>
                Match My Reading Level
              </Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

// ─── ANIMATED DOTS HOOK ───────────────────────────────────────────────────────
function useAnimatedDots() {
  const [count, setCount] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c % 3) + 1), 450)
    return () => clearInterval(id)
  }, [])
  return '.'.repeat(count)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

function stripWordPunctuation(token: string): string {
  return token.replace(/^[^a-zA-Z'-]+|[^a-zA-Z'-]+$/g, '')
}

function getSentenceContext(text: string, word: string): string {
  const lower = word.toLowerCase()
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.split(/(?<=[.!?])\s+/)
  const match = sentences.find((s) => s.toLowerCase().includes(lower))
  return match ?? text.slice(0, 200)
}

// ─── CHIME GENERATOR ─────────────────────────────────────────────────────────
// Synthesises a short two-note ascending bell chime (E5 → G5) as a WAV file
// at runtime — no bundled assets or API calls needed.
async function generateChimeUri(): Promise<string> {
  const rate      = 22050
  const dur       = 0.5
  const n         = Math.floor(rate * dur)
  const dataBytes = n * 2
  const buf       = new ArrayBuffer(44 + dataBytes)
  const view      = new DataView(buf)

  // WAV header
  const ws = (o: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)) }
  ws(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true)
  ws(8, 'WAVE'); ws(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true);  view.setUint16(34, 16, true)
  ws(36, 'data'); view.setUint32(40, dataBytes, true)

  // Two sine tones with exponential decay — E5 (659 Hz) then G5 (784 Hz)
  const tones = [
    { f: 659.25, t0: 0,    d: 8 },
    { f: 783.99, t0: 0.10, d: 8 },
  ]
  for (let i = 0; i < n; i++) {
    const t = i / rate
    let v = 0
    for (const { f, t0, d } of tones) {
      if (t >= t0) v += Math.sin(2 * Math.PI * f * (t - t0)) * Math.exp(-d * (t - t0))
    }
    view.setInt16(44 + i * 2, Math.round((v / 2) * 32767 * 0.7), true)
  }

  // Base64-encode and write to cache
  const bytes = new Uint8Array(buf)
  let b64 = ''
  for (let i = 0; i < bytes.byteLength; i++) b64 += String.fromCharCode(bytes[i])
  const uri = (FileSystem.cacheDirectory ?? '') + 'finish_chime.wav'
  await FileSystem.writeAsStringAsync(uri, btoa(b64), { encoding: 'base64' })
  return uri
}

// ─── ARTICLE CACHE ───────────────────────────────────────────────────────────
// Survives tab switches (component unmount/remount); cleared on force-refresh.
const STALE_MS = 20 * 60 * 1000   // 20 minutes
let _cachedArticles: NewsArticle[] = []
let _lastFetchTime  = 0

// ─── MAIN ─────────────────────────────────────────────────────────────────────
interface NewsScreenProps {
  onArticleOpen?: (open: boolean) => void
}

export default function NewsScreen({ onArticleOpen }: NewsScreenProps) {
  const [articles, setArticles]               = useState<NewsArticle[]>([])
  const [displayContents, setDisplayContents] = useState<string[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex]     = useState<number | null>(null)
  const [readingLevel, setReadingLevel]       = useState<ArticleLevel>('original')
  const [showSettings, setShowSettings]       = useState(false)
  const [rewriting, setRewriting]             = useState(false)
  const [refreshing, setRefreshing]           = useState(false)
  const [finishedArticles, setFinishedArticles] = useState<Set<number>>(new Set())
  const [confettiKey, setConfettiKey]           = useState(0)
  const [confettiOriginY, setConfettiOriginY]   = useState(SCREEN_H * 0.8)

  const finishBtnScale = useRef(new Animated.Value(1)).current
  const finishBtnRef   = useRef<View>(null)

  // Word lookup state
  const [definitionWord, setDefinitionWord]     = useState<string | null>(null)
  const [definitionText, setDefinitionText]     = useState<string | null>(null)
  const [definitionLoading, setDefinitionLoading] = useState(false)
  const [definitionError, setDefinitionError]   = useState<string | null>(null)
  const [speakingTarget, setSpeakingTarget]     = useState<'word' | 'definition' | null>(null)

  const storeUserId       = useStore((s) => s.userId)
  const storeReadingLevel = useStore((s) => s.readingLevel)

  const dots = useAnimatedDots()

  const soundRef        = useRef<Audio.Sound | null>(null)
  const speakCancelRef  = useRef(false)
  const chimeSoundUri   = useRef<string | null>(null)

  // Article slide animation — starts off-screen to the right
  const slideX = useRef(new Animated.Value(SCREEN_W)).current

  useEffect(() => {
    if (_cachedArticles.length > 0) {
      setArticles(_cachedArticles)
      setDisplayContents(_cachedArticles.map((a) => a.content))
      setLoading(false)
    } else {
      loadNews()
    }
  }, [])

  // Re-fetch when returning from background after the cache goes stale
  useEffect(() => {
    const appStateRef = { current: AppState.currentState }
    const bgAtRef     = { current: 0 }

    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) {
        bgAtRef.current = Date.now()
      }
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        const away = Date.now() - bgAtRef.current
        if (away > STALE_MS) loadNews(true)
      }
      appStateRef.current = next
    })
    return () => sub.remove()
  }, [])

  // Configure audio session, pre-generate chime, and clean up on unmount
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch((e) => console.warn('[NewsScreen] setAudioMode failed:', e))

    generateChimeUri()
      .then((uri) => { chimeSoundUri.current = uri })
      .catch(() => {})

    return () => {
      speakCancelRef.current = true
      soundRef.current?.unloadAsync().catch(() => {})
    }
  }, [])

  async function loadNews(force = false) {
    const now = Date.now()
    if (!force && _cachedArticles.length > 0 && now - _lastFetchTime < STALE_MS) {
      setArticles(_cachedArticles)
      setDisplayContents(_cachedArticles.map((a) => a.content))
      setLoading(false)
      return
    }

    // First load shows full-screen spinner; subsequent refreshes use pull-to-refresh indicator
    if (_cachedArticles.length === 0) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const fetched = await fetchNewsArticles()
      _cachedArticles = fetched
      _lastFetchTime  = Date.now()
      setArticles(fetched)
      setDisplayContents(fetched.map((a) => a.content))
    } catch (e) {
      console.error('[NewsScreen] fetchNewsArticles failed:', e)
      if (_cachedArticles.length === 0) {
        setError(`Could not load news — ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function openArticle(index: number) {
    setSelectedIndex(index)
    onArticleOpen?.(true)
    slideX.setValue(SCREEN_W)
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start()
    if (readingLevel !== 'original') {
      rewriteForLevel(index, readingLevel)
    }
  }

  function closeArticle() {
    dismissDefinition()
    setConfettiKey(0)
    Animated.timing(slideX, {
      toValue: SCREEN_W,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSelectedIndex(null)
      onArticleOpen?.(false)
    })
  }

  async function rewriteForLevel(index: number, level: ArticleLevel) {
    if (level === 'original') {
      setDisplayContents((prev) => {
        const next = [...prev]
        next[index] = articles[index].content
        return next
      })
      return
    }
    setRewriting(true)
    try {
      let targetLevel: GlobalReadingLevel
      if (level === 'myLevel') {
        // Prefer fresh DB value; fall back to what the store already has
        const profile = storeUserId ? await getProfile(storeUserId).catch(() => null) : null
        targetLevel = profile?.readingLevel ?? storeReadingLevel
      } else {
        targetLevel = ARTICLE_TO_READING[level]
      }
      const rewritten = await rewriteArticleAtLevel(articles[index].content, targetLevel)
      setDisplayContents((prev) => {
        const next = [...prev]
        next[index] = rewritten
        return next
      })
    } catch {
      // keep existing content on failure
    } finally {
      setRewriting(false)
    }
  }

  async function handleLevelChange(level: ArticleLevel) {
    setReadingLevel(level)
    setShowSettings(false)
    if (selectedIndex !== null) {
      await rewriteForLevel(selectedIndex, level)
    }
  }

  function toggleFinished(index: number) {
    setFinishedArticles((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function playChime() {
    const uri = chimeSoundUri.current
    if (!uri) return
    try {
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true })
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync().catch(() => {})
      })
    } catch (e) {
      console.warn('[NewsScreen] playChime failed:', e)
    }
  }

  function handleFinishPress(index: number) {
    const wasFinished = finishedArticles.has(index)
    toggleFinished(index)
    if (!wasFinished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      playChime()
      finishBtnRef.current?.measure((_x, _y, _w, h, _px, pageY) => {
        setConfettiOriginY(pageY + h / 2)
        setConfettiKey((k) => k + 1)
      })
      Animated.sequence([
        Animated.spring(finishBtnScale, {
          toValue: 1.12, useNativeDriver: true, tension: 280, friction: 4,
        }),
        Animated.spring(finishBtnScale, {
          toValue: 1, useNativeDriver: true, tension: 140, friction: 8,
        }),
      ]).start()
    }
  }

  // ── Word lookup ───────────────────────────────────────────────────────────
  async function handleWordLongPress(token: string, fullText: string) {
    const word = stripWordPunctuation(token)
    if (!word) return
    const context = getSentenceContext(fullText, word)

    setDefinitionWord(word)
    setDefinitionText(null)
    setDefinitionError(null)
    setDefinitionLoading(true)

    try {
      const raw = await defineWord(word, context)
      setDefinitionText(stripMarkdown(raw))
    } catch {
      setDefinitionError('Could not load definition. Please try again.')
    } finally {
      setDefinitionLoading(false)
    }
  }

  function dismissDefinition() {
    stopSpeaking()
    setDefinitionWord(null)
    setDefinitionText(null)
    setDefinitionError(null)
  }

  async function speakText(text: string, target: 'word' | 'definition') {
    // Cancel any in-flight synthesis and stop existing playback
    speakCancelRef.current = true
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {})
      await soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    speakCancelRef.current = false
    setSpeakingTarget(target)

    try {
      const uri = await synthesizeSpeech(text, false)
      if (speakCancelRef.current) return
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setSpeakingTarget(null)
            soundRef.current = null
          }
        },
      )
      if (speakCancelRef.current) {
        sound.unloadAsync().catch(() => {})
        return
      }
      soundRef.current = sound
      await sound.playAsync()
    } catch (e) {
      console.error('[NewsScreen] speakText failed:', e)
      setSpeakingTarget(null)
    }
  }

  function stopSpeaking() {
    speakCancelRef.current = true
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {})
      soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    setSpeakingTarget(null)
  }

  // ── Article body with tappable words ─────────────────────────────────────
  function renderInteractiveBody(text: string) {
    const tokens = text.split(/(\s+)/)
    return tokens.map((token, i) => {
      if (/^\s+$/.test(token)) {
        return <Text key={i}>{token}</Text>
      }
      return (
        <Text
          key={i}
          suppressHighlighting
          onLongPress={() => handleWordLongPress(token, text)}
        >
          {token}
        </Text>
      )
    })
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centerFill}>
        <Image source={require('../assets/loading.gif')} style={s.loadingGif} />
        <Text style={s.loadingText}>Finding today's stories{dots}</Text>
      </View>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={s.centerFill}>
        <Text style={s.errorEmoji}>📡</Text>
        <Text style={s.errorText}>{error}</Text>
        <Pressable style={s.retryBtn} onPress={() => { loadNews() }}>
          <Text style={s.retryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    )
  }

  const article = selectedIndex !== null ? articles[selectedIndex] : null
  const content = selectedIndex !== null
    ? (displayContents[selectedIndex] ?? articles[selectedIndex].content)
    : ''

  return (
    <View style={s.root}>

      {/* ── FEED (always rendered so it shows through during slide) ── */}
      <View style={s.feedContainer}>
        <View style={s.feedHeader}>
          <Text style={s.feedTitle}>News</Text>
          <View style={s.feedHeaderRight}>
            <Text style={s.levelChip}>{ARTICLE_LABELS[readingLevel]}</Text>
            <Pressable style={s.gearBtn} onPress={() => setShowSettings(true)}>
              <GearIcon />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={articles}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { loadNews(true) }}
          refreshing={refreshing}
          renderItem={({ item, index }) => (
            <AnimatedCard
              article={item}
              index={index}
              finished={finishedArticles.has(index)}
              onPress={() => openArticle(index)}
            />
          )}
        />
      </View>

      {/* ── ARTICLE DETAIL (slides over the feed) ──────────────────── */}
      {selectedIndex !== null && article && (
        <Animated.View style={[s.detailOverlay, { transform: [{ translateX: slideX }] }]}>

          {/* Rewrite overlay */}
          {rewriting && (
            <View style={s.rewriteOverlay}>
              <Image source={require('../assets/loading.gif')} style={s.loadingGif} />
              <Text style={s.loadingText}>Rewriting at {ARTICLE_LABELS[readingLevel]} level{dots}</Text>
            </View>
          )}

          <View style={s.detailHeader}>
            <Pressable style={s.backBtn} onPress={closeArticle}>
              <Text style={s.backBtnText}>←</Text>
            </Pressable>
            <Text style={s.levelBadge}>{ARTICLE_LABELS[readingLevel]}</Text>
            <Pressable style={s.gearBtn} onPress={() => setShowSettings(true)}>
              <GearIcon />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.detailScroll}>
            <Text style={s.articleTitle}>{article.title}</Text>
            <Text style={s.articleMeta}>{article.author}</Text>
            <Pressable onPress={() => Linking.openURL(article.url)}>
              <Text style={s.articleLink}>Read original article here.</Text>
            </Pressable>
            <Text style={s.articleContent}>
              {renderInteractiveBody(content)}
            </Text>
            <Text style={s.longPressHint}>Long-press any word for a definition</Text>

            <Animated.View ref={finishBtnRef} style={{ transform: [{ scale: finishBtnScale }] }}>
              <Pressable
                style={[
                  s.finishBtn,
                  selectedIndex !== null && finishedArticles.has(selectedIndex) && s.finishBtnDone,
                ]}
                onPress={() => selectedIndex !== null && handleFinishPress(selectedIndex)}
              >
                <Text
                  style={[
                    s.finishBtnText,
                    selectedIndex !== null && finishedArticles.has(selectedIndex) && s.finishBtnTextDone,
                  ]}
                >
                  {selectedIndex !== null && finishedArticles.has(selectedIndex)
                    ? 'Finished ✓'
                    : 'Mark as Finished'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>

          {/* ── CONFETTI ───────────────────────────────────────────── */}
          {confettiKey > 0 && (
            <ConfettiBurst key={confettiKey} originY={confettiOriginY} />
          )}

          {/* ── DEFINITION OVERLAY ─────────────────────────────────── */}
          {definitionWord !== null && (
            <Modal
              transparent
              animationType="fade"
              visible
              statusBarTranslucent
              onRequestClose={dismissDefinition}
            >
              {/* Tinted backdrop — dismiss on tap outside card */}
              <Pressable style={s.defBackdrop} onPress={dismissDefinition}>
                {/* Card — inner Pressable stops touches propagating to backdrop */}
                <Pressable style={s.defCard}>

                  {/* Word row */}
                  <View style={s.defWordRow}>
                    <Text style={s.defWordText}>{definitionWord}</Text>
                    <Pressable
                      style={s.ttsBtnSmall}
                      onPress={() =>
                        speakingTarget === 'word'
                          ? stopSpeaking()
                          : speakText(definitionWord, 'word')
                      }
                      hitSlop={8}
                    >
                      {speakingTarget === 'word'
                        ? <StopIcon color={DG} />
                        : <MegaphoneIcon color={DG} />}
                    </Pressable>
                  </View>

                  <View style={s.defDivider} />

                  {/* Definition area */}
                  {definitionLoading ? (
                    <View style={s.defLoadingRow}>
                      <Image source={require('../assets/loading.gif')} style={s.defLoadingGif} />
                    </View>
                  ) : definitionError ? (
                    <Text style={s.defErrorText}>{definitionError}</Text>
                  ) : (
                    <View style={s.defBodyRow}>
                      <FadeInWords text={definitionText ?? ''} style={s.defBodyText} />
                      <Pressable
                        style={s.ttsBtnSmall}
                        onPress={() =>
                          speakingTarget === 'definition'
                            ? stopSpeaking()
                            : speakText(definitionText ?? '', 'definition')
                        }
                        hitSlop={8}
                      >
                        {speakingTarget === 'definition'
                          ? <StopIcon color={DG} />
                          : <MegaphoneIcon color={DG} />}
                      </Pressable>
                    </View>
                  )}

                </Pressable>
              </Pressable>
            </Modal>
          )}
        </Animated.View>
      )}

      <SettingsPanel
        visible={showSettings}
        level={readingLevel}
        onClose={() => setShowSettings(false)}
        onSelect={handleLevelChange}
      />
    </View>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  centerFill: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  loadingGif:  { width: 80, height: 80 },
  loadingText: { marginTop: 8, fontSize: 14, color: DG, opacity: 0.6, fontFamily: 'Arial' },
  errorEmoji:  { fontSize: 40, marginBottom: 12 },
  errorText:   { fontSize: 15, color: DG, opacity: 0.7, textAlign: 'center', marginBottom: 20, fontFamily: 'Arial' },
  retryBtn: {
    backgroundColor: DG, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  retryBtnText: { color: 'white', fontSize: 15, fontWeight: '700', fontFamily: 'Arial' },

  // Feed
  feedContainer: { flex: 1 },
  feedHeader: {
    paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,51,16,0.07)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  feedTitle:       { fontSize: 28, fontWeight: '900', color: DG, fontFamily: 'Arial' },
  feedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelChip: {
    fontSize: 11, color: DG, fontWeight: '700',
    backgroundColor: LG,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, overflow: 'hidden', fontFamily: 'Arial',
  },
  gearBtn: { padding: 6 },

  grid: { padding: 18, paddingBottom: 24, gap: 10 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14, padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: DG, lineHeight: 22, fontFamily: 'Arial' },

  // Detail overlay
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 10,
  },
  detailHeader: {
    paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,51,16,0.07)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn:     { padding: 4 },
  backBtnText: { fontSize: 22, color: DG, fontWeight: '700' },
  levelBadge: {
    fontSize: 11, color: DG, fontWeight: '700',
    backgroundColor: LG,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, overflow: 'hidden', fontFamily: 'Arial',
  },

  detailScroll:   { padding: 20, paddingBottom: 48 },
  articleTitle:   { fontSize: 22, fontWeight: '900', color: DG, lineHeight: 28, marginBottom: 8, fontFamily: 'Arial' },
  articleMeta:    { fontSize: 13, color: MUTED, marginBottom: 10, fontFamily: 'Arial' },
  articleLink: {
    fontSize: 14, color: '#0066CC',
    textDecorationLine: 'underline',
    marginBottom: 20, fontFamily: 'Arial',
  },
  articleContent: { fontSize: 16, color: '#222', lineHeight: 26, fontFamily: 'Arial' },
  longPressHint: {
    marginTop: 20,
    fontSize: 12, color: MUTED, textAlign: 'center', fontFamily: 'Arial',
    opacity: 0.7,
  },

  rewriteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242,239,230,0.92)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },

  // Settings panel
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 22, paddingBottom: 48,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  panelLabel: {
    fontSize: 11, fontWeight: '700', color: DG, opacity: 0.45,
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 14, fontFamily: 'Arial',
  },
  // Complexity slider
  sliderOuter:    { marginBottom: 16 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sliderLabel:    { fontSize: 11, fontWeight: '700', color: MUTED, fontFamily: 'Arial' },
  sliderTrackArea: { height: 40, justifyContent: 'center' },
  sliderTrackBg: {
    position: 'absolute', left: 0, right: 0,
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,51,16,0.12)',
  },
  sliderTrackFill: {
    position: 'absolute', left: 0,
    height: 4, borderRadius: 2,
    backgroundColor: DG,
  },
  sliderThumb: {
    position: 'absolute',
    left: -THUMB_SIZE / 2,
    top: (40 - THUMB_SIZE) / 2,
    width: THUMB_SIZE, height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: DG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 4, elevation: 4,
  },

  myLevelBtn: {
    paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: LG,
    alignItems: 'center', backgroundColor: 'transparent',
  },
  myLevelBtnActive:    { backgroundColor: LG },
  myLevelBtnText:      { fontSize: 13, fontWeight: '700', color: DG, fontFamily: 'Arial' },
  myLevelBtnTextActive: { color: DG },

  // Definition overlay
  defBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  defCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  defWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  defWordText: {
    fontSize: 26,
    fontWeight: '900',
    color: DG,
    fontFamily: 'Arial',
    flex: 1,
    marginRight: 10,
  },
  ttsBtnSmall: {
    padding: 8,
    backgroundColor: 'rgba(0,51,16,0.06)',
    borderRadius: 10,
  },
  defDivider: {
    height: 1,
    backgroundColor: 'rgba(0,51,16,0.08)',
    marginBottom: 14,
  },
  defLoadingRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  defLoadingGif: { width: 48, height: 48 },
  defErrorText: {
    fontSize: 14,
    color: '#CC2200',
    fontFamily: 'Arial',
    paddingVertical: 4,
  },
  defBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  defBodyText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    fontFamily: 'Arial',
  },

  // Finished state
  cardFinished: { backgroundColor: '#D8F5C0' },
  cardFinishedBadge: {
    marginTop: 8,
    fontSize: 11, fontWeight: '700',
    color: DG, fontFamily: 'Arial',
    opacity: 0.7,
  },
  finishBtn: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: DG,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  finishBtnDone: {
    backgroundColor: '#D8F5C0',
    borderColor: '#6BBF4E',
  },
  finishBtnText: {
    fontSize: 14, fontWeight: '700',
    color: DG, fontFamily: 'Arial',
  },
  finishBtnTextDone: { color: '#2A6B1A' },
})
