/**
 * SCRIPT DE IMPORTAÇÃO DA PLANILHA EXISTENTE
 * 
 * Uso: node scripts/import-spreadsheet.js --file=planilha.xlsx [--dry-run] [--unit-map=units.json]
 * 
 * Suporta: .xlsx, .xls, .csv
 * Colunas esperadas na planilha: mapeamento flexível abaixo
 */

require('dotenv').config({ path: '../backend/.env' });

const XLSX   = require('xlsx');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// ─── Config ─────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace('--', '').split('=');
  acc[k] = v || true;
  return acc;
}, {});

const DRY_RUN  = !!args['dry-run'];
const FILE     = args['file'] || 'funcionarios.xlsx';
const UNIT_MAP = args['unit-map'] ? JSON.parse(fs.readFileSync(args['unit-map'], 'utf8')) : {};

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
});

// ─── Mapeamento de colunas ───────────────────────────────────
// Adapte conforme os cabeçalhos da planilha real
const COLUMN_MAP = {
  // coluna na planilha → campo no banco
  'Nome Completo':       'full_name',
  'Nome':                'full_name',
  'CPF':                 'cpf',
  'RG':                  'rg',
  'Data Nascimento':     'birth_date',
  'Nascimento':          'birth_date',
  'Data Admissão':       'hire_date',
  'Admissão':            'hire_date',
  'Cargo':               'position_name',   // → será resolvido para position_id
  'Função':              'position_name',
  'Unidade':             'unit_name',       // → será resolvido para unit_id
  'Setor':               'unit_name',
  'Email':               'email',
  'E-mail':              'email',
  'Telefone':            'phone',
  'Celular':             'phone',
  'Salário':             'salary',
  'PIS':                 'pis_pasep',
  'PIS/PASEP':           'pis_pasep',
  'CTPS':                'ctps_number',
  'Endereço':            'address',
  'Rua':                 'address',
  'Número':              'address_number',
  'Bairro':              'neighborhood',
  'Cidade':              'city',
  'Estado':              'state',
  'CEP':                 'zip_code',
  'Banco':               'bank_code',
  'Agência':             'bank_agency',
  'Conta':               'bank_account',
  'Tipo de Contrato':    'contract_type',
  'Supervisor':          'supervisor_name', // → será resolvido para supervisor_id
  'Tipo Vínculo':        'contract_type',
  'Situação':            'status_raw',      // → será mapeado para status enum
};

// Mapeamento de status da planilha → enum do banco
const STATUS_MAP = {
  'ativo':      'ATIVO',
  'inativo':    'INATIVO',
  'afastado':   'AFASTADO',
  'desligado':  'DESLIGADO',
  'demitido':   'DESLIGADO',
  'ativo':      'ATIVO',
  '':           'ATIVO',
};

// ─── Funções helpers ─────────────────────────────────────────

function normalizeHeader(h) {
  return h?.toString().trim();
}

function formatCPF(cpf) {
  if (!cpf) return null;
  const digits = cpf.toString().replace(/\D/g, '');
  if (digits.length !== 11) return cpf.toString().trim();
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatDate(val) {
  if (!val) return null;
  // Excel armazena datas como número serial
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
  }
  // Texto como DD/MM/YYYY
  if (typeof val === 'string') {
    const parts = val.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return val;
  }
  return null;
}

