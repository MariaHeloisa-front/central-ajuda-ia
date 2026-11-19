import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AskPage from './AskPage'
import { askQuestion } from '../lib/api'

vi.mock('../lib/api', () => ({ askQuestion: vi.fn() }))
const askMock = vi.mocked(askQuestion)

function setup() {
  render(<AskPage />)
  return {
    input: screen.getByLabelText('Sua pergunta'),
    button: screen.getByRole('button', { name: 'Perguntar' }),
  }
}

describe('AskPage', () => {
  beforeEach(() => {
    askMock.mockReset()
  })

  it('desabilita o botão com campo vazio ou só espaços', async () => {
    const { input, button } = setup()
    expect(button).toBeDisabled()
    await userEvent.type(input, '   ')
    expect(button).toBeDisabled()
  })

  it('limita a pergunta a 500 caracteres', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('maxLength', '500')
  })

  it('mostra a resposta e o artigo usado', async () => {
    askMock.mockResolvedValue({
      answer: 'Acesse o app em Financeiro > Faturas.',
      article: { id: 'a1', title: 'Como emitir a segunda via do boleto' },
    })
    const { input, button } = setup()
    await userEvent.type(input, 'Como pego a segunda via?')
    await userEvent.click(button)
    expect(await screen.findByText('Acesse o app em Financeiro > Faturas.')).toBeInTheDocument()
    expect(screen.getByText(/Fonte:/)).toHaveTextContent('Fonte: Como emitir a segunda via do boleto')
    expect(askMock).toHaveBeenCalledWith('Como pego a segunda via?')
  })

  it('sem artigo, orienta a falar com um atendente e não mostra fonte', async () => {
    askMock.mockResolvedValue({ answer: 'Não encontrei essa informação.', article: null })
    const { input, button } = setup()
    await userEvent.type(input, 'Qual a capital da França?')
    await userEvent.click(button)
    expect(await screen.findByText('Não encontrei essa informação.')).toBeInTheDocument()
    expect(screen.queryByText(/Fonte:/)).not.toBeInTheDocument()
    expect(screen.getByText('Entre em contato com nossa central de atendimento.')).toBeInTheDocument()
  })

  it('mostra erro amigável quando a consulta falha', async () => {
    askMock.mockImplementation(async () => { throw new Error('500') })
    const { input, button } = setup()
    await userEvent.type(input, 'Internet lenta')
    await userEvent.click(button)
    expect(
      await screen.findByText('Não foi possível obter uma resposta agora. Tente novamente.'),
    ).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('marca a resposta simulada (modo de teste)', async () => {
    askMock.mockResolvedValue({
      answer: 'Conteúdo do artigo.',
      article: { id: 'a1', title: 'Como emitir a segunda via do boleto' },
      simulated: true,
    })
    const { input, button } = setup()
    await userEvent.type(input, 'segunda via do boleto')
    await userEvent.click(button)
    expect(await screen.findByText(/Resposta simulada/)).toBeInTheDocument()
  })

  it('não mostra o aviso de simulação em respostas reais', async () => {
    askMock.mockResolvedValue({ answer: 'Ok.', article: { id: 'a1', title: 'Boleto' } })
    const { input, button } = setup()
    await userEvent.type(input, 'boleto')
    await userEvent.click(button)
    await screen.findByText('Ok.')
    expect(screen.queryByText(/Resposta simulada/)).not.toBeInTheDocument()
  })
})
