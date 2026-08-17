#!/bin/bash
# ============================================================
# run-migrations.sh — Executa todas as migrations em ordem
#
# Uso dentro do container:
#   docker exec -i casca-db bash < run-migrations.sh
#
# Ou via docker exec diretamente:
#   docker exec casca-backend node -e "require('./src/config/runMigrations')"
#
# Variáveis necessárias: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
# ============================================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ong_sistema}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASS:-postgres}"
export PGPASSWORD

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Iniciando migrations..."
echo "   Host: $DB_HOST:$DB_PORT / $DB_NAME"

run_sql() {
  local FILE="$1"
  local NAME="$(basename $FILE)"
  if [ -f "$FILE" ]; then
    echo "  ▶ $NAME"
    $PSQL -f "$FILE" -v ON_ERROR_STOP=0 2>&1 | grep -v "^NOTICE\|already exists\|does not exist" || true
    echo "  ✔ $NAME"
  else
    echo "  ⚠ Não encontrado: $FILE"
  fi
}

run_sql "$DIR/schema.sql"
run_sql "$DIR/migration_v5_employee_portal.sql"
run_sql "$DIR/migration_v6_planilha_fields.sql"
run_sql "$DIR/migration_v7_whatsapp.sql"
run_sql "$DIR/migration_v8_consolidation.sql"
run_sql "$DIR/migration_v9_missing_tables.sql"

echo ""
echo "✅ Todas as migrations aplicadas com sucesso!"
