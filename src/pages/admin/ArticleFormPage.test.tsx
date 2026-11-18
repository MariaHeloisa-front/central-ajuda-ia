import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ArticleFormPage from './ArticleFormPage'
import { getArticle, saveArticle } from '../../lib/api'

vi.mock('../../lib/api', () => ({ getArticle: vi.fn(), saveArticle: vi.fn() }))
const getMock = vi.mocked(getArticle)
const saveMock = vi.mocked(saveArticle)

const article = {
  id: 'a1',
  title: 'Como trocar de plano',
  content: 'Área do Cliente > Meu plano.',
  created_at: '2026-11-18T00:00:00Z',
  updated_at: '2026-11-18T00:00:00Z',
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<p>Lista de artigos</p>} />
        <Route path="/admin/artigos/novo" element={<ArticleFormPage />} />
        <Route path="/admin/artigos/:id" element={<ArticleFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ArticleFormPage', () => {
  beforeEach(() => {
    getMock.mockReset()
    saveMock.mockReset()
  })

  it('exige título', async () => {
    renderAt('/admin/artigos/novo')
    await userEvent.type(screen.getByLabelText('Conteúdo'), 'Algum conteúdo')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o título.')).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('exige conteúdo', async () => {
    renderAt('/admin/artigos/novo')
    await userEvent.type(screen.getByLabelText('Título'), 'Um título')
    await userEvent.type(screen.getByLabelText('Conteúdo'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o conteúdo.')).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('salva com valores sem espaços nas pontas e volta para a lista', async () => {
    saveMock.mockResolvedValue(article)
    renderAt('/admin/artigos/novo')
    await userEvent.type(screen.getByLabelText('Título'), '  Novo artigo  ')
    await userEvent.type(screen.getByLabelText('Conteúdo'), '  Texto oficial  ')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(saveMock).toHaveBeenCalledWith({ title: 'Novo artigo', content: 'Texto oficial' })
    expect(await screen.findByText('Lista de artigos')).toBeInTheDocument()
  })

  it('carrega o artigo ao editar e salva com o id', async () => {
    getMock.mockResolvedValue(article)
    saveMock.mockResolvedValue(article)
    renderAt('/admin/artigos/a1')
    expect(await screen.findByDisplayValue('Como trocar de plano')).toBeInTheDocument()
    expect(screen.getByLabelText('Conteúdo')).toHaveValue('Área do Cliente > Meu plano.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(saveMock).toHaveBeenCalledWith({ id: 'a1', title: article.title, content: article.content })
  })

  it('pré-preenche o título a partir de ?titulo=', () => {
    renderAt('/admin/artigos/novo?titulo=Como%20cancelar%3F')
    expect(screen.getByLabelText('Título')).toHaveValue('Como cancelar?')
  })
})
