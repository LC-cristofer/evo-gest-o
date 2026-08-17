const express = require('express');
const XLSX    = require('xlsx');
const multer  = require('multer');
const db      = require('../config/database');
const { authenticate, can } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, can('import:execute'));

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv',
    ].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Formato inválido. Use .xlsx, .xls ou .csv'));
  },
});

// POST /import/preview
router.post('/preview', memUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    res.json({
      total_rows:  rows.length,
      headers:     Object.keys(rows[0] || {}),
      sample_rows: rows.slice(0, 5),
      sheet_name:  wb.SheetNames[0],
    });
  } catch (err) { next(err); }
});

// POST /import/execute
router.post('/execute', memUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });

    let mapping = {};
    try { mapping = JSON.parse(req.body.column_map || '{}'); } catch {}

    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    const results = { success: 0, errors: 0, message: '' };
    const errors  = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data = {};
      for (const [col, field] of Object.entries(mapping)) {
        if (field) data[field] = row[col];
      }

      if (!data.full_name || !data.cpf) {
        errors.push({ row: i + 2, error: 'Nome ou CPF ausente' });
        results.errors++;
        continue;
      }

      // Format CPF
      const digits = data.cpf.toString().replace(/\D/g, '');
      if (digits.length === 11) {
        data.cpf = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
      }

      // Format dates
      if (data.birth_date && typeof data.birth_date === 'number') {
        const d = XLSX.SSF.parse_date_code(data.birth_date);
        data.birth_date = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }
      if (data.hire_date && typeof data.hire_date === 'number') {
        const d = XLSX.SSF.parse_date_code(data.hire_date);
        data.hire_date = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      }

      try {
        await db.query(`
          INSERT INTO employees (cpf, full_name, hire_date, status, imported_from)
          VALUES ($1, $2, COALESCE($3, CURRENT_DATE), 'ATIVO', 'PLANILHA')
          ON CONFLICT (cpf) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
        `, [data.cpf, data.full_name, data.hire_date || null]);
        results.success++;
      } catch (err) {
        errors.push({ row: i + 2, error: err.message, cpf: data.cpf });
        results.errors++;
      }
    }

    results.message = `Importação concluída. ${results.success} registros processados.`;
    res.json({ ...results, errors: errors.slice(0, 50) });
  } catch (err) { next(err); }
});



// ─── POST /import/attendance-preview ─────────────────────────
router.post('/attendance-preview', memUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    res.json({
      total_rows:  rows.length,
      headers:     Object.keys(rows[0] || {}),
      sample_rows: rows.slice(0, 5),
      sheet_name:  wb.SheetNames[0],
    });
  } catch (err) { next(err); }
});

// ─── POST /import/attendance-execute ─────────────────────────
router.post('/attendance-execute', memUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
    let mapping = {};
    try { mapping = JSON.parse(req.body.column_map || '{}'); } catch {}

    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    const { rows: employees } = await db.query(
      "SELECT id, cpf, full_name, unit_id FROM employees WHERE status != 'DESLIGADO'"
    );
    const byCpf  = {};
    const byName = {};
    for (const e of employees) {
      if (e.cpf)       byCpf[e.cpf.replace(/\D/g, '')]           = e;
      if (e.full_name) byName[e.full_name.toLowerCase().trim()]   = e;
    }

    const TYPE_MAP = {
      'falta': 'FALTA', 'falta injustificada': 'FALTA',
      'falta justificada': 'FALTA_JUSTIFICADA', 'justificada': 'FALTA_JUSTIFICADA',
      'atestado': 'FALTA_JUSTIFICADA', 'atraso': 'ATRASO',
      'meio periodo': 'MEIO_PERIODO', 'meio período': 'MEIO_PERIODO',
    };

    const results = { success: 0, errors: 0, message: '' };
    const errorList = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; const rowNum = i + 2;
      const data = {};
      for (const [col, field] of Object.entries(mapping)) { if (field) data[field] = row[col]; }

      let employee = null;
      if (data.cpf) employee = byCpf[data.cpf.toString().replace(/\D/g, '')] || null;
      if (!employee && data.full_name) employee = byName[data.full_name.toString().toLowerCase().trim()] || null;
      if (!employee) { errorList.push({ row: rowNum, error: 'Funcionário não encontrado', data }); results.errors++; continue; }

      let recordDate = null;
      if (data.record_date) {
        const val = data.record_date;
        if (typeof val === 'number') {
          const d = XLSX.SSF.parse_date_code(val);
          recordDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
        } else if (typeof val === 'string') {
          const parts = val.trim().split('/');
          recordDate = parts.length === 3
            ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
            : val.trim();
        }
      }
      if (!recordDate) { errorList.push({ row: rowNum, error: 'Data inválida' }); results.errors++; continue; }

      const type      = TYPE_MAP[(data.type || 'falta').toString().toLowerCase().trim()] || 'FALTA';
      const minutesLate    = parseInt(data.minutes_late) || 0;
      const justification  = data.justification ? data.justification.toString().trim() : null;
      const hasMedicalCert = ['sim','yes','1','true','x','atestado'].includes((data.has_medical_cert||'').toString().toLowerCase().trim());

      try {
        await db.query(`
          INSERT INTO attendance_records (employee_id, unit_id, record_date, type, minutes_late, justification, has_medical_cert, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (employee_id, record_date, type) DO UPDATE
            SET minutes_late=EXCLUDED.minutes_late, justification=COALESCE(EXCLUDED.justification,attendance_records.justification), has_medical_cert=EXCLUDED.has_medical_cert
        `, [employee.id, employee.unit_id, recordDate, type, minutesLate, justification, hasMedicalCert, req.user.id]);
        results.success++;
      } catch (err) {
        errorList.push({ row: rowNum, error: err.message }); results.errors++;
      }
    }

    results.message = `Importação concluída. ${results.success} ocorrências registradas.`;
    res.json({ ...results, error_list: errorList.slice(0, 50) });
  } catch (err) { next(err); }
});

module.exports = router;
