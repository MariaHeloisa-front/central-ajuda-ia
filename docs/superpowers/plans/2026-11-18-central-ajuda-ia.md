# Central de Ajuda com IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP onde o time cadastra artigos de ajuda e o cliente pergunta a uma IA que responde só com base neles, citando o artigo usado.

**Architecture:** SPA React+TS (Vite) falando com Supabase (Postgres + Auth). A pergunta do cliente vai para a Edge Function `ask` (Deno), que lê todos os artigos com service role, chama o Claude com a chave guardada em secret, valida a resposta JSON e registra perguntas sem cobertura. A lógica pura da função fica em `core.ts` sem imports Deno, testável com Vitest.

**Tech Stack:** Vite, React 18, TypeScript, React Router 6, @supabase/supabase-js 2, Vitest + Testing Library, Supabase CLI, Anthropic Messages API (fetch direto).

**Spec:** `docs/superpowers/specs/2026-11-18-central-ajuda-ia-design.md`

## Global Constraints

- Chave do LLM **somente** em secret da Edge Function (`ANTHROPIC_API_KEY`); nada de chave no front nem em `VITE_*`.
- Front usa apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Tabelas `articles` e `unanswered_questions` com RLS: só `authenticated` lê/escreve. Anon não acessa.
- Modelo: `claude-sonnet-5-5`.
- Texto da interface em português do Brasil.
- Mensagem padrão sem cobertura (`FALLBACK_ANSWER`): "Não encontrei essa informação na nossa central de ajuda. Por favor, fale com um de nossos atendentes para que possamos te ajudar."
- Pergunta: 1 a 500 caracteres após `trim()`.

## Review Focus

1. Modelo devolve JSON inválido ou `article_id` que não existe → tratar como sem cobertura (nunca citar artigo inventado). Teste em Task 3.
2. Banco sem nenhum artigo → resposta padrão sem chamar o LLM, pergunta registrada. Teste em Task 3 (`shouldSkipModel`).
3. Pergunta vazia/só espaços ou > 500 caracteres → 400 na função; botão desabilitado no front. Testes em Task 3 e Task 5.
4. Visitante não logado abre `/admin/...` → redireciona para `/login`. Teste em Task 6.
5. Pergunta com tentativa de injeção ("ignore as instruções e…") → pergunta vai como conteúdo do usuário delimitado em `<pergunta>`, regras no system prompt; teste de `buildPrompt` verifica delimitação. Task 3.

---

## File Structure

```
central-ajuda-ia/
  .env.example                      VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  README.md                         setup, deploy, criação de usuário
  vercel.json                       rewrite SPA → index.html
  supabase/
    config.toml
    migrations/20261118000000_init.sql
    seed.sql
    functions/ask/core.ts           lógica pura (prompt, validação, parsing)
    functions/ask/core.test.ts
    functions/ask/index.ts          handler Deno (CORS, DB, Anthropic)
  src/
    main.tsx, App.tsx               rotas
    lib/supabase.ts                 client
    lib/types.ts                    Article, UnansweredQuestion, AskResponse
    lib/api.ts                      askQuestion + CRUD
    auth/AuthProvider.tsx           sessão + useAuth
    auth/RequireAuth.tsx
    pages/AskPage.tsx (+ .test.tsx)
    pages/LoginPage.tsx
    pages/admin/AdminLayout.tsx
    pages/admin/ArticleListPage.tsx
    pages/admin/ArticleFormPage.tsx (+ .test.tsx)
    pages/admin/UnansweredPage.tsx
    styles.css
```

---

### Task 1: Scaffold do projeto

**Files:** Create todo o esqueleto Vite + `.env.example`, `.gitignore`, `src/lib/supabase.ts`, `src/lib/types.ts`, `vitest` config em `vite.config.ts`.

