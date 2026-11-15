import axios from 'axios';
import toast from 'react-hot-toast';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Injeta token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const raw   = localStorage.getItem('ong-auth');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Trata erros globais
api.interceptors.response.use(
  r => r,
  async (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('ong-auth');
        window.location.href = '/login';
      }
    } else {
      const msg = err.response?.data?.error || 'Erro inesperado.';
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

// ─── Employees ────────────────────────────────────────────────
export const employeeAPI = {
  list:    (p?: any)             => api.get('/employees', { params: p }),
  get:     (id: string)          => api.get(`/employees/${id}`),
  create:  (d: any)              => api.post('/employees', d),
  update:  (id: string, d: any)  => api.put(`/employees/${id}`, d),
  status:  (id: string, d: any)  => api.patch(`/employees/${id}/status`, d),
  history: (id: string, p?: any) => api.get(`/employees/${id}/history`, { params: p }),
  byCpf:   (cpf: string)         => api.get(`/employees/search/cpf/${cpf}`),
};

// ─── Admissions ───────────────────────────────────────────────
export const admissionAPI = {
  list:       (p?: any)               => api.get('/admissions', { params: p }),
  create:     (d: any)                => api.post('/admissions', d),
  getForm:    (token: string)         => api.get(`/admissions/form/${token}`),
  submitForm: (token: string, d: any) => api.post(`/admissions/form/${token}`, d),
  review:     (id: string, d: any)    => api.patch(`/admissions/${id}/review`, d),
  resend:     (id: string)            => api.post(`/admissions/${id}/resend`),
};

// ─── Units ────────────────────────────────────────────────────
export const unitAPI = {
  list:     ()                       => api.get('/units'),
  get:      (id: string)             => api.get(`/units/${id}`),
  create:   (d: any)                 => api.post('/units', d),
  update:   (id: string, d: any)     => api.put(`/units/${id}`, d),
  delete:   (id: string)             => api.delete(`/units/${id}`),
  addPhoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post(`/units/${id}/photo`, fd);
  },
};

// ─── Dashboard ────────────────────────────────────────────────
export const dashboardAPI = {
  general:    (p?: any)             => api.get('/dashboard/general', { params: p }),
  unit:       (id: string, p?: any) => api.get(`/dashboard/unit/${id}`, { params: p }),
  supervisor: (p?: any)             => api.get('/dashboard/supervisor', { params: p }),
  trends:     ()                    => api.get('/dashboard/attendance-trends'),
};

// ─── Notifications ────────────────────────────────────────────
export const notificationAPI = {
  list:        ()           => api.get('/notifications'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.patch('/notifications/read-all'),
};

// ─── Export ───────────────────────────────────────────────────
export const exportAPI = {
  employees:   (params: Record<string,any> = {}, format: 'xlsx'|'csv' = 'xlsx') =>
    api.get('/export/employees',  { params: { ...params, format }, responseType: 'blob' }),
  attendance:  (params: Record<string,any> = {}) =>
    api.get('/export/attendance', { params, responseType: 'blob' }),
  units:       () => api.get('/export/units',       { responseType: 'blob' }),
  supervisors: () => api.get('/export/supervisors', { responseType: 'blob' }),
  positions:   () => api.get('/export/positions',   { responseType: 'blob' }),
  events:      (params?: any) => api.get('/export/events', { params, responseType: 'blob' }),
};

// ─── Audit ────────────────────────────────────────────────────
export const auditAPI = {
  list:   (params?: any) => api.get('/audit',        { params }),
  stats:  ()             => api.get('/audit/stats'),
  export: (params?: any) => api.get('/audit/export', { params, responseType: 'blob' }),
};

// ─── OCR ──────────────────────────────────────────────────────
// upload: envia arquivo multipart → POST /ocr/upload
// extract: envia base64          → POST /ocr/extract
export const ocrAPI = {
  upload: (file: File, docType = 'auto') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', docType);
    return api.post('/ocr/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  extract: (imageBase64: string, docType = 'auto') =>
    api.post('/ocr/extract', { image_base64: imageBase64, doc_type: docType }),
  health: () => api.get('/ocr/health'),
};

// ─── Utilitário de download ───────────────────────────────────
export function downloadBlob(blob: Blob, filename: string): void {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Undo ─────────────────────────────────────────────────────
export const undoAPI = {
  list:   ()           => api.get('/undo'),
  revert: (id: string) => api.post(`/undo/${id}`),
};


export default api;
