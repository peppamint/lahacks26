import type { NewsArticle } from './claude'

const API_KEY = process.env['EXPO_PUBLIC_GUARDIAN_API_KEY'] ?? ''

const GUARDIAN_URL =
  'https://content.guardianapis.com/search' +
  '?show-fields=bodyText,byline,trailText' +
  '&page-size=8' +
  '&order-by=newest' +
  '&sections=world,science,culture,technology,environment'

interface GuardianField {
  bodyText?: string
  byline?: string
  trailText?: string
}

interface GuardianResult {
  webTitle: string
  webUrl: string
  sectionName: string
  fields?: GuardianField
}

interface GuardianResponse {
  response: {
    results: GuardianResult[]
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

export async function fetchNewsArticles(): Promise<NewsArticle[]> {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_GUARDIAN_API_KEY is not set')

  const res = await fetch(`${GUARDIAN_URL}&api-key=${API_KEY}`)
  if (!res.ok) throw new Error(`Guardian API error: ${res.status}`)

  const json = await res.json() as GuardianResponse
  const results = json.response?.results ?? []

  return results
    .filter((r) => r.fields?.bodyText)
    .map((r) => ({
      title:     r.webTitle,
      summary:   stripHtml(r.fields?.trailText ?? ''),
      author:    r.fields?.byline ?? 'The Guardian',
      publisher: 'The Guardian',
      url:       r.webUrl,
      content:   r.fields?.bodyText ?? '',
    }))
}
