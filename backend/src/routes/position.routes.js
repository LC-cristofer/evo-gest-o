/**
 * Rotas de Cargos (Positions)
 */

const express = require('express');
const { z }   = require('zod');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /positions
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM positions WHERE is_active = TRUE ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /positions
router.post('/', can('units:manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      name:         z.string().min(2),
      description:  z.string().optional(),
      salary_floor: z.number().positive().optional(),
      salary_ceil:  z.number().positive().optional(),
      cbo_code:     z.string().optional(),
    });
    const { data, error } = schema.safeParse(req.body);
    if (error) return res.status(400).json({ error: error.errors[0].message });

    const { rows } = await db.query(
      `INSERT INTO positions (name, description, salary_floor, salary_ceil, cbo_code)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.name, data.description, data.salary_floor, data.salary_ceil, data.cbo_code]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /positions/:id
router.put('/:id', can('units:manage'), async (req, res, next) => {
  try {
    const { name, description, salary_floor, salary_ceil, cbo_code, is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE positions
       SET name = COALESCE($2, name),
           description = $3,
           salary_floor = $4,
           salary_ceil = $5,
           cbo_code = $6,
           is_active = COALESCE($7, is_active)
       WHERE id = $1
       RETURNING *`,
      [req.params.id, name, description, salary_floor, salary_ceil, cbo_code, is_active]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cargo não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
