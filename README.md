# ONG Sistema de Gestão — Documentação Técnica Completa

> Sistema interno para gestão.

---

## 📁 Estrutura de Pastas

```
ong-sistema/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Bootstrap do Express
│   │   ├── config/
│   │   │   ├── database.js           # Pool PostgreSQL + helpers
│   │   │   ├── upload.js             # Multer (uploads seguros)
│   │   │   └── migrate.js            # Runner de migrations
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT + RBAC
│   │   │   └── errorHandler.js       # Tratamento global de erros
│   │   ├── routes/
│   │   │   ├── auth.routes.js        # Login, refresh, change-password
│   │   │   ├── employee.routes.js    # CRUD + busca + histórico
│   │   │   ├── unit.routes.js        # Gestão de unidades
│   │   │   ├── admission.routes.js   # Admissão digital completa
│   │   │   ├── attendance.routes.js  # Faltas e atrasos
│   │   │   ├── benefit.routes.js     # VR, VT, planos
│   │   │   ├── dashboard.routes.js   # Indicadores por nível
│   │   │   ├── history.routes.js     # Log de eventos
│   │   │   ├── document.routes.js    # Upload/gestão de docs
│   │   │   ├── notification.routes.js # Notificações
│   │   │   ├── user.routes.js        # Gestão de usuários (TI)
│   │   │   └── import.routes.js      # Importação de planilha
│   │   ├── services/
│   │   │   └── email.service.js      # Nodemailer + templates
│   │   ├── jobs/
│   │   │   ├── admissionExpiry.job.js # Expira links de admissão
│   │   │   ├── documentAlerts.job.js  # Documentos vencendo
│   │   │   └── notifications.job.js   # Aniversários e alertas
│   │   └── utils/
│   │       ├── audit.js              # Log de auditoria
│   │       └── logger.js             # Winston
│   ├── uploads/                      # Arquivos enviados (ignorar no git)
│   ├── logs/                         # Logs da aplicação
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/         # Página de login
│   │   │   ├── (app)/                # Área autenticada
│   │   │   │   ├── dashboard/        # Dashboard por papel
│   │   │   │   ├── funcionarios/     # Listagem + detalhe + form
│   │   │   │   ├── unidades/         # Gestão de unidades
│   │   │   │   ├── admissoes/        # Painel de admissões
│   │   │   │   ├── indicadores/      # Faltas e atrasos
│   │   │   │   ├── beneficios/       # VR/VT
│   │   │   │   └── importar/         # Upload de planilha
│   │   │   └── admissao/[token]/     # Formulário PÚBLICO do candidato
│   │   ├── components/
│   │   │   ├── layout/AppLayout.tsx  # Sidebar + header
│   │   │   └── ui/                   # Componentes reutilizáveis
│   │   ├── lib/api.ts                # Axios + interceptors + APIs tipadas
│   │   ├── stores/authStore.ts       # Zustand (auth + permissões)
│   │   └── types/index.ts            # Todos os tipos TypeScript
│   └── package.json
│
├── database/
│   └── schema.sql                    # Schema completo PostgreSQL
│
└── scripts/
    └── import-spreadsheet.js         # Importador CLI de planilha
```

---

## 🗄️ Banco de Dados — Modelagem

### Tabelas principais

| Tabela                  | Descrição                                      |
|-------------------------|------------------------------------------------|
| `users`                 | Usuários do sistema (login, roles)             |
| `units`                 | Unidades da ONG                                |
| `positions`             | Cargos (com CBO)                               |
| `employees`             | Funcionários (dados completos)                 |
| `employee_history`      | Log de eventos de cada funcionário             |
| `admission_processes`   | Processos de admissão digital                  |
| `admission_documents`   | Documentos por processo de admissão            |
| `attendance_records`    | Faltas e atrasos                               |
| `employee_benefits`     | Benefícios ativos por funcionário              |
| `benefit_requests`      | Solicitações de benefício                      |
| `employee_documents`    | Documentos do funcionário (após admissão)      |
| `notifications`         | Notificações por usuário                       |
| `scheduled_events`      | Agenda de eventos                              |
| `audit_logs`            | Auditoria de todas as ações críticas           |

### Views

| View                  | Descrição                                   |
|-----------------------|---------------------------------------------|
| `v_employees_full`    | Funcionário com joins de cargo/unidade/supervisor |
| `v_unit_summary`      | Resumo de headcount por unidade             |
| `v_monthly_attendance`| Faltas/atrasos por funcionário por mês      |

---

## 🔐 Controle de Acesso (RBAC)

