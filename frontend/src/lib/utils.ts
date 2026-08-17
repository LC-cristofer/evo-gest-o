/**
 * Utilitários do Frontend
 * Formatadores, máscaras e validadores reutilizáveis
 */

// ─── CPF ─────────────────────────────────────────────────────

/** Formata CPF: 12345678900 → 123.456.789-00 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3)  return digits;
  if (digits.length <= 6)  return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9)  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

/** Valida CPF (algoritmo dos dígitos verificadores) */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(digits[10]);
}

// ─── Telefone ─────────────────────────────────────────────────

/** Formata telefone: 11987654321 → (11) 98765-4321 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2)  return `(${digits}`;
  if (digits.length <= 6)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

// ─── CEP ──────────────────────────────────────────────────────

/** Formata CEP: 12345678 → 12345-678 */
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0,5)}-${digits.slice(5)}`;
}

// ─── Moeda ────────────────────────────────────────────────────

/** Formata número como moeda brasileira: 1500.5 → R$ 1.500,50 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(num);
}

/** Parseia string monetária para número: "R$ 1.500,50" → 1500.5 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// ─── Data ─────────────────────────────────────────────────────

/** Formata data ISO para pt-BR: "2024-01-15" → "15/01/2024" */
export function formatDate(value: string | Date | null | undefined, includeTime = false): string {
  if (!value) return '—';
  try {
    // Adiciona T00:00:00 para evitar problema de timezone em strings de data
    const date = typeof value === 'string' && value.length === 10
      ? new Date(value + 'T00:00:00')
      : new Date(value);

    if (isNaN(date.getTime())) return '—';

    if (includeTime) {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(date);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

/** Formata data para input[type=date]: "15/01/2024" → "2024-01-15" */
export function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return value;
}

/** Calcula anos de diferença: "2020-01-01" → 4 (anos) */
export function yearsAgo(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const now  = new Date();
  let years  = now.getFullYear() - date.getFullYear();
  const m    = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years--;
  return years;
}

/** Formata tempo relativo: "há 3 dias", "há 2 meses" */
export function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const date  = new Date(dateStr);
  const now   = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec  = Math.floor(diffMs / 1000);
  const diffMin  = Math.floor(diffSec / 60);
  const diffHr   = Math.floor(diffMin / 60);
  const diffDay  = Math.floor(diffHr  / 24);
  const diffMon  = Math.floor(diffDay / 30);
  const diffYr   = Math.floor(diffDay / 365);

  if (diffSec < 60)  return 'agora há pouco';
  if (diffMin < 60)  return `há ${diffMin} min`;
  if (diffHr  < 24)  return `há ${diffHr} hora${diffHr !== 1 ? 's' : ''}`;
  if (diffDay < 30)  return `há ${diffDay} dia${diffDay !== 1 ? 's' : ''}`;
  if (diffMon < 12)  return `há ${diffMon} ${diffMon !== 1 ? 'meses' : 'mês'}`;
  return `há ${diffYr} ano${diffYr !== 1 ? 's' : ''}`;
}

// ─── Texto ────────────────────────────────────────────────────

/** Trunca texto: "Lorem ipsum dolor sit amet" → "Lorem ipsum..." */
export function truncate(text: string, maxLen = 50): string {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen).trimEnd() + '...';
}

/** Converte snake_case/UPPER_CASE para texto legível */
export function humanize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Iniciais de um nome: "João Silva Santos" → "JS" */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

// ─── Arquivo ──────────────────────────────────────────────────

/** Formata tamanho de arquivo: 1500000 → "1.4 MB" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Retorna ícone/cor por MIME type */
export function mimeTypeInfo(mime: string | null | undefined): { label: string; color: string } {
  if (!mime) return { label: 'Arquivo', color: 'text-slate-400' };
  if (mime === 'application/pdf')            return { label: 'PDF',  color: 'text-red-500' };
  if (mime.startsWith('image/'))             return { label: 'Imagem', color: 'text-blue-500' };
  if (mime.includes('word'))                 return { label: 'Word', color: 'text-blue-700' };
  if (mime.includes('spreadsheet') || mime.includes('excel')) return { label: 'Excel', color: 'text-green-600' };
  return { label: 'Arquivo', color: 'text-slate-400' };
}

// ─── Validadores de formulário (react-hook-form) ──────────────

export const validators = {
  cpf: (v: string) => isValidCPF(v) || 'CPF inválido',

  phone: (v: string) => {
    if (!v) return true;
    return v.replace(/\D/g, '').length >= 10 || 'Telefone inválido (mínimo 10 dígitos)';
  },

  cep: (v: string) => {
    if (!v) return true;
    return v.replace(/\D/g, '').length === 8 || 'CEP inválido';
  },

  date: (v: string) => {
    if (!v) return true;
    const d = new Date(v);
    return !isNaN(d.getTime()) || 'Data inválida';
  },

  pastDate: (v: string) => {
    if (!v) return true;
    const d = new Date(v + 'T00:00:00');
    return d < new Date() || 'Data deve ser no passado';
  },

  futureDate: (v: string) => {
    if (!v) return true;
    const d = new Date(v + 'T00:00:00');
    return d > new Date() || 'Data deve ser no futuro';
  },

  minAge: (years: number) => (v: string) => {
    if (!v) return true;
    const age = yearsAgo(v);
    return age !== null && age >= years || `Deve ter no mínimo ${years} anos`;
  },
};

// ─── Classificação de status ──────────────────────────────────

/** Retorna variante de Badge por status de funcionário */
export function employeeStatusVariant(status: string): 'green' | 'red' | 'yellow' | 'gray' | 'violet' {
  const map: Record<string, any> = {
    ATIVO:     'green',
    AFASTADO:  'yellow',
    DESLIGADO: 'red',
    INATIVO:   'gray',
    PENDENTE:  'violet',
  };
  return map[status] || 'gray';
}

/** Retorna cor de atenção baseada em número de faltas */
export function absenceRiskColor(absences: number): string {
  if (absences === 0) return 'text-emerald-600';
  if (absences <= 2)  return 'text-amber-600';
  return 'text-red-600';
}

/** Retorna label de Badge baseado em número de faltas */
export function absenceRiskLabel(absences: number): { label: string; variant: 'green' | 'yellow' | 'red' } {
  if (absences === 0) return { label: 'OK',      variant: 'green' };
  if (absences <= 2)  return { label: 'Atenção', variant: 'yellow' };
  return               { label: 'Crítico', variant: 'red' };
}
