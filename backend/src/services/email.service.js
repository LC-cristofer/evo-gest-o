/**
 * Serviço de Email — EVO Gestão
 * Nodemailer com fallback gracioso quando SMTP não está disponível
 */
const nodemailer = require('nodemailer');

function createTransporter() {
  const config = {
    host:   process.env.SMTP_HOST || 'mailhog',
    port:   parseInt(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 5000,
    greetingTimeout:   5000,
  };
  // Só inclui auth se SMTP_USER estiver preenchido (Mailhog não precisa)
  if (process.env.SMTP_USER && process.env.SMTP_USER.trim()) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  } else {
    config.auth = false; // Mailhog / relay anônimo
  }
  return nodemailer.createTransport(config);
}

const FROM = `"${process.env.ORG_NAME || 'EVO Gestão'}" <${process.env.SMTP_FROM || 'rh@casca-araucaria.org.br'}>`;

// Testa conexão na inicialização (sem bloquear)
const transporter = createTransporter();
transporter.verify().then(() => {
  console.log('[EMAIL] ✅ SMTP conectado:', process.env.SMTP_HOST);
}).catch(err => {
  console.warn('[EMAIL] ⚠️  SMTP não disponível:', err.message, '— emails serão logados no console');
});

const sendMail = async (options) => {
  try {
    const t = createTransporter(); // cria novo a cada envio para evitar conn stale
    const info = await t.sendMail({ from: FROM, ...options });
    console.log('[EMAIL] Enviado:', options.to, '| ID:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[EMAIL] Falha:', err.message);
    console.log('[EMAIL] Para:', options.to);
    console.log('[EMAIL] Assunto:', options.subject);
    if (options.text) console.log('[EMAIL] Body:', options.text.slice(0, 200));
    return { ok: false, error: err.message };
  }
};

const sendAdmissionEmail = async ({ to, name, link, expiresAt, isResend = false }) => {
  const expiryStr = expiresAt ? new Intl.DateTimeFormat('pt-BR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  }).format(expiresAt) : '72 horas';

  const subject = isResend
    ? `[REENVIO] Complete seu cadastro — ${process.env.ORG_NAME || 'EVO Gestão'}`
    : `Bem-vindo(a)! Complete seu cadastro — ${process.env.ORG_NAME || 'EVO Gestão'}`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
  .hdr{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:32px;text-align:center}
  .hdr h1{margin:0;font-size:22px;font-weight:800}
  .hdr p{margin:6px 0 0;opacity:.8;font-size:13px}
  .body{padding:32px;color:#374151;line-height:1.7}
  .btn{display:inline-block;background:#2563eb;color:#fff!important;padding:14px 32px;
       border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:20px 0}
  .info{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;font-size:13px}
  .warn{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:13px;margin:16px 0}
  .steps{background:#f9fafb;border-radius:8px;padding:16px 20px;margin:16px 0}
  .steps li{margin:8px 0;font-size:14px}
  .ftr{background:#f9fafb;padding:20px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb}
  .link-fallback{word-break:break-all;font-size:12px;color:#6b7280;background:#f3f4f6;padding:10px;border-radius:6px;font-family:monospace}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <h1>EVO Gestão Araucária</h1>
    <p>${isResend ? 'Reenvio do link de admissão' : 'Processo de Admissão Digital'}</p>
  </div>
  <div class="body">
    <p>Olá, <strong>${name}</strong>! 👋</p>
    <p>${isResend
      ? 'Estamos reenviando o link de admissão conforme solicitado.'
      : 'Estamos felizes em tê-lo(a) na equipe! Para finalizar sua admissão, preencha seus dados e envie os documentos pelo link abaixo.'
    }</p>
    <div style="text-align:center">
      <a href="${link}" class="btn">→ Acessar Formulário de Admissão</a>
    </div>
    <div class="warn">⏰ Este link expira em: <strong>${expiryStr}</strong></div>
    <div class="steps">
      <p style="margin:0 0 8px;font-weight:700;font-size:13px">Como preencher:</p>
      <ol class="steps" style="margin:0;padding-left:20px">
        <li>Clique no botão acima ou copie o link</li>
        <li>Preencha seus dados pessoais e bancários</li>
        <li>Envie os documentos solicitados (RG, CPF, CTPS, etc.)</li>
        <li>Confirme o envio — o RH será notificado</li>
      </ol>
    </div>
    <div class="info">
      <strong>Link alternativo:</strong><br>
      <div class="link-fallback">${link}</div>
    </div>
    <p style="font-size:13px;color:#6b7280">Dúvidas? Entre em contato com o RH pelo email <strong>${process.env.SMTP_FROM || 'rh@casca-araucaria.org.br'}</strong></p>
  </div>
  <div class="ftr">EVO Gestão — Araucária, Paraná · Este email é automático, não responda diretamente.</div>
</div></body></html>`;

  return sendMail({
    to,
    subject,
    html,
    text: `Olá ${name}!\n\nAcesse seu formulário de admissão:\n${link}\n\nExpira em: ${expiryStr}\n\n${process.env.ORG_NAME || 'EVO Gestão'}`,
  });
};

const sendDocumentPendingEmail = async ({ to, name, documentType }) => {
  return sendMail({
    to,
    subject: `Documento pendente: ${documentType} — ${process.env.ORG_NAME || 'EVO Gestão'}`,
    text: `Olá ${name},\n\nSeu documento "${documentType}" está pendente de envio.\n\nO RH da ${process.env.ORG_NAME || 'EVO Gestão'}`,
  });
};

module.exports = { sendAdmissionEmail, sendDocumentPendingEmail, sendMail };
