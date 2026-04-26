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
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { useStore } from '../store' // ← adjust path if needed

// ─── LESSON METADATA ─────────────────────────────────────────────────────────
// Static display data. Status + stars come from the store.
// TODO: replace with Supabase-fetched lessons once your API is wired up.
const LESSON_META = [
  { id: '1',  title: 'Greetings', icon: '👋' },
  { id: '2',  title: 'Numbers',   icon: '🔢' },
  { id: '3',  title: 'Colors',    icon: '🎨' },
  { id: '4',  title: 'Animals',   icon: '🦊' },
  { id: '5',  title: 'Food',      icon: '🍜' },
  { id: '6',  title: 'Family',    icon: '👨‍👩‍👧' },
  { id: '7',  title: 'Travel',    icon: '✈️' },
  { id: '8',  title: 'Weather',   icon: '⛅' },
  { id: '9',  title: 'Shopping',  icon: '🛍️' },
  { id: '10', title: 'Work',      icon: '💼' },
  { id: '11', title: 'Hobbies',   icon: '🎸' },
  { id: '12', title: 'Health',    icon: '❤️' },
  { id: '13', title: 'Culture',   icon: '🏛️' },
  { id: '14', title: 'Grammar',   icon: '📖' },
  { id: '15', title: 'Fluency',   icon: '🏆' },
]

// Fallback progress — remove once Supabase hydration is live
const FALLBACK_PROGRESS: Record<string, { status: 'completed' | 'current' | 'locked'; stars: number }> = {
  '1':  { status: 'completed', stars: 3 },
  '2':  { status: 'completed', stars: 2 },
  '3':  { status: 'completed', stars: 3 },
  '4':  { status: 'completed', stars: 2 },
  '5':  { status: 'completed', stars: 1 },
  '6':  { status: 'current',   stars: 0 },
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
const W = SCREEN_W
const H = 2450
const R = 36
const SCALE = W / 370 // scale x-positions to any screen width

const RAW_POS: Record<string, { x: number; y: number }> = {
  '1':  { x: 185, y: 2300 },
  '2':  { x: 295, y: 2155 },
  '3':  { x: 82,  y: 2010 },
  '4':  { x: 280, y: 1865 },
  '5':  { x: 90,  y: 1720 },
  '6':  { x: 272, y: 1575 },
  '7':  { x: 98,  y: 1430 },
  '8':  { x: 278, y: 1285 },
  '9':  { x: 96,  y: 1140 },
  '10': { x: 275, y: 995  },
  '11': { x: 100, y: 850  },
  '12': { x: 280, y: 705  },
  '13': { x: 105, y: 560  },
  '14': { x: 272, y: 415  },
  '15': { x: 185, y: 270  },
}

const POS: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(RAW_POS).map(([id, { x, y }]) => [id, { x: x * SCALE, y }])
)

