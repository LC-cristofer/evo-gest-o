/**
 * Rotas de Documentos do Funcionário
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');
const upload  = require('../config/upload');

const router = express.Router();
router.use(authenticate);

// GET /documents/employee/:id
router.get('/employee/:id', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, u.name AS uploaded_by_name
      FROM employee_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.employee_id = $1
      ORDER BY d.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /documents/employee/:id - Upload de documento
router.post('/employee/:id',
  can('employees:update'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });

      const { document_type, description, expires_at, is_confidential } = req.body;

      const { rows } = await db.query(`
        INSERT INTO employee_documents
          (employee_id, document_type, description, file_name, file_path,
           file_size, mime_type, expires_at, is_confidential, uploaded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `, [
        req.params.id, document_type, description,
        req.file.originalname, req.file.path,
        req.file.size, req.file.mimetype,
        expires_at || null, is_confidential === 'true',
        req.user.id,
      ]);

      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /documents/:id
router.delete('/:id', can('employees:update'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT file_path FROM employee_documents WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Documento não encontrado.' });

    // Remove arquivo físico
    if (rows[0].file_path && fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }

    await db.query('DELETE FROM employee_documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Documento removido.' });
  } catch (err) { next(err); }
});

module.exports = router;
