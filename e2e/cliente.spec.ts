import { expect, test } from '@playwright/test'
import { FALLBACK_ANSWER, mockSupabase } from './fixtures/mockSupabase'

test.describe('Página do cliente', () => {
  test('E2E-01 pergunta coberta mostra a resposta e o artigo usado', async ({ page }) => {
    const state = await mockSupabase(page, {
      ask: {
        answer: 'Acesse o app em Financeiro > Faturas e toque em Segunda via.',
        article: { id: 'a1', title: 'Como emitir a segunda via do boleto' },
      },
    })
    await page.goto('/')
    await page.getByLabel('Sua pergunta').fill('Como tiro a segunda via do boleto?')
    await page.getByRole('button', { name: 'Perguntar' }).click()

    await expect(page.getByText('Acesse o app em Financeiro > Faturas')).toBeVisible()
    await expect(page.getByText('Fonte: Como emitir a segunda via do boleto')).toBeVisible()
    expect(state.askCalls).toEqual(['Como tiro a segunda via do boleto?'])
  })

  test('E2E-02 pergunta sem cobertura orienta a falar com um atendente', async ({ page }) => {
    await mockSupabase(page, { ask: { answer: FALLBACK_ANSWER, article: null } })
    await page.goto('/')
    await page.getByLabel('Sua pergunta').fill('Vocês vendem celular?')
    await page.getByRole('button', { name: 'Perguntar' }).click()

    await expect(page.getByText(FALLBACK_ANSWER)).toBeVisible()
    await expect(page.getByText('Entre em contato com nossa central de atendimento.')).toBeVisible()
    await expect(page.getByText(/Fonte:/)).toHaveCount(0)
  })

  test('E2E-03 botão Perguntar fica desabilitado com campo vazio ou só espaços', async ({ page }) => {
    const state = await mockSupabase(page)
    await page.goto('/')
    const button = page.getByRole('button', { name: 'Perguntar' })
    await expect(button).toBeDisabled()
    await page.getByLabel('Sua pergunta').fill('    ')
    await expect(button).toBeDisabled()
    expect(state.askCalls).toHaveLength(0)
  })

  test('E2E-04 falha da IA mostra erro amigável e permite tentar de novo', async ({ page }) => {
    await mockSupabase(page, { ask: 'error' })
    await page.goto('/')
    await page.getByLabel('Sua pergunta').fill('Minha internet está lenta')
    await page.getByRole('button', { name: 'Perguntar' }).click()

    await expect(page.getByRole('alert')).toHaveText('Não foi possível obter uma resposta agora. Tente novamente.')
    await expect(page.getByRole('button', { name: 'Perguntar' })).toBeEnabled()
  })
})
