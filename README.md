# Central de Ajuda com IA

MVP de central de ajuda para um provedor de internet. O time de atendimento cadastra as respostas oficiais (artigos) e o cliente tira dúvidas com uma IA que responde **somente** com base nesses artigos, mostrando qual artigo foi usado. Quando nenhum artigo cobre a pergunta, a IA diz que não sabe, sugere falar com um atendente e a pergunta fica registrada para o time criar um novo artigo.

## Funcionalidades

| Requisito | Onde |
|---|---|
| Cadastrar, editar, listar (e excluir) artigos | `/admin` |
| Cliente pergunta e recebe resposta da IA com base nos artigos | `/` |
| Resposta mostra o artigo usado; sem cobertura → "não sei, fale com um atendente" | `/` + Edge Function `ask` |
| Login protegendo a área do time | `/login` (Supabase Auth) |
| Registro das perguntas sem resposta | `/admin/sem-resposta` |

## Arquitetura

```
Navegador (React + TS, Vite)
 ├─ /            ── supabase.functions.invoke('ask') ──► Edge Function `ask` (Deno)
 │                                                        ├─ lê artigos (service role)
 │                                                        ├─ chama o Claude (chave só no secret)
 │                                                        └─ grava pergunta sem resposta
 └─ /admin/*     ── supabase-js (usuário logado) ──────► Postgres (RLS: só authenticated)
```

- **A chave do LLM nunca vai para o front**: ela fica no secret `ANTHROPIC_API_KEY` da Edge Function.
- As tabelas têm RLS: visitantes anônimos não leem nem escrevem nada diretamente; a página pública só fala com a função `ask`.
- A IA recebe todos os artigos no prompt (adequado para dezenas/centenas de artigos) e responde em JSON estruturado `{answer, article_id}`. A função valida o `article_id`: se for nulo, inválido ou inexistente, devolve a mensagem padrão — a IA nunca cita um artigo inventado.
- Modelo: `claude-opus-5-5` (constante `MODEL` em `supabase/functions/ask/index.ts`).

## Estrutura

```
src/                     front-end React
  pages/AskPage.tsx      página do cliente
  pages/admin/*          área do time
  auth/*                 login e rotas protegidas
  lib/api.ts             chamadas ao Supabase
supabase/
  migrations/            schema + RLS
  seed.sql               artigos de exemplo (conteúdo fictício para demonstração)
  functions/ask/         Edge Function (core.ts = lógica pura testada)
e2e/                     testes ponta a ponta (Playwright, Supabase mockado)
```

## Rodando localmente

Pré-requisitos: Node 20+ e um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Configurando o Supabase

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push                                   # cria tabelas e RLS
npx supabase secrets set ANTHROPIC_API_KEY=<sua-chave>
npx supabase functions deploy ask --no-verify-jwt      # pública: o cliente não faz login
```

Artigos de exemplo: rode o conteúdo de `supabase/seed.sql` no SQL Editor do painel.

**Usuários do time:** no painel, *Authentication → Users → Add user* (e-mail e senha). Não há cadastro público. Recomenda-se desativar *Allow new users to sign up* em *Authentication → Sign In / Providers*.

## Testes

```bash
npm test               # unitários (Vitest): lógica da IA, página do cliente, formulário, proteção de rotas
npx playwright install chromium
npm run test:e2e       # ponta a ponta (Playwright)
```

Os testes E2E não precisam de conta nem de chave: o Supabase (Auth, REST e a função `ask`) é interceptado na rede por `e2e/fixtures/mockSupabase.ts`.

| ID | Cenário |
|---|---|
| E2E-01 | Pergunta coberta mostra resposta e "Fonte: <artigo>" |
| E2E-02 | Pergunta sem cobertura mostra mensagem padrão e orienta falar com atendente |
| E2E-03 | Botão "Perguntar" desabilitado com campo vazio/só espaços |
| E2E-04 | Falha da IA mostra erro amigável e permite tentar de novo |
| E2E-05 | `/admin` sem login redireciona para `/login` |
| E2E-06 | Senha errada mostra "E-mail ou senha inválidos." |
| E2E-07 | Login válido mostra a lista de artigos |
| E2E-08 | Criar artigo faz ele aparecer na lista |
| E2E-09 | Editar artigo atualiza o título na lista |
| E2E-10 | Formulário exige título |
| E2E-11 | Perguntas sem resposta: marcar como resolvida e criar artigo a partir da pergunta |
| E2E-12 | Sair volta para `/login` e bloqueia a área do time |

## Deploy do front (Vercel)

1. Importe o repositório na Vercel (framework: Vite).
2. Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, opcionalmente, `VITE_SUPPORT_URL` (ex.: link do WhatsApp do atendimento).
3. `vercel.json` já redireciona todas as rotas para o `index.html` (SPA).