| Ação                   | TI | DIRETORIA | RH | SUPERVISOR |
|------------------------|----|-----------|----|------------|
| Ver funcionários       | ✅ | ✅        | ✅ | Só unidade |
| Criar funcionários     | ✅ | ❌        | ✅ | ❌         |
| Editar funcionários    | ✅ | ❌        | ✅ | ❌         |
| Excluir funcionários   | ✅ | ❌        | ❌ | ❌         |
| Ver dashboard geral    | ✅ | ✅        | ✅ | ❌         |
| Ver dashboard unidade  | ✅ | ✅        | ✅ | Só a sua   |
| Criar admissões        | ✅ | ❌        | ✅ | ❌         |
| Aprovar admissões      | ✅ | ❌        | ✅ | ❌         |
| Gerenciar benefícios   | ✅ | ❌        | ✅ | ❌         |
| Gerenciar usuários     | ✅ | ❌        | ❌ | ❌         |
| Importar planilha      | ✅ | ❌        | ✅ | ❌         |
| Lançar faltas          | ✅ | ❌        | ✅ | ❌         |

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 20+
- PostgreSQL 15+
- Windows Server (compatível com PM2 para processo)

### 1. Banco de dados
```sql
-- Criar banco
CREATE DATABASE ong_sistema;
\c ong_sistema
\i database/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Editar .env com suas configurações

npm install
node src/app.js       # desenvolvimento
# Produção: use PM2
npm install -g pm2
pm2 start src/app.js --name "ong-api" --watch
pm2 startup
pm2 save
```

### 3. Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://SEU_SERVIDOR:4000/api/v1" > .env.local
npm run build
npm start
# Ou com PM2:
pm2 start npm --name "ong-frontend" -- start
```

### 4. Primeiro usuário (TI)
```sql
-- Substitua a senha (use bcrypt hash real)
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Administrador TI',
  'ti@ong.org.br',
  '$2a$12$HASH_GERADO_COM_BCRYPT',
  'TI'
);
```

Ou use o script:
```bash
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('SenhaForte@123', 12).then(h => console.log(h));
"
```

### 5. Importação da planilha existente
```bash
# Dry run (sem salvar, apenas visualiza)
node scripts/import-spreadsheet.js --file=funcionarios.xlsx --dry-run

# Execução real
node scripts/import-spreadsheet.js --file=funcionarios.xlsx

# Com mapeamento de unidades (se os nomes divergirem)
node scripts/import-spreadsheet.js \
  --file=funcionarios.xlsx \
  --unit-map=mapa-unidades.json
