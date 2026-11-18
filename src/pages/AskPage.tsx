import { useState, type FormEvent } from 'react'
import { askQuestion } from '../lib/api'
import type { AskResponse } from '../lib/types'

const MAX_LENGTH = 500
const SUPPORT_URL: string | undefined = import.meta.env.VITE_SUPPORT_URL || undefined

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = question.trim().length > 0 && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await askQuestion(question.trim()))
    } catch {
      setError('Não foi possível obter uma resposta agora. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>Central de Ajuda</h1>
        <p>Tire suas dúvidas sobre boletos, planos, conexão e muito mais.</p>
      </header>

      <form className="card ask-form" onSubmit={handleSubmit}>
        <label htmlFor="question">Sua pergunta</label>
        <textarea
          id="question"
          value={question}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="Ex.: Como emito a segunda via do meu boleto?"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="form-footer">
          <span className="muted">{question.length}/{MAX_LENGTH}</span>
          <button type="submit" disabled={!canSubmit}>
            {loading ? 'Consultando…' : 'Perguntar'}
          </button>
        </div>
      </form>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {result && (
        <section className="card answer" aria-live="polite">
          <p className="answer-text">{result.answer}</p>
          {result.article ? (
            <p className="source">Fonte: {result.article.title}</p>
          ) : (
            <div className="support">
              {SUPPORT_URL ? (
                <a className="button" href={SUPPORT_URL} target="_blank" rel="noreferrer">
                  Falar com um atendente
                </a>
              ) : (
                <p>Entre em contato com nossa central de atendimento.</p>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
