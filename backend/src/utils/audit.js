/**
 * Utility de Auditoria
 * Registra todas as ações críticas no banco
 */

const db     = require('../config/database');
const logger = require('./logger');

/**
 * @param {Object} opts
 * @param {string} [opts.userId]
 * @param {string} opts.action   - CREATE, UPDATE, DELETE, LOGIN, etc.
 * @param {string} opts.entity   - nome da tabela
 * @param {string} [opts.entityId]
 * @param {Object} [opts.oldData]
 * @param {Object} [opts.newData]
 * @param {Object} [opts.req]    - Express request (para IP e user-agent)
 */
const auditLog = async ({ userId, action, entity, entityId, oldData, newData, req }) => {
  try {
    const ip        = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    // Remove campos sensíveis dos dados
    const sanitize = (data) => {
      if (!data) return null;
      const d = { ...data };
      ['password_hash', 'password', 'token', 'pix_key', 'bank_account'].forEach(k => delete d[k]);
      return d;
    };

    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, old_data, new_data, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId || null,
      action,
      entity,
      entityId || null,
      sanitize(oldData) ? JSON.stringify(sanitize(oldData)) : null,
      sanitize(newData) ? JSON.stringify(sanitize(newData)) : null,
      ip,
      userAgent,
    ]);
  } catch (err) {
    // Nunca deixa falha de auditoria derrubar o processo principal
    logger.error('Falha ao registrar audit log:', err);
  }
};

module.exports = { auditLog };
