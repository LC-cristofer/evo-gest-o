const express = require('express');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const db      = require('../config/database');
const { authenticate, can, scopeToUnit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, scopeToUnit);

// ─── Upload de foto de perfil ─────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}_${Date.now()}${ext}`);
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    cb(null, ['image/jpeg','image/png','image/webp'].includes(f.mimetype));
  },
});

// ─── Upload de documentos por funcionário ─────────────────────
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, `../../uploads/documents/${req.params.id}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(10).toString('hex') + ext);
  },
});
const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─── Listagem ────────────────────────────────────────────────
router.get('/', can('employees:read'), async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, status, unit_id, supervisor_id } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conds  = [];

    if (req.scopedUnitId) { params.push(req.scopedUnitId); conds.push(`e.unit_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      conds.push(`(e.full_name ILIKE $${i} OR e.cpf ILIKE $${i} OR e.employee_code ILIKE $${i})`);
    }
    if (status) { params.push(status); conds.push(`e.status = $${params.length}`); }
    if (unit_id && !req.scopedUnitId) { params.push(unit_id); conds.push(`e.unit_id = $${params.length}`); }
    if (supervisor_id) { params.push(supervisor_id); conds.push(`e.supervisor_id = $${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      db.query(`
        SELECT e.id, e.employee_code, e.cpf, e.full_name, e.social_name,
               e.email, e.phone, e.status, e.hire_date, e.dismissal_date,
               e.contract_type, e.photo_url, e.has_disability,
               p.name AS position_name,
               u.name AS unit_name, u.code AS unit_code,
               s.name AS supervisor_name
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.id
        LEFT JOIN units u     ON e.unit_id     = u.id
        LEFT JOIN users s     ON e.supervisor_id = s.id
        ${where}
        ORDER BY e.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      db.query(`SELECT COUNT(*) FROM employees e ${where}`, params),
    ]);

    res.json({
      data: data.rows, total: parseInt(count.rows[0].count),
      page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(count.rows[0].count / limit),
    });
  } catch (err) { next(err); }
});

// ─── Busca por CPF ───────────────────────────────────────────
router.get('/search/cpf/:cpf', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.employee_code, e.full_name, e.cpf, e.status,
              u.name AS unit_name, p.name AS position_name
       FROM employees e LEFT JOIN units u ON e.unit_id = u.id LEFT JOIN positions p ON e.position_id = p.id
       WHERE e.cpf = $1`, [req.params.cpf]
    );
    if (!rows[0]) return res.status(404).json({ error: 'CPF não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── Detalhe completo ────────────────────────────────────────
router.get('/:id', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*,
             p.name AS position_name,
             u.name AS unit_name, u.code AS unit_code,
             s.name AS supervisor_name, s.email AS supervisor_email,
             (SELECT json_agg(b.* ORDER BY b.created_at) FROM employee_benefits b WHERE b.employee_id = e.id AND b.status = 'ATIVO') AS benefits,
             (SELECT json_agg(h.* ORDER BY h.created_at DESC) FROM (SELECT * FROM employee_history WHERE employee_id = e.id ORDER BY created_at DESC LIMIT 20) h) AS recent_history,
             (SELECT json_agg(d.* ORDER BY d.created_at DESC) FROM employee_documents_v2 d WHERE d.employee_id = e.id) AS documents
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN units u     ON e.unit_id     = u.id
      LEFT JOIN users s     ON e.supervisor_id = s.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });
    if (req.scopedUnitId && rows[0].unit_id !== req.scopedUnitId) {
      return res.status(403).json({ error: 'Sem acesso a este funcionário.' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── Criar funcionário ────────────────────────────────────────
router.post('/', can('employees:create'), async (req, res, next) => {
  try {
    const d = req.body;
    if (!d.cpf || !d.full_name || !d.birth_date || !d.hire_date) {
      return res.status(400).json({ error: 'CPF, nome, nascimento e admissão são obrigatórios.' });
    }
    const { rows: dup } = await db.query('SELECT id FROM employees WHERE cpf = $1', [d.cpf]);
    if (dup[0]) return res.status(409).json({ error: 'CPF já cadastrado.' });

    const n = (v) => (v === '' || v === undefined ? null : v);

    const { rows } = await db.query(`
      INSERT INTO employees (
        cpf, full_name, social_name, rg, rg_issuer, birth_date, gender,
        nationality, place_of_birth, mothers_name,
        email, phone, phone_secondary,
        address, address_number, address_comp, neighborhood, city, state, zip_code,
        bank_code, bank_agency, bank_account, bank_account_type, pix_key,
        hire_date, position_id, unit_id, supervisor_id,
        salary, contract_type, work_schedule,
        pis_pasep, ctps_number, ctps_series,
        has_disability, disability_type, notes, status, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,
        $30,$31,$32,$33,$34,$35,$36,$37,$38,'ATIVO',$39
      ) RETURNING *
    `, [
      d.cpf, d.full_name, n(d.social_name), n(d.rg), n(d.rg_issuer), d.birth_date, n(d.gender),
      n(d.nationality), n(d.place_of_birth), n(d.mothers_name),
      n(d.email), n(d.phone), n(d.phone_secondary),
      n(d.address), n(d.address_number), n(d.address_comp), n(d.neighborhood), n(d.city), n(d.state), n(d.zip_code),
      n(d.bank_code), n(d.bank_agency), n(d.bank_account), n(d.bank_account_type), n(d.pix_key),
      d.hire_date, n(d.position_id), n(d.unit_id), n(d.supervisor_id),
      n(d.salary), n(d.contract_type) || 'CLT', n(d.work_schedule),
      n(d.pis_pasep), n(d.ctps_number), n(d.ctps_series),
      d.has_disability || false, n(d.disability_type), n(d.notes), req.user.id,
    ]);

    await db.query(
      `INSERT INTO employee_history (employee_id, event_type, description, effective_date, created_by)
       VALUES ($1,'ADMISSAO',$2,$3,$4)`,
      [rows[0].id, `Admissão registrada por ${req.user.name}`, d.hire_date, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ─── Atualizar funcionário (TODOS os campos) ──────────────────
router.put('/:id', can('employees:update'), async (req, res, next) => {
  try {
    const d = req.body;
    const ignore = ['id','employee_code','cpf','created_at','created_by','photo_url'];
    const n = (v) => (v === '' || v === undefined ? null : v);

    const fields = Object.keys(d).filter(k => !ignore.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values     = fields.map(f => n(d[f]));

    const { rows } = await db.query(
      `UPDATE employees SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── Upload de foto de perfil ─────────────────────────────────
router.post('/:id/photo', can('employees:update'), photoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    await db.query('UPDATE employees SET photo_url = $1, updated_at = NOW() WHERE id = $2', [photoUrl, req.params.id]);
    res.json({ photo_url: photoUrl });
  } catch (err) { next(err); }
});

