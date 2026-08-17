/**
 * Rotas de Documentos Úteis — arquivos públicos/internos do sistema
 */
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.join(__dirname, '../../uploads/useful-docs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex');
    cb(null, `${name}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = ['application/pdf','image/jpeg','image/png','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype);
    cb(null, ok);
  },
});

// GET /useful-docs — lista documentos
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category } = req.query;
    const params = [];
    let where = '';
    if (category) { params.push(category); where = `WHERE category=$1`; }
    if (!['TI','DIRETORIA','RH'].includes(req.user.role)) {
      params.push(true);
      where = where ? `${where} AND is_public=$${params.length}` : `WHERE is_public=$1`;
    }
    const { rows } = await db.query(
      `SELECT id, title, description, category, file_name, file_path, file_size, mime_type, is_public, tags, created_at
       FROM useful_documents ${where} ORDER BY category, title`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /useful-docs/categories
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT DISTINCT category FROM useful_documents ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (err) { next(err); }
});

// POST /useful-docs — upload
router.post('/', authenticate, can('documents:manage'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const { title, description, category = 'Geral', is_public = 'false', tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Título obrigatório.' });
    const filePath = `/uploads/useful-docs/${req.file.filename}`;
    const tagsArr  = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const { rows } = await db.query(`
      INSERT INTO useful_documents (title, description, category, file_name, file_path, file_size, mime_type, is_public, tags, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [title.trim(), description||null, category, req.file.originalname, filePath,
        req.file.size, req.file.mimetype, is_public === 'true', tagsArr, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /useful-docs/:id
router.delete('/:id', authenticate, can('documents:manage'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT file_path FROM useful_documents WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Documento não encontrado.' });
    const abs = path.join(__dirname, '../..', rows[0].file_path);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    await db.query('DELETE FROM useful_documents WHERE id=$1', [req.params.id]);
    res.json({ message: 'Removido.' });
  } catch (err) { next(err); }
});

module.exports = router;
