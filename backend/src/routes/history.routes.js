/**
 * Rotas de Histórico (acesso geral ao histórico)
 */

const express = require('express');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /history - Adiciona evento manual
router.post('/', can('employees:update'), async (req, res, next) => {
  try {
    const { employee_id, event_type, description, effective_date, event_data } = req.body;

    if (!employee_id || !description) {
      return res.status(400).json({ error: 'employee_id e description são obrigatórios.' });
    }

    const { rows } = await db.query(`
      INSERT INTO employee_history
        (employee_id, event_type, description, effective_date, event_data, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      employee_id, event_type || 'SOLICITACAO',
      description, effective_date || null,
      event_data ? JSON.stringify(event_data) : null,
      req.user.id,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /history/recent - Eventos recentes do sistema
router.get('/recent', can('dashboard:general'), async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const { rows } = await db.query(`
      SELECT h.*, e.full_name, u2.name AS created_by_name,
             un.name AS unit_name
      FROM employee_history h
      JOIN employees e ON h.employee_id = e.id
      LEFT JOIN units un ON e.unit_id = un.id
      LEFT JOIN users u2 ON h.created_by = u2.id
      ORDER BY h.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
