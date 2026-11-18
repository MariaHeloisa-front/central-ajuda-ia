# Central de Ajuda com IA — Design (MVP)

## Intenção
O time de atendimento de um provedor de internet de Recife responde sempre as mesmas dúvidas (segunda via de boleto, troca de plano, internet lenta…). As respostas estão espalhadas em documentos e na cabeça dos atendentes. O MVP centraliza as respostas oficiais e deixa o cliente tirar dúvidas com uma IA que responde **somente** com base nelas.

## Objetivos
- Área do time: cadastrar, editar e listar artigos (título + conteúdo). **Obrigatório**
- Página do cliente: pergunta → resposta da IA baseada nos artigos. **Obrigatório**
- Resposta mostra o artigo usado; sem cobertura → "não sei, fale com um atendente". **Obrigatório**
- Login protegendo a área do time. **Desejável**
- Registro de perguntas sem resposta, visível ao time. **Extra**

## Não-objetivos
Busca vetorial/embeddings, histórico de conversa (multi-turno), cadastro de usuários pela UI, categorias/tags, analytics.

## Anti-objetivos
- IA inventar resposta fora dos artigos (pior falha possível: informação errada sobre cobrança/plano).
- Chave do LLM exposta no front.

## Restrições
React + TypeScript; Supabase (conta já existe); código no GitHub; deploy se der tempo.

## Abordagens consideradas
1. **Todos os artigos no prompt (escolhida)** — Edge Function busca todos os artigos e envia ao LLM. Simples, preciso na escala de dezenas/centenas de artigos.
2. Embeddings + pgvector — escala melhor, mas mais peças (indexação, re-embed ao editar) sem ganho no tamanho do MVP.
3. Backend Node separado — funciona, mas é mais um serviço para hospedar; a Edge Function do Supabase já resolve o segredo da chave.

## Design
- **Front:** Vite + React + TS + React Router. Rotas: `/` (cliente), `/login`, `/admin` (lista), `/admin/artigos/novo`, `/admin/artigos/:id`, `/admin/sem-resposta`.
- **Banco (Supabase Postgres):**
  - `articles(id uuid, title text, content text, created_at, updated_at)`
  - `unanswered_questions(id uuid, question text, created_at, resolved bool default false)`
  - RLS: leitura/escrita de ambas só para `authenticated`. O público não acessa as tabelas diretamente — só via Edge Function.
- **Auth:** Supabase Auth, e-mail + senha. Usuários do time criados no painel do Supabase (sem cadastro público).
- **Edge Function `ask`:** recebe `{question}`; lê artigos com service role; chama o LLM com prompt de sistema restrito ("responda apenas com base nos artigos; se não houver cobertura, article_id = null") pedindo JSON `{answer, article_id}`; valida que `article_id` existe; se `null`, grava em `unanswered_questions` e retorna mensagem padrão sugerindo atendente. Retorna `{answer, article: {id, title} | null}`.
- **LLM:** Claude (Anthropic) via secret `ANTHROPIC_API_KEY` na Edge Function — *decisão minha*, trocável se o cliente usar outro provedor.
- **Deploy:** GitHub + Vercel (front); Edge Function via Supabase CLI.
- **Seed:** 3–4 artigos de exemplo (segunda via, troca de plano, internet lenta) para demo.

## Deixado ao implementador
Estilo visual (limpo, responsivo, sem biblioteca pesada), mensagens de erro, estrutura de pastas.
