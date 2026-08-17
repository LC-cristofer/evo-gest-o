/**
 * OCR Routes — proxy para o serviço Python
 * POST /ocr/extract — recebe imagem em base64, retorna dados extraídos
 * POST /ocr/upload  — recebe arquivo, converte e envia ao serviço Python
 */
const express = require('express');
const multer  = require('multer');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','application/pdf'].includes(f.mimetype);
    cb(null, ok);
  },
});

const OCR_URL = process.env.OCR_SERVICE_URL || 'http://ocr:5001';

async function callOCR(payload) {
  return new Promise((resolve, reject) => {
    const url  = new URL('/extract', OCR_URL);
    const body = JSON.stringify(payload);
    const lib  = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout:  15000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: { error: 'Invalid JSON from OCR service' } }); }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('OCR service timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// POST /ocr/extract — recebe base64
router.post('/extract', async (req, res, next) => {
  try {
    const { image_base64, doc_type } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 obrigatório.' });

    const result = await callOCR({ image_base64, doc_type: doc_type || 'auto' });
    res.status(result.status).json(result.data);
  } catch (err) {
    // Retorna erro gracioso sem crashar
    res.status(503).json({
      error: 'Serviço OCR não disponível.',
      detail: err.message,
      extracted: {},
    });
  }
});

// POST /ocr/upload — recebe arquivo multipart
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo obrigatório.' });

    const base64 = req.file.buffer.toString('base64');
    const docType = req.body.doc_type || 'auto';

    const result = await callOCR({ image_base64: base64, doc_type: docType });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(503).json({
      error: 'Serviço OCR não disponível.',
      detail: err.message,
      extracted: {},
    });
  }
});

// GET /ocr/health
router.get('/health', async (req, res) => {
  try {
    const url = new URL('/health', OCR_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const check = await new Promise((resolve, reject) => {
      const r = lib.get(url.toString(), { timeout: 3000 }, (response) => {
        let d = '';
        response.on('data', c => d += c);
        response.on('end', () => resolve({ ok: response.statusCode < 400, data: JSON.parse(d || '{}') }));
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    });
    res.json({ ocr_available: check.ok, ...check.data });
  } catch {
    res.json({ ocr_available: false, error: 'OCR service not reachable' });
  }
});

module.exports = router;
