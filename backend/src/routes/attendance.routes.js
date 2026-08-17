/**
 * Rotas de Controle de Presença
 * Registro de faltas e atrasos
 */

const express = require('express');
const { z }   = require('zod');
const db      = require('../config/database');
const { authenticate, can, scopeToUnit } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

const recordSchema = z.object({
  employee_id:     z.string().uuid(),
  record_date:     z.string().refine(d => !isNaN(Date.parse(d))),
  type:            z.enum(['FALTA', 'ATRASO', 'FALTA_JUSTIFICADA', 'MEIO_PERIODO']),
  minutes_late:    z.number().int().min(0).optional().default(0),
  justification:   z.string().optional(),
  has_medical_cert: z.boolean().optional().default(false),
});

// POST /attendance - Registra falta/atraso
router.post('/', can('employees:update'), async (req, res, next) => {
  try {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.errors });
    }
    const data = parsed.data;

    // Busca unit_id do funcionário
    const { rows: emp } = await db.query(
      'SELECT unit_id FROM employees WHERE id = $1',
      [data.employee_id]
    );
    if (!emp[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const { rows } = await db.query(`
      INSERT INTO attendance_records
        (employee_id, unit_id, record_date, type, minutes_late, justification, has_medical_cert, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (employee_id, record_date, type) DO UPDATE
        SET minutes_late = EXCLUDED.minutes_late,
            justification = EXCLUDED.justification,
            has_medical_cert = EXCLUDED.has_medical_cert
      RETURNING *
    `, [
      data.employee_id, emp[0].unit_id, data.record_date, data.type,
      data.minutes_late, data.justification, data.has_medical_cert, req.user.id,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /attendance/employee/:id - Histórico de um funcionário
router.get('/employee/:id', can('employees:read'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const params = [req.params.id];
    let dateFilter = '';
    if (month && year) {
      params.push(`${year}-${String(month).padStart(2, '0')}`);
      dateFilter = `AND TO_CHAR(record_date, 'YYYY-MM') = $2`;
    }
    const { rows } = await db.query(`
      SELECT a.*, u.name AS created_by_name
      FROM attendance_records a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.employee_id = $1 ${dateFilter}
      ORDER BY a.record_date DESC
    `, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /attendance/unit/:unitId/summary - Resumo por unidade
router.get('/unit/:unitId/summary', can('dashboard:unit'), async (req, res, next) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const { rows } = await db.query(`
      SELECT
        e.id, e.full_name, e.employee_code,
        COUNT(a.id) FILTER (WHERE a.type = 'FALTA') AS absences,
        COUNT(a.id) FILTER (WHERE a.type = 'FALTA_JUSTIFICADA') AS justified,
        COUNT(a.id) FILTER (WHERE a.type = 'ATRASO') AS late_arrivals,
        COALESCE(SUM(a.minutes_late), 0) AS total_minutes_late,
        COUNT(a.id) FILTER (WHERE a.has_medical_cert = TRUE) AS medical_certs
      FROM employees e
      LEFT JOIN attendance_records a ON a.employee_id = e.id
        AND TO_CHAR(a.record_date, 'YYYY-MM') = $2
      WHERE e.unit_id = $1 AND e.status = 'ATIVO'
      GROUP BY e.id, e.full_name, e.employee_code
      ORDER BY absences DESC, e.full_name
    `, [req.params.unitId, targetMonth]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// DELETE /attendance/:id
router.delete('/:id', can('employees:update'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM attendance_records WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ message: 'Registro removido.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
