/**
 * Middleware de Validação Zod
 * Centraliza validação de body, query e params em rotas Express
 */

const { z } = require('zod');

/**
 * Cria middleware de validação para body da requisição
 * @param {z.ZodSchema} schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error:   'Dados inválidos',
      details: result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

/**
 * Valida query string da requisição
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      error:   'Parâmetros de busca inválidos',
      details: result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      })),
    });
  }
  req.query = result.data;
  next();
};

/**
 * Valida UUID em parâmetros de rota
 */
const validateUUID = (param = 'id') => (req, res, next) => {
  const uuidSchema = z.string().uuid(`Parâmetro '${param}' deve ser um UUID válido`);
  const result = uuidSchema.safeParse(req.params[param]);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }
  next();
};

// ─── Schemas comuns reutilizáveis ─────────────────────────────

const schemas = {
  pagination: z.object({
    page:  z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    order: z.string().optional(),
    dir:   z.enum(['ASC', 'DESC']).optional().default('ASC'),
  }),

  uuid: z.string().uuid(),

  cpf: z.string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato 000.000.000-00'),

  date: z.string()
    .refine(d => !isNaN(Date.parse(d)), 'Data inválida (use YYYY-MM-DD)'),

  month: z.string()
    .regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
};

module.exports = { validateBody, validateQuery, validateUUID, schemas };