function buildPath(): string {
  const pts = LESSON_META.map(l => POS[l.id])
  const parts: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    if (i === 0) parts.push(`M ${p1.x} ${p1.y}`)
    parts.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x} ${p2.y}`
    )
  }
  return parts.join(' ')
}

const STAR_OPS = [0.85,0.55,0.70,0.90,0.60,0.80,0.45,0.75,0.95,0.50,0.65,0.88,0.40,0.72,0.58,0.83]

// ─── NODE ─────────────────────────────────────────────────────────────────────
interface NodeProps {
  id: string
  title: string
  icon: string
  status: 'completed' | 'current' | 'locked'
  stars: number
  onSelect: (id: string) => void
}

function Node({ id, title, icon, status, stars, onSelect }: NodeProps) {
  const { x, y } = POS[id]
  const pulse = useRef(new Animated.Value(1)).current

  const done   = status === 'completed'
  const curr   = status === 'current'
  const locked = status === 'locked'

  const main  = done ? '#F57C00' : curr ? '#1565C0' : '#78909C'
  const rim   = done ? '#BF360C' : curr ? '#0D47A1' : '#455A64'
  const shine = done ? '#FFCC80' : curr ? '#90CAF9' : '#B0BEC5'

  useEffect(() => {
    if (!curr) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3,  duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 1100, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [curr])

  return (
    <G onPress={() => !locked && onSelect(id)}>
      {/* Pulse halos for current node */}
      {curr && (
        <>
          <Circle cx={x} cy={y} r={R + 18} fill="rgba(21,101,192,0.10)" />
          <Circle cx={x} cy={y} r={R + 10} fill="rgba(21,101,192,0.20)" />
        </>
      )}

      {/* Drop shadow */}
      <Circle cx={x} cy={y + 5} r={R} fill="rgba(0,0,0,0.28)" />
      {/* Rim */}
      <Circle cx={x} cy={y}     r={R} fill={rim} />
      {/* Main face */}
      <Circle cx={x} cy={y - 4} r={R} fill={main} />
      {/* Shine */}
      <Ellipse
        cx={x - 11 * SCALE} cy={y - (R * 0.52 + 4)}
        rx={9 * SCALE} ry={5.5}
        fill={shine} fillOpacity={0.55}
      />

      {/* Icon or lock */}
      <SvgText
        x={x} y={y - 4}
        textAnchor="middle" alignmentBaseline="central"
        fontSize={locked ? 18 : 22}
      >
        {locked ? '🔒' : icon}
      </SvgText>

      {/* Stars below completed nodes */}
      {done && [0, 1, 2].map(i => (
        <SvgText
          key={i}
          x={x + (i - 1) * 16} y={y + R + 14}
          textAnchor="middle" alignmentBaseline="central"
          fontSize={14}
          fill={i < stars ? '#FDD835' : 'rgba(255,255,255,0.25)'}
        >★</SvgText>
      ))}

      {/* START badge above current node */}
      {curr && (
        <G>
          <Rect x={x - 26} y={y - R - 33} width={52} height={20} rx={10} fill="#1565C0" />
          <SvgText
            x={x} y={y - R - 23}
            textAnchor="middle" alignmentBaseline="central"
            fontSize={9} fontWeight="bold" fill="white"
          >START</SvgText>
        </G>
      )}

      {/* Lesson title */}
      <SvgText
        x={x} y={y + R + (done ? 30 : 18)}
        textAnchor="middle" alignmentBaseline="central"
        fontSize={11} fontWeight="800"
        fill={locked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.92)'}
      >
        {title}
      </SvgText>
    </G>
  )
}

// ─── LESSON PANEL ─────────────────────────────────────────────────────────────
interface PanelProps {
  id: string | null
  progress: Record<string, { status: 'completed' | 'current' | 'locked'; stars: number }>
  onClose: () => void
  onStart: (id: string) => void
}

function LessonPanel({ id, progress, onClose, onStart }: PanelProps) {
  const slideAnim = useRef(new Animated.Value(300)).current
  const meta = id ? LESSON_META.find(l => l.id === id) : null
  const prog = id ? progress[id] : null

  useEffect(() => {
    if (id) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start()
    } else {
      slideAnim.setValue(300)
    }
  }, [id])

  if (!meta || !prog) return null

  const isCompleted = prog.status === 'completed'

  return (
    <Modal transparent animationType="none" visible={!!id} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
          <Pressable>
            <View style={styles.handle} />

            <View style={styles.panelRow}>
              <View style={[styles.iconBubble, isCompleted ? styles.bubbleGold : styles.bubbleBlue]}>
                <Text style={styles.iconEmoji}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{meta.title}</Text>
                <Text style={styles.panelSub}>
                  Lesson {meta.id} · {isCompleted ? 'Completed' : 'In Progress'}
                </Text>
                {isCompleted && (
                  <Text style={styles.stars}>
                    {[0,1,2].map(i => i < prog.stars ? '★' : '☆').join('')}
                  </Text>
                )}
              </View>
            </View>

            <Pressable style={styles.startBtn} onPress={() => onStart(meta.id)}>
              <Text style={styles.startBtnText}>
                {isCompleted ? '🔄  Practice Again' : '🚀  Start Lesson'}
              </Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LessonMap() {
  const scrollRef = useRef<ScrollView>(null)
  const { lessonProgress, setLessonProgress, setActiveLessonId } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (Object.keys(lessonProgress).length === 0) {
      setLessonProgress(FALLBACK_PROGRESS)
    }
  }, [])

  const progress = Object.keys(lessonProgress).length > 0 ? lessonProgress : FALLBACK_PROGRESS
  const completedCount = Object.values(progress).filter(p => p.status === 'completed').length
  const currentId = LESSON_META.find(l => progress[l.id]?.status === 'current')?.id

  useEffect(() => {
    if (!currentId) return
    const pos = POS[currentId]
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: pos.y - 350, animated: true })
    }, 400)
  }, [currentId])

  function handleStartLesson(id: string) {
    setActiveLessonId(id)
    setSelectedId(null)
    // TODO: navigate to your lesson screen, e.g.:
    // navigation.navigate('Lesson', { id })
  }

  const pathD = buildPath()
  const treeColors = ['#2E7D32', '#388E3C', '#43A047']
  const flowerColors = ['#F48FB1','#FDD835','#80DEEA','#CE93D8','#A5D6A7','#FFAB40','#80CBC4']

  return (
    <View style={styles.root}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🌍 GetLit</Text>
          <Text style={styles.headerSub}>Adult Literacy · English</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeValue}>⭐ {completedCount} / {LESSON_META.length}</Text>
          <Text style={styles.badgeLabel}>LESSONS DONE</Text>
        </View>
      </View>

      {/* ── MAP ────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="bgNight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="#130833" />
              <Stop offset="100%" stopColor="#1C1464" />
            </LinearGradient>
            <LinearGradient id="bgDawn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="#1A3A6A" />
              <Stop offset="100%" stopColor="#1B6E41" />
            </LinearGradient>
            <LinearGradient id="bgMeadow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="#2E7D32" />
              <Stop offset="100%" stopColor="#1B5E20" />
            </LinearGradient>
          </Defs>

          <Rect x={0} y={0}    width={W} height={750}      fill="url(#bgNight)"  />
          <Rect x={0} y={750}  width={W} height={900}      fill="url(#bgDawn)"   />
          <Rect x={0} y={1650} width={W} height={H - 1650} fill="url(#bgMeadow)" />

          {/* Stars */}
          {([
            [28,38],[85,82],[138,28],[207,68],[285,44],[338,95],
            [52,155],[158,172],[248,135],[315,195],[62,272],[205,252],
            [324,295],[40,388],[175,355],[310,400],[72,478],[230,445],
            [345,490],[95,562],[280,535],
          ] as [number,number][]).map(([sx, sy], i) => (
            <Circle key={i} cx={sx * SCALE} cy={sy}
                    r={i % 4 === 0 ? 2 : 1.3}
                    fill="white" fillOpacity={STAR_OPS[i % STAR_OPS.length]} />
          ))}

          {/* Moon */}
          <Circle cx={308 * SCALE} cy={108} r={30} fill="#FFFDE7" fillOpacity={0.92} />
          <Circle cx={324 * SCALE} cy={96}  r={24} fill="#1C1464" />

          {/* Clouds */}
          {([
            [55,800],[195,840],[305,778],[92,965],[278,1000],
          ] as [number,number][]).map(([cx, cy], i) => (
            <G key={i} opacity={0.45}>
              <Ellipse cx={cx * SCALE}      cy={cy}   rx={36 * SCALE} ry={18} fill="white" />
              <Ellipse cx={(cx+20) * SCALE} cy={cy-8} rx={24 * SCALE} ry={14} fill="white" />
              <Ellipse cx={(cx-17) * SCALE} cy={cy-5} rx={19 * SCALE} ry={12} fill="white" />
            </G>
          ))}

          {/* Trees */}
          {([
            [38,1680,0],[335,1725,1],[22,1855,0],[352,1810,1],[162,1740,2],
            [48,1978,1],[342,1990,0],[198,1908,1],[102,2080,0],[305,2130,2],
            [60,2230,1],[340,2210,0],[190,2170,2],
          ] as [number,number,number][]).map(([tx, ty, t], i) => (
            <G key={i}>
              <Rect x={(tx - 4) * SCALE} y={ty} width={8 * SCALE} height={26} fill="#4E342E" />
              <Ellipse cx={tx * SCALE} cy={ty - 20} rx={17 * SCALE} ry={26} fill={treeColors[t]} />
            </G>
          ))}

          {/* Flowers */}
          {([
            [108,2025],[264,2010],[68,2185],[318,2200],[183,2080],[140,2260],[290,2245],
          ] as [number,number][]).map(([fx, fy], i) => (
            <G key={i}>
              <Rect x={(fx - 1.5) * SCALE} y={fy - 14} width={3 * SCALE} height={14} fill="#558B2F" />
              <Circle cx={fx * SCALE} cy={fy} r={4.5} fill={flowerColors[i % flowerColors.length]} />
            </G>
          ))}

          {/* Path shadow */}
          <Path d={pathD} fill="none" stroke="rgba(0,0,0,0.35)"
                strokeWidth={18} strokeLinecap="round"
                x={3} y={6} />
          {/* Rope */}
          <Path d={pathD} fill="none" stroke="#EDE0C4"
                strokeWidth={14} strokeLinecap="round" strokeDasharray="24,15" />
          {/* Highlight */}
          <Path d={pathD} fill="none" stroke="rgba(255,255,255,0.45)"
                strokeWidth={4} strokeLinecap="round" />

          {/* Nodes */}
          {LESSON_META.map(l => (
            <Node
              key={l.id}
              id={l.id}
              title={l.title}
              icon={l.icon}
              status={progress[l.id]?.status ?? 'locked'}
              stars={progress[l.id]?.stars ?? 0}
              onSelect={setSelectedId}
            />
          ))}
        </Svg>
      </ScrollView>

      <LessonPanel
        id={selectedId}
        progress={progress}
        onClose={() => setSelectedId(null)}
        onStart={handleStartLesson}
      />
    </View>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#0A1628' },
  header: {
    backgroundColor: '#0D3B8C',
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: 'white' },
  headerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  badgeValue:   { fontSize: 15, fontWeight: '800', color: 'white' },
  badgeLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.6, marginTop: 1 },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  panelRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBubble:   { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  bubbleGold:   { backgroundColor: '#F57C00' },
  bubbleBlue:   { backgroundColor: '#1565C0' },
  iconEmoji:    { fontSize: 30 },
  panelTitle:   { fontSize: 26, fontWeight: '800', color: '#1A1A2E' },
  panelSub:     { fontSize: 12, color: '#888', marginTop: 3 },
  stars:        { fontSize: 18, color: '#FDD835', marginTop: 4 },
  startBtn:     { marginTop: 22, backgroundColor: '#1565C0', borderRadius: 16, padding: 16, alignItems: 'center' },
  startBtnText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.4 },
})