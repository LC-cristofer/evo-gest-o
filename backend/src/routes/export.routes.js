const express = require('express');
const XLSX    = require('xlsx');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

function toXlsx(data, sheetName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function sendFile(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

const dateStr = () => new Date().toISOString().split('T')[0];

// GET /export/employees
router.get('/employees', can('employees:read'), async (req, res, next) => {
  try {
    const { status, unit_id, supervisor_id } = req.query;
    const params = [];
    const conds  = [];
    if (req.user.role === 'SUPERVISOR' && req.user.unit_id) { params.push(req.user.unit_id); conds.push(`e.unit_id=$${params.length}`); }
    if (status)      { params.push(status);      conds.push(`e.status=$${params.length}`); }
    if (unit_id)     { params.push(unit_id);     conds.push(`e.unit_id=$${params.length}`); }
    if (supervisor_id){ params.push(supervisor_id); conds.push(`e.supervisor_id=$${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT e.employee_code AS "Código", e.full_name AS "Nome", e.cpf AS "CPF",
             e.rg AS "RG", e.birth_date AS "Nascimento", e.gender AS "Gênero",
             e.email AS "Email", e.phone AS "Telefone",
             e.address AS "Endereço", e.city AS "Cidade", e.state AS "UF",
             p.name AS "Cargo", u.name AS "Unidade",
             s.name AS "Supervisor",
             e.hire_date AS "Admissão", e.dismissal_date AS "Desligamento",
             e.contract_type AS "Vínculo", e.salary AS "Salário",
             e.work_schedule AS "Jornada", e.status AS "Status",
             e.pis_pasep AS "PIS/PASEP", e.bank_code AS "Banco",
             e.bank_agency AS "Agência", e.bank_account AS "Conta",
             e.pix_key AS "Chave PIX", e.notes AS "Observações"
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN units u     ON e.unit_id     = u.id
      LEFT JOIN users s     ON e.supervisor_id = s.id
      ${where} ORDER BY e.full_name
    `, params);

    await auditLog({ userId: req.user.id, action: 'EXPORT', entity: 'employees', newData: { count: rows.length }, req });
    sendFile(res, toXlsx(rows, 'Funcionários'), `funcionarios_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/attendance
router.get('/attendance', can('dashboard:unit'), async (req, res, next) => {
  try {
    const { unit_id, month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0,7);
    const params = [targetMonth];
    const conds  = [`TO_CHAR(a.record_date,'YYYY-MM')=$1`];
    if (req.user.role === 'SUPERVISOR' && req.user.unit_id) { params.push(req.user.unit_id); conds.push(`a.unit_id=$${params.length}`); }
    else if (unit_id) { params.push(unit_id); conds.push(`a.unit_id=$${params.length}`); }

    const { rows } = await db.query(`
      SELECT e.full_name AS "Funcionário", e.employee_code AS "Código",
             u.name AS "Unidade", a.record_date AS "Data", a.type AS "Tipo",
             a.minutes_late AS "Min. Atraso", a.justification AS "Justificativa",
             a.has_medical_cert AS "Atestado"
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN units u ON a.unit_id = u.id
      WHERE ${conds.join(' AND ')}
      ORDER BY e.full_name, a.record_date
    `, params);

    sendFile(res, toXlsx(rows, 'Faltas e Atrasos'), `presenca_${targetMonth}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/units
router.get('/units', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.code AS "Código", u.name AS "Nome", u.city AS "Cidade",
             u.state AS "UF", u.phone AS "Telefone", u.email AS "Email",
             u.capacity AS "Capacidade",
             COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Ativos",
             s.name AS "Supervisor"
      FROM units u
      LEFT JOIN employees e ON e.unit_id = u.id
      LEFT JOIN users s ON s.unit_id = u.id AND s.role='SUPERVISOR'
      WHERE u.is_active = TRUE
      GROUP BY u.id, s.name ORDER BY u.name
    `);
    sendFile(res, toXlsx(rows, 'Unidades'), `unidades_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/supervisors
router.get('/supervisors', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.name AS "Supervisor", u.email AS "Email",
             un.name AS "Unidade",
             COUNT(e.id) AS "Total Funcionários",
             COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Ativos"
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN employees e ON e.supervisor_id = u.id
      WHERE u.role = 'SUPERVISOR' AND u.is_active = TRUE
      GROUP BY u.id, un.name ORDER BY u.name
    `);
    sendFile(res, toXlsx(rows, 'Supervisores'), `supervisores_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/positions
router.get('/positions', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.name AS "Cargo", p.cbo_code AS "CBO",
             COUNT(e.id) AS "Total", COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Ativos"
      FROM positions p LEFT JOIN employees e ON e.position_id = p.id
      WHERE p.is_active = TRUE GROUP BY p.id ORDER BY p.name
    `);
    sendFile(res, toXlsx(rows, 'Cargos'), `cargos_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/events
router.get('/events', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT ce.title AS "Título", ce.type AS "Tipo",
             ce.start_date AS "Data", ce.description AS "Descrição",
             u.name AS "Unidade", us.name AS "Criado por"
      FROM calendar_events ce
      LEFT JOIN units u ON ce.unit_id = u.id
      LEFT JOIN users us ON ce.created_by = us.id
      ORDER BY ce.start_date DESC
    `);
    sendFile(res, toXlsx(rows, 'Eventos'), `eventos_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});



// GET /export/units
router.get('/units', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.code AS "Código", u.name AS "Nome",
             u.city AS "Cidade", u.state AS "UF",
             u.phone AS "Telefone", u.email AS "Email",
             u.capacity AS "Capacidade",
             u.description AS "Descrição",
             COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Ativos",
             COUNT(e.id) FILTER (WHERE e.status='AFASTADO') AS "Afastados"
      FROM units u
      LEFT JOIN employees e ON e.unit_id = u.id
      WHERE u.is_active = TRUE AND u.name NOT ILIKE '%VOLANTE%'
      GROUP BY u.id ORDER BY u.name
    `);
    sendFile(res, toXlsx(rows, 'Unidades'), `unidades_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/positions
router.get('/positions', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT p.name AS "Cargo", p.cbo_code AS "CBO",
             COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Ativos"
      FROM positions p
      LEFT JOIN employees e ON e.position_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id ORDER BY p.name
    `);
    sendFile(res, toXlsx(rows, 'Cargos'), `cargos_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/supervisors
router.get('/supervisors', can('dashboard:general'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.name AS "Supervisor", u.email AS "Email",
             un.name AS "Unidade",
             COUNT(e.id) FILTER (WHERE e.status='ATIVO') AS "Funcionários Ativos"
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN employees e ON e.supervisor_id = u.id
      WHERE u.role = 'SUPERVISOR' AND u.is_active = TRUE
      GROUP BY u.id, un.name ORDER BY u.name
    `);
    sendFile(res, toXlsx(rows, 'Supervisores'), `supervisores_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

// GET /export/events?start=&end=
router.get('/events', can('employees:read'), async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const params = [];
    const conds  = [];
    if (start) { params.push(start); conds.push(`ce.start_date >= $${params.length}::date`); }
    if (end)   { params.push(end);   conds.push(`ce.start_date <= $${params.length}::date`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await db.query(`
      SELECT ce.title AS "Título", ce.type AS "Tipo",
             ce.start_date AS "Início", ce.end_date AS "Fim",
             u.name AS "Unidade", e.full_name AS "Funcionário",
             usr.name AS "Criado por", ce.description AS "Descrição"
      FROM calendar_events ce
      LEFT JOIN units u     ON ce.unit_id     = u.id
      LEFT JOIN employees e ON ce.employee_id = e.id
      LEFT JOIN users usr   ON ce.created_by  = usr.id
      ${where} ORDER BY ce.start_date
    `, params);
    sendFile(res, toXlsx(rows, 'Eventos'), `eventos_${dateStr()}.xlsx`);
  } catch (err) { next(err); }
});

module.exports = router;
