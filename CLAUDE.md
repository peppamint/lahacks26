# CLAUDE.md — Adult Literacy App

> Hackathon project guide for Claude Code and all teammates. Read this before touching any code.

---

## Project Overview

An AI-powered adult literacy app that meets learners where they are — from total beginners to near-fluent readers. Users set goals, take a diagnostic, and receive a personalized curriculum of micro- and macro-lessons using real-world documents. Claude (Sonnet + Haiku) powers curriculum generation, text simplification, and comprehension questions. The app works offline and supports both iOS and Android from a single codebase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo) |
| AI / LLM | Claude API — Sonnet (`claude-sonnet-4-20250514`) for curriculum & simplification; Haiku (`claude-haiku-4-5-20251001`) for fast inline tasks |
| Speech-to-Text | OpenAI Whisper API (online); `whisper.cpp` on-device (offline) |
| Text-to-Speech | ElevenLabs API (online); Kokoro open-source (offline) |
| Backend / DB | Supabase (auth, Postgres, file storage) |
| Offline Storage | SQLite via Expo SQLite |
| OCR | Google ML Kit (on-device, no API key needed) |

---

## Repository Structure

```
/
├── CLAUDE.md                  ← you are here
├── App.tsx                    ← root application entry
├── app.json                   ← Expo config
├── package.json
├── tsconfig.json
├── index.ts
├── assets/                    ← static assets
├── components/                ← shared UI primitives only
│   ├── Button.tsx
│   ├── AudioPlayer.tsx
│   ├── ReadingCard.tsx
│   └── ProgressChart.tsx
├── modules/                   ← FEATURE MODULES (one per teammate)
│   ├── diagnostic/
│   │   ├── DiagnosticFlow.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── micro-lessons/
│   │   ├── MicroLesson.tsx
│   │   ├── index.ts
│   │   └── types.ts
│   ├── macro-lessons/
│   │   ├── MacroLesson.tsx
│   │   ├── index.ts
│   │   └── types.ts
│   ├── plain-english/
│   │   ├── PlainEnglishReader.tsx
│   │   ├── templates.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── speech/
│   │   ├── stumbleDetection.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── hooks/
│   │       ├── useSpeechRecognition.ts
│   │       └── useTextToSpeech.ts
│   └── progress/
│       ├── ProgressDashboard.tsx
│       ├── WordBank.tsx
│       ├── types.ts
│       ├── index.ts
│       └── hooks/
│           └── useProgress.ts
├── services/                  ← shared API clients (never import directly from modules)
│   ├── claude.ts              ← all Anthropic API calls
│   ├── supabase.ts            ← DB + auth
│   ├── whisper.ts             ← STT
│   ├── elevenlabs.ts          ← TTS
│   ├── elevanlabs.test.ts     ← TTS tests
│   ├── ocr.ts                 ← Google ML Kit
│   └── vocabBank.ts           ← vocabulary bank service
├── store/                     ← Zustand global state slices
│   ├── index.ts
│   ├── userSlice.ts
│   ├── lessonSlice.ts
│   └── progressSlice.ts
├── hooks/                     ← shared React hooks
│   └── useSpeechRecognition.ts
├── constants/
│   ├── readingLevels.ts       ← Lexile / grade-level definitions
│   └── domains.ts             ← curriculum domain tags
├── types/
│   └── index.ts               ← shared TypeScript interfaces
├── utils/
│   └── eventBus.ts            ← inter-module event bus (mitt)
└── supabase/                  ← Supabase Edge Functions
    └── functions/
        ├── tts-proxy/
        │   └── index.ts
        └── whisper-api/
            └── index.ts
```

---

## Module Ownership (Assign One Per Teammate)

Each module is a self-contained folder. It owns its own screens, local state, Claude prompts, and tests. It exposes a single public API via `index.ts`. **Do not import internals from another module.**

### Module 1 — `diagnostic/`
**Responsibility:** Onboarding goal-setting conversation + initial reading-level assessment.

Key tasks:
- Multi-turn Claude (Sonnet) conversation to elicit learner goals (e.g. "read documents for work as an accountant")
- Store structured `UserProfile` (goal, domain, estimated reading level) in Supabase
- Adaptive diagnostic quiz: 5–10 sentences of increasing complexity; detect stumble points via Whisper

Exports:
```ts
// modules/diagnostic/index.ts
export { runDiagnostic } from './DiagnosticFlow'
export type { UserProfile, DiagnosticResult } from './types'
```

---

### Module 2 — `micro-lessons/`
**Responsibility:** 5–10 min lessons using real-world documents.

