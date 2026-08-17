/**
 * Dashboard Routes
 * Indicadores por unidade, supervisor e geral
 */

const express = require('express');
const db      = require('../config/database');
const { authenticate, can, scopeToUnit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, scopeToUnit);

// ─── GET /dashboard/general ──────────────────────────────────
// Visão geral para RH / Diretoria
router.get('/general', can('dashboard:general'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const targetDate = month && year
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : new Date().toISOString().slice(0, 7) + '-01';

    const [
      totals,
      byStatus,
      recentAdmissions,
      recentDismissals,
      unitRanking,
      pendingAdmissions,
      monthAttendance,
    ] = await Promise.all([
      // Totais gerais
      db.query(`
        SELECT
          COUNT(*)                                           AS total,
          COUNT(*) FILTER (WHERE status = 'ATIVO')          AS active,
          COUNT(*) FILTER (WHERE status = 'AFASTADO')       AS away,
          COUNT(*) FILTER (WHERE status = 'DESLIGADO')      AS dismissed,
          COUNT(*) FILTER (WHERE status = 'PENDENTE')       AS pending
        FROM employees
      `),

      // Por status e unidade
      db.query(`
        SELECT u.name AS unit_name, u.code, e.status, COUNT(*) AS total
        FROM employees e
        JOIN units u ON e.unit_id = u.id
        GROUP BY u.name, u.code, e.status
        ORDER BY u.name, e.status
      `),

      // Admissões recentes (30 dias)
      db.query(`
        SELECT e.full_name, e.hire_date, p.name AS position, u.name AS unit
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.id
        LEFT JOIN units u     ON e.unit_id     = u.id
        WHERE e.hire_date >= NOW() - INTERVAL '30 days'
          AND e.status != 'DESLIGADO'
        ORDER BY e.hire_date DESC
        LIMIT 10
      `),

      // Desligamentos recentes (30 dias)
      db.query(`
        SELECT e.full_name, h.effective_date, h.dismissal_type, u.name AS unit
        FROM employee_history h
        JOIN employees e ON h.employee_id = e.id
        LEFT JOIN units u ON e.unit_id = u.id
        WHERE h.event_type = 'DESLIGAMENTO'
          AND h.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY h.created_at DESC
        LIMIT 10
      `),

      // Ranking de unidades por faltas no mês
      db.query(`
        SELECT
          u.name AS unit_name, u.code,
          COUNT(a.id) FILTER (WHERE a.type = 'FALTA') AS absences,
          COUNT(a.id) FILTER (WHERE a.type = 'ATRASO') AS late_arrivals,
          COUNT(DISTINCT a.employee_id) AS employees_with_issues
        FROM units u
        LEFT JOIN attendance_records a ON a.unit_id = u.id
          AND DATE_TRUNC('month', a.record_date) = DATE_TRUNC('month', $1::DATE)
        GROUP BY u.name, u.code
        ORDER BY absences DESC
        LIMIT 10
      `, [targetDate]),

      // Admissões digitais pendentes
      db.query(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PENDENTE')    AS pending,
          COUNT(*) FILTER (WHERE status = 'EM_ANALISE')  AS in_review,
          COUNT(*) FILTER (WHERE link_expires_at < NOW() AND status = 'PENDENTE') AS expired
        FROM admission_processes
      `),

      // Attendance no mês
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'FALTA')            AS total_absences,
          COUNT(*) FILTER (WHERE type = 'FALTA_JUSTIFICADA') AS justified_absences,
          COUNT(*) FILTER (WHERE type = 'ATRASO')           AS late_arrivals,
          SUM(minutes_late)                                  AS total_minutes_late
        FROM attendance_records
        WHERE DATE_TRUNC('month', record_date) = DATE_TRUNC('month', $1::DATE)
      `, [targetDate]),
    ]);

    res.json({
      period: targetDate,
      totals:             totals.rows[0],
      by_status:          byStatus.rows,
      recent_admissions:  recentAdmissions.rows,
      recent_dismissals:  recentDismissals.rows,
      unit_ranking:       unitRanking.rows,
      digital_admissions: pendingAdmissions.rows[0],
      attendance:         monthAttendance.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/unit/:unitId ─────────────────────────────
router.get('/unit/:unitId', can('dashboard:unit'), async (req, res, next) => {
  try {
    // Supervisor só acessa a própria unidade
    const unitId = req.scopedUnitId || req.params.unitId;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [unit, employees, attendance, history] = await Promise.all([
      db.query('SELECT * FROM v_unit_summary WHERE id = $1', [unitId]),

      db.query(`
        SELECT e.id, e.full_name, e.employee_code, e.status,
               p.name AS position,
               -- faltas no mês
               (SELECT COUNT(*) FROM attendance_records a
                WHERE a.employee_id = e.id AND a.type = 'FALTA'
                  AND TO_CHAR(a.record_date, 'YYYY-MM') = $2) AS month_absences,
               -- atrasos no mês
               (SELECT COUNT(*) FROM attendance_records a
                WHERE a.employee_id = e.id AND a.type = 'ATRASO'
                  AND TO_CHAR(a.record_date, 'YYYY-MM') = $2) AS month_late
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.id
        WHERE e.unit_id = $1 AND e.status = 'ATIVO'
        ORDER BY e.full_name
      `, [unitId, targetMonth]),

      db.query(`
        SELECT
          DATE_TRUNC('week', record_date)::DATE AS week_start,
          COUNT(*) FILTER (WHERE type = 'FALTA')  AS absences,
          COUNT(*) FILTER (WHERE type = 'ATRASO') AS late_arrivals
        FROM attendance_records
        WHERE unit_id = $1
          AND TO_CHAR(record_date, 'YYYY-MM') = $2
        GROUP BY DATE_TRUNC('week', record_date)
        ORDER BY week_start
      `, [unitId, targetMonth]),

      db.query(`
        SELECT h.event_type, h.description, h.created_at,
               e.full_name, u2.name AS created_by_name
        FROM employee_history h
        JOIN employees e  ON h.employee_id = e.id
        LEFT JOIN users u2 ON h.created_by = u2.id
        WHERE e.unit_id = $1
        ORDER BY h.created_at DESC
        LIMIT 20
      `, [unitId]),
    ]);

    if (!unit.rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });

    res.json({
      unit:       unit.rows[0],
      employees:  employees.rows,
      attendance_by_week: attendance.rows,
      recent_events: history.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/supervisor ───────────────────────────────
router.get('/supervisor', authenticate, async (req, res, next) => {
  try {
    const supervisorId = req.query.supervisor_id || req.user.id;

    // Outros roles podem ver qualquer supervisor; supervisor só vê o próprio
    if (req.user.role === 'SUPERVISOR' && supervisorId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso restrito à sua própria equipe.' });
    }

    const { rows: team } = await db.query(`
      SELECT
        e.id, e.full_name, e.employee_code, e.status, e.hire_date,
        p.name AS position,
        u.name AS unit_name,
        -- indicadores mês atual
        (SELECT COUNT(*) FROM attendance_records a
         WHERE a.employee_id = e.id AND a.type = 'FALTA'
           AND DATE_TRUNC('month', a.record_date) = DATE_TRUNC('month', NOW())
        ) AS month_absences
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN units u     ON e.unit_id     = u.id
      WHERE e.supervisor_id = $1
      ORDER BY u.name, e.full_name
    `, [supervisorId]);

    const { rows: summary } = await db.query(`
      SELECT
        COUNT(*)                                  AS total,
        COUNT(*) FILTER (WHERE status = 'ATIVO')  AS active,
        COUNT(*) FILTER (WHERE status = 'AFASTADO') AS away
      FROM employees WHERE supervisor_id = $1
    `, [supervisorId]);

    res.json({
      supervisor_id: supervisorId,
      team:          team,
      summary:       summary.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /dashboard/attendance-trends ────────────────────────
router.get('/attendance-trends', can('dashboard:general'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        DATE_TRUNC('month', record_date)::DATE AS month,
        COUNT(*) FILTER (WHERE type = 'FALTA')            AS absences,
        COUNT(*) FILTER (WHERE type = 'FALTA_JUSTIFICADA') AS justified,
        COUNT(*) FILTER (WHERE type = 'ATRASO')           AS late_arrivals
      FROM attendance_records
      WHERE record_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', record_date)
      ORDER BY month
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
