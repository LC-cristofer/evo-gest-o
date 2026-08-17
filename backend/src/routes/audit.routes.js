/**
 * Rota de Auditoria
 * Visualização e exportação do audit_log — restrito ao TI
 */

const express = require('express');
const XLSX    = require('xlsx');
const db      = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('TI'));

// GET /audit — lista com filtros e paginação
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1, limit = 30,
      search, entity, action,
      date_from, date_to,
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR al.entity ILIKE $${params.length})`);
    }
    if (entity) {
      params.push(entity);
      conditions.push(`al.entity = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`al.created_at >= $${params.length}::DATE`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`al.created_at < ($${params.length}::DATE + INTERVAL '1 day')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        al.id, al.action, al.entity, al.entity_id,
        al.old_data, al.new_data,
        al.ip_address, al.user_agent, al.created_at,
        u.name  AS user_name,
        u.email AS user_email,
        u.role  AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
    `;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      db.query(sql, [...params, limit, offset]),
      db.query(countSql, params),
    ]);

    res.json({
      data:  rows,
      total: parseInt(countRows[0].count),
      page:  parseInt(page),
      pages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
    });
  } catch (err) { next(err); }
});

// GET /audit/export — exporta CSV completo
router.get('/export', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const params = [];
    const conditions = [];

    if (date_from) { params.push(date_from); conditions.push(`al.created_at >= $${params.length}::DATE`); }
    if (date_to)   { params.push(date_to);   conditions.push(`al.created_at < ($${params.length}::DATE + INTERVAL '1 day')`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT
        TO_CHAR(al.created_at, 'DD/MM/YYYY HH24:MI:SS') AS "Data/Hora",
        u.name        AS "Usuário",
        u.email       AS "Email",
        u.role        AS "Perfil",
        al.action     AS "Ação",
        al.entity     AS "Entidade",
        al.entity_id  AS "ID Entidade",
        al.ip_address AS "IP"
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT 50000
    `, params);

    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const filename = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) { next(err); }
});

// GET /audit/stats — estatísticas rápidas
router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        action,
        COUNT(*)                                      AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS last_7d
      FROM audit_logs
      GROUP BY action
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
