// unit.routes.js
const express = require('express');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const unitRouter = express.Router();
unitRouter.use(authenticate);

unitRouter.get('/', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.*,
        COUNT(e.id) FILTER (WHERE e.status = 'ATIVO')     AS active_count,
        COUNT(e.id) FILTER (WHERE e.status = 'AFASTADO')  AS away_count,
        COUNT(e.id) FILTER (WHERE e.status = 'DESLIGADO') AS dismissed_count
      FROM units u LEFT JOIN employees e ON e.unit_id = u.id
      WHERE u.is_active = TRUE GROUP BY u.id ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

unitRouter.get('/:id', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.*,
        COUNT(e.id) FILTER (WHERE e.status = 'ATIVO')     AS active_count,
        COUNT(e.id) FILTER (WHERE e.status = 'AFASTADO')  AS away_count
      FROM units u LEFT JOIN employees e ON e.unit_id = u.id
      WHERE u.id = $1 GROUP BY u.id
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

unitRouter.post('/', can('units:manage'), async (req, res, next) => {
  try {
    const { code, name, address, city, state, phone, email, capacity } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Código e nome obrigatórios.' });
    const { rows } = await db.query(
      'INSERT INTO units (code,name,address,city,state,phone,email,capacity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [code, name, address||null, city||null, state||null, phone||null, email||null, capacity||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

unitRouter.put('/:id', can('units:manage'), async (req, res, next) => {
  try {
    const d = req.body;
    const fields = Object.keys(d).filter(k => !['id','created_at'].includes(k));
    if (!fields.length) return res.status(400).json({ error: 'Sem campos.' });
    const set = fields.map((f,i) => `${f} = $${i+2}`).join(', ');
    const { rows } = await db.query(`UPDATE units SET ${set} WHERE id = $1 RETURNING *`, [req.params.id, ...fields.map(f=>d[f])]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// position routes
const positionRouter = express.Router();
positionRouter.use(authenticate);

positionRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM positions WHERE is_active = TRUE ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

positionRouter.post('/', can('units:manage'), async (req, res, next) => {
  try {
    const { name, cbo_code } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
    const { rows } = await db.query(
      'INSERT INTO positions (name, cbo_code) VALUES ($1,$2) RETURNING *',
      [name, cbo_code||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// dashboard routes
const dashboardRouter = express.Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/general', can('dashboard:general'), async (req, res, next) => {
  try {
    const [totals, ranking, admissions, attendance] = await Promise.all([
      db.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'ATIVO')     AS active,
        COUNT(*) FILTER (WHERE status = 'AFASTADO')  AS away,
        COUNT(*) FILTER (WHERE status = 'DESLIGADO') AS dismissed
        FROM employees`),
      db.query(`SELECT u.name AS unit_name, u.code,
        COUNT(a.id) FILTER (WHERE a.type = 'FALTA')  AS absences,
        COUNT(a.id) FILTER (WHERE a.type = 'ATRASO') AS late_arrivals
        FROM units u LEFT JOIN attendance_records a ON a.unit_id = u.id
          AND DATE_TRUNC('month', a.record_date) = DATE_TRUNC('month', NOW())
        GROUP BY u.name, u.code ORDER BY absences DESC LIMIT 10`),
      db.query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'PENDENTE')   AS pending,
        COUNT(*) FILTER (WHERE status = 'EM_ANALISE') AS in_review
        FROM admission_processes`),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE type = 'FALTA')  AS total_absences,
        COUNT(*) FILTER (WHERE type = 'ATRASO') AS late_arrivals,
        SUM(minutes_late) AS total_minutes_late
        FROM attendance_records WHERE DATE_TRUNC('month', record_date) = DATE_TRUNC('month', NOW())`),
    ]);
    res.json({
      totals:             totals.rows[0],
      unit_ranking:       ranking.rows,
      digital_admissions: admissions.rows[0],
      attendance:         attendance.rows[0],
    });
  } catch (err) { next(err); }
});

dashboardRouter.get('/unit/:unitId', can('dashboard:unit'), async (req, res, next) => {
  try {
    const unitId = req.user.role === 'SUPERVISOR' ? req.user.unit_id : req.params.unitId;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [unit, employees, attendance] = await Promise.all([
      db.query(`SELECT u.*,
        COUNT(e.id) FILTER (WHERE e.status = 'ATIVO') AS active_count
        FROM units u LEFT JOIN employees e ON e.unit_id = u.id WHERE u.id = $1 GROUP BY u.id`, [unitId]),
      db.query(`SELECT e.id, e.full_name, e.employee_code, e.status, p.name AS position,
        (SELECT COUNT(*) FROM attendance_records a WHERE a.employee_id = e.id AND a.type = 'FALTA' AND TO_CHAR(a.record_date,'YYYY-MM') = $2) AS month_absences,
        (SELECT COUNT(*) FROM attendance_records a WHERE a.employee_id = e.id AND a.type = 'ATRASO' AND TO_CHAR(a.record_date,'YYYY-MM') = $2) AS month_late
        FROM employees e LEFT JOIN positions p ON e.position_id = p.id
        WHERE e.unit_id = $1 AND e.status = 'ATIVO' ORDER BY e.full_name`, [unitId, targetMonth]),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE type = 'FALTA')  AS absences,
        COUNT(*) FILTER (WHERE type = 'ATRASO') AS late_arrivals
        FROM attendance_records WHERE unit_id = $1 AND TO_CHAR(record_date,'YYYY-MM') = $2`, [unitId, targetMonth]),
    ]);

    if (!unit.rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json({ unit: unit.rows[0], employees: employees.rows, attendance: attendance.rows[0] });
  } catch (err) { next(err); }
});

dashboardRouter.get('/supervisor', authenticate, async (req, res, next) => {
  try {
    const supId = req.query.supervisor_id || req.user.id;
    const { rows: team }    = await db.query(`SELECT e.id, e.full_name, e.employee_code, e.status, p.name AS position, u.name AS unit_name FROM employees e LEFT JOIN positions p ON e.position_id = p.id LEFT JOIN units u ON e.unit_id = u.id WHERE e.supervisor_id = $1 ORDER BY e.full_name`, [supId]);
    const { rows: summary } = await db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='ATIVO') AS active FROM employees WHERE supervisor_id = $1`, [supId]);
    res.json({ supervisor_id: supId, team, summary: summary[0] });
  } catch (err) { next(err); }
});

dashboardRouter.get('/attendance-trends', can('dashboard:general'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT DATE_TRUNC('month', record_date)::DATE AS month,
             COUNT(*) FILTER (WHERE type = 'FALTA')  AS absences,
             COUNT(*) FILTER (WHERE type = 'ATRASO') AS late_arrivals
      FROM attendance_records WHERE record_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', record_date) ORDER BY month`);
    res.json(rows);
  } catch (err) { next(err); }
});

// notification routes
const notifRouter = express.Router();
notifRouter.use(authenticate);

notifRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT n.*, e.full_name AS employee_name FROM notifications n LEFT JOIN employees e ON n.employee_id = e.id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

notifRouter.patch('/read-all', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

notifRouter.patch('/:id/read', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = { unitRouter, positionRouter, dashboardRouter, notifRouter };
