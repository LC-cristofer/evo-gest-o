/**
 * PM2 Ecosystem - Produção
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 startup          # configura auto-start no boot
 *   pm2 save             # persiste a lista de processos
 *   pm2 monit            # monitor em tempo real
 *   pm2 logs             # ver logs
 */

module.exports = {
  apps: [
    // ─── API Backend ──────────────────────────────────────
    {
      name:        'ong-api',
      script:      './backend/src/app.js',
      instances:   2,           // 2 processos = aproveita dual-core mínimo
      exec_mode:   'cluster',   // balanceamento de carga automático
      watch:       false,       // NUNCA true em produção
      env: {
        NODE_ENV:  'production',
        PORT:      4000,
      },
      // Logs
      error_file:  './logs/api-error.log',
      out_file:    './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Reinício automático
      max_memory_restart: '512M',
      restart_delay:       3000,
      max_restarts:        10,
      min_uptime:         '10s',
      // Graceful shutdown
      kill_timeout:        5000,
      wait_ready:          true,
      listen_timeout:      10000,
    },

    // ─── Frontend Next.js ─────────────────────────────────
    {
      name:   'ong-frontend',
      script: 'npm',
      args:   'start',
      cwd:    './frontend',
      watch:  false,
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      error_file: './logs/frontend-error.log',
      out_file:   './logs/frontend-out.log',
      max_memory_restart: '256M',
    },
  ],
};
