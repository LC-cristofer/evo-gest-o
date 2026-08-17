/**
 * Rotas da Home Pública — Blog/Notícias da EVO Gestão
 */
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();

// Upload de mídia para posts
const mediaStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.join(__dirname, '../../uploads/home-posts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex');
    cb(null, `${name}${ext}`);
  },
});
const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB para vídeos
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── GET /home/posts — Público, posts publicados ──────────────
router.get('/posts', async (req, res, next) => {
  try {
    const { limit = 12, offset = 0, type } = req.query;
    const conds = ['is_published = TRUE'];
    const params = [];
    if (type) { params.push(type); conds.push(`type = $${params.length}`); }
    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await db.query(`
      SELECT id, title, summary, cover_url, media_urls, type,
             author_name, published_at, views, created_at
      FROM home_posts
      WHERE ${conds.join(' AND ')}
      ORDER BY published_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    const { rows: [{ count }] } = await db.query(
      `SELECT COUNT(*) FROM home_posts WHERE ${conds.slice(0, type ? 2 : 1).join(' AND ')}`,
      params.slice(0, type ? 1 : 0)
    );
    res.json({ data: rows, total: parseInt(count) });
  } catch (err) { next(err); }
});

// ── GET /home/posts/:id — Público ────────────────────────────
router.get('/posts/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM home_posts WHERE id=$1 AND is_published=TRUE',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post não encontrado.' });
    // Incrementa views
    await db.query('UPDATE home_posts SET views=views+1 WHERE id=$1', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── GET /home/admin/posts — Admin: todos os posts ────────────
router.get('/admin/posts', authenticate, can('units:manage'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, type, is_published, published_at, views, created_at, author_name
       FROM home_posts ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /home/admin/posts — Criar post ──────────────────────
router.post('/admin/posts', authenticate, can('units:manage'), async (req, res, next) => {
  try {
    const { title, content, summary, type = 'NOTICIA', is_published = false } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Título e conteúdo obrigatórios.' });
    const { rows } = await db.query(`
      INSERT INTO home_posts (title, content, summary, type, is_published, published_at, author_id, author_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [
      title.trim(), content.trim(), summary?.trim() || null,
      type, is_published,
      is_published ? new Date() : null,
      req.user.id, req.user.name,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PUT /home/admin/posts/:id — Editar post ──────────────────
router.put('/admin/posts/:id', authenticate, can('units:manage'), async (req, res, next) => {
  try {
    const { title, content, summary, type, is_published } = req.body;
    const { rows: [cur] } = await db.query('SELECT * FROM home_posts WHERE id=$1', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Post não encontrado.' });
    const { rows } = await db.query(`
      UPDATE home_posts SET
        title=$1, content=$2, summary=$3, type=$4, is_published=$5,
        published_at = CASE WHEN $5 AND NOT $6 THEN NOW() ELSE published_at END,
        updated_at=NOW()
      WHERE id=$7 RETURNING *
    `, [
      title ?? cur.title, content ?? cur.content, summary ?? cur.summary,
      type ?? cur.type, is_published ?? cur.is_published, cur.is_published,
      req.params.id,
    ]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST /home/admin/posts/:id/cover — Upload capa ───────────
router.post('/admin/posts/:id/cover', authenticate, can('units:manage'),
  mediaUpload.single('cover'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
      const coverUrl = `/uploads/home-posts/${req.file.filename}`;
      await db.query('UPDATE home_posts SET cover_url=$1, updated_at=NOW() WHERE id=$2', [coverUrl, req.params.id]);
      res.json({ cover_url: coverUrl });
    } catch (err) { next(err); }
  }
);

// ── POST /home/admin/posts/:id/media — Upload foto/vídeo ─────
router.post('/admin/posts/:id/media', authenticate, can('units:manage'),
  mediaUpload.single('media'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
      const mediaUrl = `/uploads/home-posts/${req.file.filename}`;
      const isVideo  = req.file.mimetype.startsWith('video/');
      await db.query(`
        UPDATE home_posts
        SET media_urls = media_urls || $1::jsonb, updated_at=NOW()
        WHERE id=$2
      `, [JSON.stringify([{ url: mediaUrl, type: isVideo ? 'video' : 'image', name: req.file.originalname }]), req.params.id]);
      res.json({ url: mediaUrl, type: isVideo ? 'video' : 'image' });
    } catch (err) { next(err); }
  }
);

// ── DELETE /home/admin/posts/:id ─────────────────────────────
router.delete('/admin/posts/:id', authenticate, can('units:manage'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM home_posts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Post removido.' });
  } catch (err) { next(err); }
});

module.exports = router;
