/**
 * Rotas de Usuários do Sistema
 * Apenas TI pode gerenciar
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const { z }   = require('zod');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('TI'));

const createSchema = z.object({
  name:    z.string().min(3),
  email:   z.string().email(),
  role:    z.enum(['DIRETORIA', 'RH', 'SUPERVISOR', 'TI']),
  unit_id: z.string().uuid().optional().nullable(),
  password: z.string().min(8),
});

// GET /users
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_login, u.created_at,
             un.name AS unit_name
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /users
router.post('/', async (req, res, next) => {
  try {
    const { data, error } = createSchema.safeParse(req.body);
    if (error) return res.status(400).json({ error: error.errors[0].message });

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1', [data.email.toLowerCase()]
    );
    if (existing[0]) return res.status(409).json({ error: 'Email já cadastrado.' });

    const hash = await bcrypt.hash(data.password, 12);
    const { rows } = await db.query(`
      INSERT INTO users (name, email, password_hash, role, unit_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, unit_id, is_active, created_at
    `, [data.name, data.email.toLowerCase(), hash, data.role, data.unit_id || null]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /users/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Não é possível desativar a própria conta.' });
    }
    const { rows } = await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, role, unit_id } = req.body;
    const { rows } = await db.query(`
      UPDATE users SET
        name    = COALESCE($2, name),
        email   = COALESCE($3, email),
        role    = COALESCE($4, role),
        unit_id = $5
      WHERE id = $1
      RETURNING id, name, email, role, unit_id, is_active
    `, [req.params.id, name, email?.toLowerCase(), role, unit_id || null]);

    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /users/:id/reset-password
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hash = await bcrypt.hash(tempPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    // Em produção: enviar por email
    res.json({ tempPassword, message: 'Senha resetada. Forneça ao usuário de forma segura.' });
  } catch (err) { next(err); }
});


// ── POST /users/funcionario — RH cria conta de funcionário ──
// Exposto sem o authorize('TI') — requer autenticação + role RH/TI
const employeeRouter = express.Router();
employeeRouter.use(authenticate);

employeeRouter.post('/create-employee-account', async (req, res, next) => {
  try {
    if (!['TI','RH'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id obrigatório.' });

    // Busca funcionário
    const { rows: empRows } = await db.query(
      'SELECT id, full_name, cpf, unit_id FROM employees WHERE id = $1 AND status = $2',
      [employee_id, 'ATIVO']
    );
    if (!empRows[0]) return res.status(404).json({ error: 'Funcionário não encontrado ou inativo.' });
    const emp = empRows[0];

    // Verifica se já tem conta
    const cpfClean = emp.cpf.replace(/\D/g, '');
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE cpf = $1 OR employee_id = $2',
      [cpfClean, emp.id]
    );
    if (existing[0]) return res.status(409).json({ error: 'Funcionário já possui conta no sistema.' });

    // Cria conta com senha = CPF, must_change_password = true
    const hash = await require('bcryptjs').hash(cpfClean, 12);
    const fakeMail = `func_${cpfClean}@casca.internal`;

    const { rows } = await db.query(`
      INSERT INTO users (name, email, password_hash, role, unit_id, employee_id, cpf, must_change_password)
      VALUES ($1, $2, $3, 'FUNCIONARIO', $4, $5, $6, TRUE)
      RETURNING id, name, email, role, unit_id, cpf, employee_id, must_change_password
    `, [emp.full_name, fakeMail, hash, emp.unit_id, emp.id, cpfClean]);

    res.status(201).json({
      ...rows[0],
      message: `Conta criada! Login: ${cpfClean} | Senha inicial: ${cpfClean}`,
    });
  } catch (err) { next(err); }
});

module.exports = { router, employeeRouter };
