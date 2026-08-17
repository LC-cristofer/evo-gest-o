/**
 * Relatório Mensal — /api/v1/relatorio
 */
const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /current — relatório do mês atual ───────────────────
router.get('/current', async (req, res, next) => {
  try {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const { rows } = await db.query(
      'SELECT * FROM relatorios_mensais WHERE user_id = $1 AND year = $2 AND month = $3',
      [req.user.id, year, month]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── GET /:year/:month ────────────────────────────────────────
router.get('/:year/:month', async (req, res, next) => {
  try {
    const userId = req.query.user_id && ['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)
      ? req.query.user_id
      : req.user.id;

    const { rows } = await db.query(
      'SELECT * FROM relatorios_mensais WHERE user_id = $1 AND year = $2 AND month = $3',
      [userId, req.params.year, req.params.month]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── GET /list/me — lista de relatórios do usuário ───────────
router.get('/list/me', async (req, res, next) => {
  try {
    const userId = req.query.user_id && ['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)
      ? req.query.user_id
      : req.user.id;

    const { rows } = await db.query(
      `SELECT id, year, month, status, submitted_at
       FROM relatorios_mensais WHERE user_id = $1
       ORDER BY year DESC, month DESC LIMIT 24`,
      [userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST / — salvar ou enviar relatório ─────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { year, month, content, highlights, challenges, goals_next, submit,
            form_type, form_data } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'Ano e mês obrigatórios.' });

    const now = new Date();
    const curYear  = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const isCurrentMonth = (year == curYear && month == curMonth);
    const isPrevMonth    = (year == curYear && month == curMonth - 1)
      || (curMonth === 1 && year == curYear - 1 && month === 12);

    if (submit && !isCurrentMonth && !isPrevMonth) {
      return res.status(400).json({ error: 'Só é possível enviar relatório do mês atual ou anterior.' });
    }

    const status = submit ? 'ENVIADO' : 'RASCUNHO';
    const fType  = form_type || 'GERAL';

    const { rows: existing } = await db.query(
      'SELECT id, status FROM relatorios_mensais WHERE user_id = $1 AND year = $2 AND month = $3',
      [req.user.id, year, month]
    );
    if (existing[0]?.status === 'ENVIADO' && submit) {
      return res.status(400).json({ error: 'Relatório já enviado para este mês.' });
    }

    const { rows } = await db.query(`
      INSERT INTO relatorios_mensais
        (user_id, employee_id, year, month, content, highlights, challenges, goals_next,
         status, submitted_at, form_type, form_data)
      VALUES ($1,
        (SELECT employee_id FROM users WHERE id = $1),
        $2, $3, $4, $5, $6, $7, $8, ${submit ? 'NOW()' : 'NULL'}, $9, $10)
      ON CONFLICT (user_id, year, month)
      DO UPDATE SET
        content     = $4,
        highlights  = $5,
        challenges  = $6,
        goals_next  = $7,
        status      = $8,
        submitted_at = CASE WHEN $8 = 'ENVIADO' AND relatorios_mensais.status != 'ENVIADO'
                            THEN NOW() ELSE relatorios_mensais.submitted_at END,
        form_type   = $9,
        form_data   = $10,
        updated_at  = NOW()
      RETURNING *
    `, [req.user.id, year, month,
        content||'', highlights||'', challenges||'', goals_next||'',
        status, fType, form_data ? JSON.stringify(form_data) : null]);

    if (submit) {
      await db.query(
        `UPDATE pendencias SET resolved_at = NOW()
         WHERE user_id = $1 AND type = 'RELATORIO'
           AND ref_year = $2 AND ref_month = $3 AND resolved_at IS NULL`,
        [req.user.id, year, month]
      ).catch(() => {});
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── GET /team/:year/:month — visão supervisor ────────────────
router.get('/team/:year/:month', async (req, res, next) => {
  try {
    if (!['TI','DIRETORIA','RH','SUPERVISOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    const params = [req.params.year, req.params.month];
    let unitFilter = '';
    if (req.user.role === 'SUPERVISOR') {
      unitFilter = ' AND u.unit_id = $3';
      params.push(req.user.unit_id);
    }

    const { rows } = await db.query(`
      SELECT u.id AS user_id, u.name, u.unit_id, un.name AS unit_name,
             r.status AS relatorio_status, r.submitted_at
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN relatorios_mensais r
        ON r.user_id = u.id AND r.year = $1 AND r.month = $2
      WHERE u.role = 'FUNCIONARIO' AND u.is_active = TRUE
      ${unitFilter}
      ORDER BY u.name
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
