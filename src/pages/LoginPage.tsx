import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setSubmitting(false)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  return (
    <main className="container">
      <form className="card login-box" onSubmit={handleSubmit}>
        <h1>Área do time</h1>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
