import { expect, test } from '@playwright/test'
import { VALID_EMAIL, login, mockSupabase } from './fixtures/mockSupabase'

test.describe('Área do time', () => {
  test('E2E-05 acessar /admin sem login redireciona para /login', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Área do time' })).toBeVisible()
  })

  test('E2E-06 login com senha errada mostra erro', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(VALID_EMAIL)
    await page.getByLabel('Senha').fill('errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('E2E-07 login válido mostra a lista de artigos', async ({ page }) => {
    await mockSupabase(page)
    await login(page)
    const list = page.getByRole('list', { name: 'Artigos' })
    await expect(list.getByText('Como emitir a segunda via do boleto')).toBeVisible()
    await expect(list.getByText('Como trocar de plano')).toBeVisible()
  })

  test('E2E-08 criar artigo faz ele aparecer na lista', async ({ page }) => {
    const state = await mockSupabase(page)
    await login(page)
    await page.getByRole('link', { name: 'Novo artigo' }).click()
    await page.getByLabel('Título').fill('Como cancelar o contrato')
    await page.getByLabel('Conteúdo').fill('O cancelamento é feito pela Área do Cliente > Contrato > Cancelar.')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('list', { name: 'Artigos' }).getByText('Como cancelar o contrato')).toBeVisible()
    expect(state.articles.map((a) => a.title)).toContain('Como cancelar o contrato')
  })

  test('E2E-09 editar artigo atualiza o título na lista', async ({ page }) => {
    await mockSupabase(page)
    await login(page)
    const row = page.getByRole('listitem').filter({ hasText: 'Como trocar de plano' })
    await row.getByRole('link', { name: 'Editar' }).click()
    await expect(page.getByLabel('Título')).toHaveValue('Como trocar de plano')
    await page.getByLabel('Título').fill('Como mudar de plano')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const list = page.getByRole('list', { name: 'Artigos' })
    await expect(list.getByText('Como mudar de plano')).toBeVisible()
    await expect(list.getByText('Como trocar de plano')).toHaveCount(0)
  })

  test('E2E-10 formulário exige título', async ({ page }) => {
    const state = await mockSupabase(page)
    await login(page)
    await page.getByRole('link', { name: 'Novo artigo' }).click()
    await page.getByLabel('Conteúdo').fill('Conteúdo sem título')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe o título.')).toBeVisible()
    expect(state.articles).toHaveLength(2)
  })

  test('E2E-11 perguntas sem resposta: marcar como resolvida e criar artigo', async ({ page }) => {
    await mockSupabase(page, {
      unanswered: [
        { id: 'q1', question: 'Vocês têm plano empresarial?', created_at: '2026-11-18T10:00:00Z', resolved: false },
        { id: 'q2', question: 'Posso pausar minha assinatura?', created_at: '2026-11-18T09:00:00Z', resolved: false },
      ],
    })
    await login(page)
    await page.getByRole('link', { name: 'Perguntas sem resposta' }).click()
    const list = page.getByRole('list', { name: 'Perguntas sem resposta' })
    await expect(list.getByRole('listitem')).toHaveCount(2)

    await list
      .getByRole('listitem')
      .filter({ hasText: 'Posso pausar' })
      .getByRole('button', { name: 'Marcar como resolvida' })
      .click()
    await expect(list.getByRole('listitem')).toHaveCount(1)

    await list
      .getByRole('listitem')
      .filter({ hasText: 'plano empresarial' })
      .getByRole('link', { name: 'Criar artigo' })
      .click()
    await expect(page.getByRole('heading', { name: 'Novo artigo' })).toBeVisible()
    await expect(page.getByLabel('Título')).toHaveValue('Vocês têm plano empresarial?')
  })

  test('E2E-12 sair volta para /login e bloqueia a área do time', async ({ page }) => {
    await mockSupabase(page)
    await login(page)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
  })
})
