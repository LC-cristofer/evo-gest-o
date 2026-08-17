/**
 * Rotas de Geração de PDF
 */

const express = require('express');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');
const { generateEmployeePDF, generateAttendancePDF } = require('../services/pdf.service');
const { auditLog } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

/**
 * GET /pdf/employee/:id
 * Gera PDF da ficha completa do funcionário
 */
router.get('/employee/:id', can('employees:read'), async (req, res, next) => {
  try {
    // Busca dados completos
    const [empRes, benefitsRes, historyRes] = await Promise.all([
      db.query(`
        SELECT e.*, p.name AS position_name, u.name AS unit_name, u.code AS unit_code,
               s.name AS supervisor_name
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.id
        LEFT JOIN units u     ON e.unit_id     = u.id
        LEFT JOIN users s     ON e.supervisor_id = s.id
        WHERE e.id = $1
      `, [req.params.id]),

      db.query(
        `SELECT * FROM employee_benefits WHERE employee_id = $1 AND status = 'ATIVO'`,
        [req.params.id]
      ),

      db.query(
        `SELECT * FROM employee_history WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [req.params.id]
      ),
    ]);

    if (!empRes.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    const employee = empRes.rows[0];

    // Verifica escopo do supervisor
    if (req.user.role === 'SUPERVISOR' && employee.unit_id !== req.user.unit_id) {
      return res.status(403).json({ error: 'Sem acesso a este funcionário.' });
    }

    const buffer = await generateEmployeePDF(
      employee,
      benefitsRes.rows,
      historyRes.rows
    );

    await auditLog({
      userId:   req.user.id,
      action:   'EXPORT',
      entity:   'employees',
      entityId: req.params.id,
      newData:  { format: 'pdf', type: 'ficha_funcional' },
      req,
    });

    const filename = `ficha_${employee.employee_code || employee.id}_${
      new Date().toISOString().split('T')[0]
    }.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pdf/attendance
 * Gera PDF do relatório de presença de uma unidade
 * Query: unit_id, month (YYYY-MM)
 */
router.get('/attendance', can('dashboard:unit'), async (req, res, next) => {
  try {
    const { unit_id, month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Supervisor usa sua própria unidade
    const effectiveUnitId = req.user.role === 'SUPERVISOR'
      ? req.user.unit_id
      : unit_id;

    const params = [targetMonth];
    let unitFilter = '';
    if (effectiveUnitId) {
      params.push(effectiveUnitId);
      unitFilter = `AND a.unit_id = $${params.length}`;
    }

    const [recordsRes, unitRes] = await Promise.all([
      db.query(`
        SELECT
          e.id, e.full_name, e.employee_code,
          COUNT(a.id) FILTER (WHERE a.type = 'FALTA')            AS absences,
          COUNT(a.id) FILTER (WHERE a.type = 'FALTA_JUSTIFICADA') AS justified,
          COUNT(a.id) FILTER (WHERE a.type = 'ATRASO')           AS late_arrivals,
          COALESCE(SUM(a.minutes_late), 0)                        AS total_minutes_late
        FROM employees e
        LEFT JOIN attendance_records a ON a.employee_id = e.id
          AND TO_CHAR(a.record_date, 'YYYY-MM') = $1 ${unitFilter}
        WHERE e.status = 'ATIVO'
        ${effectiveUnitId ? 'AND e.unit_id = $2' : ''}
        GROUP BY e.id, e.full_name, e.employee_code
        ORDER BY absences DESC, e.full_name
      `, params),

      effectiveUnitId
        ? db.query('SELECT name FROM units WHERE id = $1', [effectiveUnitId])
        : Promise.resolve({ rows: [{ name: 'Todas as Unidades' }] }),
    ]);

    const buffer = await generateAttendancePDF(
      unitRes.rows[0],
      recordsRes.rows,
      targetMonth
    );

    const filename = `presenca_${targetMonth}${effectiveUnitId ? `_${effectiveUnitId.slice(0,8)}` : ''}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
