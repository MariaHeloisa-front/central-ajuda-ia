-- Projetos novos do Supabase não concedem privilégios automáticos às roles da API
-- em tabelas novas do schema public. Sem isto, a Edge Function (service_role) e o
-- time logado (authenticated) recebem "permission denied".
-- `anon` não recebe nada: a página pública só fala com a função `ask`.

grant select, insert, update, delete on public.articles to authenticated, service_role;
grant select, insert, update, delete on public.unanswered_questions to authenticated, service_role;
