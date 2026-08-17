/**
 * Executa todas as migrations em ordem
 * Uso: node src/config/runMigrations.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
});

const MIGRATIONS = [
  'schema.sql',
  'migration_v5_employee_portal.sql',
  'migration_v6_planilha_fields.sql',
  'migration_v7_whatsapp.sql',
  'migration_v8_consolidation.sql',
  'migration_v9_missing_tables.sql',
];

const DB_DIR = path.resolve(__dirname, '../../../../database');

async function run() {
  const client = await pool.connect();
  console.log('🔄 Iniciando migrations...');
  for (const file of MIGRATIONS) {
    const filePath = path.join(DB_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Não encontrado: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await client.query(sql);
      console.log(`  ✔ ${file}`);
    } catch (err) {
      // Ignora erros de "já existe" — são esperados em re-execuções
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`  ✔ ${file} (parcial — alguns objetos já existiam)`);
      } else {
        console.error(`  ✘ ${file}: ${err.message}`);
      }
    }
  }
  client.release();
  await pool.end();
  console.log('\n✅ Migrations concluídas!');
}

run().catch(err => { console.error('Erro fatal:', err.message); process.exit(1); });
