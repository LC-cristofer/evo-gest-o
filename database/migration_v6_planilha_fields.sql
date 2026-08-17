-- ============================================================
-- MIGRAÇÃO V6 — Campos da Planilha LISTA_GERAL_ARAUCARIA
-- Executar após schema.sql e migration_v5_employee_portal.sql
--
-- Novos campos adicionados à tabela employees:
--   rg, mother_name, cbo, weekly_hours, work_schedule,
--   work_shift, aso_date, vt_active, vr_card_received,
--   pix_key, contract_received, contract_signed,
--   observations, import_order
-- ============================================================

-- ── Identificação complementar ───────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS mother_name        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rg                 VARCHAR(20);

-- ── Cargo / CBO ──────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cbo                VARCHAR(10);   -- ex: "3311-10"

-- ── Jornada de trabalho ──────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_hours       VARCHAR(10),   -- ex: "44"
  ADD COLUMN IF NOT EXISTS work_schedule      VARCHAR(50),   -- ex: "07:30-11:30-13:00-17:00"
  ADD COLUMN IF NOT EXISTS work_shift         VARCHAR(20);   -- Diurno / Noturno / Misto

-- ── Saúde ocupacional ────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS aso_date           DATE;          -- data do ASO mais recente

-- ── Benefícios ───────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS vt_active          BOOLEAN,       -- Vale Transporte ativo
  ADD COLUMN IF NOT EXISTS vr_card_received   BOOLEAN,       -- Cartão VR entregue
  ADD COLUMN IF NOT EXISTS pix_key            VARCHAR(150);  -- Chave PIX do funcionário

-- ── Documentação ─────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS contract_received  BOOLEAN,       -- Contrato recebido
  ADD COLUMN IF NOT EXISTS contract_signed    BOOLEAN;       -- Contrato assinado

-- ── Extras ───────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS observations       TEXT,          -- Observações livres
  ADD COLUMN IF NOT EXISTS import_order       INTEGER;       -- Número de ordem da planilha

-- ── Índices úteis ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_unit_id
  ON employees(unit_id);

CREATE INDEX IF NOT EXISTS idx_employees_aso_date
  ON employees(aso_date)
  WHERE aso_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_contract_signed
  ON employees(contract_signed)
  WHERE contract_signed IS NOT NULL;

-- ── Comentários ──────────────────────────────────────────────
COMMENT ON COLUMN employees.cbo              IS 'Código Brasileiro de Ocupações';
COMMENT ON COLUMN employees.weekly_hours     IS 'Carga horária semanal em horas (ex: 44)';
COMMENT ON COLUMN employees.work_schedule    IS 'Horário de trabalho (ex: 07:30-11:30-13:00-17:00)';
COMMENT ON COLUMN employees.work_shift       IS 'Turno: Diurno, Noturno ou Misto';
COMMENT ON COLUMN employees.aso_date         IS 'Data do último Atestado de Saúde Ocupacional';
COMMENT ON COLUMN employees.vt_active        IS 'Funcionário recebe Vale Transporte';
COMMENT ON COLUMN employees.vr_card_received IS 'Cartão de Vale Refeição já entregue ao funcionário';
COMMENT ON COLUMN employees.pix_key          IS 'Chave PIX para pagamentos';
COMMENT ON COLUMN employees.contract_received IS 'Contrato de trabalho recebido pela empresa';
COMMENT ON COLUMN employees.contract_signed  IS 'Contrato de trabalho assinado pelo funcionário';
COMMENT ON COLUMN employees.observations     IS 'Observações gerais da planilha de origem';
COMMENT ON COLUMN employees.import_order     IS 'Número de ordem (ORDEM) da planilha importada';
