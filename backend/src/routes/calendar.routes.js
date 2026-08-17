const express = require('express');
const db      = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /calendar/events
router.get('/events', async (req, res, next) => {
  try {
    const { start, end, unit_id } = req.query;
    const params = [];
    const conds  = [];

    if (start) { params.push(start); conds.push(`ce.start_date >= $${params.length}::date`); }
    if (end)   { params.push(end);   conds.push(`ce.start_date <= $${params.length}::date + interval '1 day'`); }

    // Supervisores veem só sua unidade
    if (req.user.role === 'SUPERVISOR' && req.user.unit_id) {
      params.push(req.user.unit_id);
      conds.push(`(ce.unit_id = $${params.length} OR ce.unit_id IS NULL)`);
    } else if (unit_id) {
      params.push(unit_id);
      conds.push(`(ce.unit_id = $${params.length} OR ce.unit_id IS NULL)`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT ce.*,
             u.name  AS unit_name,
             e.full_name AS employee_name,
             usr.name    AS created_by_name,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'employee_id', cep.employee_id,
                 'employee_name', emp.full_name
               ))
               FROM calendar_event_participants cep
               JOIN employees emp ON cep.employee_id = emp.id
               WHERE cep.event_id = ce.id),
               '[]'::json
             ) AS participants
      FROM calendar_events ce
      LEFT JOIN units    u   ON ce.unit_id     = u.id
      LEFT JOIN employees e  ON ce.employee_id = e.id
      LEFT JOIN users usr    ON ce.created_by  = usr.id
      ${where}
      ORDER BY ce.start_date
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /calendar/birthdays?month=MM
router.get('/birthdays', async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const params = [month];
    let extra = '';
    if (req.user.role === 'SUPERVISOR' && req.user.unit_id) {
      params.push(req.user.unit_id);
      extra = `AND e.unit_id = $${params.length}`;
    }
    const { rows } = await db.query(`
      SELECT e.id, e.full_name, e.birth_date, e.cpf,
             u.name AS unit_name,
             s.name AS supervisor_name,
             EXTRACT(DAY   FROM e.birth_date) AS day,
             EXTRACT(MONTH FROM e.birth_date) AS month,
             DATE_PART('year', AGE(
               MAKE_DATE(EXTRACT(YEAR FROM NOW())::int,
                         EXTRACT(MONTH FROM e.birth_date)::int,
                         EXTRACT(DAY   FROM e.birth_date)::int)
             )) AS age_this_year
      FROM employees e
      LEFT JOIN units u ON e.unit_id = u.id
      LEFT JOIN users  s ON e.supervisor_id = s.id
      WHERE e.status = 'ATIVO'
        AND e.birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM e.birth_date) = $1
        ${extra}
      ORDER BY EXTRACT(DAY FROM e.birth_date)
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /calendar/events
router.post('/events', async (req, res, next) => {
  try {
    const {
      title, description, start_date, end_date, all_day,
      type, color, unit_id, employee_id, participant_ids,
    } = req.body;
    if (!title || !start_date) return res.status(400).json({ error: 'Título e data obrigatórios.' });

    const { rows } = await db.query(`
      INSERT INTO calendar_events
        (title,description,start_date,end_date,all_day,type,color,unit_id,employee_id,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      title, description||null, start_date, end_date||null,
      all_day !== false, type||'EVENTO', color||'#2563eb',
      unit_id||null, employee_id||null, req.user.id,
    ]);

    const event = rows[0];

    // Inserir participantes adicionais
    if (participant_ids?.length) {
      for (const empId of participant_ids) {
        await db.query(
          'INSERT INTO calendar_event_participants (event_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [event.id, empId]
        ).catch(() => {});
      }
    }

    res.status(201).json(event);
  } catch (err) { next(err); }
});

// PUT /calendar/events/:id
router.put('/events/:id', async (req, res, next) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE calendar_events
      SET title       = COALESCE($2, title),
          description = COALESCE($3, description),
          start_date  = COALESCE($4, start_date),
          end_date    = $5,
          all_day     = COALESCE($6, all_day),
          type        = COALESCE($7, type),
          color       = COALESCE($8, color),
          unit_id     = $9,
          employee_id = $10
      WHERE id = $1 RETURNING *
    `, [
      req.params.id, d.title, d.description, d.start_date,
      d.end_date||null, d.all_day, d.type, d.color,
      d.unit_id||null, d.employee_id||null,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Evento não encontrado.' });

    // Atualizar participantes
    if (d.participant_ids !== undefined) {
      await db.query('DELETE FROM calendar_event_participants WHERE event_id = $1', [req.params.id]);
      for (const empId of (d.participant_ids || [])) {
        await db.query(
          'INSERT INTO calendar_event_participants (event_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, empId]
        ).catch(() => {});
      }
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /calendar/events/:id
router.delete('/events/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM calendar_event_participants WHERE event_id = $1', [req.params.id]);
    await db.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
