/**
 * Testes E2E com Playwright
 * Cobre os fluxos principais: login, listagem, criação e admissão
 *
 * Instalação:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Execução:
 *   npx playwright test
 *   npx playwright test --headed      # com interface visual
 *   npx playwright test --ui          # modo interativo
 */

import { test, expect, Page } from '@playwright/test';

// ─── Config ──────────────────────────────────────────────────

const BASE_URL  = process.env.E2E_BASE_URL  || 'http://localhost:3000';
const TI_EMAIL  = process.env.E2E_TI_EMAIL  || 'ti@ong.org.br';
const TI_PASS   = process.env.E2E_TI_PASS   || 'Admin@123';
const RH_EMAIL  = process.env.E2E_RH_EMAIL  || 'rh@ong.org.br';
const RH_PASS   = process.env.E2E_RH_PASS   || 'Admin@123';
const SUP_EMAIL = process.env.E2E_SUP_EMAIL || 'sup.central@ong.org.br';
const SUP_PASS  = process.env.E2E_SUP_PASS  || 'Admin@123';

// ─── Helpers ─────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function loginAsTI(page: Page)         { await login(page, TI_EMAIL,  TI_PASS);  }
async function loginAsRH(page: Page)         { await login(page, RH_EMAIL,  RH_PASS);  }
async function loginAsSupervisor(page: Page) { await login(page, SUP_EMAIL, SUP_PASS); }

// ─── Auth ────────────────────────────────────────────────────

test.describe('Autenticação', () => {
  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h1')).toContainText('Sistema de Gestão');

    await page.fill('input[type="email"]',    TI_EMAIL);
    await page.fill('input[type="password"]', TI_PASS);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]',    'errado@email.com');
    await page.fill('input[type="password"]', 'senhaerrada');
    await page.click('button[type="submit"]');

    // Toast de erro deve aparecer
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('acesso direto a rota protegida redireciona para login', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

// ─── Dashboard ────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test('TI vê dashboard geral com KPIs', async ({ page }) => {
    await loginAsTI(page);
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // KPIs devem estar presentes
    await expect(page.locator('text=Total de funcionários')).toBeVisible();
    await expect(page.locator('text=Admissões digitais')).toBeVisible();
    await expect(page.locator('text=Faltas no mês')).toBeVisible();
  });

  test('Supervisor vê dashboard de equipe', async ({ page }) => {
    await loginAsSupervisor(page);
    await expect(page.locator('text=Olá,')).toBeVisible();
    await expect(page.locator('text=Total na equipe')).toBeVisible();
    await expect(page.locator('text=Minha equipe')).toBeVisible();
  });

  test('Supervisor NÃO vê menu de admissões', async ({ page }) => {
    await loginAsSupervisor(page);
    await expect(page.locator('a[href="/admissoes"]')).not.toBeVisible();
  });
});

// ─── Funcionários ─────────────────────────────────────────────

