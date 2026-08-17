/**
 * Job: Notificações diversas (aniversários, etc.)
 * Roda: todo dia às 7h
 */

const cron   = require('node-cron');
const db     = require('../config/database');
const logger = require('../utils/logger');


const BIRTHDAY_MESSAGES = [
  (name) => `🎂 Parabéns, ${name}! Que este novo ciclo seja repleto de conquistas, saúde e realizações. Todo o time EVO Gestão celebra com você!`,
  (name) => `🎉 Feliz aniversário, ${name}! Hoje é o seu dia especial. Que cada momento seja marcado por alegria e que seus sonhos continuem se realizando!`,
  (name) => `✨ Hoje é aniversário de ${name}! Desejamos um dia incrível, cheio de surpresas boas e muito carinho de quem você ama. Parabéns!`,
  (name) => `🌟 ${name}, hoje você merece toda a celebração do mundo! A equipe EVO Gestão te deseja saúde, paz e muito sucesso nesse novo ano de vida!`,
  (name) => `💙 Parabéns, ${name}! Que a sua jornada continue sendo marcada por momentos especiais. Estamos felizes em ter você no nosso time!`,
  (name) => `🎊 Feliz aniversário, ${name}! Que este ano que se inicia traga grandes oportunidades e que você continue brilhando em tudo que faz!`,
  (name) => `🥳 Hoje é dia de celebrar a vida de ${name}! Obrigado por fazer parte da nossa família EVO Gestão. Que seu aniversário seja repleto de alegria!`,
  (name) => `🌸 ${name}, parabéns pelo seu aniversário! Que você colha os frutos de tudo que planta com dedicação e que esse novo ano seja cheio de bênçãos!`,
  (name) => `🎈 Feliz aniversário, ${name}! Cada ano que passa é mais sabedoria e experiência. Que você continue crescendo e inspirando todos ao redor!`,
  (name) => `⭐ Hoje comemoramos mais um ano de vida de ${name}! Que a sua estrela continue brilhando forte. Parabéns de toda a equipe EVO Gestão!`,
];

function getBirthdayMessage(name) {
  const idx = Math.floor(Math.random() * BIRTHDAY_MESSAGES.length);
  return BIRTHDAY_MESSAGES[idx](name);
}

cron.schedule('0 7 * * *', async () => {
  logger.info('[JOB] Gerando notificações diárias...');

  let birthdays = [];
  try {
    const result = await db.query(`
      SELECT id, full_name, unit_id
      FROM employees
      WHERE status = 'ATIVO'
        AND birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY   FROM birth_date) = EXTRACT(DAY   FROM CURRENT_DATE)
    `);
    birthdays = result.rows;
  } catch (err) {
    logger.error('[JOB] Falha ao buscar aniversariantes:', err.message);
    return;
  }

  logger.info(`[JOB] ${birthdays.length} aniversariante(s) hoje.`);

  for (const emp of birthdays) {
    try {
      const firstName   = emp.full_name.split(' ')[0];
      const personalMsg = getBirthdayMessage(firstName);

      // ── 1. Notifica RH, DIRETORIA e SUPERVISOR da unidade ──
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, link, employee_id)
        SELECT u.id,
               'ANIVERSARIO',
               '🎂 Aniversariante hoje!',
               $1, $2, $3
        FROM users u
        WHERE (
          u.role IN ('RH','DIRETORIA')
          OR (u.role = 'SUPERVISOR' AND u.unit_id = $4)
        )
        AND u.is_active = TRUE
        ON CONFLICT DO NOTHING
      `, [
        `${emp.full_name} faz aniversário hoje! 🎉`,
        `/funcionarios/${emp.id}`,
        emp.id,
        emp.unit_id || null,
      ]).catch(e => logger.warn(`[JOB][BDAY] Notif gestores - ${emp.full_name}:`, e.message));

      // ── 2. Remetente: primeiro usuário RH/DIRETORIA ativo ──
      const { rows: rhUsers } = await db.query(
        "SELECT id FROM users WHERE role IN ('RH','DIRETORIA') AND is_active = TRUE ORDER BY id LIMIT 1"
      );

      // ── 3. Destinatário: usuário do próprio funcionário (se tiver login) ──
      const { rows: empUser } = await db.query(
        "SELECT id FROM users WHERE name ILIKE $1 AND is_active = TRUE LIMIT 1",
        [`%${firstName}%`]
      );

      if (rhUsers[0] && empUser[0] && rhUsers[0].id !== empUser[0].id) {
        // Mensagem interna de parabéns
        await db.query(
          `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)`,
          [rhUsers[0].id, empUser[0].id, personalMsg]
        ).catch(e => logger.warn(`[JOB][BDAY] Msg interna - ${emp.full_name}:`, e.message));

        // Notificação pessoal
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, employee_id)
           VALUES ($1, 'ANIVERSARIO', '🎂 Feliz Aniversário!', $2, $3)
           ON CONFLICT DO NOTHING`,
          [empUser[0].id, personalMsg, emp.id]
        ).catch(e => logger.warn(`[JOB][BDAY] Notif pessoal - ${emp.full_name}:`, e.message));
      }

      logger.info(`[JOB][BDAY] ✅ Processado: ${emp.full_name}`);
    } catch (empErr) {
      // Erro em 1 funcionário não para o loop
      logger.error(`[JOB][BDAY] Erro ao processar ${emp.full_name}:`, empErr.message);
    }
  }

  logger.info('[JOB] Notificações de aniversário concluídas.');
}, { timezone: 'America/Sao_Paulo' });

module.exports = {};
