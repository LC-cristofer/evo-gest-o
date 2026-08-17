/**
 * Job de Pendências — executa todo dia às 22h
 * Marca como pendente quem não preencheu o diário do dia
 */
const cron   = require('node-cron');
const db     = require('../config/database');
const logger = require('../utils/logger');

// ── Verifica diário todo dia às 22h ────────────────────────
cron.schedule('0 22 * * 1-5', async () => {
  logger.info('[JOB][PENDENCIAS] Verificando diários do dia...');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  try {
    // Funcionários ativos que NÃO enviaram o diário hoje
    const { rows: missing } = await db.query(`
      SELECT u.id AS user_id, u.name, u.unit_id, u.employee_id
      FROM users u
      WHERE u.role = 'FUNCIONARIO' AND u.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM diarios d
          WHERE d.user_id = u.id AND d.date = $1 AND d.status = 'ENVIADO'
        )
    `, [today]);

    logger.info(`[JOB][PENDENCIAS] ${missing.length} funcionário(s) sem diário.`);

    for (const u of missing) {
      try {
        // Inserir pendência (ON CONFLICT ignora duplicatas)
        await db.query(`
          INSERT INTO pendencias (user_id, employee_id, type, ref_date)
          VALUES ($1, $2, 'DIARIO', $3)
          ON CONFLICT (user_id, type, ref_date) DO NOTHING
        `, [u.user_id, u.employee_id, today]);

        // Notificação para o próprio funcionário
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES ($1, 'PENDENCIA', '⚠️ Diário não preenchido',
                  'Você não preencheu o diário de bordo hoje. Regularize assim que possível.')
          ON CONFLICT DO NOTHING
        `, [u.user_id]).catch(() => {});

        // Notificação para supervisor da unidade
        if (u.unit_id) {
          await db.query(`
            INSERT INTO notifications (user_id, type, title, message, employee_id)
            SELECT s.id, 'PENDENCIA',
              '⚠️ Funcionário sem diário',
              $1, $2
            FROM users s
            WHERE s.role = 'SUPERVISOR' AND s.unit_id = $3 AND s.is_active = TRUE
            ON CONFLICT DO NOTHING
          `, [
            `${u.name} não preencheu o diário hoje (${today}).`,
            u.employee_id,
            u.unit_id,
          ]).catch(() => {});
        }

        // Notificar RH
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, employee_id)
          SELECT id, 'PENDENCIA', '⚠️ Pendência de diário', $1, $2
          FROM users WHERE role IN ('RH','DIRETORIA') AND is_active = TRUE
          ON CONFLICT DO NOTHING
        `, [
          `${u.name} não preencheu o diário de ${today}.`,
          u.employee_id,
        ]).catch(() => {});

      } catch (err) {
        logger.error(`[JOB][PENDENCIAS] Erro em ${u.name}:`, err.message);
      }
    }

    logger.info('[JOB][PENDENCIAS] Verificação concluída.');
  } catch (err) {
    logger.error('[JOB][PENDENCIAS] Falha geral:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── Verifica relatório mensal no dia 25 de cada mês ─────────
cron.schedule('0 9 25 * *', async () => {
  logger.info('[JOB][RELATORIO] Verificando relatórios do mês...');
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  try {
    const { rows: missing } = await db.query(`
      SELECT u.id AS user_id, u.name, u.employee_id
      FROM users u
      WHERE u.role = 'FUNCIONARIO' AND u.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM relatorios_mensais r
          WHERE r.user_id = u.id AND r.year = $1 AND r.month = $2
            AND r.status = 'ENVIADO'
        )
    `, [year, month]);

    for (const u of missing) {
      await db.query(`
        INSERT INTO pendencias (user_id, employee_id, type, ref_date, ref_year, ref_month)
        VALUES ($1, $2, 'RELATORIO', $3, $4, $5)
        ON CONFLICT (user_id, type, ref_date) DO NOTHING
      `, [u.user_id, u.employee_id, today, year, month]).catch(() => {});

      await db.query(`
        INSERT INTO notifications (user_id, type, title, message)
        VALUES ($1, 'PENDENCIA', '📋 Relatório mensal pendente',
                'Seu relatório do mês ainda não foi enviado. Prazo: final do mês.')
        ON CONFLICT DO NOTHING
      `, [u.user_id]).catch(() => {});
    }

    logger.info(`[JOB][RELATORIO] ${missing.length} relatório(s) pendente(s) notificado(s).`);
  } catch (err) {
    logger.error('[JOB][RELATORIO] Falha:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

module.exports = {};
