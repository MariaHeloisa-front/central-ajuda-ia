import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import RequireAuth from './RequireAuth'
import { useAuth } from './AuthProvider'

vi.mock('./AuthProvider', () => ({ useAuth: vi.fn() }))
const useAuthMock = vi.mocked(useAuth)

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <p>Área do time</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function authState(partial: Partial<ReturnType<typeof useAuth>>) {
  return {
    session: null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...partial,
  } as ReturnType<typeof useAuth>
}

describe('RequireAuth', () => {
  it('redireciona para /login sem sessão', () => {
    useAuthMock.mockReturnValue(authState({ session: null }))
    renderAt('/admin')
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('mostra o conteúdo com sessão', () => {
    useAuthMock.mockReturnValue(authState({ session: { user: { id: 'u1' } } as never }))
    renderAt('/admin')
    expect(screen.getByText('Área do time')).toBeInTheDocument()
  })

  it('mostra carregando enquanto verifica a sessão', () => {
    useAuthMock.mockReturnValue(authState({ loading: true }))
    renderAt('/admin')
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })
})
