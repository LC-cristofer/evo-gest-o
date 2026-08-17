/**
 * Utilidade de Notificações
 * Helper para criar notificações no banco a partir de qualquer contexto
 */

const db     = require('../config/database');
const logger = require('./logger');

/**
 * Notifica todos os usuários de uma unidade (incluindo RH/TI)
 */
const notifyUnit = async ({ unitId, type, title, message, link, employeeId } = {}) => {
  try {
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, link, employee_id)
      SELECT u.id, $1, $2, $3, $4, $5
      FROM users u
      WHERE u.is_active = TRUE
        AND (
          u.role IN ('RH', 'TI')
          OR (u.role = 'SUPERVISOR' AND u.unit_id = $6)
        )
    `, [type, title, message, link || null, employeeId || null, unitId]);
  } catch (err) {
    logger.error('Erro ao criar notificação de unidade:', err);
  }
};

/**
 * Notifica usuários específicos por role
 */
const notifyByRole = async ({ roles, type, title, message, link, employeeId } = {}) => {
  try {
    const rolePlaceholders = roles.map((_, i) => `$${i + 6}`).join(', ');
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, link, employee_id)
      SELECT id, $1, $2, $3, $4, $5
      FROM users
      WHERE is_active = TRUE AND role IN (${rolePlaceholders})
    `, [type, title, message, link || null, employeeId || null, ...roles]);
  } catch (err) {
    logger.error('Erro ao criar notificação por role:', err);
  }
};

/**
 * Notifica um usuário específico
 */
const notifyUser = async ({ userId, type, title, message, link, employeeId } = {}) => {
  try {
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, link, employee_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, type, title, message, link || null, employeeId || null]);
  } catch (err) {
    logger.error('Erro ao criar notificação de usuário:', err);
  }
};

module.exports = { notifyUnit, notifyByRole, notifyUser };
