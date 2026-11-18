import type { Page, Route } from '@playwright/test'
import type { Article, AskResponse, UnansweredQuestion } from '../../src/lib/types'

export const SUPABASE_URL = 'http://supabase.test'
export const VALID_EMAIL = 'atendente@provedor.com.br'
export const VALID_PASSWORD = 'senha-correta'

export const FALLBACK_ANSWER =
  'Não encontrei essa informação na nossa central de ajuda. Por favor, fale com um de nossos atendentes para que possamos te ajudar.'

export function makeArticle(partial: Partial<Article> & Pick<Article, 'id' | 'title'>): Article {
  return {
    content: `Conteúdo de ${partial.title}`,
    created_at: '2026-11-18T12:00:00Z',
    updated_at: '2026-11-18T12:00:00Z',
    ...partial,
  }
}

export const SEED_ARTICLES: Article[] = [
  makeArticle({
    id: 'a1',
    title: 'Como emitir a segunda via do boleto',
    content: 'Acesse o app em Financeiro > Faturas e toque em Segunda via.',
  }),
  makeArticle({ id: 'a2', title: 'Como trocar de plano', content: 'Área do Cliente > Meu plano > Alterar plano.' }),
]

export interface MockOptions {
  articles?: Article[]
  unanswered?: UnansweredQuestion[]
  /** Resposta da função `ask`; `'error'` simula falha 500. */
  ask?: AskResponse | 'error' | ((question: string) => AskResponse)
}

export interface MockState {
  articles: Article[]
  unanswered: UnansweredQuestion[]
  askCalls: string[]
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': '*',
}

function reply(route: Route, status: number, body?: unknown) {
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  })
}

/** Lê o filtro PostgREST `coluna=eq.valor` da query string. */
function eqFilter(url: URL, column: string): string | null {
  const v = url.searchParams.get(column)
  return v?.startsWith('eq.') ? v.slice(3) : null
}

function wantsSingle(route: Route) {
  return (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
}

function sessionFor(email: string) {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: 'e2e-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: 'user-1',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

/**
 * Intercepta todas as chamadas ao Supabase (Auth, REST e Edge Function `ask`)
 * mantendo um estado em memória por teste. Não usa rede, conta nem chave.
 */
export async function mockSupabase(page: Page, opts: MockOptions = {}): Promise<MockState> {
  const state: MockState = {
    articles: structuredClone(opts.articles ?? SEED_ARTICLES),
    unanswered: structuredClone(opts.unanswered ?? []),
    askCalls: [],
  }
  let nextId = 1

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const path = url.pathname

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    // ---- Auth ----
    if (path === '/auth/v1/token') {
      const { email, password } = req.postDataJSON() as { email: string; password: string }
      if (email === VALID_EMAIL && password === VALID_PASSWORD) return reply(route, 200, sessionFor(email))
      return reply(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })
    if (path === '/auth/v1/user') return reply(route, 200, sessionFor(VALID_EMAIL).user)

    // ---- Edge Function ----
    if (path === '/functions/v1/ask') {
      const { question } = req.postDataJSON() as { question: string }
      state.askCalls.push(question)
      if (opts.ask === 'error') return reply(route, 500, { error: 'Falha ao consultar a IA' })
      const res =
        typeof opts.ask === 'function' ? opts.ask(question) : (opts.ask ?? { answer: FALLBACK_ANSWER, article: null })
      return reply(route, 200, res)
    }

    // ---- REST: articles ----
    if (path === '/rest/v1/articles') {
      const id = eqFilter(url, 'id')
      if (method === 'GET') {
        if (id) {
          const found = state.articles.find((a) => a.id === id)
          return found ? reply(route, 200, found) : reply(route, 406, { message: 'not found' })
        }
        const sorted = [...state.articles].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        return reply(route, 200, sorted)
      }
      if (method === 'POST') {
        const body = req.postDataJSON() as { title: string; content: string }
        const now = new Date().toISOString()
        const created: Article = { id: `new-${nextId++}`, ...body, created_at: now, updated_at: now }
        state.articles.push(created)
        return reply(route, 201, wantsSingle(route) ? created : [created])
      }
      if (method === 'PATCH' && id) {
        const body = req.postDataJSON() as Partial<Article>
        const article = state.articles.find((a) => a.id === id)
        if (!article) return reply(route, 406, { message: 'not found' })
        Object.assign(article, body, { updated_at: new Date().toISOString() })
        return reply(route, 200, wantsSingle(route) ? article : [article])
      }
      if (method === 'DELETE' && id) {
        state.articles = state.articles.filter((a) => a.id !== id)
        return route.fulfill({ status: 204, headers: CORS })
      }
    }

    // ---- REST: unanswered_questions ----
    if (path === '/rest/v1/unanswered_questions') {
      const id = eqFilter(url, 'id')
      if (method === 'GET') {
        const onlyOpen = eqFilter(url, 'resolved') === 'false'
        const list = state.unanswered
          .filter((q) => !onlyOpen || !q.resolved)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
        return reply(route, 200, list)
      }
      if (method === 'PATCH' && id) {
        const body = req.postDataJSON() as Partial<UnansweredQuestion>
        const q = state.unanswered.find((x) => x.id === id)
        if (q) Object.assign(q, body)
        return route.fulfill({ status: 204, headers: CORS })
      }
    }

    return reply(route, 404, { message: `Rota não mockada: ${method} ${path}` })
  })

  return state
}

/** Faz login pela UI com as credenciais válidas do mock. */
export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(VALID_EMAIL)
  await page.getByLabel('Senha').fill(VALID_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/admin')
}
