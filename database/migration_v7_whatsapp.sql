-- ============================================================
-- MIGRAÇÃO V7 — Integração WhatsApp (Evolution API)
-- Executar após migration_v6_planilha_fields.sql
-- ============================================================

-- Tabela de log de mensagens WhatsApp enviadas
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID        REFERENCES employees(id) ON DELETE SET NULL,
  phone          VARCHAR(20),
  message        TEXT        NOT NULL,
  type           VARCHAR(30) NOT NULL DEFAULT 'GERAL',
  -- Tipos: ANIVERSARIO | DOCUMENTO | ADMISSAO | GERAL
  status         VARCHAR(15) NOT NULL DEFAULT 'PENDENTE',
  -- Status: PENDENTE | ENVIADO | ERRO
  error_message  TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_wpp_logs_employee   ON whatsapp_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_wpp_logs_type_date  ON whatsapp_logs(type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_logs_status     ON whatsapp_logs(status);

COMMENT ON TABLE  whatsapp_logs                IS 'Histórico de mensagens WhatsApp enviadas pelo sistema';
COMMENT ON COLUMN whatsapp_logs.type           IS 'ANIVERSARIO | DOCUMENTO | ADMISSAO | GERAL';
COMMENT ON COLUMN whatsapp_logs.status         IS 'PENDENTE | ENVIADO | ERRO';
COMMENT ON COLUMN whatsapp_logs.error_message  IS 'Mensagem de erro retornada pela Evolution API';