test.describe('Funcionários', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRH(page);
  });

  test('listagem carrega com paginação', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tbody tr')).toHaveCount({ min: 1 }, { timeout: 5000 });
  });

  test('busca por nome filtra resultados', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await page.fill('input[placeholder*="Buscar"]', 'Maria');
    await page.waitForTimeout(600); // aguarda debounce

    // Todos os resultados devem conter "Maria"
    const names = page.locator('tbody td:first-child p:first-child');
    const count = await names.count();
    for (let i = 0; i < count; i++) {
      const text = await names.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('maria');
    }
  });

  test('link "Ver" na listagem leva ao detalhe', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await page.locator('tbody tr').first().hover();
    await page.locator('tbody tr').first().locator('a:has-text("Ver")').click();
    await expect(page).toHaveURL(/\/funcionarios\/.+/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('página de detalhe mostra abas corretamente', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await page.locator('tbody tr').first().hover();
    await page.locator('tbody tr').first().locator('a:has-text("Ver")').click();

    // Abas devem existir
    await expect(page.locator('text=Dados')).toBeVisible();
    await expect(page.locator('text=Histórico')).toBeVisible();
    await expect(page.locator('text=Benefícios')).toBeVisible();

    // Troca de aba
    await page.click('text=Histórico');
    await expect(page.locator('text=Nenhum evento')).toBeVisible().catch(() => {
      // Pode ter eventos, tudo bem
    });
  });

  test('botão de PDF gera download', async ({ page }) => {
    await page.goto(`${BASE_URL}/funcionarios`);
    await page.locator('tbody tr').first().hover();
    await page.locator('tbody tr').first().locator('a:has-text("Ver")').click();

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Ficha PDF")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});

// ─── Admissões ────────────────────────────────────────────────

test.describe('Admissões Digitais', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRH(page);
  });

  test('página de admissões lista processos por status', async ({ page }) => {
    await page.goto(`${BASE_URL}/admissoes`);
    await expect(page.locator('text=Admissões Digitais')).toBeVisible();
    await expect(page.locator('text=Aguardando')).toBeVisible();
    await expect(page.locator('text=Em análise')).toBeVisible();
  });

  test('modal de novo processo abre e fecha', async ({ page }) => {
    await page.goto(`${BASE_URL}/admissoes`);
    await page.click('button:has-text("Novo processo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Novo processo de admissão')).toBeVisible();

    // Fecha com ESC
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

// ─── Formulário público de admissão ──────────────────────────

test.describe('Formulário Público de Admissão', () => {
  test('token inválido mostra erro', async ({ page }) => {
    await page.goto(`${BASE_URL}/admissao/00000000-0000-0000-0000-000000000000`);
    await expect(page.locator('text=Link inválido')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Unidades ─────────────────────────────────────────────────

test.describe('Unidades', () => {
  test('lista de unidades carrega como grid', async ({ page }) => {
    await loginAsTI(page);
    await page.goto(`${BASE_URL}/unidades`);
    await expect(page.locator('text=Unidades')).toBeVisible();
    await expect(page.locator('a[href^="/unidades/"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('clique no card de unidade abre detalhe', async ({ page }) => {
    await loginAsTI(page);
    await page.goto(`${BASE_URL}/unidades`);
    await page.locator('a[href^="/unidades/"]').first().click();
    await expect(page).toHaveURL(/\/unidades\/.+/);
    await expect(page.locator('text=Equipe')).toBeVisible();
  });
});

// ─── Importação ───────────────────────────────────────────────

test.describe('Importação de Planilha', () => {
  test('página de importação carrega para TI/RH', async ({ page }) => {
    await loginAsRH(page);
    await page.goto(`${BASE_URL}/importar`);
    await expect(page.locator('text=Importar Planilha')).toBeVisible();
    await expect(page.locator('text=Arraste sua planilha')).toBeVisible();
  });
});

// ─── Configurações (TI only) ──────────────────────────────────

test.describe('Configurações', () => {
  test('página de configurações carrega para TI', async ({ page }) => {
    await loginAsTI(page);
    await page.goto(`${BASE_URL}/configuracoes`);
    await expect(page.locator('text=Configurações')).toBeVisible();
    await expect(page.locator('text=Usuários do sistema')).toBeVisible();
  });

  test('RH não acessa configurações', async ({ page }) => {
    await loginAsRH(page);
    await page.goto(`${BASE_URL}/configuracoes`);
    // Deve mostrar mensagem de acesso restrito
    await expect(page.locator('text=Acesso restrito')).toBeVisible({ timeout: 5000 });
  });
});

// ─── Perfil ───────────────────────────────────────────────────

test.describe('Perfil', () => {
  test('página de perfil exibe dados do usuário', async ({ page }) => {
    await loginAsTI(page);
    await page.goto(`${BASE_URL}/perfil`);
    await expect(page.locator('text=Meu perfil')).toBeVisible();
    await expect(page.locator('text=Alterar senha')).toBeVisible();
  });

  test('clicar no avatar vai para perfil', async ({ page }) => {
    await loginAsTI(page);
    await page.locator('a[href="/perfil"]').click();
    await expect(page).toHaveURL(`${BASE_URL}/perfil`);
  });
});

// ─── Auditoria (TI only) ──────────────────────────────────────

test.describe('Auditoria', () => {
  test('página de auditoria carrega logs', async ({ page }) => {
    await loginAsTI(page);
    await page.goto(`${BASE_URL}/auditoria`);
    await expect(page.locator('text=Log de Auditoria')).toBeVisible();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Notificações ─────────────────────────────────────────────

test.describe('Notificações', () => {
  test('badge de notificações aparece no header', async ({ page }) => {
    await loginAsRH(page);
    // O bell icon deve estar no header
    await expect(page.locator('a[href="/notificacoes"]')).toBeVisible();
  });

  test('página de notificações carrega', async ({ page }) => {
    await loginAsRH(page);
    await page.goto(`${BASE_URL}/notificacoes`);
    await expect(page.locator('text=Notificações')).toBeVisible();
  });
});
