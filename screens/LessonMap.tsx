import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { useStore } from '../store'
import NewsScreen from './NewsScreen'

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const DG       = '#003310'  // dark green — text, completed nodes
const LG       = '#C7EF4E'  // light green — current node ring
const BG       = '#F2EFE6'  // off-white — background
const PATH_C   = '#C2BFB7'  // gray — dashed connecting path
const BORDER_C = '#D1CEC6'  // light gray — locked node border

// ─── LESSON METADATA ──────────────────────────────────────────────────────────
// TODO: replace with Supabase-fetched data once your API is wired up.
const LESSON_META = [
  { id: '1',  title: 'Warm Up',         isQuiz: false },
  { id: '2',  title: 'Listen & Repeat', isQuiz: false },
  { id: '3',  title: 'Word Meanings',   isQuiz: false },
  { id: '4',  title: 'Short Sentences', isQuiz: false },
  { id: '5',  title: 'Unit 1 Quiz',     isQuiz: true  },
  { id: '6',  title: 'Reading Basics',  isQuiz: false },
  { id: '7',  title: 'Phonics',         isQuiz: false },
  { id: '8',  title: 'Sight Words',     isQuiz: false },
  { id: '9',  title: 'Comprehension',   isQuiz: false },
  { id: '10', title: 'Unit 2 Quiz',     isQuiz: true  },
  { id: '11', title: 'Fluency',         isQuiz: false },
  { id: '12', title: 'Vocabulary',      isQuiz: false },
  { id: '13', title: 'Writing Skills',  isQuiz: false },
  { id: '14', title: 'Grammar',         isQuiz: false },
  { id: '15', title: 'Final Quiz',      isQuiz: true  },
]

const FALLBACK_PROGRESS: Record<string, { status: 'completed' | 'current' | 'locked'; stars: number }> = {
  '1':  { status: 'current',   stars: 0 },
  '2':  { status: 'locked',    stars: 0 },
  '3':  { status: 'locked',    stars: 0 },
  '4':  { status: 'locked',    stars: 0 },
  '5':  { status: 'locked',    stars: 0 },
  '6':  { status: 'locked',    stars: 0 },
  '7':  { status: 'locked',    stars: 0 },
  '8':  { status: 'locked',    stars: 0 },
  '9':  { status: 'locked',    stars: 0 },
  '10': { status: 'locked',    stars: 0 },
  '11': { status: 'locked',    stars: 0 },
  '12': { status: 'locked',    stars: 0 },
  '13': { status: 'locked',    stars: 0 },
  '14': { status: 'locked',    stars: 0 },
  '15': { status: 'locked',    stars: 0 },
}

// ─── MAP GEOMETRY ─────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width
const SCALE    = SCREEN_W / 375    // scale to any device width
const MAP_W    = SCREEN_W
const MAP_H    = 1920
const NW       = 106 * SCALE       // node width
const NH       = 70                // node height
const NR       = 13                // node border radius

// Node centers at 375px baseline — scaled at render time via SCALE
const RAW_POS: Record<string, { x: number; y: number }> = {
  '1':  { x: 148, y: 100  },
  '2':  { x: 278, y: 205  },
  '3':  { x: 190, y: 326  },
  '4':  { x: 80,  y: 447  },
  '5':  { x: 188, y: 572  },
  '6':  { x: 276, y: 697  },
  '7':  { x: 148, y: 822  },
  '8':  { x: 68,  y: 947  },
  '9':  { x: 204, y: 1072 },
  '10': { x: 188, y: 1200 },
  '11': { x: 278, y: 1325 },
  '12': { x: 162, y: 1450 },
  '13': { x: 68,  y: 1575 },
  '14': { x: 238, y: 1700 },
  '15': { x: 188, y: 1825 },
}

const POS = Object.fromEntries(
  Object.entries(RAW_POS).map(([id, { x, y }]) => [id, { x: x * SCALE, y }])
)

