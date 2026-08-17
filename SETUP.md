# Guia de Instalação Completo — ONG Sistema

> Passo a passo para configurar o sistema em ambiente de produção no **Windows Server**  
> e em ambiente de desenvolvimento local com Docker.

---

## Pré-requisitos

| Dependência    | Versão mínima | Instalação                                    |
|----------------|--------------|-----------------------------------------------|
| Node.js        | 20.x LTS     | https://nodejs.org/en/download                |
| PostgreSQL      | 15.x         | https://www.postgresql.org/download/windows/  |
| PM2            | 5.x          | `npm install -g pm2`                          |
| Git (opcional) | qualquer     | https://git-scm.com/download/win              |

---

## Opção A — Desenvolvimento Local com Docker (recomendado para devs)

```bash
# 1. Clone o repositório
git clone https://seu-repositorio/ong-sistema.git
cd ong-sistema

# 2. Suba todos os serviços com Docker
docker compose up -d

# 3. Aguarde o banco inicializar (~15s) e rode o seed
docker compose exec api node src/config/seed.js

# 4. Acesse o sistema
# Frontend:  http://localhost:3000
# API:       http://localhost:4000
# MailHog:   http://localhost:8025 (captura emails de admissão)

# 5. Credenciais iniciais
# TI:         ti@ong.org.br        / Admin@123
# RH:         rh@ong.org.br         / Admin@123
# Diretoria:  diretoria@ong.org.br  / Admin@123
# Supervisor: sup.central@ong.org.br / Admin@123
```

---

## Opção B — Produção no Windows Server

### 1. Preparar o banco de dados

```sql
-- Conecte ao PostgreSQL como superuser
psql -U postgres

-- Crie banco e usuário dedicado
CREATE DATABASE ong_sistema;
CREATE USER ong_app WITH ENCRYPTED PASSWORD 'SenhaForteAqui123!';
GRANT ALL PRIVILEGES ON DATABASE ong_sistema TO ong_app;
\c ong_sistema
GRANT ALL ON SCHEMA public TO ong_app;

-- Execute o schema
\i C:/ong/database/schema.sql
```

### 2. Configurar o Backend

```batch
:: Entre na pasta do backend
cd C:\ong\backend

:: Copie e edite o .env
copy .env.example .env
notepad .env
```

**Conteúdo mínimo do `.env`:**
```env
NODE_ENV=production
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ong_sistema
DB_USER=ong_app
DB_PASS=SenhaForteAqui123!
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<gere outro>
FRONTEND_URL=http://SEU_SERVIDOR_IP:3000
SMTP_HOST=smtp.seudominio.com.br
SMTP_PORT=587
SMTP_USER=rh@seudominio.com.br
SMTP_PASS=senha_smtp
SMTP_FROM=rh@seudominio.com.br
ORG_NAME=Nome da ONG
```

```batch
:: Instale dependências e rode seed inicial
npm install --production
node src/config/seed.js
```

### 3. Configurar o Frontend

```batch
cd C:\ong\frontend
copy .env.local.example .env.local
notepad .env.local
```

**Conteúdo do `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://SEU_SERVIDOR_IP:4000/api/v1
```

```batch
npm install
npm run build
```

### 4. Iniciar com PM2

```batch
cd C:\ong

:: Inicia os dois serviços
pm2 start ecosystem.config.js

:: Configura auto-start no boot do Windows
pm2 startup

:: (Execute o comando que o PM2 mostrar)

:: Salva a lista de processos
pm2 save

:: Verifica status
pm2 status
pm2 logs
```

### 5. Configurar Backup Automático

1. Abra o **Agendador de Tarefas do Windows**
2. Clique em **Criar Tarefa**
3. Configure:
   - **Nome:** ONG Sistema — Backup Diário
   - **Acionador:** Diariamente às 02:00
   - **Ação:** Programa — `powershell.exe`
   - **Argumentos:** `-ExecutionPolicy Bypass -File "C:\ong\scripts\backup.ps1"`
4. Em **Configurações**, marque "Executar com maiores privilégios"

---

## Importação da Planilha Existente

### Via linha de comando (recomendado para 1ª vez)

```bash
# Teste primeiro sem salvar
node scripts/import-spreadsheet.js \
  --file=C:\dados\funcionarios.xlsx \
  --dry-run

# Se OK, execute de verdade
node scripts/import-spreadsheet.js \
  --file=C:\dados\funcionarios.xlsx

# Se os nomes das unidades na planilha diferem do banco, crie um mapeamento:
# mapa.json:
# {
#   "unid. centro": "uuid-da-unidade-no-banco",
#   "filial norte": "outro-uuid"
# }
node scripts/import-spreadsheet.js \
  --file=funcionarios.xlsx \
  --unit-map=mapa.json
```

