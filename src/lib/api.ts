import { supabase } from './supabase'
import type { Article, AskResponse, UnansweredQuestion } from './types'

export async function askQuestion(question: string): Promise<AskResponse> {
  const { data, error } = await supabase.functions.invoke<AskResponse>('ask', { body: { question } })
  if (error || !data) throw error ?? new Error('Resposta vazia')
  return data
}

// ---- Área do time (requer sessão; RLS bloqueia anônimos) ----

export async function listArticles(): Promise<Article[]> {
  const { data, error } = await supabase.from('articles').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getArticle(id: string): Promise<Article> {
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function saveArticle(input: { id?: string; title: string; content: string }): Promise<Article> {
  const { id, ...fields } = input
  const query = id
    ? supabase.from('articles').update(fields).eq('id', id)
    : supabase.from('articles').insert(fields)
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) throw error
}

export async function listUnanswered(): Promise<UnansweredQuestion[]> {
  const { data, error } = await supabase
    .from('unanswered_questions')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function markResolved(id: string): Promise<void> {
  const { error } = await supabase.from('unanswered_questions').update({ resolved: true }).eq('id', id)
  if (error) throw error
}
