export interface Article {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface UnansweredQuestion {
  id: string
  question: string
  created_at: string
  resolved: boolean
}

export interface AskResponse {
  answer: string
  article: { id: string; title: string } | null
  /** true quando a função está em modo de teste (sem chave da IA). */
  simulated?: boolean
}
