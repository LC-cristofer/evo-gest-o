/**
 * Rate Limiters específicos
 * Proteção adicional para rotas sensíveis
 */

const rateLimit = require('express-rate-limit');

/** Login: 10 tentativas por 15 minutos */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.ip + ':login',
});

/** Admissão pública: 30 submissões por hora por IP */
const admissionFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      30,
  message:  { error: 'Muitas requisições. Tente novamente mais tarde.' },
  keyGenerator: (req) => req.ip + ':admission',
});

/** Upload de arquivos: 20 uploads por hora por IP */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  message:  { error: 'Limite de uploads atingido. Tente novamente mais tarde.' },
  keyGenerator: (req) => req.ip + ':upload',
});

/** Export: 10 exportações por hora */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10,
  message:  { error: 'Limite de exportações atingido.' },
  keyGenerator: (req) => (req.user?.id || req.ip) + ':export',
});

/** Geral: 300 req por 15 minutos */
const generalLimiter = rateLimit({
  windowMs:    15 * 60 * 1000,
  max:         300,
  message:     { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => req.path === '/health',
});

module.exports = {
  loginLimiter,
  admissionFormLimiter,
  uploadLimiter,
  exportLimiter,
  generalLimiter,
};
