/**
 * Sistema de Desfazer — Undo para ações críticas
 * Ações desfazíveis: remanejamento, faltas/atestados, status de funcionário
 */
const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /undo — lista ações recentes desfazíveis do usuário
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, action_type, entity_type, description, created_at, expires_at,
             reverted_at, (expires_at > NOW()) AS can_undo
      FROM undo_log
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /undo/:id — desfaz uma ação
router.post('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM undo_log WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    const log = rows[0];
    if (!log)           return res.status(404).json({ error: 'Ação não encontrada.' });
    if (log.reverted_at) return res.status(400).json({ error: 'Esta ação já foi desfeita.' });
    if (new Date(log.expires_at) < new Date()) {
      return res.status(410).json({ error: 'O prazo para desfazer esta ação expirou (24h).' });
    }

    const snap = log.snapshot;

    // Reverter com base no tipo
    switch (log.action_type) {
      case 'TRANSFER': {
        // Restaura unit_id e supervisor_id anteriores
        await db.query(
          'UPDATE employees SET unit_id=$1, supervisor_id=$2, updated_at=NOW() WHERE id=$3',
          [snap.unit_id, snap.supervisor_id || null, log.entity_id]
        );
        // Registra no histórico
        await db.query(
          `INSERT INTO employee_history (employee_id, event_type, description, created_by)
           VALUES ($1,'MUDANCA_UNIDADE','Remanejamento desfeito (restaurado para unidade anterior)',$2)`,
          [log.entity_id, req.user.id]
        );
        break;
      }
      case 'ATTENDANCE_CREATE': {
        // Remove o registro de falta/atestado
        await db.query('DELETE FROM attendance_records WHERE id=$1', [log.entity_id]);
        break;
      }
      case 'STATUS_CHANGE': {
        // Restaura o status anterior
        await db.query(
          'UPDATE employees SET status=$1, updated_at=NOW() WHERE id=$2',
          [snap.status, log.entity_id]
        );
        await db.query(
          `INSERT INTO employee_history (employee_id, event_type, description, created_by)
           VALUES ($1,'STATUS','Alteração de status desfeita (restaurado para ${snap.status})',$2)`,
          [log.entity_id, req.user.id]
        );
        break;
      }
      case 'BULK_TRANSFER': {
        // Restaura todos os funcionários do lote
        const employees = snap.employees || [];
        for (const emp of employees) {
          await db.query(
            'UPDATE employees SET unit_id=$1, supervisor_id=$2, updated_at=NOW() WHERE id=$3',
            [emp.unit_id, emp.supervisor_id || null, emp.id]
          );
        }
        break;
      }
      default:
        return res.status(400).json({ error: `Tipo de ação "${log.action_type}" não suportado para desfazer.` });
    }

    // Marcar como desfeito
    await db.query('UPDATE undo_log SET reverted_at=NOW() WHERE id=$1', [log.id]);
    res.json({ message: 'Ação desfeita com sucesso.' });
  } catch (err) { next(err); }
});

module.exports = router;
