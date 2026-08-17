require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const compression = require('compression');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const db = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter, loginLimiter } = require('./middleware/rateLimiter');

// ─── Jobs (silencioso se deps faltarem) ──────────────────────
try { require('./jobs/admissionExpiry.job'); } catch (e) { console.warn('[JOB] admissionExpiry:', e.message); }
try { require('./jobs/documentAlerts.job');  } catch (e) { console.warn('[JOB] documentAlerts:', e.message); }
try { require('./jobs/notifications.job');   } catch (e) { console.warn('[JOB] notifications:', e.message); }
try { require('./jobs/pendencias.job');      } catch (e) { console.warn('[JOB] pendencias:', e.message); }

// ─── Routes ───────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const employeeRoutes     = require('./routes/employee.routes');
const unitRoutes         = require('./routes/unit.routes');
const admissionRoutes    = require('./routes/admission.routes');
const attendanceRoutes   = require('./routes/attendance.routes');
const benefitRoutes      = require('./routes/benefit.routes');
const dashboardRoutes    = require('./routes/dashboard.routes');
const historyRoutes      = require('./routes/history.routes');
const documentRoutes     = require('./routes/document.routes');
const notificationRoutes = require('./routes/notification.routes');
const positionRoutes     = require('./routes/position.routes');
const { router: userRoutes, employeeRouter } = require('./routes/user.routes');
const importRoutes       = require('./routes/import.routes');
const exportRoutes       = require('./routes/export.routes');
const auditRoutes        = require('./routes/audit.routes');
const pdfRoutes          = require('./routes/pdf.routes');
const ocrRoutes          = require('./routes/ocr.routes');
const faqRoutes      = require('./routes/faq.routes');
const calendarRoutes = require('./routes/calendar.routes');
const messagesRoutes = require('./routes/messages.routes');
const minutesRoutes  = require('./routes/minutes.routes');
const homeRoutes     = require('./routes/home.routes');
const usefulDocsRoutes = require('./routes/useful-docs.routes');
const undoRoutes       = require('./routes/undo.routes');
const diarioRoutes     = require('./routes/diario.routes');
const relatorioRoutes  = require('./routes/relatorio.routes');
const portalRoutes     = require('./routes/portal.routes');

const app = express();

// ─── Diretórios ───────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
const logsDir    = path.join(__dirname, '../logs');
[uploadsDir, logsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Middlewares ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: aceita localhost:3000 e qualquer origem em desenvolvimento
app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    // Permite localhost em qualquer porta (dev)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Em produção, verificar FRONTEND_URL
    const allowed = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (origin === allowed) return callback(null, true);
    callback(null, true); // Permissivo em dev
  },
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(generalLimiter);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ─── Health check ─────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const dbOk = await db.query('SELECT 1').then(() => true).catch(() => false);
  res.json({ status: dbOk ? 'healthy' : 'degraded', db: dbOk ? 'connected' : 'error', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`,          loginLimiter, authRoutes);
app.use(`${API}/employees`,     employeeRoutes);
app.use(`${API}/units`,         unitRoutes);
app.use(`${API}/positions`,     positionRoutes);
app.use(`${API}/admissions`,    admissionRoutes);
app.use(`${API}/attendance`,    attendanceRoutes);
app.use(`${API}/benefits`,      benefitRoutes);
app.use(`${API}/dashboard`,     dashboardRoutes);
app.use(`${API}/history`,       historyRoutes);
app.use(`${API}/documents`,     documentRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/users`,         userRoutes);
app.use(`${API}/users`,         employeeRouter);
app.use(`${API}/import`,        importRoutes);
app.use(`${API}/export`,        exportRoutes);
app.use(`${API}/audit`,         auditRoutes);
app.use(`${API}/pdf`,           pdfRoutes);
app.use(`${API}/ocr`,           ocrRoutes);
app.use(`${API}/faq`,           faqRoutes);
app.use(`${API}/calendar`,      calendarRoutes);
app.use(`${API}/messages`,      messagesRoutes);
app.use(`${API}/minutes`,       minutesRoutes);
app.use(`${API}/home`,          homeRoutes);
app.use(`${API}/useful-docs`,   usefulDocsRoutes);
app.use(`${API}/undo`,          undoRoutes);
app.use(`${API}/diario`,        diarioRoutes);
app.use(`${API}/relatorio`,     relatorioRoutes);
app.use(`${API}/portal`,        portalRoutes);

// ─── Error handlers ───────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start com retry ─────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 4000;

const start = async () => {
  let retries = 30;
  while (retries > 0) {
    try {
      await db.query('SELECT 1');
      console.log('✅ [DB] Conectado ao PostgreSQL');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) { console.error('❌ [DB] Falha fatal:', err.message); process.exit(1); }
      console.log(`⏳ [DB] Aguardando banco... (${retries} tentativas)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ONG API → http://0.0.0.0:${PORT}`);
    console.log(`🔗 Health → http://localhost:${PORT}/health`);
  });
};

start().catch(err => { console.error('Erro fatal:', err); process.exit(1); });

module.exports = app;
