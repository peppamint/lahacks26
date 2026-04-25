import type { Domain } from '../../constants/domains'
import { READING_LEVELS, type ReadingLevel } from '../../constants/readingLevels'
import { SKILL_CATEGORY_LABELS, adjustReadingLevel, type SkillCategory, type SkillLevels } from '../../constants/skills'
import type { MicroLessonPlan, MicroLessonQuestion } from './types'

const DOMAIN_TOPIC: Record<Domain, string> = {
  accounting: 'reviewing a simple receipt',
  parenting: 'reading a school reminder',
  legal: 'understanding a short notice',
  healthcare: 'following medicine directions',
  employment: 'reading a work shift message',
  housing: 'reading an apartment maintenance update',
  education: 'reading a class announcement',
  government: 'reading a benefits appointment reminder',
  finance: 'reading a bank account alert',
  general: 'reading an everyday community update',
}

const PASSAGE_TEMPLATES: Record<ReadingLevel, string[]> = {
  'pre-k': [
    'Lena sees a note. The note says bus at ten. Lena smiles.',
    'A sign says wash hands. Omar reads it and goes to the sink.',
    'Jae has a card. The card says room two. Jae goes there.',
  ],
  grade1: [
    'Marta reads a text from her manager. It says her shift starts at 9 AM tomorrow.',
    'Noah gets a reminder from the clinic. It says to drink water before his visit.',
    'A school note says family night is on Thursday at 6 PM in the gym.',
  ],
  grade3: [
    'A bus alert says Route 5 will leave ten minutes later this week because of road work.',
    'A pharmacy message says to take one tablet after dinner and call if symptoms continue.',
    'A utility notice says water service will pause from 1 PM to 3 PM during repairs.',
  ],
  grade5: [
    'The community center newsletter explains that job support workshops run on Tuesdays and Thursdays, and seats are limited.',
    'A clinic update says blood test results are ready in the patient portal and asks patients to schedule follow-up visits.',
    'A landlord email says the building inspection is Friday morning and asks residents to clear access to heaters.',
  ],
  grade8: [
    'The workplace memo explains a new scheduling system where requests must be submitted by Wednesday to be included in next week\'s roster.',
    'The city transit update describes a route redesign intended to reduce transfers during peak commute hours.',
    'The school district message outlines a new attendance policy with excused and unexcused absence categories.',
  ],
  grade10: [
    'The benefits office announcement clarifies that applicants must upload proof of income and residency before final review.',
    'The housing association bulletin states that maintenance requests are prioritized by urgency and safety impact.',
    'The financial literacy newsletter compares fixed and variable interest rates for first-time borrowers.',
  ],
  adult: [
    'The employee handbook update notes that overtime approvals now require manager confirmation in the payroll portal before the shift begins.',
    'The health insurance explanation describes deductible resets, in-network pricing, and prior authorization requirements.',
    'The lease addendum specifies rent escalation terms, renewal windows, and dispute resolution procedures.',
  ],
}

function buildQuestion(id: string, passage: string, level: ReadingLevel): MicroLessonQuestion {
  return {
    id,
    prompt: `What is the main idea of this passage at the ${level} level?`,
    options: [
      'It shares a practical instruction or update for daily life.',
      'It tells a fantasy story about imaginary characters.',
      'It gives a recipe with no real-world context.',
      'It describes a science experiment with lab equipment.',
    ],
    correctIndex: 0,
  }
}

function buildQuizQuestion(id: string, level: ReadingLevel): MicroLessonQuestion {
  return {
    id,
    prompt: `A learner scores 90% on a ${level} lesson. What should happen next?`,
    options: [
      'Lower their level by one immediately.',
      'Keep level unchanged no matter performance.',
      'Raise next lesson difficulty by one level.',
      'Delete progress history and restart.',
    ],
    correctIndex: 2,
  }
}

export function buildMicroLessonPlan(params: {
  lessonId: string
  domain: Domain
  targetCategory: SkillCategory
  skillLevels: SkillLevels
}): MicroLessonPlan {
  const targetSkillLevel = params.skillLevels[params.targetCategory]
  const passages = PASSAGE_TEMPLATES[targetSkillLevel]

  return {
    lessonId: params.lessonId,
    title: `${SKILL_CATEGORY_LABELS[params.targetCategory]}: ${DOMAIN_TOPIC[params.domain]}`,
    domain: params.domain,
    targetCategory: params.targetCategory,
    targetSkillLevel,
    items: passages.map((passage, index) => ({
      id: `item-${index + 1}`,
      passage,
      question: buildQuestion(`item-q-${index + 1}`, passage, targetSkillLevel),
    })),
    quiz: [
      buildQuizQuestion('quiz-1', targetSkillLevel),
      {
        id: 'quiz-2',
        prompt: 'Why do we keep lessons short in this app?',
        options: [
          'To support focused practice and quick daily progress.',
          'To avoid measuring learner performance.',
          'To remove all adaptive difficulty adjustments.',
          'To prevent progress from being saved.',
        ],
        correctIndex: 0,
      },
    ],
  }
}

export function recommendNextReadingLevel(level: ReadingLevel, scorePercent: number): ReadingLevel {
  if (!READING_LEVELS.includes(level)) return level
  if (scorePercent >= 85) return adjustReadingLevel(level, 1)
  if (scorePercent <= 50) return adjustReadingLevel(level, -1)
  return adjustReadingLevel(level, 0)
}
