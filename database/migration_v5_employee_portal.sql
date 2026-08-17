-- ============================================================
-- MIGRAÇÃO V5 — Portal do Funcionário
-- Executar após o schema.sql existente
-- ============================================================

-- 1. Adicionar role FUNCIONARIO ao enum (seguro — não remove existentes)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FUNCIONARIO';

-- 2. Adicionar colunas ao users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cpf               VARCHAR(14);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_users_employee ON users(employee_id);

-- ============================================================
-- TABELA: diario_questions — Perguntas configuráveis do diário
-- ============================================================
CREATE TABLE IF NOT EXISTS diario_questions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      VARCHAR(300) NOT NULL,
  placeholder VARCHAR(300),
  type       VARCHAR(20) DEFAULT 'textarea',  -- textarea | text | select | number
  options    JSONB,                             -- para type=select
  is_required BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO diario_questions (label, placeholder, type, sort_order, is_active) VALUES
  ('Quais atividades você realizou hoje?',        'Descreva suas principais atividades...', 'textarea', 1, TRUE),
  ('Houve alguma dificuldade ou intercorrência?', 'Relate se houver algo relevante...',      'textarea', 2, TRUE),
  ('Quantas crianças/alunos atendidos hoje?',     'Ex: 25',                                  'number',   3, TRUE),
  ('Observações adicionais',                       'Algum ponto que queira registrar...',     'textarea', 4, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: diarios — Diário de Bordo diário
-- ============================================================
CREATE TABLE IF NOT EXISTS diarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  answers     JSONB NOT NULL DEFAULT '{}',  -- { question_id: resposta }
  status      VARCHAR(20) DEFAULT 'RASCUNHO', -- RASCUNHO | ENVIADO
  submitted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_diarios_user_date ON diarios(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_date      ON diarios(date DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_status    ON diarios(status);

-- ============================================================
-- TABELA: relatorios_mensais — Relatório Mensal
-- ============================================================
CREATE TABLE IF NOT EXISTS relatorios_mensais (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  year        SMALLINT NOT NULL,
  month       SMALLINT NOT NULL,  -- 1-12
  content     TEXT,
  highlights  TEXT,
  challenges  TEXT,
  goals_next  TEXT,
  status      VARCHAR(20) DEFAULT 'RASCUNHO', -- RASCUNHO | ENVIADO
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_relatorios_user    ON relatorios_mensais(user_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_relatorios_yearmon ON relatorios_mensais(year, month);

-- ============================================================
-- TABELA: pendencias — Registro de pendências diárias
-- ============================================================
CREATE TABLE IF NOT EXISTS pendencias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  type        VARCHAR(30) NOT NULL,  -- DIARIO | RELATORIO
  ref_date    DATE NOT NULL,         -- dia/mês de referência
  ref_year    SMALLINT,
  ref_month   SMALLINT,
  resolved_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type, ref_date)
);

CREATE INDEX IF NOT EXISTS idx_pendencias_user    ON pendencias(user_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_unresolved ON pendencias(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- TABELA: employee_hours — Horas/faltas por mês
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_hours (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year            SMALLINT NOT NULL,
  month           SMALLINT NOT NULL,
  hours_expected  NUMERIC(6,2) DEFAULT 0,
  hours_worked    NUMERIC(6,2) DEFAULT 0,
  absences_justified   INTEGER DEFAULT 0,
  absences_unjustified INTEGER DEFAULT 0,
  notes           TEXT,
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_emp_hours_emp ON employee_hours(employee_id, year DESC, month DESC);

-- ============================================================
-- FIM DA MIGRAÇÃO V5
-- ============================================================
