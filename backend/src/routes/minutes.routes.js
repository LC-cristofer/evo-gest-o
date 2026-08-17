const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const uploadsDir = path.join(__dirname, '../../uploads/minutes');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try {
    const { unit_id, employee_id, limit = 20, page = 1 } = req.query;
    const params = [];
    const conds  = [];
    if (unit_id)     { params.push(unit_id);     conds.push(`m.unit_id = $${params.length}`); }
    if (employee_id) { params.push(employee_id); conds.push(`m.employee_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows } = await db.query(
      `SELECT m.*, u.name AS unit_name, e.full_name AS employee_name, usr.name AS created_by_name
       FROM meeting_minutes m
       LEFT JOIN units u     ON m.unit_id     = u.id
       LEFT JOIN employees e ON m.employee_id = e.id
       LEFT JOIN users usr   ON m.created_by  = usr.id
       ${where} ORDER BY m.meeting_date DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { title, meeting_date, location, content, unit_id, employee_id, participants } = req.body;
    if (!title || !meeting_date) return res.status(400).json({ error: 'Título e data obrigatórios.' });
    const parts = participants ? JSON.parse(participants) : [];
    const { rows } = await db.query(
      `INSERT INTO meeting_minutes (title,meeting_date,location,content,participants,unit_id,employee_id,file_path,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PUBLICADA',$9) RETURNING *`,
      [title, meeting_date, location||null, content||null, parts,
       unit_id||null, employee_id||null,
       req.file ? req.file.path : null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT m.*, u.name AS unit_name, e.full_name AS employee_name
       FROM meeting_minutes m
       LEFT JOIN units u     ON m.unit_id     = u.id
       LEFT JOIN employees e ON m.employee_id = e.id
       WHERE m.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ata não encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('TI','RH'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM meeting_minutes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
