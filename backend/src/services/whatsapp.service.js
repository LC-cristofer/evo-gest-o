/**
 * Serviço de WhatsApp — EVO Gestão
 * Integração com Evolution API (open-source, self-hosted)
 *
 * Docs: https://doc.evolution-api.com
 *
 * Variáveis de ambiente necessárias (.env):
 *   EVOLUTION_API_URL   — ex: http://localhost:8080
 *   EVOLUTION_API_KEY   — chave gerada na Evolution API
 *   EVOLUTION_INSTANCE  — nome da instância (ex: "casca")
 *   WHATSAPP_ENABLED    — "true" para ativar envios reais
 */

const logger = require('../utils/logger');
const db     = require('../config/database');

const BASE_URL  = process.env.EVOLUTION_API_URL  || 'http://localhost:8080';
const API_KEY   = process.env.EVOLUTION_API_KEY  || '';
const INSTANCE  = process.env.EVOLUTION_INSTANCE || 'casca';
const ENABLED   = process.env.WHATSAPP_ENABLED === 'true';

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Normaliza número para o formato E.164 sem "+" (ex: "5541999990000")
 * Aceita: (41) 99999-0000 | 41999990000 | +5541999990000
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.toString().replace(/\D/g, '');

  // Já tem DDI 55
  if (digits.startsWith('55') && digits.length >= 12) return digits;

  // Só DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return null;
}

/**
 * Faz uma requisição para a Evolution API
 */
async function evolutionRequest(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Função principal de envio ───────────────────────────────

/**
 * Envia uma mensagem de texto via WhatsApp
 * @param {string} phone  — número do destinatário
 * @param {string} text   — texto da mensagem
 * @returns {{ ok: boolean, messageId?: string, error?: string }}
 */
async function sendText(phone, text) {
  const number = normalizePhone(phone);

  if (!number) {
    logger.warn(`[WHATSAPP] Número inválido: "${phone}"`);
    return { ok: false, error: 'Número inválido' };
  }

  if (!ENABLED) {
    logger.info(`[WHATSAPP][DRY] Seria enviado para ${number}: ${text.slice(0, 60)}…`);
    return { ok: true, dry: true };
  }

  try {
    const data = await evolutionRequest(
      `/message/sendText/${INSTANCE}`,
      { number, text }
    );

    logger.info(`[WHATSAPP] ✅ Enviado para ${number} | ID: ${data?.key?.id || '?'}`);
    return { ok: true, messageId: data?.key?.id };

  } catch (err) {
    logger.error(`[WHATSAPP] ❌ Falha ao enviar para ${number}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ─── Registro de log no banco ────────────────────────────────

/**
 * Registra o resultado do envio na tabela whatsapp_logs
 */
async function logSend({ employeeId, phone, message, type, result }) {
  try {
    await db.query(`
      INSERT INTO whatsapp_logs
        (employee_id, phone, message, type, status, error_message, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      employeeId  || null,
      phone       || null,
      message,
      type        || 'GERAL',
      result.ok   ? 'ENVIADO' : 'ERRO',
      result.ok   ? null : (result.error || 'Erro desconhecido'),
    ]);
  } catch (dbErr) {
    logger.warn('[WHATSAPP] Falha ao salvar log no banco:', dbErr.message);
  }
}

// ─── Mensagens de aniversário ────────────────────────────────

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

/**
 * Envia parabéns de aniversário via WhatsApp para um funcionário.
 * Registra o envio no banco para evitar duplicatas no mesmo dia.
 *
 * @param {{ id, full_name, phone }} employee
 */
async function sendBirthdayMessage(employee) {
  const { id, full_name, phone } = employee;
  const firstName = full_name.split(' ')[0];

  // Evita reenvio: checa se já enviamos hoje
  const { rows } = await db.query(`
    SELECT id FROM whatsapp_logs
    WHERE employee_id = $1
      AND type        = 'ANIVERSARIO'
      AND sent_at::date = CURRENT_DATE
      AND status      = 'ENVIADO'
    LIMIT 1
  `, [id]);

  if (rows.length > 0) {
    logger.info(`[WHATSAPP][BDAY] Já enviado hoje para ${full_name}, pulando.`);
    return;
  }

  const message = getBirthdayMessage(firstName);
  const result  = await sendText(phone, message);

  await logSend({
    employeeId: id,
    phone,
    message,
    type: 'ANIVERSARIO',
    result,
  });
}

// ─── Verificação de status da instância ─────────────────────

/**
 * Verifica se a instância está conectada ao WhatsApp.
 * Útil para health-checks e painel admin.
 */
async function checkInstanceStatus() {
  try {
    const res = await fetch(
      `${BASE_URL}/instance/fetchInstances`,
      { headers: { 'apikey': API_KEY }, signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return { connected: false, error: `HTTP ${res.status}` };

    const data = await res.json();
    const inst = Array.isArray(data)
      ? data.find(i => i.instance?.instanceName === INSTANCE)
      : null;

    const connected = inst?.instance?.status === 'open';
    return { connected, status: inst?.instance?.status || 'unknown' };

  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  sendText,
  sendBirthdayMessage,
  checkInstanceStatus,
  normalizePhone,
  logSend,
};
