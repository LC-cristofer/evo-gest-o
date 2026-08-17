-- ============================================================
-- EVO Gestão — apply-to-existing.sql
-- Aplica colunas e migrações em banco já existente.
-- Seguro re-executar (idempotente).
-- ============================================================

-- ── Roles novos ───────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COORDENACAO';    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VISUALIZADOR';   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RH_OPERACIONAL'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

UPDATE users SET role = 'COORDENACAO'    WHERE role = 'DIRETORIA';
UPDATE users SET role = 'RH_OPERACIONAL' WHERE role = 'RH';

-- ── employees: colunas da planilha ──────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mothers_name      VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cbo               VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_hours      VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_schedule     VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_shift        VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aso_date          DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vt_active         BOOLEAN;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vr_card_received  BOOLEAN;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pix_key           VARCHAR(150);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_received BOOLEAN;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_signed   BOOLEAN;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS observations      TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS import_order      INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS imported_from     VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dismissal_type    VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_disability    BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes             TEXT;
ALTER TABLE employees ALTER COLUMN birth_date DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN hire_date  DROP NOT NULL;
UPDATE employees SET status = 'ATIVO' WHERE status = 'PENDENTE';

-- ── users ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- ── attendance_records ───────────────────────────────────────
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS has_medical_cert BOOLEAN DEFAULT FALSE;

-- ── units ────────────────────────────────────────────────────
ALTER TABLE units ADD COLUMN IF NOT EXISTS zip_code     VARCHAR(10);
ALTER TABLE units ADD COLUMN IF NOT EXISTS capacity     INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);

-- ── View resumo por unidade ──────────────────────────────────
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

-- ── Índices úteis ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_unit   ON employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_attendance_unit  ON attendance_records(unit_id);

-- ── employees: colunas usadas no formulário manual de cadastro ──
ALTER TABLE employees ADD COLUMN IF NOT EXISTS social_name       VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg_issuer         VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender            VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality       VARCHAR(80) DEFAULT 'Brasileiro(a)';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS place_of_birth    VARCHAR(150);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_secondary   VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_number    VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_comp      VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS neighborhood      VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS zip_code          VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_code         VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_agency       VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account      VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(20) DEFAULT 'CORRENTE';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pis_pasep         VARCHAR(14);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps_number       VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps_series       VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS disability_type   VARCHAR(100);
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

-- ── units: colunas adicionais ─────────────────────────────────
ALTER TABLE units ADD COLUMN IF NOT EXISTS zip_code     VARCHAR(10);
ALTER TABLE units ADD COLUMN IF NOT EXISTS capacity     INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);

-- ── positions: colunas adicionais ─────────────────────────────
ALTER TABLE positions ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS salary_floor NUMERIC(10,2);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS salary_ceil  NUMERIC(10,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='positions_name_key') THEN
    ALTER TABLE positions ADD CONSTRAINT positions_name_key UNIQUE (name);
  END IF;
END $$;
