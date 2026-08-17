/**
 * Rotas de Benefícios (VR, VT, Plano de Saúde)
 */

const express = require('express');
const { z }   = require('zod');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /benefits/employee/:id - Benefícios de um funcionário
router.get('/employee/:id', can('benefits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT b.*, u.name AS created_by_name
       FROM employee_benefits b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.employee_id = $1
       ORDER BY b.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /benefits - Adiciona benefício
router.post('/', can('benefits:manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      employee_id:  z.string().uuid(),
      benefit_type: z.enum(['VR', 'VT', 'PLANO_SAUDE', 'OUTROS']),
      value:        z.number().positive().optional(),
      operator:     z.string().optional(),
      card_number:  z.string().optional(),
      start_date:   z.string().optional(),
      notes:        z.string().optional(),
    });
    const { data, error } = schema.safeParse(req.body);
    if (error) return res.status(400).json({ error: error.errors[0].message });

    const { rows } = await db.query(`
      INSERT INTO employee_benefits
        (employee_id, benefit_type, value, operator, card_number, start_date, notes, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'ATIVO',$8)
      RETURNING *
    `, [
      data.employee_id, data.benefit_type, data.value,
      data.operator, data.card_number, data.start_date,
      data.notes, req.user.id,
    ]);

    // Registra no histórico
    await db.query(`
      INSERT INTO employee_history (employee_id, event_type, description, created_by)
      VALUES ($1, 'BENEFICIO_ALTERADO', $2, $3)
    `, [data.employee_id, `Benefício ${data.benefit_type} adicionado`, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /benefits/:id/status - Altera status
router.patch('/:id/status', can('benefits:manage'), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const valid = ['ATIVO', 'INATIVO', 'CANCELADO'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido.' });

    const { rows } = await db.query(
      `UPDATE employee_benefits SET status = $1, end_date = CASE WHEN $1 IN ('INATIVO','CANCELADO') THEN CURRENT_DATE ELSE end_date END
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Benefício não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /benefits/requests/:id/review - Aprova ou rejeita solicitação
router.patch('/requests/:id/review', can('benefits:manage'), async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    if (!['APROVADO', 'REJEITADO'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    const { rows } = await db.query(`
      UPDATE benefit_requests
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), resolution = $3
      WHERE id = $4 RETURNING *
    `, [status, req.user.id, resolution || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    if (status === 'APROVADO') {
      if (rows[0].request_type === 'INCLUSAO') {
        await db.query(
          `INSERT INTO employee_benefits (employee_id, benefit_type, status, created_by)
           VALUES ($1, $2, 'ATIVO', $3) ON CONFLICT DO NOTHING`,
          [rows[0].employee_id, rows[0].benefit_type, req.user.id]
        );
      } else if (rows[0].request_type === 'CANCELAMENTO') {
        await db.query(
          `UPDATE employee_benefits SET status = 'CANCELADO', end_date = CURRENT_DATE
           WHERE employee_id = $1 AND benefit_type = $2 AND status = 'ATIVO'`,
          [rows[0].employee_id, rows[0].benefit_type]
        );
      }
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /benefits/requests - Solicitações pendentes
router.get('/requests', can('benefits:manage'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT br.*, e.full_name, e.employee_code, u.name AS unit_name
      FROM benefit_requests br
      JOIN employees e ON br.employee_id = e.id
      LEFT JOIN units u ON e.unit_id = u.id
      WHERE br.status = 'PENDENTE'
      ORDER BY br.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