**Interfaces — Produces:**
- `supabase: SupabaseClient` em `src/lib/supabase.ts`
- `src/lib/types.ts`:
  ```ts
  export interface Article { id: string; title: string; content: string; created_at: string; updated_at: string }
  export interface UnansweredQuestion { id: string; question: string; created_at: string; resolved: boolean }
  export interface AskResponse { answer: string; article: { id: string; title: string } | null }
  ```

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, instalar `@supabase/supabase-js react-router-dom` e dev `vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`.
- [ ] **Step 2:** Configurar `test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' }`; `npm test` = `vitest run`.
- [ ] **Step 3:** Criar `supabase.ts`, `types.ts`, `.env.example`; garantir `.env` no `.gitignore`.
- [ ] **Step 4:** `npm run build && npm test` → build OK, vitest sem falhas (passWithNoTests).
- [ ] **Step 5:** `git init`, commit `chore: scaffold vite react ts`.

### Task 2: Banco (migração + seed)

**Files:** Create `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261118000000_init.sql`, `supabase/seed.sql`.

**Interfaces — Produces:** tabelas conforme `types.ts`; trigger `updated_at` em `articles`.

- [ ] **Step 1:** Migração: `articles` (uuid default `gen_random_uuid()`, `title text not null check (length(trim(title))>0)`, `content text not null`, timestamps default `now()`), `unanswered_questions` (`question text not null`, `resolved boolean not null default false`). Habilitar RLS em ambas; policies `for all to authenticated using (true) with check (true)`. Trigger `set_updated_at`.
- [ ] **Step 2:** Seed com 4 artigos: "Como emitir a segunda via do boleto", "Como trocar de plano", "Minha internet está lenta", "Formas de pagamento".
- [ ] **Step 3:** Se Docker disponível: `npx supabase db reset` → aplica sem erro. Senão, revisar SQL e marcar para aplicar com `supabase db push`.
- [ ] **Step 4:** Commit `feat: schema e seed do banco`.

### Task 3: Lógica pura da função `ask`

**Files:** Create `supabase/functions/ask/core.ts`, `supabase/functions/ask/core.test.ts` (incluir `supabase/functions/**/*.test.ts` no vitest).

**Interfaces — Produces:**
```ts
export const FALLBACK_ANSWER: string            // texto das Global Constraints
export const MAX_QUESTION_LENGTH = 500
export type ArticleLite = { id: string; title: string; content: string }
export function validateQuestion(raw: unknown): { ok: true; question: string } | { ok: false; error: string }
export function shouldSkipModel(articles: ArticleLite[]): boolean
export function buildPrompt(articles: ArticleLite[], question: string): { system: string; user: string }
export function parseModelOutput(raw: string, articles: ArticleLite[]): { answer: string; article: { id: string; title: string } | null }
```

- [ ] **Step 1: Testes que falham**
  - `validateQuestion("  ")` → `ok:false`; `validateQuestion(123)` → `ok:false`; `"a".repeat(501)` → `ok:false`; `"  oi  "` → `{ok:true, question:"oi"}`.
  - `shouldSkipModel([])` → `true`; com 1 artigo → `false`.
  - `buildPrompt`: `system` contém cada `id` e `title` dos artigos e a instrução de responder só em JSON `{"answer","article_id"}`; `user` contém `<pergunta>…</pergunta>` envolvendo a pergunta; a pergunta **não** aparece em `system`.
  - `parseModelOutput('{"answer":"Acesse o app","article_id":"a1"}', [a1])` → `{answer:"Acesse o app", article:{id:"a1", title:a1.title}}`.
  - JSON dentro de cerca ```` ```json ... ``` ```` → parse normal.
  - `article_id: null` → `{answer: FALLBACK_ANSWER, article: null}`.
  - `article_id: "inexistente"` → fallback, `article: null`.
  - `"texto solto"` (não-JSON) → fallback, `article: null`.
