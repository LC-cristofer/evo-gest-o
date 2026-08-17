const express = require('express');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /faq - público
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const params = [];
    let where = 'WHERE is_published = TRUE';
    if (category) { params.push(category); where += ` AND category = $${params.length}`; }
    const { rows } = await db.query(
      `SELECT * FROM faq_items ${where} ORDER BY order_index, created_at`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /faq/:id - incrementa views
router.get('/:id', async (req, res, next) => {
  try {
    await db.query('UPDATE faq_items SET views = views + 1 WHERE id = $1', [req.params.id]);
    const { rows } = await db.query('SELECT * FROM faq_items WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'FAQ não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /faq - TI/RH
router.post('/', authenticate, authorize('TI', 'RH'), async (req, res, next) => {
  try {
    const { question, answer, category, order_index } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias.' });
    const { rows } = await db.query(
      'INSERT INTO faq_items (question,answer,category,order_index,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [question, answer, category || 'Geral', order_index || 0, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('TI', 'RH'), async (req, res, next) => {
  try {
    const { question, answer, category, order_index, is_published } = req.body;
    const { rows } = await db.query(
      `UPDATE faq_items SET question=COALESCE($2,question), answer=COALESCE($3,answer),
       category=COALESCE($4,category), order_index=COALESCE($5,order_index),
       is_published=COALESCE($6,is_published), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, question, answer, category, order_index, is_published]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('TI'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM faq_items WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
