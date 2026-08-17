-- ============================================================
-- SISTEMA RH / ADMINISTRATIVO COMPLETO
-- Versão reorganizada com permissões, férias, atestados,
-- supervisor limitado, foto 3x4, admissão digital e RH completo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'TI',
  'COORDENACAO',
  'VISUALIZADOR',
  'RH_OPERACIONAL',
  'SUPERVISOR',
  'FUNCIONARIO'
);

CREATE TYPE employee_status AS ENUM (
  'ATIVO',
  'INATIVO',
  'AFASTADO',
  'DESLIGADO',
  'PENDENTE'
);

CREATE TYPE benefit_type AS ENUM (
  'VR',
  'VT',
  'PLANO_SAUDE',
  'OUTROS'
);

CREATE TYPE benefit_status AS ENUM (
  'ATIVO',
  'INATIVO',
  'PENDENTE',
  'CANCELADO'
);

-- ============================================================
-- UNIDADES
-- ============================================================

CREATE TABLE units (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  city         VARCHAR(100),
  state        CHAR(2),
  address      VARCHAR(300),
  zip_code     VARCHAR(10),
  phone        VARCHAR(20),
  email        VARCHAR(150),
  photo_url    VARCHAR(500),
  capacity     INTEGER,
  description  TEXT,
  manager_name VARCHAR(200),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USUÁRIOS
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  cpf VARCHAR(14),
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  unit_id UUID REFERENCES units(id),
  employee_id UUID,
  must_change_password BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CARGOS
-- ============================================================

CREATE TABLE positions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(150) NOT NULL UNIQUE,
  description  TEXT,
  salary_floor NUMERIC(10,2),
  salary_ceil  NUMERIC(10,2),
  cbo_code     VARCHAR(20),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCIONÁRIOS
-- ============================================================

CREATE TABLE employees (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code    VARCHAR(20)  UNIQUE,

  -- [PLANILHA: PROFISSIONAIS, CPF, RG, DATA DE NASCIMENTO, NOME DA MÃE]
  full_name        VARCHAR(200) NOT NULL,
  social_name      VARCHAR(200),
  cpf              VARCHAR(14)  UNIQUE NOT NULL,
  rg               VARCHAR(20),
  rg_issuer        VARCHAR(30),
  birth_date       DATE,
  gender           VARCHAR(20),
  nationality      VARCHAR(80) DEFAULT 'Brasileiro(a)',
  place_of_birth   VARCHAR(150),
  mothers_name     VARCHAR(200),

  -- [PLANILHA: TELEFONE, EMAIL, ENDEREÇO]
  phone            VARCHAR(20),
  phone_secondary  VARCHAR(20),
  email            VARCHAR(150),
  address          VARCHAR(300),
  address_number   VARCHAR(20),
  address_comp     VARCHAR(100),
  neighborhood     VARCHAR(100),
  city             VARCHAR(100),
  state            CHAR(2),
  zip_code         VARCHAR(10),

  -- Dados bancários (cadastro manual via formulário)
  bank_code         VARCHAR(10),
  bank_agency       VARCHAR(20),
  bank_account      VARCHAR(30),
  bank_account_type VARCHAR(20) DEFAULT 'CORRENTE',
  pis_pasep         VARCHAR(14),
  ctps_number       VARCHAR(20),
  ctps_series       VARCHAR(10),
  disability_type   VARCHAR(100),

  -- [PLANILHA: INÍCIO NA UNIDADE, VÍNCULO]
  hire_date        DATE,
  contract_type    VARCHAR(50)  DEFAULT 'CLT',

  -- [PLANILHA: FUNÇÃO, SALÁRIO, CBO, C. H. SEMANAL, JORNADA, TURNO]
  position_id      UUID         REFERENCES positions(id),
  salary           NUMERIC(10,2),
  cbo              VARCHAR(20),
  weekly_hours     VARCHAR(20),
  work_schedule    VARCHAR(100),
  work_shift       VARCHAR(50),

  -- [PLANILHA: ASO]
  aso_date         DATE,

  -- [PLANILHA: VT, RECEBEU O CARTÃO VR, CHAVE PIX]
  vt_active        BOOLEAN,
  vr_card_received BOOLEAN,
  pix_key          VARCHAR(150),
  vr_active        BOOLEAN      DEFAULT TRUE,

  -- [PLANILHA: CONTRATO RECEBIDO, CONTRATO ASSINADO]
  contract_received BOOLEAN,
  contract_signed   BOOLEAN,

  -- [PLANILHA: OBSERVAÇÕES]
  observations     TEXT,

  -- [PLANILHA: UNIDADE, SUPERVISOR]
  unit_id          UUID         REFERENCES units(id),
  supervisor_id    UUID         REFERENCES users(id),

  -- [PLANILHA DESLIGADOS: DESLIGAMENTO, SITUAÇÃO]
  dismissal_date   DATE,
  dismissal_type   VARCHAR(100),
  dismissal_reason TEXT,

  -- Controle interno
  status           employee_status DEFAULT 'ATIVO',
  photo_url        VARCHAR(500),
  import_order     INTEGER,
  imported_from    VARCHAR(50),
  has_disability   BOOLEAN      DEFAULT FALSE,
  notes            TEXT,

  created_by       UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE users
ADD CONSTRAINT fk_users_employee
FOREIGN KEY (employee_id)
REFERENCES employees(id)
ON DELETE SET NULL;

-- ============================================================
-- PRESENÇA / FALTAS / ATRASOS
-- ============================================================

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id),
  record_date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  has_medical_cert BOOLEAN DEFAULT FALSE,
  minutes_late INTEGER DEFAULT 0,
  justification TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATESTADOS MÉDICOS
-- ============================================================

CREATE TABLE medical_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL,
  days_off INTEGER NOT NULL,
  cid_code VARCHAR(20),
  file_path VARCHAR(500),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FÉRIAS
-- ============================================================

CREATE TABLE vacation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  status VARCHAR(30) DEFAULT 'PROGRAMADA',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OCORRÊNCIAS RH
-- ============================================================

CREATE TABLE occurrence_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(50),
  severity VARCHAR(30),
  description TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BENEFÍCIOS
-- ============================================================

CREATE TABLE employee_benefits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_type benefit_type NOT NULL,
  status benefit_status DEFAULT 'ATIVO',
  value NUMERIC(10,2),
  operator VARCHAR(100),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTOS
-- ============================================================

CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADMISSÃO DIGITAL
-- ============================================================

CREATE TABLE admission_processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID UNIQUE DEFAULT uuid_generate_v4(),
  candidate_name VARCHAR(200) NOT NULL,
  candidate_email VARCHAR(150) NOT NULL,
  candidate_cpf VARCHAR(14),
  unit_id UUID REFERENCES units(id),
  position_id UUID REFERENCES positions(id),
  supervisor_id UUID REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'PENDENTE',
  form_data JSONB,
  link_expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admission_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES admission_processes(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  accepted_format VARCHAR(50) DEFAULT 'PDF',
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  status VARCHAR(30) DEFAULT 'PENDENTE',
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CALENDÁRIO
-- ============================================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  unit_id UUID REFERENCES units(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTOS ÚTEIS
-- ============================================================

CREATE TABLE useful_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES IMPORTANTES
-- ============================================================

CREATE INDEX idx_employees_supervisor ON employees(supervisor_id);
CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX idx_vacation_employee ON vacation_records(employee_id);
CREATE INDEX idx_occurrence_employee ON occurrence_logs(employee_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- OBSERVAÇÃO
-- ============================================================
-- Supervisor deve enxergar apenas:
-- dashboard da equipe
-- calendário
-- documentos úteis
-- isso será controlado no backend via middleware/auth.js
-- porque banco não faz milagre sozinho.

-- ============================================================
-- VIEW RESUMO POR UNIDADE
-- ============================================================

CREATE OR REPLACE VIEW v_unit_summary AS
SELECT
  u.*,
  COUNT(e.id)                                           AS total_employees,
  COUNT(e.id) FILTER (WHERE e.status = 'ATIVO')         AS active_count,
  COUNT(e.id) FILTER (WHERE e.status = 'AFASTADO')      AS away_count,
  COUNT(e.id) FILTER (WHERE e.status = 'DESLIGADO')     AS dismissed_count
FROM units u
LEFT JOIN employees e ON e.unit_id = u.id
GROUP BY u.id;

-- ============================================================
-- TABELAS ADICIONAIS — usadas pelas rotas mas ausentes do schema original
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type     VARCHAR(50) NOT NULL,
  dismissal_type VARCHAR(50),
  description    TEXT,
  effective_date DATE,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  entity     VARCHAR(100),
  entity_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benefit_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_type VARCHAR(50),
  request_type VARCHAR(30) DEFAULT 'INCLUSAO',
  status      VARCHAR(30) DEFAULT 'PENDENTE',
  details     JSONB,
  resolution  TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  event_id    UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, employee_id)
);

CREATE TABLE IF NOT EXISTS diario_questions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question   TEXT NOT NULL,
  type       VARCHAR(30) DEFAULT 'TEXT',
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_documents_v2 (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path     VARCHAR(500) NOT NULL,
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  category      VARCHAR(100) DEFAULT 'Geral',
  description   TEXT,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  category     VARCHAR(100) DEFAULT 'Geral',
  order_index  INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS home_posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(300) NOT NULL,
  content      TEXT,
  summary      VARCHAR(500),
  cover_url    VARCHAR(500),
  type         VARCHAR(30) DEFAULT 'NOTICIA',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  views        INTEGER DEFAULT 0,
  author_id    UUID REFERENCES users(id),
  author_name  VARCHAR(200),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(300) NOT NULL,
  meeting_date DATE NOT NULL,
  location     VARCHAR(200),
  content      TEXT,
  participants JSONB DEFAULT '[]',
  unit_id      UUID REFERENCES units(id),
  employee_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  file_path    VARCHAR(500),
  status       VARCHAR(30) DEFAULT 'PUBLICADA',
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS undo_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   UUID,
  snapshot    JSONB,
  description TEXT,
  reverted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relatorios_mensais (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id),
  employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL,
  content      TEXT,
  highlights   TEXT,
  challenges   TEXT,
  goals_next   TEXT,
  status       VARCHAR(30) DEFAULT 'RASCUNHO',
  submitted_at TIMESTAMPTZ,
  form_type    VARCHAR(50) DEFAULT 'MENSAL',
  form_data    JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE TABLE IF NOT EXISTS employee_hours (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year                 INTEGER NOT NULL,
  month                INTEGER NOT NULL,
  hours_expected       NUMERIC(6,2) DEFAULT 0,
  hours_worked         NUMERIC(6,2) DEFAULT 0,
  absences_justified   INTEGER DEFAULT 0,
  absences_unjustified INTEGER DEFAULT 0,
  notes                TEXT,
  updated_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, year, month)
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_emp_history_employee ON employee_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_posts_published  ON home_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_benefit_requests_status ON benefit_requests(status);