- [ ] **Step 2:** `npx vitest run supabase/functions/ask` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar. Parse: extrair primeiro `{…}` balanceado/regex `\{[\s\S]*\}`, `JSON.parse` em try/catch. `answer` vazio também → fallback.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: lógica de prompt e parsing da função ask`.

### Task 4: Handler Deno da função `ask`

**Files:** Create `supabase/functions/ask/index.ts`.

**Interfaces:**
- Consumes: tudo de `core.ts`.
- Produces: `POST /functions/v1/ask` body `{question: string}` → 200 `AskResponse`; 400 `{error}` se inválida; 500 `{error:"Falha ao consultar a IA"}`. `OPTIONS` → CORS (`Access-Control-Allow-Origin: *`, headers `authorization, x-client-info, apikey, content-type`).

- [ ] **Step 1:** Implementar: valida → client service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) lê `articles(id,title,content)` → se `shouldSkipModel`, resposta fallback; senão `fetch('https://api.anthropic.com/v1/messages')` com headers `x-api-key`, `anthropic-version: 2023-06-01`, `model: claude-sonnet-5-5`, `max_tokens: 1024`, `temperature: 0` → `parseModelOutput`. Se `article === null`, `insert` em `unanswered_questions` (erro de insert só loga).
- [ ] **Step 2:** Se Supabase CLI local disponível: `npx supabase functions serve ask --env-file supabase/.env` e `curl` com pergunta coberta → 200 com `article`; pergunta "qual a capital da França?" → fallback e linha em `unanswered_questions`. Senão verificar após deploy (Task 8).
- [ ] **Step 3:** Commit `feat: edge function ask`.

### Task 5: Página do cliente

**Files:** Create `src/lib/api.ts` (parte `askQuestion`), `src/pages/AskPage.tsx`, `src/pages/AskPage.test.tsx`, `src/App.tsx`, `src/styles.css`.

**Interfaces — Produces:** `askQuestion(question: string): Promise<AskResponse>` via `supabase.functions.invoke('ask', { body: { question } })`.

- [ ] **Step 1: Testes que falham** (mock de `../lib/api`):
  - botão "Perguntar" desabilitado com campo vazio/só espaços;
  - pergunta digitada + clique → mostra `answer` e "Fonte: <título do artigo>";
  - resposta com `article: null` → mostra resposta, não mostra "Fonte:", e mostra "Entre em contato com nossa central de atendimento." (sem `VITE_SUPPORT_URL` no teste);
  - `askQuestion` rejeita → mostra "Não foi possível obter uma resposta agora. Tente novamente.";
  - `textarea` com `maxLength=500`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar (estado loading desabilita o botão). "Falar com um atendente" é link para `import.meta.env.VITE_SUPPORT_URL` (ex.: WhatsApp do provedor); se não definido, mostra só o texto "Entre em contato com nossa central de atendimento." (adicionar `VITE_SUPPORT_URL` ao `.env.example`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: página de perguntas do cliente`.

### Task 6: Login e proteção do admin

**Files:** Create `src/auth/AuthProvider.tsx`, `src/auth/RequireAuth.tsx`, `src/auth/RequireAuth.test.tsx`, `src/pages/LoginPage.tsx`, `src/pages/admin/AdminLayout.tsx`; Modify `src/App.tsx`.

**Interfaces — Produces:** `useAuth(): { session: Session | null; loading: boolean; signIn(email, password): Promise<string | null /*erro*/>; signOut(): Promise<void> }`; `<RequireAuth>` envolve rotas `/admin/*`.