Key tasks:
- Fetch or paste real document (news, bill, prescription) → simplify via Claude Haiku to learner's level
- Voice-input answer mode (Whisper) instead of typed answers
- AI speech analysis: flag stumbled/mispronounced words → auto-save to word bank
- Lesson completion event → emit to `progress/` module via event bus

Exports:
```ts
export { MicroLesson } from './MicroLesson'
export type { MicroLessonConfig, StumbledWord } from './types'
```

---

### Module 3 — `macro-lessons/`
**Responsibility:** Extended reading tracks through longer works (books, long articles).

Key tasks:
- Chapter-by-chapter reading or audiobook (ElevenLabs TTS) playback
- Claude Sonnet generates SAT-style multiple-choice comprehension questions per chapter
- Track chapter completion + comprehension score in Supabase
- Progress event → emit to `progress/` module

Exports:
```ts
export { MacroLesson } from './MacroLesson'
export type { MacroLessonConfig, Chapter, ComprehensionQuestion } from './types'
```

---

### Module 4 — `plain-english/`
**Responsibility:** Paste any URL → re-render page at learner's chosen reading level.

Key tasks:
- Fetch URL content (strip nav/ads), pass to Claude Sonnet with reading-level target
- Render simplified version in-app with learner's font size preference
- "Tap word for definition" affordance (Claude Haiku inline lookup)
- Real-world document templates: utility bill, lease, job application, bus schedule, prescription

Exports:
```ts
export { PlainEnglishReader } from './PlainEnglishReader'
export { DocumentTemplates } from './templates'
```

---

### Module 5 — `speech/`
**Responsibility:** Shared speech layer used by micro-lessons and diagnostic.

Key tasks:
- Unified `SpeechRecognizer` that switches between Whisper API (online) and `whisper.cpp` (offline)
- `TextToSpeech` that switches between ElevenLabs (online) and Kokoro (offline)
- Stumble detection: compare expected vs actual transcript; return diff with confidence scores
- Expose `useSpeechRecognition` and `useTextToSpeech` hooks

Exports:
```ts
export { useSpeechRecognition } from './hooks/useSpeechRecognition'
export { useTextToSpeech } from './hooks/useTextToSpeech'
export { detectStumbles } from './stumbleDetection'
export type { StumbleResult, SpeechConfig } from './types'
```

---

### Module 6 — `progress/`
**Responsibility:** All analytics, the personal word bank, and progress charts.

Key tasks:
- Listen to completion events from `micro-lessons/` and `macro-lessons/` via event bus
- Persist progress to Supabase Postgres
- Word bank: stumbled words + pronunciation recording the learner can replay
- Colorful bar/line charts (Victory Native or Recharts Native) for reading level over time, lessons completed, words mastered

Exports:
```ts
export { ProgressDashboard } from './ProgressDashboard'
export { WordBank } from './WordBank'
export { useProgress } from './hooks/useProgress'
export type { ProgressStats, WordBankEntry } from './types'
```

---

---

## Shared Services (Do Not Duplicate)

All external API calls live in `/services/`. Modules call these — they never call Anthropic, Supabase, or Whisper directly.

### `services/claude.ts`
```ts
// Sonnet — use for curriculum generation, simplification, comprehension Qs
export async function simplifyText(text: string, targetLevel: ReadingLevel): Promise<string>
export async function generateComprehensionQuestions(chapter: string): Promise<Question[]>
export async function runGoalConversation(messages: Message[]): Promise<string>

// Haiku — use for fast, inline, single-turn tasks
export async function defineWord(word: string, context: string): Promise<string>
export async function detectStumbleFromTranscript(expected: string, actual: string): Promise<StumbleResult>
```

Model constants:
```ts
export const SONNET = 'claude-sonnet-4-20250514'
export const HAIKU  = 'claude-haiku-4-5-20251001'
```

### `services/supabase.ts`
Single initialized Supabase client. Auth, user profiles, progress rows, word bank entries.

### `services/progress.ts`
```ts
// Fetch aggregated progress stats for a user
export async function fetchProgressStats(userId: string): Promise<ProgressStats | null>

// Fetch today's progress (words learned + lessons completed today)
export async function fetchTodayProgress(userId: string): Promise<{
  wordsLearnedToday: number
  grammarStructuresLearned: number
}>

// Fetch all words in user's word bank
export async function fetchWordBank(userId: string): Promise<WordBankEntry[]>

// Fetch reading level progression over time
export async function fetchReadingLevelTrend(userId: string): Promise<{ date: string; level: string }[]>
```

### `services/whisper.ts`
```ts
export async function transcribeAudio(blob: Blob, offline: boolean): Promise<string>
```

