/**
 * Diário de Bordo — /api/v1/diario
 * Acesso: todos os roles autenticados
 */
const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /questions — perguntas configuradas ──────────────────
router.get('/questions', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM diario_questions WHERE is_active = TRUE ORDER BY sort_order, id'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /today — entrada de hoje do usuário ──────────────────
router.get('/today', async (req, res, next) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const { rows } = await db.query(
      'SELECT * FROM diarios WHERE user_id = $1 AND date = $2',
      [req.user.id, today]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── GET /streak — sequência de dias preenchidos ──────────────
router.get('/streak', async (req, res, next) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    // Últimos 60 dias enviados
    const { rows } = await db.query(`
      SELECT date::text FROM diarios
      WHERE user_id = $1 AND status = 'ENVIADO'
        AND date <= $2::date
      ORDER BY date DESC
      LIMIT 60
    `, [req.user.id, today]);

    const dates = new Set(rows.map(r => r.date));
    let streak = 0;
    let cursor = new Date(today);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = cursor.toLocaleDateString('en-CA');
      if (!dates.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const total = rows.length;
    res.json({ streak, total });
  } catch (err) { next(err); }
});

// ── GET /history?month=2025-04 — histórico do mês ────────────
router.get('/history', async (req, res, next) => {
  try {
    const { month } = req.query; // 'YYYY-MM'
    const userId = req.query.user_id && ['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)
      ? req.query.user_id
      : req.user.id;

    let query = `
      SELECT date::text, status, submitted_at
      FROM diarios
      WHERE user_id = $1
    `;
    const params = [userId];

    if (month) {
      query += ' AND to_char(date, \'YYYY-MM\') = $2';
      params.push(month);
    } else {
      query += ` AND date >= date_trunc('month', CURRENT_DATE)`;
    }
    query += ' ORDER BY date DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /:date — entrada de uma data específica ──────────────
router.get('/:date', async (req, res, next) => {
  try {
    const userId = req.query.user_id && ['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)
      ? req.query.user_id
      : req.user.id;

    const { rows } = await db.query(
      'SELECT * FROM diarios WHERE user_id = $1 AND date = $2',
      [userId, req.params.date]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── POST / — salvar rascunho ou enviar ───────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { date, answers, submit } = req.body;
    if (!date) return res.status(400).json({ error: 'Data obrigatória.' });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (date !== today) {
      return res.status(400).json({ error: 'Só é possível preencher o diário do dia atual.' });
    }

    // Verifica se já foi enviado (não pode reabrir)
    const { rows: existing } = await db.query(
      'SELECT id, status FROM diarios WHERE user_id = $1 AND date = $2',
      [req.user.id, date]
    );
    if (existing[0]?.status === 'ENVIADO' && submit) {
      return res.status(400).json({ error: 'Diário já enviado para este dia.' });
    }

    const status = submit ? 'ENVIADO' : 'RASCUNHO';
    const submittedAt = submit ? 'NOW()' : 'NULL';

    const { rows } = await db.query(`
      INSERT INTO diarios (user_id, employee_id, date, answers, status, submitted_at)
      VALUES ($1,
        (SELECT employee_id FROM users WHERE id = $1),
        $2, $3, $4, ${submit ? 'NOW()' : 'NULL'})
      ON CONFLICT (user_id, date)
      DO UPDATE SET answers = $3, status = $4,
        submitted_at = CASE WHEN $4 = 'ENVIADO' AND diarios.status != 'ENVIADO'
                            THEN NOW() ELSE diarios.submitted_at END,
        updated_at = NOW()
      RETURNING *
    `, [req.user.id, date, JSON.stringify(answers || {}), status]);

    // Se enviou, resolver pendência
    if (submit) {
      await db.query(
        `UPDATE pendencias SET resolved_at = NOW()
         WHERE user_id = $1 AND type = 'DIARIO' AND ref_date = $2 AND resolved_at IS NULL`,
        [req.user.id, date]
      ).catch(() => {});
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── GET /team/:date — supervisor: status da equipe ───────────
router.get('/team/:date', async (req, res, next) => {
  try {
    if (!['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    let unitFilter = '';
    const params = [req.params.date];
    if (req.user.role === 'SUPERVISOR') {
      unitFilter = ' AND u.unit_id = $2';
      params.push(req.user.unit_id);
    }

    const { rows } = await db.query(`
      SELECT
        u.id AS user_id, u.name, u.unit_id,
        un.name AS unit_name,
        d.status AS diario_status,
        d.submitted_at
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN diarios d ON d.user_id = u.id AND d.date = $1
      WHERE u.role = 'FUNCIONARIO' AND u.is_active = TRUE
      ${unitFilter}
      ORDER BY u.name
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
