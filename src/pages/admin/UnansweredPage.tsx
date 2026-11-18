import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listUnanswered, markResolved } from '../../lib/api'
import type { UnansweredQuestion } from '../../lib/types'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function UnansweredPage() {
  const [questions, setQuestions] = useState<UnansweredQuestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listUnanswered()
      .then(setQuestions)
      .catch(() => setError('Não foi possível carregar as perguntas.'))
  }, [])

  async function handleResolve(id: string) {
    try {
      await markResolved(id)
      setQuestions((list) => list?.filter((q) => q.id !== id) ?? null)
    } catch {
      setError('Não foi possível atualizar a pergunta.')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Perguntas sem resposta</h1>
      </div>
      <p className="muted">Perguntas de clientes que nenhum artigo cobriu. Use-as para criar novos artigos.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <section className="card">
        {questions === null && !error && <p>Carregando…</p>}
        {questions?.length === 0 && <p className="muted">Nenhuma pergunta pendente. 🎉</p>}
        {questions && questions.length > 0 && (
          <ul className="list" aria-label="Perguntas sem resposta">
            {questions.map((q) => (
              <li key={q.id}>
                <div>
                  <div className="title">{q.question}</div>
                  <div className="muted">{dateFormat.format(new Date(q.created_at))}</div>
                </div>
                <div className="actions">
                  <Link className="button secondary" to={`/admin/artigos/novo?titulo=${encodeURIComponent(q.question)}`}>
                    Criar artigo
                  </Link>
                  <button className="secondary" onClick={() => handleResolve(q.id)}>Marcar como resolvida</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
