/**
 * Job: Alertas de documentos vencendo
 * Roda: toda segunda-feira às 9h
 */

const cron   = require('node-cron');
const db     = require('../config/database');
const logger = require('../utils/logger');

cron.schedule('0 9 * * 1', async () => {
  logger.info('[JOB] Verificando documentos próximos do vencimento...');
  try {
    // Documentos vencendo em até 30 dias
    const { rows } = await db.query(`
      SELECT d.id, d.document_type, d.expires_at,
             e.id AS employee_id, e.full_name, e.unit_id,
             e.email AS employee_email
      FROM employee_documents d
      JOIN employees e ON d.employee_id = e.id
      WHERE d.expires_at IS NOT NULL
        AND d.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND e.status = 'ATIVO'
    `);

    for (const doc of rows) {
      // Notifica o RH e supervisor da unidade
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, link, employee_id)
        SELECT u.id, 'DOCUMENTO_VENCENDO',
          'Documento vencendo em breve',
          $1, $2, $3
        FROM users u
        WHERE (u.role IN ('RH', 'TI') OR (u.role = 'SUPERVISOR' AND u.unit_id = $4))
          AND u.is_active = TRUE
        ON CONFLICT DO NOTHING
      `, [
        `${doc.full_name}: ${doc.document_type} vence em ${new Date(doc.expires_at).toLocaleDateString('pt-BR')}`,
        `/funcionarios/${doc.employee_id}`,
        doc.employee_id,
        doc.unit_id,
      ]);
    }

    logger.info(`[JOB] ${rows.length} alertas de documentos enviados.`);
  } catch (err) {
    logger.error('[JOB] Erro no job de documentos:', err);
  }
}, { timezone: 'America/Sao_Paulo' });

module.exports = {};