```

`mapa-unidades.json` exemplo:
```json
{
  "unid. centro": "uuid-da-unidade-centro",
  "filial sul":   "uuid-da-unidade-sul"
}
```

---

## 🌐 Endpoints da API

### Auth
| Método | Rota                        | Descrição                  |
|--------|-----------------------------|----------------------------|
| POST   | `/auth/login`               | Login com email/senha      |
| GET    | `/auth/me`                  | Dados do usuário logado    |
| POST   | `/auth/refresh`             | Novo access token          |
| POST   | `/auth/change-password`     | Alterar senha              |
| POST   | `/auth/logout`              | Logout                     |

### Funcionários
| Método | Rota                            | Descrição                     |
|--------|---------------------------------|-------------------------------|
| GET    | `/employees`                    | Listagem com filtros/paginação|
| GET    | `/employees/:id`                | Detalhe completo              |
| POST   | `/employees`                    | Novo funcionário              |
| PUT    | `/employees/:id`                | Atualização completa          |
| PATCH  | `/employees/:id/status`         | Altera status/desligamento    |
| GET    | `/employees/:id/history`        | Histórico do funcionário      |
| GET    | `/employees/search/cpf/:cpf`    | Busca por CPF                 |

### Admissão
| Método | Rota                            | Descrição                     |
|--------|---------------------------------|-------------------------------|
| GET    | `/admissions`                   | Lista processos               |
| POST   | `/admissions`                   | Cria processo + envia email   |
| GET    | `/admissions/form/:token`       | **Público** - Busca formulário|
| POST   | `/admissions/form/:token`       | **Público** - Envia formulário|
| POST   | `/admissions/upload/:token/:docId` | **Público** - Upload doc   |
| POST   | `/admissions/:id/resend`        | Reenvio do link               |
| PATCH  | `/admissions/:id/review`        | Aprova ou rejeita             |

### Dashboard
| Método | Rota                          | Descrição                     |
|--------|-------------------------------|-------------------------------|
| GET    | `/dashboard/general`          | Visão geral RH/Diretoria      |
| GET    | `/dashboard/unit/:unitId`     | Indicadores por unidade       |
| GET    | `/dashboard/supervisor`       | Visão da equipe do supervisor |
| GET    | `/dashboard/attendance-trends`| Tendência de 12 meses         |

---

## 🔒 Segurança

| Medida                          | Implementado |
|---------------------------------|:------------:|
| JWT com expiração               | ✅           |
| Refresh token separado          | ✅           |
| Bcrypt com custo 12             | ✅           |
| Rate limiting (300 req/15min)   | ✅           |
| Rate limiting login (10/15min)  | ✅           |
| Helmet (headers HTTP seguras)   | ✅           |
| CORS restrito ao frontend       | ✅           |
| Sanitização de audit logs       | ✅           |
| Path traversal em uploads       | ✅ (nome aleatório) |
| Validação de tipo de arquivo    | ✅           |
| Validação de tamanho (10MB)     | ✅           |
| Zod em todas as rotas           | ✅           |
| RBAC em todos os endpoints      | ✅           |
| Timing attack em login          | ✅           |
| Audit log de ações críticas     | ✅           |
| SQL injection (queries parametrizadas) | ✅    |

---

## 💡 Melhorias Sugeridas (Não Solicitadas)

### 🔴 Alta prioridade
1. **Backup automático** — Script PowerShell com `pg_dump` agendado no Agendador de Tarefas do Windows Server
2. **Export para Excel** — Botão "Exportar" na listagem de funcionários usando `xlsx`
3. **Ponto eletrônico básico** — Integração com relógio de ponto via arquivo TXT (padrão AFDT/ACJEF)

### 🟡 Média prioridade
4. **Assinatura digital de documentos** — Integração com DocuSign ou assinatura via AWS/Azure
5. **App mobile** — PWA (Progressive Web App) com Next.js para supervisores acessarem no celular
6. **Relatórios em PDF** — Geração de holerites, fichas de admissão e relatórios com Puppeteer
7. **Importação incremental** — Diff automático entre planilha e banco antes de importar
8. **Workflow de aprovações** — Multi-nível: Supervisor → RH → Diretoria para grandes mudanças

### 🟢 Baixa prioridade
9. **Integração eSocial** — Geração de XML para envio ao governo (obrigatório para ONGs com CLT)
10. **Chat interno** — Comunicação entre RH e supervisores via WebSocket
11. **Multi-factor authentication** — TOTP (Google Authenticator) para usuários privilegiados

---

## 📊 Arquitetura

```
Browser / App
     │
     ▼
┌─────────────────────────────────────┐
│         Next.js Frontend            │
│  React Query + Zustand + Tailwind   │
└──────────────────┬──────────────────┘
                   │ HTTP/HTTPS
                   ▼
┌─────────────────────────────────────┐
│         Express.js API              │
│  Helmet · CORS · Rate Limit · JWT   │
│  ─────────────────────────────────  │
│  Routes → Controllers → Services   │
│  ─────────────────────────────────  │
│  Cron Jobs (node-cron)              │
└──────────┬──────────────────────────┘
           │
    ┌──────▼──────┐    ┌─────────┐
    │ PostgreSQL  │    │  SMTP   │
    │   (dados)   │    │ (email) │
    └─────────────┘    └─────────┘
           │
    ┌──────▼──────┐
    │  /uploads/  │
    │ (arquivos)  │
    └─────────────┘
```

**Decisão de arquitetura: Monolito Modular**

Para ~400 funcionários e 60 unidades, microsserviços seria over-engineering. O monolito modular oferece:
- Deployment simples no Windows Server
- Manutenção mais fácil para equipe pequena
- Fácil de escalar horizontalmente quando necessário (PM2 cluster mode)
- Migrations e transações de banco triviais
- Pronto para ser quebrado em serviços no futuro, se necessário

---

## ⚙️ Configuração PM2 (Windows Server)

```javascript
// ecosystem.config.js — raiz do projeto
module.exports = {
  apps: [
    {
      name:       'ong-api',
      script:     './backend/src/app.js',
      instances:  2,          // ou 'max' para usar todos os CPUs
      exec_mode:  'cluster',
      env: {
        NODE_ENV: 'production',
        PORT:     4000,
      },
      error_file: './logs/api-error.log',
      out_file:   './logs/api-out.log',
      max_memory_restart: '500M',
    },
    {
      name:   'ong-frontend',
      script: 'npm',
      args:   'start',
      cwd:    './frontend',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```
