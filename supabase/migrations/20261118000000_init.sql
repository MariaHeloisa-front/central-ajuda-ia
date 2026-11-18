-- Artigos de ajuda (respostas oficiais do time)
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perguntas que a IA não conseguiu responder
create table public.unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

-- RLS: somente o time autenticado lê/escreve. O público usa a Edge Function `ask`.
alter table public.articles enable row level security;
alter table public.unanswered_questions enable row level security;

create policy "time gerencia artigos" on public.articles
  for all to authenticated using (true) with check (true);

create policy "time gerencia perguntas sem resposta" on public.unanswered_questions
  for all to authenticated using (true) with check (true);
