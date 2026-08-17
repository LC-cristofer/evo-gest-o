const jwt = require('jsonwebtoken');
const db  = require('../config/database');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

const PERMISSIONS = {
  'employees:read':     ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'employees:create':   ['TI','COORDENACAO','RH_OPERACIONAL'],
  'employees:update':   ['TI','COORDENACAO','RH_OPERACIONAL'],
  'employees:transfer': ['TI','COORDENACAO'],
  'employees:delete':   ['TI'],
  'units:read':         ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'units:create':       ['TI','COORDENACAO'],
  'units:manage':       ['TI','COORDENACAO'],
  'attendance:read':    ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'attendance:create':  ['TI','COORDENACAO','RH_OPERACIONAL','SUPERVISOR'],
  'attendance:approve': ['TI','COORDENACAO','RH_OPERACIONAL'],
  'documents:read':     ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'documents:manage':   ['TI','COORDENACAO','RH_OPERACIONAL'],
  'admissions:read':    ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL'],
  'admissions:create':  ['TI','COORDENACAO','RH_OPERACIONAL'],
  'admissions:review':  ['TI','COORDENACAO','RH_OPERACIONAL'],
  'benefits:read':      ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'benefits:manage':    ['TI','COORDENACAO','RH_OPERACIONAL'],
  'dashboard:general':  ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL'],
  'dashboard:unit':     ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'export:execute':     ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'import:execute':     ['TI','COORDENACAO'],
  'users:manage':       ['TI'],
  'system:config':      ['TI'],
  'audit:read':         ['TI','COORDENACAO'],
  'home:manage':        ['TI','COORDENACAO','RH_OPERACIONAL'],
  'positions:manage':   ['TI','COORDENACAO'],
  'occurrences:read':   ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'occurrences:manage': ['TI','COORDENACAO','RH_OPERACIONAL'],
  'diario:read':        ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR'],
  'diario:manage':      ['TI','COORDENACAO','RH_OPERACIONAL','SUPERVISOR','FUNCIONARIO'],
  'portal:access':      ['TI','COORDENACAO','VISUALIZADOR','RH_OPERACIONAL','SUPERVISOR','FUNCIONARIO'],
};

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token não fornecido.' });
    const token = header.split(' ')[1];
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch (e) { return res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expirado.' : 'Token inválido.' }); }
    const { rows } = await db.query(
      'SELECT id, name, email, role, unit_id, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );
    if (!rows[0] || !rows[0].is_active)
      return res.status(401).json({ error: 'Usuário inativo.' });
    req.user = rows[0];
    next();
  } catch (err) { next(err); }
};

const can = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  const allowed = PERMISSIONS[permission];
  if (allowed && !allowed.includes(req.user.role))
    return res.status(403).json({ error: 'Sem permissão para esta ação.' });
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Sem permissão.' });
  next();
};

const scopeToUnit = (req, res, next) => {
  if (req.user?.role === 'SUPERVISOR') req.scopedUnitId = req.user.unit_id;
  next();
};

const generateToken = (user) => jwt.sign(
  { sub: user.id, name: user.name, role: user.role },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

const generateRefreshToken = (user) => jwt.sign(
  { sub: user.id, type: 'refresh' },
  process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh',
  { expiresIn: '7d' }
);

module.exports = { authenticate, authorize, can, scopeToUnit, generateToken, generateRefreshToken, PERMISSIONS };