function buildPath(lessonMeta: typeof LESSON_META): string {
  return lessonMeta
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${POS[l.id].x} ${POS[l.id].y}`)
    .join(' ')
}

// Split a title into at most 2 lines for SVG rendering
function splitTitle(title: string): string[] {
  if (title.length <= 12) return [title]
  const words = title.split(' ')
  if (words.length === 1) return [title]
  const mid = Math.ceil(words.length / 2)
  const line1 = words.slice(0, mid).join(' ')
  const line2 = words.slice(mid).join(' ')
  const maxChars = 14
  const clamp = (text: string) => (text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text)
  return [clamp(line1), clamp(line2)]
}

// ─── NODE ─────────────────────────────────────────────────────────────────────
interface NodeProps {
  id: string
  title: string
  isQuiz: boolean
  status: 'completed' | 'current' | 'locked'
  onSelect: (id: string) => void
}

function Node({ id, title, isQuiz, status, onSelect }: NodeProps) {
  const { x, y } = POS[id]
  const done   = status === 'completed'
  const curr   = status === 'current'
  const locked = status === 'locked'

  const fill      = done || curr ? DG : 'white'
  const textColor = done || curr ? 'white' : '#B0ACA4'
  const lines     = splitTitle(title)
  const lineH     = 13

  return (
    <G onPress={() => !locked && onSelect(id)}>

      {/* Current node accent ring */}
      {curr && (
        <Rect
          x={x - NW / 2 - 6} y={y - NH / 2 - 6}
          width={NW + 12}     height={NH + 12}
          rx={NR + 5}
          fill="none" stroke={LG} strokeWidth={3}
        />
      )}

      {/* Drop shadow */}
      <Rect
        x={x - NW / 2 + 1} y={y - NH / 2 + 3}
        width={NW}           height={NH}
        rx={NR}
        fill="rgba(0,0,0,0.07)"
      />

      {/* Node body */}
      <Rect
        x={x - NW / 2} y={y - NH / 2}
        width={NW}       height={NH}
        rx={NR}
        fill={fill}
        stroke={locked ? BORDER_C : 'none'}
        strokeWidth={locked ? 1.5 : 0}
      />

      {/* Quiz node: star + title */}
      {isQuiz ? (
        <>
          <SvgText
            x={x} y={y - 9}
            textAnchor="middle" alignmentBaseline="central"
            fontSize={18} fill={textColor}
          >★</SvgText>
          <SvgText
            x={x} y={y + 13}
            textAnchor="middle" alignmentBaseline="central"
            fontSize={11} fontFamily="Arial" fill={textColor}
          >{title}</SvgText>
        </>
      ) : (
        <>
          {/* Lesson number */}
          <SvgText
            x={x} y={y - NH / 2 + 16}
            textAnchor="middle" alignmentBaseline="central"
            fontSize={11} fontWeight="bold" fontFamily="Arial" fill={textColor}
          >{id}</SvgText>

          {/* Title — up to 2 lines */}
          {lines.map((line, i) => (
            <SvgText
              key={i}
              x={x}
              y={y + 4 - ((lines.length - 1) * lineH / 2) + i * lineH}
              textAnchor="middle" alignmentBaseline="central"
              fontSize={11} fontFamily="Arial" fill={textColor}
            >{line}</SvgText>
          ))}
        </>
      )}
    </G>
  )
}

// ─── LESSON PANEL ─────────────────────────────────────────────────────────────
interface PanelProps {
  id: string | null
  lessonMeta: typeof LESSON_META
  progress: Record<string, { status: 'completed' | 'current' | 'locked'; stars: number }>
  onClose: () => void
  onStart: (id: string) => void
}

function LessonPanel({ id, lessonMeta, progress, onClose, onStart }: PanelProps) {
  const slideY = useRef(new Animated.Value(300)).current
  const meta   = id ? lessonMeta.find(l => l.id === id) : null
  const prog   = id ? progress[id] : null

  useEffect(() => {
    if (id) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
    } else {
      slideY.setValue(300)
    }
  }, [id])

  if (!meta || !prog) return null
  const isCompleted = prog.status === 'completed'

  return (
    <Modal transparent animationType="none" visible={!!id} onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View style={[s.panel, { transform: [{ translateY: slideY }] }]}>
          <Pressable>
            <View style={s.handle} />

            {/* Lesson label */}
            <Text style={s.panelLabel}>
              {meta.isQuiz ? 'Quiz' : `Lesson ${meta.id}`}
            </Text>
            <Text style={s.panelTitle}>{meta.title}</Text>
            <Text style={s.panelStatus}>
              {isCompleted ? 'Completed ✓' : 'In Progress'}
            </Text>

            {/* Stars */}
            {isCompleted && (
              <Text style={s.panelStars}>
                {[0,1,2].map(i => i < prog.stars ? '★' : '☆').join('  ')}
              </Text>
            )}

            <Pressable style={s.panelBtn} onPress={() => onStart(meta.id)}>
              <Text style={s.panelBtnText}>
                {isCompleted ? 'Practice Again →' : 'Start Lesson →'}
              </Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
interface LessonMapProps {
  lessons?: LessonMapItem[]
}

export default function LessonMap({ lessons }: LessonMapProps) {
  const scrollRef = useRef<ScrollView>(null)
  const { lessonProgress, setLessonProgress, setActiveLessonId } = useStore()
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<'home' | 'news'>('home')
  const [articleOpen, setArticleOpen] = useState(false)
  const titleOverrides = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]))
  const lessonMeta = LESSON_META.map((lesson) => ({
    ...lesson,
    title: titleOverrides.get(lesson.id) ?? lesson.title,
  }))

  // Seed fallback if store is empty
  useEffect(() => {
    if (Object.keys(lessonProgress).length === 0) {
      setLessonProgress(FALLBACK_PROGRESS)
    }
  }, [])

  const progress     = Object.keys(lessonProgress).length > 0 ? lessonProgress : FALLBACK_PROGRESS
  const currentLesson = lessonMeta.find(l => progress[l.id]?.status === 'current')

  // Auto-scroll to current lesson
  useEffect(() => {
    if (!currentLesson) return
    const pos = POS[currentLesson.id]
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: pos.y - 280, animated: true })
    }, 350)
  }, [currentLesson?.id])

  function handleStart(id: string) {
    setActiveLessonId(id)
    setSelectedId(null)
    // TODO: navigate to your lesson screen, e.g.:
    // navigation.navigate('Lesson', { id })
  }

  const pathD = buildPath(lessonMeta)

  return (
    <View style={s.root}>

      {/* ── HEADER — hidden on News tab (NewsScreen renders its own) ── */}
      {activeTab !== 'news' && (
        <View style={s.header}>
          <Text style={s.headerTitle}>GetLit</Text>
          <Text style={s.headerSub}>UNIT 1 — FOUNDATIONS OF READING</Text>
        </View>
      )}

      {/* ── CONTENT: MAP or NEWS ────────────────────────────────── */}
      {activeTab === 'news' ? (
        <NewsScreen onArticleOpen={setArticleOpen} />
      ) : (
        <>
          {/* ── MAP ──────────────────────────────────────────────── */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <Svg width={MAP_W} height={MAP_H}>

              {/* Background */}
              <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill={BG} />

              {/* Dashed connecting path */}
              <Path
                d={pathD}
                fill="none"
                stroke={PATH_C}
                strokeWidth={2}
                strokeDasharray="8,7"
                strokeLinecap="round"
              />

              {/* Nodes */}
              {lessonMeta.map(l => (
                <Node
                  key={l.id}
                  id={l.id}
                  title={l.title}
                  isQuiz={l.isQuiz}
                  status={progress[l.id]?.status ?? 'locked'}
                  onSelect={setSelectedId}
                />
              ))}

            </Svg>
          </ScrollView>

          {/* ── BEGIN LESSON CTA ──────────────────────────────────── */}
          <View style={s.ctaArea}>
            <Pressable
              style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }]}
              onPress={() => currentLesson && handleStart(currentLesson.id)}
            >
              <Text style={s.ctaText}>▷  Begin Lesson {currentLesson?.id}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── TAB BAR ─────────────────────────────────────────────── */}
      {!articleOpen && <View style={s.tabbar}>
        {[
          { label: 'Home',     icon: '⌂', key: 'home'     },
          { label: 'News',     icon: '◉', key: 'news'     },
          { label: 'Learn',    icon: '□', key: 'learn'    },
          { label: 'Progress', icon: '↑', key: 'progress' },
          { label: 'Profile',  icon: '○', key: 'profile'  },
        ].map(({ label, icon, key }) => {
          const active = key === activeTab
          return (
            <Pressable
              key={key}
              style={s.tab}
              onPress={() => {
                if (key === 'home' || key === 'news') setActiveTab(key as 'home' | 'news')
              }}
            >
              <Text style={[s.tabIcon, active && s.tabIconActive]}>{icon}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>}

      {/* ── LESSON PANEL ─────────────────────────────────────────── */}
      <LessonPanel
        id={selectedId}
        lessonMeta={lessonMeta}
        progress={progress}
        onClose={() => setSelectedId(null)}
        onStart={handleStart}
      />
    </View>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: BG },

  // Header
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,51,16,0.07)',
  },
  headerTitle:   { fontSize: 28, fontWeight: '900', color: DG, fontFamily: 'Arial' },
  headerSub: {
    fontSize: 10, color: DG, opacity: 0.45,
    letterSpacing: 1.4, marginTop: 4, fontFamily: 'Arial',
  },

  // CTA
  ctaArea: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,51,16,0.07)',
  },
  ctaBtn: {
    backgroundColor: DG,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700', fontFamily: 'Arial' },

  // Tab bar
  tabbar: {
    height: 58,
    flexDirection: 'row',
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,51,16,0.07)',
    paddingBottom: 6,
  },
  tab:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon:       { fontSize: 18, color: '#B0ACA4' },
  tabIconActive: { color: DG },
  tabLabel:      { fontSize: 10, color: '#B0ACA4', fontFamily: 'Arial' },
  tabLabelActive:{ color: DG, fontWeight: '700' },

  // Panel
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  panelLabel:    { fontSize: 11, fontWeight: '700', color: DG, opacity: 0.45, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Arial' },
  panelTitle:    { fontSize: 24, fontWeight: '900', color: DG, marginTop: 4, fontFamily: 'Arial' },
  panelStatus:   { fontSize: 13, color: '#999', marginTop: 6, fontFamily: 'Arial' },
  panelStars:    { fontSize: 20, color: DG, marginTop: 8, letterSpacing: 4 },
  panelBtn: {
    marginTop: 20,
    backgroundColor: DG,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  panelBtnText:  { color: 'white', fontSize: 15, fontWeight: '700', fontFamily: 'Arial' },
})