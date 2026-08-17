/**
 * Jobs agendados - Notificações automáticas
 * Roda diariamente: documentos vencendo, admissões expirando, etc.
 */

const cron   = require('node-cron');
const db     = require('../config/database');
const { sendAdmissionEmail, sendDocumentPendingEmail } = require('../services/email.service');
const logger = require('../utils/logger');

/**
 * Job 1: Verifica admissões que expirarão em 24h e notifica RH
 * Roda: todo dia às 8h
 */
cron.schedule('0 8 * * *', async () => {
  logger.info('[JOB] Verificando admissões próximas do vencimento...');
  try {
    const { rows } = await db.query(`
      SELECT ap.*, p.name AS position_name, u.name AS unit_name
      FROM admission_processes ap
      LEFT JOIN positions p ON ap.position_id = p.id
      LEFT JOIN units u     ON ap.unit_id     = u.id
      WHERE ap.status = 'PENDENTE'
        AND ap.link_expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    `);

    for (const proc of rows) {
      // Notifica RH no sistema
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, link, employee_id)
        SELECT id, 'ADMISSAO_PENDENTE',
          'Link de admissão expirando',
          $1, $2, NULL
        FROM users WHERE role IN ('RH', 'TI') AND is_active = TRUE
      `, [
        `Link de admissão de "${proc.candidate_name}" expira em menos de 24h`,
        `/admissoes/${proc.id}`,
      ]);
    }

    logger.info(`[JOB] ${rows.length} admissões com link expirando notificadas.`);
  } catch (err) {
    logger.error('[JOB] Erro no job de admissões:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

/**
 * Job 2: Marca admissões expiradas
 * Roda: todo dia às 00h
 */
cron.schedule('0 0 * * *', async () => {
  try {
    const { rowCount } = await db.query(`
      UPDATE admission_processes
      SET status = 'EXPIRADO'
      WHERE status = 'PENDENTE' AND link_expires_at < NOW()
    `);
    if (rowCount > 0) {
      logger.info(`[JOB] ${rowCount} processos de admissão marcados como expirados.`);
    }
  } catch (err) {
    logger.error('[JOB] Erro ao expirar admissões:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

module.exports = {};
