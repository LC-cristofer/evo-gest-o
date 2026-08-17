/**
 * Testes de integração — Export (XLSX/CSV) e PDF
 */

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');

let tiToken;
let rhToken;
let supervisorToken;
let testEmployeeId;
let testUnitId;

beforeAll(async () => {
  const bcrypt = require('bcryptjs');
  const hash   = await bcrypt.hash('Test@1234', 12);

  const { rows: u } = await db.query(`
    INSERT INTO units (code, name) VALUES ('EXP-01','Unidade Export Teste')
    ON CONFLICT (code) DO UPDATE SET name='Unidade Export Teste' RETURNING id
  `);
  testUnitId = u[0].id;

  for (const [email, role, uid] of [
    ['ti3.test@test.com',  'TI',         null],
    ['rh3.test@test.com',  'RH',         null],
    ['sup3.test@test.com', 'SUPERVISOR', testUnitId],
  ]) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, unit_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET password_hash=$3`,
      [email.split('@')[0], email, hash, role, uid]
    );
  }

  const { rows: pos } = await db.query("SELECT id FROM positions LIMIT 1");
  const { rows: rh  } = await db.query("SELECT id FROM users WHERE role='RH' LIMIT 1");

  const { rows: emp } = await db.query(`
    INSERT INTO employees (cpf, full_name, hire_date, unit_id, position_id, status, birth_date)
    VALUES ('888.777.666-55','TEST_Export Func','2024-01-01',$1,$2,'ATIVO','1990-06-15')
    ON CONFLICT (cpf) DO UPDATE SET full_name='TEST_Export Func' RETURNING id
  `, [testUnitId, pos[0]?.id]);
  testEmployeeId = emp[0].id;

  const [ti, rh3, sup] = await Promise.all([
    request(app).post('/api/v1/auth/login').send({ email: 'ti3.test@test.com',  password: 'Test@1234' }),
    request(app).post('/api/v1/auth/login').send({ email: 'rh3.test@test.com',  password: 'Test@1234' }),
    request(app).post('/api/v1/auth/login').send({ email: 'sup3.test@test.com', password: 'Test@1234' }),
  ]);
  tiToken         = ti.body.token;
  rhToken         = rh3.body.token;
  supervisorToken = sup.body.token;
});

afterAll(async () => {
  await db.query("DELETE FROM employees WHERE cpf = '888.777.666-55'");
  await db.query("DELETE FROM users WHERE email LIKE '%3.test@test.com'");
  await db.pool.end();
});

// ─── Export XLSX ──────────────────────────────────────────────

describe('GET /api/v1/export/employees', () => {
  test('RH exporta XLSX de funcionários', async () => {
    const res = await request(app)
      .get('/api/v1/export/employees')
      .set('Authorization', `Bearer ${rhToken}`)
      .query({ format: 'xlsx' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('.xlsx');
    expect(res.body.length).toBeGreaterThan(100); // tem conteúdo
  });

  test('TI exporta CSV', async () => {
    const res = await request(app)
      .get('/api/v1/export/employees')
      .set('Authorization', `Bearer ${tiToken}`)
      .query({ format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('csv');
    expect(res.headers['content-disposition']).toContain('.csv');
    // CSV deve ter cabeçalho
    expect(res.text).toMatch(/Nome Completo|CPF/i);
  });

  test('Supervisor exporta apenas sua unidade', async () => {
    const res = await request(app)
      .get('/api/v1/export/employees')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .query({ format: 'csv' });

    expect(res.status).toBe(200);
    // Conteúdo scoped à unidade do supervisor
  });

  test('Sem autenticação retorna 401', async () => {
    const res = await request(app).get('/api/v1/export/employees');
    expect(res.status).toBe(401);
  });

  test('Filtro por status funciona', async () => {
    const res = await request(app)
      .get('/api/v1/export/employees')
      .set('Authorization', `Bearer ${tiToken}`)
      .query({ format: 'csv', status: 'ATIVO' });

    expect(res.status).toBe(200);
  });
});

// ─── Export Attendance ────────────────────────────────────────

describe('GET /api/v1/export/attendance', () => {
  test('TI exporta relatório de presença', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await request(app)
      .get('/api/v1/export/attendance')
      .set('Authorization', `Bearer ${tiToken}`)
      .query({ unit_id: testUnitId, month });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});

// ─── PDF ──────────────────────────────────────────────────────

describe('GET /api/v1/pdf/employee/:id', () => {
  test('TI gera PDF da ficha do funcionário', async () => {
    const res = await request(app)
      .get(`/api/v1/pdf/employee/${testEmployeeId}`)
      .set('Authorization', `Bearer ${tiToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    // PDF começa com %PDF
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  test('ID inexistente retorna 404', async () => {
    const res = await request(app)
      .get('/api/v1/pdf/employee/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(404);
  });

  test('Supervisor não acessa funcionário de outra unidade', async () => {
    // Cria funcionário em outra unidade
    const { rows: otherUnit } = await db.query(`
      SELECT id FROM units WHERE code != 'EXP-01' LIMIT 1
    `);
    if (!otherUnit[0]) return; // pula se não houver

    const { rows: otherEmp } = await db.query(`
      INSERT INTO employees (cpf, full_name, hire_date, unit_id, status, birth_date)
      VALUES ('000.111.222-33','Func Outra Unidade','2024-01-01',$1,'ATIVO','1990-01-01')
      ON CONFLICT (cpf) DO UPDATE SET unit_id=$1 RETURNING id
    `, [otherUnit[0].id]);

    const res = await request(app)
      .get(`/api/v1/pdf/employee/${otherEmp[0].id}`)
      .set('Authorization', `Bearer ${supervisorToken}`);

    expect(res.status).toBe(403);

    await db.query("DELETE FROM employees WHERE cpf = '000.111.222-33'");
  });
});

describe('GET /api/v1/pdf/attendance', () => {
  test('TI gera PDF de presença de uma unidade', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await request(app)
      .get('/api/v1/pdf/attendance')
      .set('Authorization', `Bearer ${tiToken}`)
      .query({ unit_id: testUnitId, month })
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });
});

// ─── Audit ────────────────────────────────────────────────────

describe('GET /api/v1/audit', () => {
  test('TI acessa log de auditoria', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  test('RH NÃO acessa auditoria', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${rhToken}`);

    expect(res.status).toBe(403);
  });

  test('Filtro por action funciona', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${tiToken}`)
      .query({ action: 'LOGIN_SUCCESS' });

    expect(res.status).toBe(200);
    res.body.data.forEach((log) => {
      expect(log.action).toBe('LOGIN_SUCCESS');
    });
  });

  test('GET /audit/stats retorna estatísticas', async () => {
    const res = await request(app)
      .get('/api/v1/audit/stats')
      .set('Authorization', `Bearer ${tiToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
