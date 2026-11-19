// Edge Function `ask` — recebe a pergunta do cliente e responde com base nos artigos.
// A chave do LLM fica apenas no secret ANTHROPIC_API_KEY (nunca no front).
// Sem ANTHROPIC_API_KEY, roda em modo de teste: escolhe o artigo por palavras-chave (sem IA).
import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0'
import { createClient } from 'npm:@supabase/supabase-js@2.119.1'
import {
  FALLBACK_ANSWER,
  buildPrompt,
  parseModelOutput,
  shouldSkipModel,
  simulatedAnswer,
  validateQuestion,
  type ArticleLite,
  type AskResult,
} from './core.ts'

const MODEL = 'claude-opus-5-5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
const anthropic = apiKey ? new Anthropic({ apiKey }) : null
if (!anthropic) console.warn('ANTHROPIC_API_KEY não definida: função `ask` em modo de teste (respostas simuladas).')

async function askModel(anthropic: Anthropic, articles: ArticleLite[], question: string): Promise<AskResult> {
  const { system, user } = buildPrompt(articles, question)
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            article_id: { type: ['string', 'null'] },
          },
          required: ['answer', 'article_id'],
          additionalProperties: false,
        },
      },
    },
    system,
    messages: [{ role: 'user', content: user }],
  })

  if (response.stop_reason === 'refusal') return { answer: FALLBACK_ANSWER, article: null }
  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
  return parseModelOutput(text, articles)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  let body: { question?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }

  const validation = validateQuestion(body?.question)
  if (!validation.ok) return json({ error: validation.error }, 400)
  const question = validation.question

  try {
    const { data, error } = await supabase.from('articles').select('id, title, content')
    if (error) throw error
    const articles = (data ?? []) as ArticleLite[]

    const result: AskResult = !anthropic
      ? simulatedAnswer(articles, question)
      : shouldSkipModel(articles)
        ? { answer: FALLBACK_ANSWER, article: null }
        : await askModel(anthropic, articles, question)

    if (result.article === null) {
      const { error: insertError } = await supabase
        .from('unanswered_questions')
        .insert({ question })
      if (insertError) console.error('Falha ao registrar pergunta sem resposta:', insertError)
    }

    return json(result)
  } catch (err) {
    console.error('Erro na função ask:', err)
    return json({ error: 'Falha ao consultar a IA' }, 500)
  }
})