function formatSalary(val) {
  if (!val) return null;
  const num = parseFloat(val.toString().replace(/[R$\s.]/g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

// ─── Importação principal ────────────────────────────────────

async function importSpreadsheet() {
  console.log('\n🚀 ONG Sistema - Importador de Planilha');
  console.log(`📄 Arquivo: ${FILE}`);
  console.log(`${DRY_RUN ? '🔍 MODO DRY-RUN (sem alterações no banco)' : '✅ Modo produção'}\n`);

  const filePath = path.resolve(FILE);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`📊 Total de linhas na planilha: ${rawRows.length}`);

  // Detecta mapeamento de colunas dinamicamente
  const headers = Object.keys(rawRows[0] || {});
  const activeMap = {};
  for (const h of headers) {
    const normalized = normalizeHeader(h);
    if (COLUMN_MAP[normalized]) {
      activeMap[h] = COLUMN_MAP[normalized];
    }
  }

  console.log('\n📋 Colunas detectadas e mapeadas:');
  Object.entries(activeMap).forEach(([col, field]) => {
    console.log(`  "${col}" → ${field}`);
  });

  // Cache de posições e unidades do banco
  const { rows: positions } = await pool.query('SELECT id, name FROM positions');
  const { rows: units }     = await pool.query('SELECT id, name, code FROM units');
  const { rows: users }     = await pool.query("SELECT id, name FROM users WHERE role = 'SUPERVISOR'");

  const positionCache = Object.fromEntries(
    positions.map(p => [p.name.toLowerCase().trim(), p.id])
  );
  const unitCache = Object.fromEntries([
    ...units.map(u => [u.name.toLowerCase().trim(), u.id]),
    ...units.map(u => [u.code.toLowerCase().trim(), u.id]),
    ...Object.entries(UNIT_MAP), // mapeamento manual
  ]);
  const supervisorCache = Object.fromEntries(
    users.map(u => [u.name.toLowerCase().trim(), u.id])
  );

  // Processa cada linha
  const results = { success: 0, errors: 0, skipped: 0 };
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2; // 1 = header, i+2 = linha real

    // Mapeia campos
    const mapped = {};
    for (const [col, field] of Object.entries(activeMap)) {
      mapped[field] = row[col];
    }

    // Validações obrigatórias
    if (!mapped.full_name) {
      errors.push({ row: rowNum, error: 'Nome obrigatório', data: row });
      results.errors++;
      continue;
    }

    if (!mapped.cpf) {
      errors.push({ row: rowNum, error: 'CPF obrigatório', full_name: mapped.full_name });
      results.errors++;
      continue;
    }

    // Formata campos
    mapped.cpf       = formatCPF(mapped.cpf);
    mapped.birth_date = formatDate(mapped.birth_date);
    mapped.hire_date  = formatDate(mapped.hire_date) || new Date().toISOString().split('T')[0];
    mapped.salary     = formatSalary(mapped.salary);
    mapped.status     = STATUS_MAP[(mapped.status_raw || '').toLowerCase().trim()] || 'ATIVO';

    // Resolve FKs
    if (mapped.position_name) {
      mapped.position_id = positionCache[mapped.position_name.toLowerCase().trim()] || null;
      if (!mapped.position_id) {
        // Cria cargo on-the-fly se não existir
        if (!DRY_RUN) {
          const { rows: newPos } = await pool.query(
            'INSERT INTO positions (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
            [mapped.position_name.trim()]
          );
          if (newPos[0]) {
            mapped.position_id = newPos[0].id;
            positionCache[mapped.position_name.toLowerCase().trim()] = newPos[0].id;
          }
        }
      }
    }

    if (mapped.unit_name) {
      mapped.unit_id = unitCache[mapped.unit_name.toLowerCase().trim()] || null;
      if (!mapped.unit_id) {
        errors.push({ row: rowNum, error: `Unidade não encontrada: "${mapped.unit_name}"`, full_name: mapped.full_name });
      }
    }

    if (mapped.supervisor_name) {
      mapped.supervisor_id = supervisorCache[mapped.supervisor_name.toLowerCase().trim()] || null;
    }

    if (DRY_RUN) {
      console.log(`[DRY] Linha ${rowNum}: ${mapped.full_name} (${mapped.cpf}) → ${mapped.status}`);
      results.success++;
      continue;
    }

    // Insere no banco com ON CONFLICT para evitar duplicatas
    try {
      await pool.query(`
        INSERT INTO employees (
          cpf, full_name, birth_date, hire_date, email, phone,
          position_id, unit_id, supervisor_id, salary, status,
          pis_pasep, ctps_number, address, address_number,
          neighborhood, city, state, zip_code,
          bank_code, bank_agency, bank_account, contract_type,
          imported_from
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22,$23,'PLANILHA'
        )
        ON CONFLICT (cpf) DO UPDATE SET
          full_name   = EXCLUDED.full_name,
          hire_date   = EXCLUDED.hire_date,
          position_id = COALESCE(EXCLUDED.position_id, employees.position_id),
          unit_id     = COALESCE(EXCLUDED.unit_id, employees.unit_id),
          status      = EXCLUDED.status,
          updated_at  = NOW()
      `, [
        mapped.cpf, mapped.full_name, mapped.birth_date, mapped.hire_date,
        mapped.email, mapped.phone, mapped.position_id, mapped.unit_id,
        mapped.supervisor_id, mapped.salary, mapped.status,
        mapped.pis_pasep, mapped.ctps_number, mapped.address, mapped.address_number,
        mapped.neighborhood, mapped.city, mapped.state, mapped.zip_code,
        mapped.bank_code, mapped.bank_agency, mapped.bank_account, mapped.contract_type,
      ]);
      results.success++;
    } catch (err) {
      errors.push({ row: rowNum, error: err.message, full_name: mapped.full_name });
      results.errors++;
    }
  }

  // Relatório final
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESULTADO DA IMPORTAÇÃO');
  console.log('═'.repeat(50));
  console.log(`✅ Sucesso:   ${results.success}`);
  console.log(`❌ Erros:     ${results.errors}`);
  console.log(`⏭️  Ignorados: ${results.skipped}`);

  if (errors.length > 0) {
    const errorFile = `import-errors-${Date.now()}.json`;
    fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
    console.log(`\n⚠️  Erros exportados para: ${errorFile}`);
  }

  if (!DRY_RUN && results.success > 0) {
    console.log('\n✅ Importação concluída com sucesso!');
  }

  await pool.end();
}

importSpreadsheet().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
