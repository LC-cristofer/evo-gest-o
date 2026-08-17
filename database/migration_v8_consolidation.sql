-- ============================================================
-- MIGRAÇÃO V8 — Consolidação de colunas ausentes
-- Alinha o schema.sql com tudo que o código usa.
-- Executar UMA vez, em ordem, após schema.sql
-- ============================================================

-- ── employees: campos pessoais ────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS social_name       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS gender            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nationality       VARCHAR(80)  DEFAULT 'Brasileiro(a)',
  ADD COLUMN IF NOT EXISTS place_of_birth    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS mothers_name      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS rg_issuer         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS phone_secondary   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS has_disability    BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disability_type   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes             TEXT;

-- ── employees: endereço completo ─────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS address_number    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_comp      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip_code          VARCHAR(10);

-- ── employees: dados bancários ────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bank_code         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS bank_agency       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bank_account      VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(20) DEFAULT 'CORRENTE',
  ADD COLUMN IF NOT EXISTS pix_key           VARCHAR(150);

-- ── employees: vínculo e jornada ─────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_schedule     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS work_shift        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS weekly_hours      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cbo               VARCHAR(10);

-- ── employees: documentos trabalhistas ───────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pis_pasep         VARCHAR(14),
  ADD COLUMN IF NOT EXISTS ctps_number       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ctps_series       VARCHAR(10);

-- ── employees: saúde e benefícios ────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS aso_date          DATE,
  ADD COLUMN IF NOT EXISTS vt_active         BOOLEAN,
  ADD COLUMN IF NOT EXISTS vr_card_received  BOOLEAN;

-- ── employees: controle de documentação ──────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS contract_received BOOLEAN,
  ADD COLUMN IF NOT EXISTS contract_signed   BOOLEAN;

-- ── employees: campos de planilha / importação ───────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS mother_name       VARCHAR(200),   -- alias de mothers_name
  ADD COLUMN IF NOT EXISTS observations      TEXT,
  ADD COLUMN IF NOT EXISTS import_order      INTEGER,
  ADD COLUMN IF NOT EXISTS dismissal_type    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS imported_from     VARCHAR(50);

-- ── employees: outros campos usados em rotas ─────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_code     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_login        TIMESTAMPTZ;

-- Garante uniqueness de employee_code onde não criou índice ainda
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'employees' AND indexname = 'employees_employee_code_key'
  ) THEN
    CREATE UNIQUE INDEX employees_employee_code_key ON employees(employee_code) WHERE employee_code IS NOT NULL;
  END IF;
END $$;

-- ── attendance_records: coluna unit_id e has_medical_cert ────
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS unit_id          UUID REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS has_medical_cert BOOLEAN DEFAULT FALSE;

-- Conflict unique necessário para o ON CONFLICT da rota de presença
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'attendance_records' AND indexname = 'attendance_records_emp_date_type_key'
  ) THEN
    CREATE UNIQUE INDEX attendance_records_emp_date_type_key ON attendance_records(employee_id, record_date, type);
  END IF;
END $$;

-- ── users: last_login ─────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- ── whatsapp_logs (caso migration v7 não tenha sido rodada) ──
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID        REFERENCES employees(id) ON DELETE SET NULL,
  phone          VARCHAR(20),
  message        TEXT        NOT NULL,
  type           VARCHAR(30) NOT NULL DEFAULT 'GERAL',
  status         VARCHAR(15) NOT NULL DEFAULT 'PENDENTE',
  error_message  TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices úteis ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_status      ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_unit_id     ON employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_birth_mmdd  ON employees(EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date));
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date   ON attendance_records(employee_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_logs_employee     ON whatsapp_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_wpp_logs_type_date    ON whatsapp_logs(type, sent_at DESC);

-- ── View v_unit_summary usada pelo dashboard ─────────────────
CREATE OR REPLACE VIEW v_unit_summary AS
SELECT
  u.*,
  COUNT(e.id)                                            AS total_employees,
  COUNT(e.id) FILTER (WHERE e.status = 'ATIVO')          AS active_count,
  COUNT(e.id) FILTER (WHERE e.status = 'AFASTADO')       AS away_count,
  COUNT(e.id) FILTER (WHERE e.status = 'DESLIGADO')      AS dismissed_count
FROM units u
LEFT JOIN employees e ON e.unit_id = u.id
GROUP BY u.id;
