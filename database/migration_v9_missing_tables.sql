-- ============================================================
-- MIGRAÇÃO V9 — Tabelas ausentes do schema base
-- Cria todas as tabelas que o código usa mas não estão em schema.sql
-- ============================================================

-- ── employee_history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_history (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,  -- ADMISSAO, DESLIGAMENTO, MUDANCA_UNIDADE, AFASTAMENTO, etc.
  dismissal_type  VARCHAR(50),
  description     TEXT,
  effective_date  DATE,
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_history_employee ON employee_history(employee_id, created_at DESC);

-- ── employee_documents_v2 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_documents_v2 (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path     VARCHAR(500) NOT NULL,
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  category      VARCHAR(100) DEFAULT 'Geral',
  description   TEXT,
  uploaded_by   UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_docs_v2_employee ON employee_documents_v2(employee_id);

-- ── audit_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50) NOT NULL,   -- CREATE, UPDATE, DELETE, LOGIN, etc.
  entity      VARCHAR(100),
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs(created_at DESC);

-- ── messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  is_read     BOOLEAN     DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id, created_at DESC);

-- ── meeting_minutes (atas) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(300) NOT NULL,
  meeting_date DATE         NOT NULL,
  location     VARCHAR(200),
  content      TEXT,
  participants JSONB        DEFAULT '[]',
  unit_id      UUID         REFERENCES units(id),
  employee_id  UUID         REFERENCES employees(id) ON DELETE SET NULL,
  file_path    VARCHAR(500),
  status       VARCHAR(30)  DEFAULT 'PUBLICADA',
  created_by   UUID         REFERENCES users(id),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_minutes_unit    ON meeting_minutes(unit_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_minutes_date    ON meeting_minutes(meeting_date DESC);

-- ── faq_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faq_items (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  question     TEXT         NOT NULL,
  answer       TEXT         NOT NULL,
  category     VARCHAR(100) DEFAULT 'Geral',
  order_index  INTEGER      DEFAULT 0,
  is_published BOOLEAN      DEFAULT TRUE,
  created_by   UUID         REFERENCES users(id),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ── home_posts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_posts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(300) NOT NULL,
  content      TEXT,
  summary      VARCHAR(500),
  cover_url    VARCHAR(500),
  media_urls   JSONB        DEFAULT '[]',
  type         VARCHAR(30)  DEFAULT 'NOTICIA',  -- NOTICIA, EVENTO, COMUNICADO
  is_published BOOLEAN      DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  views        INTEGER      DEFAULT 0,
  author_id    UUID         REFERENCES users(id),
  author_name  VARCHAR(200),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_home_posts_published ON home_posts(is_published, published_at DESC);

-- ── calendar_event_participants ───────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_participants (
  event_id    UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, employee_id)
);

-- ── undo_log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS undo_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,
  entity      VARCHAR(100),
  entity_id   UUID,
  snapshot    JSONB,
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_undo_log_user    ON undo_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_undo_log_expires ON undo_log(expires_at);

-- ── benefit_requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benefit_requests (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        VARCHAR(100) NOT NULL,
  status      VARCHAR(30) DEFAULT 'PENDENTE',
  details     JSONB,
  notes       TEXT,
  reviewed_by UUID        REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benefit_requests_employee ON benefit_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_benefit_requests_status   ON benefit_requests(status);

-- ── Garante colunas que algumas rotas assumem em notifications ─
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link        VARCHAR(500),
  ADD COLUMN IF NOT EXISTS is_read     BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at     TIMESTAMPTZ;

-- ON CONFLICT DO NOTHING em notifications precisa de unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'notifications_user_type_emp_key'
  ) THEN
    CREATE UNIQUE INDEX notifications_user_type_emp_key
      ON notifications(user_id, type, employee_id)
      WHERE employee_id IS NOT NULL;
  END IF;
END $$;

-- ── calendar_events: campo type e color que o código usa ──────
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS type       VARCHAR(30) DEFAULT 'GERAL',
  ADD COLUMN IF NOT EXISTS color      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS all_day    BOOLEAN DEFAULT FALSE;
