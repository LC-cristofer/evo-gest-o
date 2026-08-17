const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /messages - conversas do usuário
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*, 
             s.name AS sender_name, s.email AS sender_email,
             r.name AS receiver_name, r.email AS receiver_email
      FROM messages m
      JOIN users s ON m.sender_id   = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY m.created_at DESC
      LIMIT 100
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /messages/unread
router.get('/unread', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { next(err); }
});

// POST /messages
router.post('/', async (req, res, next) => {
  try {
    const { receiver_id, content } = req.body;
    if (!receiver_id || !content) return res.status(400).json({ error: 'Destinatário e conteúdo obrigatórios.' });
    const { rows } = await db.query(
      'INSERT INTO messages (sender_id,receiver_id,content) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, receiver_id, content]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /messages/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE messages SET is_read=TRUE, read_at=NOW() WHERE id=$1 AND receiver_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});


// POST /messages/send-to-employee — envia mensagem para funcionário pelo employee_id
router.post('/send-to-employee', authenticate, async (req, res, next) => {
  try {
    const { employee_id, content } = req.body;
    if (!employee_id || !content?.trim()) {
      return res.status(400).json({ error: 'employee_id e content são obrigatórios.' });
    }
    // Buscar user associado ao funcionário pelo nome
    const { rows: empRows } = await db.query(
      'SELECT full_name FROM employees WHERE id=$1', [employee_id]
    );
    if (!empRows[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    // Tentar encontrar user com mesmo nome
    const { rows: userRows } = await db.query(
      `SELECT id FROM users WHERE name ILIKE $1 AND is_active=TRUE LIMIT 1`,
      [empRows[0].full_name]
    );

    if (!userRows[0]) {
      return res.status(404).json({
        error: 'Este funcionário não possui acesso ao sistema. A mensagem não pode ser entregue via chat.',
      });
    }

    const { rows } = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, userRows[0].id, content.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});


// POST /messages/send-birthday — Envio manual de mensagem de parabéns
router.post('/send-birthday', authenticate, async (req, res, next) => {
  try {
    const { employee_id, message } = req.body;
    if (!employee_id || !message?.trim()) {
      return res.status(400).json({ error: 'employee_id e message são obrigatórios.' });
    }

    // Busca o usuário vinculado ao funcionário (pelo nome)
    const { rows: emp } = await db.query(
      'SELECT id, full_name FROM employees WHERE id=$1', [employee_id]
    );
    if (!emp[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    // Tenta encontrar usuário com login vinculado ao funcionário
    const { rows: empUser } = await db.query(
      `SELECT id FROM users WHERE name ILIKE $1 AND is_active=TRUE LIMIT 1`,
      [`%${emp[0].full_name.split(' ')[0]}%`]
    );

    if (empUser[0]) {
      // Envia como mensagem interna para o usuário do funcionário
      await db.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1,$2,$3)',
        [req.user.id, empUser[0].id, message.trim()]
      );
    }

    // Cria notificação para todos os usuários que tenham a mesma unidade
    const { rows: empData } = await db.query(
      'SELECT unit_id FROM employees WHERE id=$1', [employee_id]
    );
    if (empData[0]?.unit_id) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, employee_id)
        SELECT u.id, 'ANIVERSARIO', '🎂 Mensagem de aniversário enviada',
               $1, $2
        FROM users u
        WHERE (u.unit_id = $3 OR u.role IN ('RH','DIRETORIA'))
          AND u.id != $4 AND u.is_active = TRUE
        ON CONFLICT DO NOTHING
      `, [message.trim(), employee_id, empData[0].unit_id, req.user.id]).catch(() => {});
    }

    res.json({ ok: true, message: 'Mensagem enviada!' });
  } catch (err) { next(err); }
});

module.exports = router;
