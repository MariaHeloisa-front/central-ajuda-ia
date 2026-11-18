import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getArticle, saveArticle } from '../../lib/api'

export default function ArticleFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [title, setTitle] = useState(() => searchParams.get('titulo') ?? '')
  const [content, setContent] = useState('')
  const [errors, setErrors] = useState<{ title?: string; content?: string; form?: string }>({})
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    getArticle(id)
      .then((a) => {
        setTitle(a.title)
        setContent(a.content)
      })
      .catch(() => setErrors({ form: 'Não foi possível carregar o artigo.' }))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const c = content.trim()
    const next: typeof errors = {}
    if (!t) next.title = 'Informe o título.'
    if (!c) next.content = 'Informe o conteúdo.'
    setErrors(next)
    if (next.title || next.content) return

    setSaving(true)
    try {
      await saveArticle(id ? { id, title: t, content: c } : { title: t, content: c })
      navigate('/admin')
    } catch {
      setErrors({ form: 'Não foi possível salvar o artigo. Tente novamente.' })
      setSaving(false)
    }
  }

  if (loading) return <p>Carregando…</p>

  return (
    <>
      <div className="page-header">
        <h1>{id ? 'Editar artigo' : 'Novo artigo'}</h1>
        <Link to="/admin">Voltar</Link>
      </div>
      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <p className="error-text">{errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="content">Conteúdo</label>
          <textarea id="content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
          {errors.content && <p className="error-text">{errors.content}</p>}
        </div>
        {errors.form && <p className="alert alert-error" role="alert">{errors.form}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </>
  )
}
