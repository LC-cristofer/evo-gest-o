const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../config/database');
const { authenticate, authorize, can } = require('../middleware/auth');

// ─── Attendance ───────────────────────────────────────────────
const attendanceRouter = express.Router();
attendanceRouter.use(authenticate);

attendanceRouter.post('/', can('employees:update'), async (req, res, next) => {
  try {
    const { employee_id, record_date, type, minutes_late, justification, has_medical_cert } = req.body;
    if (!employee_id || !record_date || !type) return res.status(400).json({ error: 'Campos obrigatórios: employee_id, record_date, type.' });
    const types = ['FALTA','ATRASO','FALTA_JUSTIFICADA','MEIO_PERIODO'];
    if (!types.includes(type)) return res.status(400).json({ error: `Tipo inválido. Use: ${types.join(', ')}` });

    const { rows: emp } = await db.query('SELECT unit_id FROM employees WHERE id = $1', [employee_id]);
    if (!emp[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const { rows } = await db.query(`
      INSERT INTO attendance_records (employee_id, unit_id, record_date, type, minutes_late, justification, has_medical_cert, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (employee_id, record_date, type) DO UPDATE
        SET minutes_late = EXCLUDED.minutes_late, justification = EXCLUDED.justification
      RETURNING *
    `, [employee_id, emp[0].unit_id, record_date, type, minutes_late||0, justification||null, has_medical_cert||false, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

attendanceRouter.get('/employee/:id', can('employees:read'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const params = [req.params.id];
    let extra = '';
    if (month && year) { params.push(`${year}-${String(month).padStart(2,'0')}`); extra = `AND TO_CHAR(record_date,'YYYY-MM') = $2`; }
    const { rows } = await db.query(`SELECT * FROM attendance_records WHERE employee_id = $1 ${extra} ORDER BY record_date DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

attendanceRouter.get('/unit/:unitId/summary', can('dashboard:unit'), async (req, res, next) => {
  try {
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const { rows } = await db.query(`
      SELECT e.id, e.full_name, e.employee_code,
        COUNT(a.id) FILTER (WHERE a.type = 'FALTA')            AS absences,
        COUNT(a.id) FILTER (WHERE a.type = 'FALTA_JUSTIFICADA') AS justified,
        COUNT(a.id) FILTER (WHERE a.type = 'ATRASO')           AS late_arrivals,
        COALESCE(SUM(a.minutes_late), 0)                        AS total_minutes_late
      FROM employees e LEFT JOIN attendance_records a ON a.employee_id = e.id
        AND TO_CHAR(a.record_date,'YYYY-MM') = $2
      WHERE e.unit_id = $1 AND e.status = 'ATIVO'
      GROUP BY e.id, e.full_name, e.employee_code ORDER BY absences DESC
    `, [req.params.unitId, targetMonth]);
    res.json(rows);
  } catch (err) { next(err); }
});

attendanceRouter.delete('/:id', can('employees:update'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM attendance_records WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ message: 'Removido.' });
  } catch (err) { next(err); }
});

// ─── Benefits ─────────────────────────────────────────────────
const benefitRouter = express.Router();
benefitRouter.use(authenticate);

benefitRouter.get('/employee/:id', can('benefits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM employee_benefits WHERE employee_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

benefitRouter.post('/', can('benefits:manage'), async (req, res, next) => {
  try {
    const { employee_id, benefit_type, value, operator, card_number, start_date, notes } = req.body;
    if (!employee_id || !benefit_type) return res.status(400).json({ error: 'employee_id e benefit_type obrigatórios.' });
    const { rows } = await db.query(
      `INSERT INTO employee_benefits (employee_id, benefit_type, value, operator, card_number, start_date, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ATIVO',$8) RETURNING *`,
      [employee_id, benefit_type, value||null, operator||null, card_number||null, start_date||null, notes||null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

benefitRouter.patch('/:id/status', can('benefits:manage'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ATIVO','INATIVO','CANCELADO'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    const { rows } = await db.query(
      `UPDATE employee_benefits SET status = $1, end_date = CASE WHEN $1 IN ('INATIVO','CANCELADO') THEN CURRENT_DATE ELSE end_date END WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

benefitRouter.get('/requests', can('benefits:manage'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT br.*, e.full_name, e.employee_code, u.name AS unit_name
      FROM benefit_requests br JOIN employees e ON br.employee_id = e.id LEFT JOIN units u ON e.unit_id = u.id
      WHERE br.status = 'PENDENTE' ORDER BY br.created_at DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

benefitRouter.patch('/requests/:id/review', can('benefits:manage'), async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    if (!['APROVADO','REJEITADO'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    const { rows } = await db.query(
      'UPDATE benefit_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW(), resolution=$3 WHERE id=$4 RETURNING *',
      [status, req.user.id, resolution||null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── Users ────────────────────────────────────────────────────
const userRouter = express.Router();
userRouter.use(authenticate, authorize('TI'));

userRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_login, u.created_at, un.name AS unit_name
       FROM users u LEFT JOIN units un ON u.unit_id = un.id ORDER BY u.name`);
    res.json(rows);
  } catch (err) { next(err); }
});

userRouter.post('/', async (req, res, next) => {
  try {
    const { name, email, role, unit_id, password } = req.body;
    if (!name||!email||!role||!password) return res.status(400).json({ error: 'Campos obrigatórios.' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO users (name,email,password_hash,role,unit_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,unit_id,is_active',
      [name, email.toLowerCase(), hash, role, unit_id||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

userRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, email, role, unit_id } = req.body;
    const { rows } = await db.query(
      'UPDATE users SET name=COALESCE($2,name), email=COALESCE($3,email), role=COALESCE($4,role), unit_id=$5 WHERE id=$1 RETURNING id,name,email,role,unit_id,is_active',
      [req.params.id, name, email?.toLowerCase(), role, unit_id||null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

userRouter.patch('/:id/toggle', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Não pode desativar sua própria conta.' });
    const { rows } = await db.query('UPDATE users SET is_active = NOT is_active WHERE id=$1 RETURNING id,name,is_active', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

userRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
    const hash   = await bcrypt.hash(tempPw, 12);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ tempPassword: tempPw, message: 'Senha resetada.' });
  } catch (err) { next(err); }
});

module.exports = { attendanceRouter, benefitRouter, userRouter };
