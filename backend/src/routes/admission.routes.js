const express  = require('express');
const db       = require('../config/database');
const { authenticate, can } = require('../middleware/auth');
const { sendAdmissionEmail } = require('../services/email.service');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const router = express.Router();

// GET /admissions
router.get('/', authenticate, can('admissions:read'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE ap.status = $1`; }

    const { rows } = await db.query(`
      SELECT ap.id, ap.candidate_name, ap.candidate_email, ap.status,
             ap.link_expires_at, ap.submitted_at, ap.created_at, ap.send_count,
             ap.token,
             p.name AS position_name, u.name AS unit_name,
             cb.name AS created_by_name,
             (SELECT COUNT(*) FROM admission_documents ad WHERE ad.process_id = ap.id) AS doc_total,
             (SELECT COUNT(*) FROM admission_documents ad WHERE ad.process_id = ap.id AND ad.status = 'ENVIADO') AS doc_sent
      FROM admission_processes ap
      LEFT JOIN positions p ON ap.position_id = p.id
      LEFT JOIN units u     ON ap.unit_id     = u.id
      LEFT JOIN users cb    ON ap.created_by  = cb.id
      ${where} ORDER BY ap.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /admissions — cria processo E envia email
router.post('/', authenticate, can('admissions:create'), async (req, res, next) => {
  try {
    const { candidate_name, candidate_email, candidate_phone, position_id, unit_id,
            supervisor_id, salary, hire_date_expected, notes } = req.body;
    if (!candidate_name || !candidate_email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate_email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const { rows } = await db.query(`
      INSERT INTO admission_processes (candidate_name, candidate_email, candidate_phone,
        position_id, unit_id, supervisor_id, salary, hire_date_expected, notes,
        link_expires_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [candidate_name, candidate_email, candidate_phone||null,
        position_id||null, unit_id||null, supervisor_id||null,
        salary||null, hire_date_expected||null, notes||null, expiresAt, req.user.id]);

    // IMPORTANTE: variável renomeada para 'admProc' para não sobrescrever o global process do Node.js
    const admProc = rows[0];

    // Documentos padrão exigidos
    const requiredDocs = ['RG','CPF','Comprovante de Residência','CTPS','PIS/PASEP','Foto 3x4','Comprovante Bancário'];
    for (const doc of requiredDocs) {
      await db.query(
        'INSERT INTO admission_documents (process_id, document_type, is_required) VALUES ($1,$2,TRUE)',
        [admProc.id, doc]
      );
    }

    // ENVIAR EMAIL (com fallback gracioso)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/admissao/${admProc.token}`;
    let emailSent = false;
    try {
      await sendAdmissionEmail({
        to: candidate_email,
        name: candidate_name,
        link,
        expiresAt,
      });
      emailSent = true;
      await db.query(
        'UPDATE admission_processes SET link_sent_at=NOW(), send_count=1 WHERE id=$1',
        [admProc.id]
      );
    } catch (emailErr) {
      console.warn('[EMAIL] Falha ao enviar:', emailErr.message);
      // Continua mesmo sem email — retorna o link para cópia manual
    }

    res.status(201).json({
      ...admProc,
      link,
      email_sent: emailSent,
      message: emailSent
        ? 'Processo criado e email enviado!'
        : 'Processo criado. Email não enviado — copie o link abaixo.',
    });
  } catch (err) { next(err); }
});

// GET /admissions/form/:token — público
router.get('/form/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT ap.id, ap.token, ap.candidate_name, ap.candidate_email,
             ap.status, ap.link_expires_at, ap.form_data,
             p.name AS position_name, u.name AS unit_name,
             (SELECT json_agg(json_build_object('id',ad.id,'type',ad.document_type,'required',ad.is_required,'status',ad.status))
              FROM admission_documents ad WHERE ad.process_id = ap.id) AS documents
      FROM admission_processes ap
      LEFT JOIN positions p ON ap.position_id = p.id
      LEFT JOIN units u     ON ap.unit_id     = u.id
      WHERE ap.token = $1
    `, [req.params.token]);

    if (!rows[0]) return res.status(404).json({ error: 'Link inválido.' });
    if (new Date(rows[0].link_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link expirado. Entre em contato com o RH.' });
    }
    if (['APROVADO','REJEITADO'].includes(rows[0].status)) {
      return res.status(400).json({ error: 'Processo já finalizado.', status: rows[0].status });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /admissions/form/:token — público
router.post('/form/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM admission_processes WHERE token=$1', [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Link inválido.' });
    if (new Date(rows[0].link_expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado.' });
    if (rows[0].status !== 'PENDENTE') return res.status(400).json({ error: 'Formulário já submetido.' });

    await db.query(
      `UPDATE admission_processes SET form_data=$1, status='EM_ANALISE', submitted_at=NOW(), candidate_cpf=$2 WHERE id=$3`,
      [JSON.stringify(req.body), req.body.cpf || null, rows[0].id]
    );
    res.json({ message: 'Formulário enviado com sucesso! O RH entrará em contato.' });
  } catch (err) { next(err); }
});

// POST /admissions/upload/:token/:docId — upload público
const uploadsDir = path.join(__dirname, '../../uploads/admissions');
const admStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});
const admUpload = multer({
  storage: admStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','application/pdf'].includes(f.mimetype);
    cb(null, ok);
  },
});

router.post('/upload/:token/:docId', admUpload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id FROM admission_processes WHERE token=$1', [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Link inválido.' });
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });

    await db.query(
      `UPDATE admission_documents
       SET file_name=$1, file_path=$2, file_size=$3, mime_type=$4, status='ENVIADO', uploaded_at=NOW()
       WHERE id=$5 AND process_id=$6`,
      [req.file.originalname, req.file.path, req.file.size, req.file.mimetype, req.params.docId, rows[0].id]
    );
    res.json({ message: 'Documento enviado.' });
  } catch (err) { next(err); }
});

// POST /admissions/:id/resend
router.post('/:id/resend', authenticate, can('admissions:create'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM admission_processes WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });
    if (['APROVADO','REJEITADO'].includes(rows[0].status)) {
      return res.status(400).json({ error: 'Processo já finalizado.' });
    }

    const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const { rows: updated } = await db.query(
      `UPDATE admission_processes SET token=uuid_generate_v4(), link_expires_at=$1,
       link_sent_at=NOW(), send_count=send_count+1, status='PENDENTE' WHERE id=$2 RETURNING *`,
      [newExpiry, req.params.id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/admissao/${updated[0].token}`;
    let emailSent = false;
    try {
      await sendAdmissionEmail({
        to: updated[0].candidate_email,
        name: updated[0].candidate_name,
        link,
        expiresAt: newExpiry,
        isResend: true,
      });
      emailSent = true;
    } catch (emailErr) {
      console.warn('[EMAIL] Falha ao reenviar:', emailErr.message);
    }

    res.json({ message: emailSent ? 'Link reenviado!' : 'Novo link gerado (email não enviado).', link, email_sent: emailSent });
  } catch (err) { next(err); }
});

// PATCH /admissions/:id/review
router.patch('/:id/review', authenticate, can('admissions:review'), async (req, res, next) => {
  try {
    const { action, rejection_reason } = req.body;
    if (!['APROVADO','REJEITADO'].includes(action)) return res.status(400).json({ error: 'Ação inválida.' });

    const { rows } = await db.query('SELECT * FROM admission_processes WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });

    if (action === 'APROVADO') {
      const formData = rows[0].form_data || {};
      await db.transaction(async (client) => {
        const { rows: emp } = await client.query(`
          INSERT INTO employees (cpf, full_name, email, phone, birth_date, hire_date,
            position_id, unit_id, supervisor_id, salary, status, imported_from, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ATIVO','ADMISSAO',$11) RETURNING id
        `, [
          rows[0].candidate_cpf || formData.cpf,
          rows[0].candidate_name, rows[0].candidate_email, rows[0].candidate_phone,
          formData.birth_date || null,
          formData.hire_date || new Date().toISOString().split('T')[0],
          rows[0].position_id, rows[0].unit_id, rows[0].supervisor_id, rows[0].salary, req.user.id,
        ]);
        await client.query(
          `UPDATE admission_processes SET status='APROVADO', reviewed_at=NOW(), reviewed_by=$1, employee_id=$2 WHERE id=$3`,
          [req.user.id, emp[0].id, req.params.id]
        );
        await client.query(
          `INSERT INTO employee_history (employee_id, event_type, description, created_by) VALUES ($1,'ADMISSAO','Admissão via processo digital',$2)`,
          [emp[0].id, req.user.id]
        );
      });
    } else {
      await db.query(
        `UPDATE admission_processes SET status='REJEITADO', reviewed_at=NOW(), reviewed_by=$1, rejection_reason=$2 WHERE id=$3`,
        [req.user.id, rejection_reason || null, req.params.id]
      );
    }
    res.json({ message: action === 'APROVADO' ? 'Admissão aprovada.' : 'Processo rejeitado.' });
  } catch (err) { next(err); }
});

module.exports = router;
