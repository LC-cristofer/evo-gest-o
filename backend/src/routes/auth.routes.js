const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../config/database');
const { generateToken, generateRefreshToken, authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Credenciais obrigatórias.' });

    const loginField = email.toLowerCase().trim();
    // Se for só números, trata como CPF (login de funcionário)
    const isCpf = /^\d{9,11}$/.test(loginField.replace(/\D/g, ''));

    let query, params;
    if (isCpf) {
      const cpfClean = loginField.replace(/\D/g, '');
      query  = 'SELECT id, name, email, password_hash, role, unit_id, is_active, must_change_password FROM users WHERE cpf = $1';
      params = [cpfClean];
    } else {
      query  = 'SELECT id, name, email, password_hash, role, unit_id, is_active, must_change_password FROM users WHERE email = $1';
      params = [loginField];
    }

    const { rows } = await db.query(query, params);
    const user = rows[0];
    if (!user) {
      await bcrypt.compare(password, '$2a$12$placeholder.to.avoid.timing.attack');
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!user.is_active) return res.status(403).json({ error: 'Conta desativada.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas.' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token        = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      token,
      refreshToken,
      must_change_password: user.must_change_password || false,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, unit_id: user.unit_id },
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.unit_id, u.last_login, un.name AS unit_name
       FROM users u LEFT JOIN units un ON u.unit_id = un.id WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token não fornecido.' });
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || 'dev_secret') + '_refresh'
      );
    } catch { return res.status(401).json({ error: 'Refresh token inválido.' }); }

    const { rows } = await db.query(
      'SELECT id, name, email, role, unit_id, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );
    if (!rows[0]?.is_active) return res.status(401).json({ error: 'Usuário inativo.' });

    res.json({ token: generateToken(rows[0]) });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Senha mínimo 8 caracteres.' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) { next(err); }
});

module.exports = router;
