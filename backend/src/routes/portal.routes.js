/**
 * Portal do Funcionário — /api/v1/portal
 * Dashboard pessoal: horas, pendências, avisos, dados do funcionário
 */
const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /me — dados completos do funcionário logado ──────────
router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.unit_id, u.employee_id,
        e.full_name, e.cpf, e.employee_code, e.position_id,
        e.unit_id AS emp_unit_id, e.status AS emp_status,
        e.hire_date, e.birth_date, e.photo_url,
        p.name AS position_name,
        un.name AS unit_name,
        sup.name AS supervisor_name
      FROM users u
      LEFT JOIN employees e  ON e.id = u.employee_id
      LEFT JOIN positions  p  ON p.id = e.position_id
      LEFT JOIN units      un ON un.id = COALESCE(u.unit_id, e.unit_id)
      LEFT JOIN users      sup ON sup.unit_id = COALESCE(u.unit_id, e.unit_id)
        AND sup.role = 'SUPERVISOR' AND sup.is_active = TRUE
      WHERE u.id = $1
      LIMIT 1
    `, [req.user.id]);
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── GET /dashboard — dados do dashboard do funcionário ───────
router.get('/dashboard', async (req, res, next) => {
  try {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    // Horas do mês
    let hours = { hours_expected: 0, hours_worked: 0, absences_justified: 0, absences_unjustified: 0 };
    if (req.user.employee_id) {
      const { rows: hRows } = await db.query(
        'SELECT * FROM employee_hours WHERE employee_id = $1 AND year = $2 AND month = $3',
        [req.user.employee_id, year, month]
      );
      if (hRows[0]) hours = hRows[0];
    }

    // Diário de hoje
    const { rows: todayDiary } = await db.query(
      'SELECT status FROM diarios WHERE user_id = $1 AND date = $2',
      [req.user.id, today]
    );

    // Relatório do mês atual
    const { rows: relatorio } = await db.query(
      'SELECT status FROM relatorios_mensais WHERE user_id = $1 AND year = $2 AND month = $3',
      [req.user.id, year, month]
    );

    // Streak
    const { rows: streakRows } = await db.query(`
      SELECT date::text FROM diarios
      WHERE user_id = $1 AND status = 'ENVIADO' AND date <= $2::date
      ORDER BY date DESC LIMIT 30
    `, [req.user.id, today]);
    let streak = 0;
    const streakDates = new Set(streakRows.map(r => r.date));
    let cursor = new Date(today);
    for (let i = 0; i < 30; i++) {
      if (!streakDates.has(cursor.toLocaleDateString('en-CA'))) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Pendências abertas
    const { rows: pendRows } = await db.query(
      `SELECT type, ref_date FROM pendencias
       WHERE user_id = $1 AND resolved_at IS NULL ORDER BY ref_date DESC LIMIT 10`,
      [req.user.id]
    );

    // Notificações não lidas
    const { rows: notifRows } = await db.query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    // Avisos/notícias publicados (últimos 5)
    const { rows: posts } = await db.query(
      `SELECT id, title, summary, type, cover_url, published_at
       FROM home_posts WHERE is_published = TRUE
       ORDER BY published_at DESC LIMIT 5`
    );

    // Documentos úteis
    const { rows: usefulDocs } = await db.query(
      `SELECT id, name, file_url, description, category
       FROM useful_documents ORDER BY created_at DESC LIMIT 10`
    ).catch(() => ({ rows: [] }));

    res.json({
      hours,
      diary_today: todayDiary[0]?.status || null,
      relatorio_month: relatorio[0]?.status || null,
      streak,
      pendencias: pendRows,
      unread_notifications: parseInt(notifRows[0]?.cnt || 0),
      posts,
      useful_docs: usefulDocs,
    });
  } catch (err) { next(err); }
});

// ── GET /pendencias — pendências do usuário ──────────────────
router.get('/pendencias', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM pendencias WHERE user_id = $1
       AND resolved_at IS NULL ORDER BY ref_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /hours — horas do mês (ou mês específico) ───────────
router.get('/hours', async (req, res, next) => {
  try {
    const now  = new Date();
    const year  = parseInt(req.query.year  || now.getFullYear());
    const month = parseInt(req.query.month || now.getMonth() + 1);

    if (!req.user.employee_id) return res.json(null);

    const { rows } = await db.query(
      'SELECT * FROM employee_hours WHERE employee_id = $1 AND year = $2 AND month = $3',
      [req.user.employee_id, year, month]
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// ── PUT /hours (RH/TI only) — lançar horas de um funcionário ─
router.put('/hours/:employee_id', async (req, res, next) => {
  try {
    if (!['TI','RH','DIRETORIA'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
    const { year, month, hours_expected, hours_worked, absences_justified, absences_unjustified, notes } = req.body;

    const { rows } = await db.query(`
      INSERT INTO employee_hours
        (employee_id, year, month, hours_expected, hours_worked, absences_justified, absences_unjustified, notes, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (employee_id, year, month)
      DO UPDATE SET
        hours_expected       = $4,
        hours_worked         = $5,
        absences_justified   = $6,
        absences_unjustified = $7,
        notes                = $8,
        updated_by           = $9,
        updated_at           = NOW()
      RETURNING *
    `, [req.params.employee_id, year, month,
        hours_expected||0, hours_worked||0,
        absences_justified||0, absences_unjustified||0,
        notes||'', req.user.id]);

    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
