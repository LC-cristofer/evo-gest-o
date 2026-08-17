/**
 * SEED — EVO Gestão
 *
 * IMPORTANTE:
 * - Este arquivo contém somente dados 100% fictícios para demonstração/portfólio.
 * - Nunca coloque nomes, CPFs, telefones, e-mails, endereços ou dados bancários reais aqui.
 * - Em produção, use migrações e cadastros reais fora do repositório.
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'ong_sistema',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres123',
});

const DEMO_UNITS = [
  { code: 'DEMO-CENTRO', name: 'Unidade Centro' },
  { code: 'DEMO-NORTE', name: 'Unidade Norte' },
  { code: 'DEMO-SUL', name: 'Unidade Sul' },
  { code: 'DEMO-LESTE', name: 'Unidade Leste' },
  { code: 'DEMO-OESTE', name: 'Unidade Oeste' },
  { code: 'DEMO-ADM', name: 'Escritório Administrativo' },
];

const DEMO_POSITIONS = [
  'Analista Administrativo',
  'Assistente de RH',
  'Supervisor',
  'Auxiliar Administrativo',
  'Analista de Operações',
  'Assistente Financeiro',
];

const DEMO_USERS = [
  { name: 'Administrador Demo', email: 'admin.demo@example.com', role: 'TI' },
  { name: 'Coordenação Demo', email: 'coordenacao.demo@example.com', role: 'COORDENACAO' },
  { name: 'RH Demo', email: 'rh.demo@example.com', role: 'RH_OPERACIONAL' },
  { name: 'Supervisor Centro', email: 'supervisor.centro@example.com', role: 'SUPERVISOR', unitCode: 'DEMO-CENTRO' },
  { name: 'Supervisor Norte', email: 'supervisor.norte@example.com', role: 'SUPERVISOR', unitCode: 'DEMO-NORTE' },
  { name: 'Supervisor Sul', email: 'supervisor.sul@example.com', role: 'SUPERVISOR', unitCode: 'DEMO-SUL' },
  { name: 'Visualizador Demo', email: 'viewer.demo@example.com', role: 'VISUALIZADOR' },
];

const DEMO_NAMES = [
  'Marina Exemplo', 'Rafael Exemplo', 'Camila Exemplo', 'Bruno Exemplo',
  'Fernanda Exemplo', 'Diego Exemplo', 'Juliana Exemplo', 'Gustavo Exemplo',
  'Larissa Exemplo', 'Eduardo Exemplo', 'Patricia Exemplo', 'Henrique Exemplo',
  'Bianca Exemplo', 'Felipe Exemplo', 'Aline Exemplo', 'Rodrigo Exemplo',
  'Natalia Exemplo', 'Marcelo Exemplo', 'Isabela Exemplo', 'Vinicius Exemplo',
  'Renata Exemplo', 'Caio Exemplo', 'Beatriz Exemplo', 'Leandro Exemplo',
];

function demoCpf(index) {
  // Intencionalmente sintético e sem pretensão de representar documento real.
  return `900.${String(index).padStart(3, '0')}.000-${String((index % 90) + 10).padStart(2, '0')}`;
}

function demoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildDemoEmployees() {
  return DEMO_NAMES.map((name, idx) => {
    const i = idx + 1;
    return {
      employeeCode: `DEMO-${String(i).padStart(3, '0')}`,
      name,
      cpf: demoCpf(i),
      rg: `DEMO${String(i).padStart(5, '0')}`,
      birth: demoDate(1985 + (i % 15), ((i - 1) % 12) + 1, ((i * 2 - 1) % 27) + 1),
      hire: demoDate(2024 + (i % 2), ((i + 2) % 12) + 1, ((i * 3) % 27) + 1),
      position: DEMO_POSITIONS[(i - 1) % DEMO_POSITIONS.length],
      unitCode: DEMO_UNITS[(i - 1) % DEMO_UNITS.length].code,
      email: `${name.split(' ')[0].toLowerCase()}.${String(i).padStart(2, '0')}@example.com`,
      phone: `000000${String(i).padStart(5, '0')}`,
      salary: 2100 + (i % 6) * 350,
      address: `Rua Exemplo, ${100 + i}`,
      status: i <= 20 ? 'ATIVO' : 'DESLIGADO',
    };
  });
}

async function seed() {
  console.log('\nEVO Gestão — seed com dados fictícios\n');

  const demoPassword = process.env.DEMO_SEED_PASSWORD || 'Demo@123!';

  if (process.env.NODE_ENV === 'production' && !process.env.DEMO_SEED_PASSWORD) {
    throw new Error(
      'Em produção, defina DEMO_SEED_PASSWORD antes de executar o seed.'
    );
  }

  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const unitIds = {};
  for (const unit of DEMO_UNITS) {
    const { rows } = await pool.query(
      `INSERT INTO units (code, name, city, state, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code)
       DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city,
                     state = EXCLUDED.state, description = EXCLUDED.description
       RETURNING id`,
      [unit.code, unit.name, 'Cidade Exemplo', 'PR', 'Unidade fictícia para demonstração']
    );
    unitIds[unit.code] = rows[0].id;
  }

  const positionIds = {};
  for (const name of DEMO_POSITIONS) {
    const { rows } = await pool.query(
      `INSERT INTO positions (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [name, 'Cargo fictício para demonstração']
    );
    positionIds[name] = rows[0].id;
  }

  const userIds = {};
  for (const user of DEMO_USERS) {
    const unitId = user.unitCode ? unitIds[user.unitCode] : null;
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, unit_id, must_change_password, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       ON CONFLICT (email)
       DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
                     unit_id = EXCLUDED.unit_id, is_active = TRUE
       RETURNING id`,
      [user.name, user.email, passwordHash, user.role, unitId]
    );
    userIds[user.email] = rows[0].id;
  }

  const supervisorsByUnit = {
    'DEMO-CENTRO': userIds['supervisor.centro@example.com'],
    'DEMO-NORTE': userIds['supervisor.norte@example.com'],
    'DEMO-SUL': userIds['supervisor.sul@example.com'],
  };

  const employees = buildDemoEmployees();
  let active = 0;
  let dismissed = 0;

  for (const employee of employees) {
    const supervisorId =
      supervisorsByUnit[employee.unitCode] ||
      userIds['supervisor.centro@example.com'];

    await pool.query(
      `INSERT INTO employees (
        employee_code, full_name, cpf, rg, birth_date, phone, email,
        address, hire_date, position_id, salary, unit_id, supervisor_id,
        status, imported_from, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, 'DEMO', $15
      )
      ON CONFLICT (cpf)
      DO UPDATE SET
        employee_code = EXCLUDED.employee_code,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        position_id = EXCLUDED.position_id,
        unit_id = EXCLUDED.unit_id,
        supervisor_id = EXCLUDED.supervisor_id,
        status = EXCLUDED.status,
        imported_from = 'DEMO',
        notes = EXCLUDED.notes,
        updated_at = NOW()`,
      [
        employee.employeeCode,
        employee.name,
        employee.cpf,
        employee.rg,
        employee.birth,
        employee.phone,
        employee.email,
        employee.address,
        employee.hire,
        positionIds[employee.position],
        employee.salary,
        unitIds[employee.unitCode],
        supervisorId,
        employee.status,
        'Registro 100% fictício para demonstração e testes.',
      ]
    );

    if (employee.status === 'ATIVO') active += 1;
    else dismissed += 1;
  }

  console.log(`Unidades demo: ${DEMO_UNITS.length}`);
  console.log(`Usuários demo: ${DEMO_USERS.length}`);
  console.log(`Funcionários demo: ${employees.length} (${active} ativos, ${dismissed} desligados)`);
  console.log('\nNenhum dado pessoal real é necessário para executar esta demonstração.\n');
}

seed()
  .catch((error) => {
    console.error('Erro ao executar seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
