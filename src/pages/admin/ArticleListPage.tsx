import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteArticle, listArticles } from '../../lib/api'
import type { Article } from '../../lib/types'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function ArticleListPage() {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listArticles()
      .then(setArticles)
      .catch(() => setError('Não foi possível carregar os artigos.'))
  }, [])

  async function handleDelete(article: Article) {
    if (!window.confirm(`Excluir o artigo "${article.title}"?`)) return
    try {
      await deleteArticle(article.id)
      setArticles((list) => list?.filter((a) => a.id !== article.id) ?? null)
    } catch {
      setError('Não foi possível excluir o artigo.')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Artigos de ajuda</h1>
        <Link className="button" to="/admin/artigos/novo">Novo artigo</Link>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <section className="card">
        {articles === null && !error && <p>Carregando…</p>}
        {articles?.length === 0 && <p className="muted">Nenhum artigo cadastrado ainda.</p>}
        {articles && articles.length > 0 && (
          <ul className="list" aria-label="Artigos">
            {articles.map((a) => (
              <li key={a.id}>
                <div>
                  <div className="title">{a.title}</div>
                  <div className="muted">Atualizado em {dateFormat.format(new Date(a.updated_at))}</div>
                </div>
                <div className="actions">
                  <Link className="button secondary" to={`/admin/artigos/${a.id}`}>Editar</Link>
                  <button className="danger" onClick={() => handleDelete(a)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
