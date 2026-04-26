import type { MacroLessonConfig, MicroLessonConfig } from '../types'
import type { ReadingLevel } from './readingLevels'

export type LessonKind = 'micro' | 'macro'

export interface LessonDefinition {
  id: string
  title: string
  kind: LessonKind
}

export const LESSON_DEFINITIONS: LessonDefinition[] = [
  { id: '1', title: 'Greetings', kind: 'micro' },
  { id: '2', title: 'Numbers', kind: 'macro' },
  { id: '3', title: 'Colors', kind: 'micro' },
  { id: '4', title: 'Animals', kind: 'macro' },
  { id: '5', title: 'Food', kind: 'micro' },
  { id: '6', title: 'Family', kind: 'macro' },
  { id: '7', title: 'Travel', kind: 'micro' },
  { id: '8', title: 'Weather', kind: 'macro' },
  { id: '9', title: 'Shopping', kind: 'micro' },
  { id: '10', title: 'Work', kind: 'macro' },
  { id: '11', title: 'Hobbies', kind: 'micro' },
  { id: '12', title: 'Health', kind: 'macro' },
  { id: '13', title: 'Culture', kind: 'micro' },
  { id: '14', title: 'Grammar', kind: 'macro' },
  { id: '15', title: 'Fluency', kind: 'micro' },
]

const MICRO_PASSAGES: Record<string, string> = {
  '1': 'Nia meets her new neighbor in the hallway. She says hello and asks how the day is going. The neighbor smiles and answers slowly so both of them can understand each other.',
  '3': 'Rosa paints a small sign for her kitchen. She picks blue for the sky, green for the leaves, and red for a bright flower. Her son points at each color and says the names with her.',
  '5': 'At lunch, Sam reads a short recipe card. It says to wash the tomatoes, chop one onion, and stir the soup for five minutes. He follows each step and serves dinner to his family.',
  '7': 'Leila takes the bus to a job interview. She checks the route map, reads the stop names, and asks the driver one clear question. She arrives early and feels ready.',
  '9': 'Andre walks through the grocery store with a list. He compares two cereal labels and chooses the box with less sugar. At checkout, he reads the total and counts his change.',
  '11': 'Mina enjoys gardening on weekends. She reads seed packets to learn how deep to plant each seed. After a few weeks, she writes notes about what grows best in her yard.',
  '13': 'A community center hosts a music night. People bring songs from different places and explain what the words mean. Everyone listens, asks questions, and learns from one another.',
  '15': 'Jordan practices reading for ten minutes every morning. At first he pauses often, but now he reads whole paragraphs with confidence. He smiles when he notices how much faster he has become.',
}

const MACRO_CHAPTERS: Record<string, Array<{ title: string; content: string }>> = {
  '2': [
    {
      title: 'Counting at the Market',
      content: 'Marta visits a weekend market with twenty dollars. She writes prices in a notebook and adds them before paying. By the end, she can explain exactly how much money she spent and saved.',
    },
    {
      title: 'Reading Bills Clearly',
      content: 'At home, Marta studies a utility bill line by line. She circles the due date and checks each fee. When she calls customer support, she uses the numbers on the page to ask strong questions.',
    },
  ],
  '4': [
    {
      title: 'Animal Shelter Morning',
      content: 'Drew volunteers at a local shelter before work. He reads care cards for each dog and follows feeding instructions. The staff trusts him because he pays attention to every detail.',
    },
    {
      title: 'Helping New Volunteers',
      content: 'A new volunteer arrives and feels nervous. Drew explains the checklist in plain language and demonstrates each task. Together they finish quickly and keep the animals calm.',
    },
  ],
  '6': [
    {
      title: 'Family Message Board',
      content: 'The Nguyen family puts a whiteboard near the front door. Everyone writes reminders for school, work, and appointments. Reading and updating the board helps the household stay organized.',
    },
    {
      title: 'Planning the Week',
      content: 'On Sunday evening, they review the board together. They move unfinished items to the next day and add grocery notes. The routine makes busy mornings much easier.',
    },
  ],
  '8': [
    {
      title: 'Forecast for the Trip',
      content: 'Before traveling, Alia checks the weather report for three cities. She reads words like cloudy, humid, and chance of storms. She packs the right clothes and avoids delays.',
    },
    {
      title: 'Storm Alert',
      content: 'During the trip, her phone sends a storm alert. Alia reads the warning and follows the safety instructions. She thanks herself for practicing reading weather updates.',
    },
  ],
  '10': [
    {
      title: 'Workplace Instructions',
      content: 'Carlos starts a new shift at a warehouse. He reads safety signs and follows step-by-step instructions for lifting boxes. His supervisor notices his careful work on the first day.',
    },
    {
      title: 'Team Communication',
      content: 'Later, Carlos reads a short message from his manager about schedule changes. He confirms the new time and updates his calendar. Clear reading helps him stay dependable.',
    },
  ],
  '12': [
    {
      title: 'Doctor Visit Notes',
      content: 'Nora visits a clinic and reads the intake form slowly. She writes her symptoms clearly and asks the nurse about one medical term. The visit feels less stressful when she understands each step.',
    },
    {
      title: 'Medicine Label Practice',
      content: 'At home, Nora reads a medicine label out loud. She marks the dose and timing on her phone. This habit helps her take medicine safely every day.',
    },
  ],
  '14': [
    {
      title: 'Sentence Building',
      content: 'In class, Malik practices turning short phrases into full sentences. He learns where to place punctuation and how to connect ideas with because and so. His writing becomes easier to follow.',
    },
    {
      title: 'Editing with Confidence',
      content: 'Malik rereads his paragraph and fixes small mistakes. He checks capitals, commas, and verb tense one line at a time. By the end, he can explain why each correction matters.',
    },
  ],
}

export function getLessonDefinition(lessonId: string): LessonDefinition | undefined {
  return LESSON_DEFINITIONS.find((lesson) => lesson.id === lessonId)
}

export function getNextLessonId(lessonId: string): string | null {
  const currentIndex = LESSON_DEFINITIONS.findIndex((lesson) => lesson.id === lessonId)
  if (currentIndex < 0 || currentIndex === LESSON_DEFINITIONS.length - 1) return null
  return LESSON_DEFINITIONS[currentIndex + 1].id
}

export function buildMicroLessonConfig(
  lessonId: string,
  readingLevel: ReadingLevel,
  interests: string,
): MicroLessonConfig {
  return {
    lessonId,
    documentText:
      MICRO_PASSAGES[lessonId] ??
      'Read this short passage out loud and focus on smooth pacing and clear pronunciation.',
    readingLevel,
    interests: interests || 'general literacy',
  }
}

export function buildMacroLessonConfig(lessonId: string, readingLevel: ReadingLevel): MacroLessonConfig {
  const lesson = getLessonDefinition(lessonId)
  const chapters = (MACRO_CHAPTERS[lessonId] ?? [
    {
      title: 'Reading Practice',
      content:
        'Read this chapter slowly and clearly. Pay attention to punctuation and pause at commas and periods.',
    },
  ]).map((chapter, index) => ({
    chapterId: `${lessonId}-${index + 1}`,
    index,
    title: chapter.title,
    content: chapter.content,
  }))

  return {
    lessonId,
    title: lesson?.title ?? `Lesson ${lessonId}`,
    chapters,
    readingLevel,
  }
}