### `services/elevenlabs.ts`
```ts
export async function synthesizeSpeech(text: string, offline: boolean): Promise<ArrayBuffer>
```

### `services/ocr.ts`
```ts
export async function extractTextFromImage(imageUri: string): Promise<string>
```

---

## Shared State (Zustand)

```ts
// store/userSlice.ts
interface UserState {
  userId: string
  profile: UserProfile       // from diagnostic module
  readingLevel: ReadingLevel // updated after each lesson
}

// store/lessonSlice.ts
interface LessonState {
  activeLessonId: string | null
  currentChapter: number
  stumbledWords: StumbledWord[]
}

// store/progressSlice.ts
interface ProgressState {
  stats: ProgressStats
  wordBank: WordBankEntry[]
  lastSynced: Date | null
}
```

---

## Inter-Module Communication

Modules must not import from each other. Use the event bus for cross-module side effects.

```ts
// utils/eventBus.ts
import mitt from 'mitt'

type Events = {
  'lesson:completed': { lessonId: string; type: 'micro' | 'macro'; score: number }
  'word:stumbled': StumbledWord
  'reading-level:updated': ReadingLevel
}

export const bus = mitt<Events>()
```

Usage:
```ts
// In micro-lessons/
bus.emit('lesson:completed', { lessonId, type: 'micro', score })

// In progress/
bus.on('lesson:completed', (data) => saveProgress(data))
```

---

## Reading Level System

Use a simple 7-level internal scale mapped to Lexile ranges. Store as a string enum.

```ts
// constants/readingLevels.ts
export type ReadingLevel = 'pre-k' | 'grade1' | 'grade3' | 'grade5' | 'grade8' | 'grade10' | 'adult'

export const LEVEL_LABELS: Record<ReadingLevel, string> = {
  'pre-k':   'Beginning (Pre-K)',
  'grade1':  'Early Reader (Grade 1–2)',
  'grade3':  'Developing (Grade 3–4)',
  'grade5':  'Intermediate (Grade 5–6)',
  'grade8':  'Confident (Grade 7–8)',
  'grade10': 'Advanced (Grade 9–10)',
  'adult':   'Proficient Adult',
}
```

Pass this level as a string in all Claude prompts: `"Rewrite this at a ${LEVEL_LABELS[level]} reading level."`

---

## Claude Prompt Guidelines

1. **Always include the reading level** in simplification prompts.
2. **Always include the learner's domain** (accounting, parenting, legal) so Claude picks relevant vocabulary.
3. **Use Haiku for anything single-turn and fast** (word definitions, stumble detection, short rephrasing).
4. **Use Sonnet for anything multi-turn or generative** (goal conversation, chapter questions, full lesson plans).
5. **Return JSON from Claude** when the output feeds UI — ask for JSON explicitly and parse safely.

Example prompt pattern:
```ts
const prompt = `
You are a literacy tutor. The learner is at a ${level} reading level.
Their goal: ${userProfile.goal}
Their domain: ${userProfile.domain}

Rewrite the following text so it is clear and accessible at the learner's level.
Return only the rewritten text, no explanation.

TEXT:
${originalText}
`
```

---

## Environment Variables

```
# .env (never commit)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=          # server-side only, never expose to client
OPENAI_API_KEY=             # Whisper
ELEVENLABS_API_KEY=
```

> ⚠️ `ANTHROPIC_API_KEY` must only be used server-side (Supabase Edge Function or a thin proxy). Never embed it in the Expo bundle.

---

## Supabase Schema (Quick Reference)

```sql
-- users (managed by Supabase Auth)

-- profiles
create table profiles (
  id uuid references auth.users primary key,
  goal text,
  domain text,
  reading_level text,
  created_at timestamptz default now()
);

-- progress_events
create table progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  lesson_id text,
  lesson_type text,  -- 'micro' | 'macro'
  score numeric,
  reading_level text,
  completed_at timestamptz default now()
);

-- word_bank
create table word_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  word text,
  context text,
  pronunciation_url text,
  created_at timestamptz default now()
);
```

---

## Running the Project

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android
```

---

## Key Conventions

- **TypeScript everywhere.** No `any` without a comment explaining why.
- **Each module has its own `__tests__/` folder.** Unit test Claude prompt outputs with mocked responses.
- **No direct `fetch()` to external APIs in components.** Always go through `/services/`.
- **Offline-first mindset.** Every feature should degrade gracefully when `useOfflineStatus()` returns `true`.
- **Emit events, don't import across modules.** Cross-module side effects go through the event bus.
- **Reading level is always explicit.** Never pass text to Claude without specifying the target level.
