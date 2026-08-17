/**
 * Testes de integração - Auth e Employees
 * Roda contra banco de teste
 * 
 * Uso: npm test
 */

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const app     = require('../src/app');
const db      = require('../src/config/database');

// ─── Setup ───────────────────────────────────────────────────

let tiToken;
let rhToken;
let supervisorToken;
let testUnitId;
let testEmployeeId;
let testUserId;

beforeAll(async () => {
  // Cria unidade de teste
  const { rows: unitRows } = await db.query(`
    INSERT INTO units (code, name) VALUES ('TEST-01', 'Unidade de Teste')
    ON CONFLICT (code) DO UPDATE SET name = 'Unidade de Teste'
    RETURNING id
  `);
  testUnitId = unitRows[0].id;

  // Cria usuários de teste
  const hash = await bcrypt.hash('Test@1234', 12);
  for (const [email, role, unitId] of [
    ['ti.test@test.com',         'TI',         null],
    ['rh.test@test.com',         'RH',         null],
    ['sup.test@test.com',        'SUPERVISOR', testUnitId],
  ]) {
    await db.query(`
      INSERT INTO users (name, email, password_hash, role, unit_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = $4
    `, [email.split('@')[0], email, hash, role, unitId]);
  }
});

afterAll(async () => {
  // Limpa dados de teste
  await db.query("DELETE FROM employees WHERE full_name LIKE 'TEST_%'");
  await db.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  await db.pool.end();
});

// ─── Auth ────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  test('login válido retorna token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ti.test@test.com', password: 'Test@1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('TI');
    tiToken = res.body.token;
  });

  test('senha errada retorna 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ti.test@test.com', password: 'senhaErrada' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('email inexistente retorna 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'naoexiste@test.com', password: 'qualquercoisa' });

    expect(res.status).toBe(401);
  });

  test('email inválido retorna 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nao-e-email', password: 'Test@1234' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  test('retorna dados do usuário logado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'ti.test@test.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('sem token retorna 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('token inválido retorna 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui');
    expect(res.status).toBe(401);
  });
});

// ─── Funcionários ─────────────────────────────────────────────

describe('GET /api/v1/employees', () => {
  beforeAll(async () => {
    // Pega tokens dos outros roles
    const rhRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rh.test@test.com', password: 'Test@1234' });
    rhToken = rhRes.body.token;

    const supRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sup.test@test.com', password: 'Test@1234' });
    supervisorToken = supRes.body.token;
  });

  test('TI pode listar funcionários', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('RH pode listar funcionários', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${rhToken}`);
    expect(res.status).toBe(200);
  });

  test('Supervisor pode listar (apenas sua unidade)', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(res.status).toBe(200);
    // Resultados devem ser da unidade do supervisor
    res.body.data.forEach((emp: any) => {
      expect(emp.unit_id).toBe(testUnitId);
    });
  });

  test('paginação funciona', async () => {
    const res = await request(app)
      .get('/api/v1/employees?page=1&limit=5')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body).toHaveProperty('pages');
  });
});

describe('POST /api/v1/employees', () => {
  const employeeData = {
    cpf:           '123.456.789-00',
    full_name:     'TEST_Funcionario Silva',
    birth_date:    '1990-05-15',
    hire_date:     '2024-01-10',
    email:         'test.func@test.com',
    contract_type: 'CLT',
  };

  test('RH pode criar funcionário', async () => {
    // Cria cargo e unidade primeiro
    const { rows: posRows } = await db.query(
      "INSERT INTO positions (name) VALUES ('Cargo Teste') ON CONFLICT DO NOTHING RETURNING id"
    );
    const posId = posRows[0]?.id;

    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${rhToken}`)
      .send({ ...employeeData, position_id: posId, unit_id: testUnitId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.full_name).toBe(employeeData.full_name);
    testEmployeeId = res.body.id;

    // Limpa
    await db.query('DELETE FROM positions WHERE name = $1', ['Cargo Teste']);
  });

  test('CPF duplicado retorna 409', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${rhToken}`)
      .send({ ...employeeData, unit_id: testUnitId });

    expect(res.status).toBe(409);
  });

  test('Supervisor não pode criar funcionário', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ ...employeeData, cpf: '000.000.000-01', unit_id: testUnitId });

    expect(res.status).toBe(403);
  });

  test('CPF inválido retorna 400', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${rhToken}`)
      .send({ ...employeeData, cpf: '123.456.789', unit_id: testUnitId });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/employees/:id', () => {
  test('retorna funcionário por ID', async () => {
    if (!testEmployeeId) return;

    const res = await request(app)
      .get(`/api/v1/employees/${testEmployeeId}`)
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testEmployeeId);
  });

  test('ID inexistente retorna 404', async () => {
    const res = await request(app)
      .get('/api/v1/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── Health Check ─────────────────────────────────────────────

describe('GET /health', () => {
  test('retorna status healthy com banco conectado', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('connected');
  });
});