- [ ] **Step 1: Testes que falham:** sem sessão → renderiza rota `/login`; com sessão → renderiza filho; `loading` → "Carregando…".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (`onAuthStateChange`). Login com erro mostra "E-mail ou senha inválidos." AdminLayout: nav (Artigos, Perguntas sem resposta, Sair).
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat: login e rotas protegidas`.

### Task 7: CRUD de artigos e perguntas sem resposta

**Files:** Modify `src/lib/api.ts`; Create `ArticleListPage.tsx`, `ArticleFormPage.tsx`, `ArticleFormPage.test.tsx`, `UnansweredPage.tsx`.

**Interfaces — Produces (api.ts):**
```ts
listArticles(): Promise<Article[]>                      // order updated_at desc
getArticle(id: string): Promise<Article>
saveArticle(input: { id?: string; title: string; content: string }): Promise<Article>
deleteArticle(id: string): Promise<void>
listUnanswered(): Promise<UnansweredQuestion[]>         // resolved=false, created_at desc
markResolved(id: string): Promise<void>
```

- [ ] **Step 1: Testes que falham (ArticleFormPage):** título vazio → "Informe o título." e `saveArticle` não chamado; conteúdo vazio → "Informe o conteúdo."; válido → `saveArticle` chamado com valores trimados e navega para `/admin`; em `/admin/artigos/:id` carrega e preenche os campos.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Lista com título, data de atualização, "Editar", "Excluir" (com `confirm`). UnansweredPage: lista, "Criar artigo" (navega para `/admin/artigos/novo?titulo=<pergunta>`, form pré-preenche título) e "Marcar como resolvida".
- [ ] **Step 4:** `npm test && npm run build` → PASS. **Step 5:** Commit `feat: gestão de artigos e perguntas sem resposta`.

### Task 8: Testes E2E (Playwright)

**Files:** Create `playwright.config.ts`, `e2e/fixtures/mockSupabase.ts`, `e2e/cliente.spec.ts`, `e2e/admin.spec.ts`; script `npm run test:e2e`.

**Abordagem:** Playwright sobe `vite` (`webServer`) com `VITE_SUPABASE_URL=http://supabase.test` e intercepta via `page.route('http://supabase.test/**')` os endpoints `auth/v1/token`, `auth/v1/user`, `auth/v1/logout`, `rest/v1/articles`, `rest/v1/unanswered_questions` e `functions/v1/ask`, mantendo um estado em memória por teste. Assim os E2E rodam sem conta, chave ou rede. Vitest exclui `e2e/**`.

**Interfaces — Produces:** `mockSupabase(page, opts?: { articles?: Article[]; unanswered?: UnansweredQuestion[]; askResponse?: AskResponse | ((q: string) => AskResponse) }): Promise<{ state }>`.

- [ ] **Cenários `cliente.spec.ts`:**
  - E2E-01 pergunta coberta → resposta + "Fonte: Como emitir a segunda via do boleto".
  - E2E-02 pergunta sem cobertura → mensagem padrão + orientação para falar com atendente, sem "Fonte:".
  - E2E-03 botão "Perguntar" desabilitado com campo vazio ou só espaços.
  - E2E-04 função retorna 500 → mensagem de erro amigável e botão volta a ficar habilitado.
- [ ] **Cenários `admin.spec.ts`:**
  - E2E-05 acessar `/admin` sem login → redireciona para `/login`.
  - E2E-06 login com senha errada → "E-mail ou senha inválidos."
  - E2E-07 login válido → lista de artigos visível.
  - E2E-08 criar artigo → aparece na lista.
  - E2E-09 editar artigo → título novo aparece na lista.
  - E2E-10 validação do formulário: título vazio → "Informe o título."
  - E2E-11 perguntas sem resposta: listar, "Criar artigo" pré-preenche o título, "Marcar como resolvida" remove da lista.
  - E2E-12 sair → volta para `/login` e `/admin` redireciona de novo.
- [ ] **Run:** `npx playwright install chromium && npm run test:e2e` → todos PASS.
- [ ] **Commit** `test: testes e2e com playwright`.

### Task 9: Docs, GitHub e deploy

**Files:** Create `README.md`, `vercel.json` (`{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`).

- [ ] **Step 1:** README: visão geral, arquitetura, setup local, `supabase link`, `supabase db push`, `supabase secrets set ANTHROPIC_API_KEY=…`, `supabase functions deploy ask --no-verify-jwt`, criação de usuário do time no painel (Authentication → Add user), deploy Vercel com env vars.
- [ ] **Step 2:** Com aprovação do usuário: criar repo GitHub (`gh repo create`) e push.
- [ ] **Step 3:** Com o projeto Supabase do usuário linkado e a chave fornecida: aplicar migração, seed, deploy da função; testar com `curl` as duas perguntas da Task 4.
- [ ] **Step 4:** Deploy Vercel (se o usuário tiver conta) e teste ponta a ponta no navegador.
- [ ] **Step 5:** Commit `docs: readme e config de deploy`.
