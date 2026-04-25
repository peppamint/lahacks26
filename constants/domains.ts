export type Domain =
  | 'accounting'
  | 'parenting'
  | 'legal'
  | 'healthcare'
  | 'employment'
  | 'housing'
  | 'education'
  | 'government'
  | 'finance'
  | 'general'

export const DOMAIN_LABELS: Record<Domain, string> = {
  accounting:  'Accounting & Tax',
  parenting:   'Parenting & Family',
  legal:       'Legal & Court',
  healthcare:  'Healthcare & Medical',
  employment:  'Employment & Work',
  housing:     'Housing & Utilities',
  education:   'Education & School',
  government:  'Government & Benefits',
  finance:     'Banking & Finance',
  general:     'General / Everyday',
}

export const DOMAINS: Domain[] = Object.keys(DOMAIN_LABELS) as Domain[]
