import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

type InteractionMode = 'mcq' | 'text' | 'speech' | 'hybrid'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json() as {
      lessonId: string
      title: string
      forceRefresh?: boolean
      passages: Array<{ title: string; content: string }>
      generatedQuestions: Array<{
        prompt: string
        choices: string[]
        correctIndex: number
        questionTypeId: string
        interactionMode: InteractionMode
      }>
    }

    const slug = `lesson-${body.lessonId}`
    let { data: lesson, error: lessonErr } = await admin
      .from('lessons')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!lesson) {
      const { data: created, error: createErr } = await admin
        .from('lessons')
        .insert({
          slug,
          title: body.title,
          lesson_type: body.generatedQuestions.length > 2 ? 'macro' : 'micro',
          min_reading_level: 'grade1',
          max_reading_level: 'adult',
          base_difficulty: 0.5,
          is_published: true,
          is_active: true,
        })
        .select('id')
        .single()

      if (createErr || !created) {
        return new Response(
          JSON.stringify({ error: 'Lesson create failed', detail: createErr?.message ?? lessonErr?.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      lesson = created
    }

    await admin
      .from('lessons')
      .update({ title: body.title, updated_at: new Date().toISOString() })
      .eq('id', lesson.id)

    if (body.forceRefresh) {
      await admin.from('questions').delete().eq('lesson_id', lesson.id)
      await admin.from('lesson_passages').delete().eq('lesson_id', lesson.id)
    }

    for (let i = 0; i < body.passages.length; i++) {
      const p = body.passages[i]
      await admin.from('lesson_passages').upsert(
        {
          lesson_id: lesson.id,
          passage_order: i + 1,
          title: p.title,
          content: p.content,
          difficulty: 0.5,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lesson_id,passage_order' },
      )
    }

    const persistedQuestions: Array<{
      id: string
      question_type_id: string
      prompt: string
      choices: string[]
      answer_key: { correctIndex?: number }
      interaction_mode: InteractionMode
      difficulty: number
    }> = []

    for (let i = 0; i < body.generatedQuestions.length; i++) {
      const q = body.generatedQuestions[i]
      const { data } = await admin
        .from('questions')
        .insert({
          lesson_id: lesson.id,
          question_order: i + 1,
          question_type_id: q.questionTypeId,
          interaction_mode: q.interactionMode,
          prompt: q.prompt,
          choices: q.choices,
          answer_key: { correctIndex: q.correctIndex },
          difficulty: 0.5,
          is_active: true,
        })
        .select('id,question_type_id,prompt,choices,answer_key,interaction_mode,difficulty')
        .single()

      if (data) persistedQuestions.push(data)
    }

    return new Response(JSON.stringify({ questions: persistedQuestions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Unhandled error',
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
