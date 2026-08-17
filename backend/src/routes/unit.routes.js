const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const photoStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.join(__dirname, '../../uploads/units');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname)),
});
const photoUpload = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /units — filtra VOLANTE da listagem principal, salvo se ?include_volante=true
router.get('/', can('units:read'), async (req, res, next) => {
  try {
    const { include_volante } = req.query;
    let extraWhere = include_volante === 'true' ? '' : "AND u.name NOT ILIKE '%VOLANTE%'";

    const { rows } = await db.query(`
      SELECT u.*,
        COUNT(e.id) FILTER (WHERE e.status='ATIVO')    AS active_count,
        COUNT(e.id) FILTER (WHERE e.status='AFASTADO') AS away_count,
        (SELECT name FROM users WHERE unit_id=u.id AND role='SUPERVISOR' AND is_active=TRUE LIMIT 1) AS supervisor_name
      FROM units u
      LEFT JOIN employees e ON e.unit_id = u.id
      WHERE u.is_active = TRUE ${extraWhere}
      GROUP BY u.id
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /units/:id
router.get('/:id', can('units:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.*,
        COUNT(e.id) FILTER (WHERE e.status='ATIVO')     AS active_count,
        COUNT(e.id) FILTER (WHERE e.status='AFASTADO')  AS away_count,
        COUNT(e.id) FILTER (WHERE e.status='DESLIGADO') AS dismissed_count,
        (SELECT name  FROM users WHERE unit_id=u.id AND role='SUPERVISOR' AND is_active=TRUE LIMIT 1) AS supervisor_name,
        (SELECT email FROM users WHERE unit_id=u.id AND role='SUPERVISOR' AND is_active=TRUE LIMIT 1) AS supervisor_email
      FROM units u
      LEFT JOIN employees e ON e.unit_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });

    // Apenas funcionários ATIVOS aparecem na lista da equipe
    const { rows: employees } = await db.query(`
      SELECT e.id, e.full_name, e.employee_code, e.status, e.phone, e.email,
             e.hire_date, e.photo_url, p.name AS position_name
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE e.unit_id = $1 AND e.status = 'ATIVO'
      ORDER BY e.full_name
    `, [req.params.id]);

    res.json({ ...rows[0], employees });
  } catch (err) { next(err); }
});

// POST /units
router.post('/', can('units:manage'), async (req, res, next) => {
  try {
    const { code, name, address, city, state, zip_code, phone, email, capacity, description, manager_name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Código e nome obrigatórios.' });
    const { rows } = await db.query(
      `INSERT INTO units (code,name,address,city,state,zip_code,phone,email,capacity,description,manager_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code, name, address||null, city||null, state||null, zip_code||null, phone||null, email||null, capacity||null, description||null, manager_name||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /units/:id
router.put('/:id', can('units:manage'), async (req, res, next) => {
  try {
    const d = req.body;
    const ignore = ['id','code','created_at','photo_url'];
    const fields = Object.keys(d).filter(k => !ignore.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'Sem campos.' });
    const set = fields.map((f,i) => `${f}=$${i+2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE units SET ${set}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id, ...fields.map(f => d[f]||null)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /units/:id/photo
router.post('/:id/photo', can('units:manage'), photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const photoUrl = `/uploads/units/${req.file.filename}`;
    await db.query('UPDATE units SET photo_url=$1, updated_at=NOW() WHERE id=$2', [photoUrl, req.params.id]);
    res.json({ photo_url: photoUrl });
  } catch (err) { next(err); }
});

// DELETE /units/:id — com validação de funcionários vinculados
router.delete('/:id', can('units:manage'), async (req, res, next) => {
  try {
    const { rows: emp } = await db.query(
      "SELECT COUNT(*) FROM employees WHERE unit_id=$1 AND status IN ('ATIVO','AFASTADO')",
      [req.params.id]
    );
    const count = parseInt(emp[0].count);
    if (count > 0) {
      return res.status(409).json({
        error: `Não é possível excluir: ${count} funcionário(s) ativo(s) vinculado(s). Remova-os antes.`,
        employee_count: count,
      });
    }
    await db.query('UPDATE units SET is_active=FALSE, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ message: 'Unidade desativada com sucesso.' });
  } catch (err) { next(err); }
});

module.exports = router;
