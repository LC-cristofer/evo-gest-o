/**
 * Migration Runner
 * Executa o schema SQL no banco de dados
 * 
 * Uso: node src/config/migrate.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');
const logger   = require('../utils/logger');

async function migrate() {
  const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
  });

  const schemaPath = path.resolve(__dirname, '../../../../database/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    logger.error(`Schema não encontrado: ${schemaPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('🔄 Executando migrations...');
  logger.info(`📄 Schema: ${schemaPath}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    logger.info('✅ Migration executada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('❌ Erro na migration:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