### Via painel web (para importações subsequentes)

1. Acesse **Importar** no menu lateral (somente TI/RH)
2. Arraste o arquivo `.xlsx` ou `.csv`
3. Revise o mapeamento automático de colunas
4. Clique em **Importar**

---

## Executar os Testes

```bash
cd backend

# Crie um banco de teste separado
psql -U postgres -c "CREATE DATABASE ong_sistema_test;"
psql -U postgres -d ong_sistema_test -f ../database/schema.sql

# Configure .env para apontar para o banco de teste
# DB_NAME=ong_sistema_test

# Roda todos os testes
npm test

# Com cobertura
npm test -- --coverage

# Arquivo específico
npm test -- tests/auth-employees.test.js
```

---

## Variáveis de Ambiente — Referência Completa

### Backend

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DB_HOST` | ✅ | Host do PostgreSQL |
| `DB_PORT` | ✅ | Porta (padrão: 5432) |
| `DB_NAME` | ✅ | Nome do banco |
| `DB_USER` | ✅ | Usuário do banco |
| `DB_PASS` | ✅ | Senha do banco |
| `JWT_SECRET` | ✅ | Segredo JWT (mín. 64 chars) |
| `JWT_REFRESH_SECRET` | ✅ | Segredo do refresh token |
| `JWT_EXPIRES` | — | Validade do token (padrão: 8h) |
| `SMTP_HOST` | ✅ | Servidor SMTP |
| `SMTP_PORT` | ✅ | Porta SMTP |
| `SMTP_USER` | ✅ | Usuário SMTP |
| `SMTP_PASS` | ✅ | Senha SMTP |
| `SMTP_FROM` | ✅ | Remetente dos emails |
| `SMTP_SECURE` | — | `true` para SSL (padrão: false) |
| `FRONTEND_URL` | ✅ | URL base do frontend |
| `ORG_NAME` | — | Nome da organização |
| `PORT` | — | Porta da API (padrão: 4000) |
| `LOG_LEVEL` | — | `debug/info/warn/error` |
| `REDIS_URL` | — | URL Redis (blacklist de tokens) |

### Frontend

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `NEXT_PUBLIC_API_URL` | ✅ | URL completa da API |
| `NEXT_PUBLIC_API_HOST` | — | Host da API (para imagens) |
| `NEXT_PUBLIC_API_PORT` | — | Porta da API (para imagens) |

---

## Troubleshooting

**API não inicia:**
```bash
pm2 logs ong-api --lines 50
# Verifique se o .env está correto e o banco está acessível
node -e "require('./src/config/database').query('SELECT 1').then(() => console.log('OK'))"
```

**Emails não chegam:**
```bash
# Teste SMTP manualmente
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
t.sendMail({ from: 'test@test.com', to: 'voce@email.com', subject: 'Teste', text: 'OK' }).then(console.log).catch(console.error);
"
```

**Frontend com erro de API:**
- Verifique se `NEXT_PUBLIC_API_URL` aponta para o endereço correto
- Confirme que o backend está rodando: `curl http://localhost:4000/health`
- Verifique o CORS: o `FRONTEND_URL` no `.env` do backend deve bater com a URL do frontend

**Banco de dados cheio de erros:**
```bash
# Verifica conexões ativas
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname='ong_sistema';"

# Reinicia pool de conexões
pm2 restart ong-api
```

**Backup não roda:**
```powershell
# Teste manual no PowerShell como Administrador
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
C:\ong\scripts\backup.ps1
```

---

## Estrutura de Pastas em Produção

```
C:\ong\
├── backend\         ← API Node.js
│   ├── src\
│   ├── uploads\     ← Documentos enviados (fazer backup!)
│   ├── logs\        ← Logs da aplicação
│   └── .env         ← Configurações (nunca commitar!)
├── frontend\        ← Next.js
│   └── .next\       ← Build compilado
├── database\        ← Schema SQL
├── scripts\         ← backup.ps1, import-spreadsheet.js
├── backups\         ← Backups automáticos
│   ├── database\    ← Dumps do PostgreSQL (.sql.zip)
│   └── uploads\     ← Backups dos documentos (.zip)
├── logs\            ← Logs do PM2
└── ecosystem.config.js
```
