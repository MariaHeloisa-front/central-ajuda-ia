import { supabase } from './supabase'
import type { AskResponse } from './types'

export async function askQuestion(question: string): Promise<AskResponse> {
  const { data, error } = await supabase.functions.invoke<AskResponse>('ask', { body: { question } })
  if (error || !data) throw error ?? new Error('Resposta vazia')
  return data
}
