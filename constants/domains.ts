// The 5 learner-facing domains used in the diagnostic and lesson modules.
// To add a domain: add the value here, add a label below, and add sample
// passages in services/claude.ts → generateDomainPassage().
export type Domain = 'legal' | 'work' | 'parenting' | 'news' | 'social'

export const DOMAIN_LABELS: Record<Domain, string> = {
  legal:     'Legal & Government',
  work:      'Work & Professional',
  parenting: 'Parenting & Family',
  news:      'News & Current Events',
  social:    'Social & Everyday',
}

export const DOMAINS: Domain[] = Object.keys(DOMAIN_LABELS) as Domain[]