// ─── Documentos do funcionário ────────────────────────────────
router.get('/:id/documents', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM employee_documents_v2 WHERE employee_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/documents', can('employees:update'), docUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const { category, description } = req.body;
    const filePath = `/uploads/documents/${req.params.id}/${req.file.filename}`;

    const { rows } = await db.query(`
      INSERT INTO employee_documents_v2 (employee_id, file_name, original_name, file_path, file_size, mime_type, category, description, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      req.params.id, req.file.filename, req.file.originalname,
      filePath, req.file.size, req.file.mimetype,
      category || 'Geral', description || null, req.user.id,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id/documents/:docId', can('employees:update'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT file_path FROM employee_documents_v2 WHERE id=$1 AND employee_id=$2', [req.params.docId, req.params.id]);
    if (rows[0]) {
      const abs = path.join(__dirname, '../..', rows[0].file_path);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      await db.query('DELETE FROM employee_documents_v2 WHERE id=$1', [req.params.docId]);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Alterar status / desligamento ───────────────────────────
router.patch('/:id/status', can('employees:update'), async (req, res, next) => {
  try {
    const { status, dismissal_type, reason, effective_date, dismissal_date } = req.body;
    const valid = ['ATIVO','INATIVO','AFASTADO','DESLIGADO'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    if (status === 'DESLIGADO' && !dismissal_type) return res.status(400).json({ error: 'Tipo de desligamento obrigatório.' });

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE employees SET status=$1, dismissal_date=$2, dismissal_reason=$3, updated_at=NOW() WHERE id=$4`,
        [status, status === 'DESLIGADO' ? (dismissal_date || effective_date || new Date().toISOString().split('T')[0]) : null, reason || null, req.params.id]
      );
      await client.query(
        `INSERT INTO employee_history (employee_id, event_type, dismissal_type, description, effective_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.id,
         status === 'DESLIGADO' ? 'DESLIGAMENTO' : 'AFASTAMENTO',
         dismissal_type || null,
         reason || `Status alterado para ${status}`,
         effective_date || new Date().toISOString().split('T')[0],
         req.user.id]
      );
    });
    res.json({ message: 'Status atualizado.' });
  } catch (err) { next(err); }
});

// ─── Remanejar funcionário ────────────────────────────────────
router.patch('/:id/transfer', can('employees:update'), async (req, res, next) => {
  try {
    const { unit_id, reason } = req.body;
    if (!unit_id) return res.status(400).json({ error: 'Unidade de destino obrigatória.' });

    // Verificar que unidade não é do tipo VOLANTE
    const { rows: unitCheck } = await db.query('SELECT name FROM units WHERE id=$1', [unit_id]);
    if (!unitCheck[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    if (unitCheck[0].name.toUpperCase().includes('VOLANTE')) {
      return res.status(400).json({ error: 'Unidades VOLANTE não podem receber funcionários fixos.' });
    }

    const { rows: cur } = await db.query('SELECT unit_id FROM employees WHERE id=$1', [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const { rows: oldUnit } = await db.query('SELECT name FROM units WHERE id=$1', [cur[0].unit_id]);

    const { supervisor_id } = req.body;

    // Se supervisor_id for fornecido, validar que pertence à unidade destino
    let supUpdate = '';
    const updateParams = [unit_id, req.params.id];
    if (supervisor_id !== undefined) {
      supUpdate = ', supervisor_id=$3';
      updateParams.push(supervisor_id || null);
    }

    await db.transaction(async (client) => {
      await client.query(`UPDATE employees SET unit_id=$1${supUpdate}, updated_at=NOW() WHERE id=$2`, updateParams);
      await client.query(
        `INSERT INTO employee_history (employee_id, event_type, description, effective_date, created_by)
         VALUES ($1,'MUDANCA_UNIDADE',$2,CURRENT_DATE,$3)`,
        [req.params.id,
         `Remanejado de "${oldUnit[0]?.name || 'N/A'}" para "${unitCheck[0].name}"${reason ? ': ' + reason : ''}`,
         req.user.id]
      );
    });
    res.json({ message: 'Remanejado com sucesso.' });
  } catch (err) { next(err); }
});


// ─── Remanejamento em lote ───────────────────────────────────
router.post('/bulk-transfer', can('employees:update'), async (req, res, next) => {
  try {
    const { employee_ids, unit_id, supervisor_id, reason } = req.body;
    if (!Array.isArray(employee_ids) || !employee_ids.length) {
      return res.status(400).json({ error: 'Selecione pelo menos um funcionário.' });
    }
    if (!unit_id) return res.status(400).json({ error: 'Unidade de destino obrigatória.' });

    const { rows: unitCheck } = await db.query('SELECT name FROM units WHERE id=$1', [unit_id]);
    if (!unitCheck[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    if (unitCheck[0].name.toUpperCase().includes('VOLANTE')) {
      return res.status(400).json({ error: 'Unidades VOLANTE não podem receber funcionários fixos.' });
    }

    let updated = 0;
    for (const empId of employee_ids) {
      try {
        const { rows: cur } = await db.query('SELECT unit_id, full_name FROM employees WHERE id=$1', [empId]);
        if (!cur[0]) continue;
        const { rows: oldUnit } = await db.query('SELECT name FROM units WHERE id=$1', [cur[0].unit_id]);

        const supParam = supervisor_id !== undefined ? [unit_id, supervisor_id || null, empId] : [unit_id, empId];
        const supClause = supervisor_id !== undefined ? 'unit_id=$1, supervisor_id=$2' : 'unit_id=$1';
        const empIdx = supervisor_id !== undefined ? 3 : 2;
        supParam[empIdx-1] = empId;

        await db.query(
          `UPDATE employees SET ${supClause}, updated_at=NOW() WHERE id=$${empIdx}`,
          supParam
        );
        await db.query(
          `INSERT INTO employee_history (employee_id, event_type, description, effective_date, created_by)
           VALUES ($1,'MUDANCA_UNIDADE',$2,CURRENT_DATE,$3)`,
          [empId,
           `Remanejado (lote) de "${oldUnit[0]?.name||'N/A'}" para "${unitCheck[0].name}"${reason ? ': '+reason : ''}`,
           req.user.id]
        );
        updated++;
      } catch {}
    }
    res.json({ message: `${updated} funcionário(s) remanejado(s).`, updated });
  } catch (err) { next(err); }
});

// ─── Histórico ───────────────────────────────────────────────
router.get('/:id/history', can('employees:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT h.*, u.name AS created_by_name
       FROM employee_history h LEFT JOIN users u ON h.created_by = u.id
       WHERE h.employee_id = $1 ORDER BY h.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
