const bcrypt = require('bcryptjs');
const db     = require('../config/database');
const { generateToken, generateRefreshToken } = require('../middleware/auth');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

    const { rows } = await db.query(
      `SELECT id, name, email, password_hash, role, unit_id, employee_id, is_active, must_change_password
       FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'Usuário inativo.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

    return res.json({
      token:        generateToken(user),
      refreshToken: generateRefreshToken(user),
      user: {
        id:                   user.id,
        name:                 user.name,
        email:                user.email,
        role:                 user.role,
        unit_id:              user.unit_id,
        employee_id:          user.employee_id,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    console.error('[AUTH] login error:', err.message);
    return res.status(500).json({ error: 'Erro interno no login.' });
  }
};

exports.me = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role, unit_id, employee_id, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json(rows[0]);
  } catch (err) { return res.status(500).json({ error: 'Erro interno.' }); }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Senhas obrigatórias.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres.' });
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash=$1, must_change_password=FALSE, updated_at=NOW() WHERE id=$2',
      [hash, req.user.id]
    );
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) { return res.status(500).json({ error: 'Erro interno.' }); }
};

exports.refreshToken = async (req, res) => {
  try { return res.json({ token: generateToken(req.user) }); }
  catch (err) { return res.status(500).json({ error: 'Erro ao renovar token.' }); }
};
