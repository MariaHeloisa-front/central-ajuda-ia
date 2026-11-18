import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="admin-header">
        <nav>
          <strong>Central de Ajuda · Time</strong>
          <NavLink to="/admin" end>Artigos</NavLink>
          <NavLink to="/admin/sem-resposta">Perguntas sem resposta</NavLink>
          <span className="spacer" />
          <a href="/" target="_blank" rel="noreferrer">Ver página do cliente</a>
          <button className="link" onClick={handleSignOut}>Sair</button>
        </nav>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </>
  )
}
