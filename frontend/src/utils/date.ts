/**
 * Utilitários de data — sem date-fns, sem quebra em SSR.
 * Retorna "—" em caso de valor null, undefined ou inválido.
 */

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = value.trim();
  if (!s) return null;
  // "2024-01-15" → evita offset UTC no Safari/SSR
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** "2024-01-15" → "15/01/2024" | null/inválido → "—" */
export function formatDateSafe(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';
  try { return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return '—'; }
}

/** datetime → "15/01/2024 às 14:30" | null → "—" */
export function formatDateTimeSafe(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';
  try {
    const date = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    return `${date} às ${time}`;
  } catch { return '—'; }
}

/** datetime → "14:30" | null → "—" */
export function formatTimeSafe(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';
  try { return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }
  catch { return '—'; }
}

/** Date → "janeiro de 2024" | null → "—" */
export function formatMonthYearSafe(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';
  try { return d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }); }
  catch { return '—'; }
}

/** Date → "jan/24" */
export function formatMonthShortSafe(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';
  try {
    const m = d.toLocaleDateString('pt-BR', { month:'short' }).replace('.','');
    return `${m}/${String(d.getFullYear()).slice(2)}`;
  } catch { return '—'; }
}

/** Date → "segunda-feira, 13 de abril" */
export function formatFullDateSafe(d: Date): string {
  try { return d.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' }); }
  catch { return '—'; }
}

/** Date → "15 de janeiro" | null → "Selecione um dia" */
export function formatDayOfMonthSafe(d: Date | null): string {
  if (!d) return 'Selecione um dia';
  try { return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long' }); }
  catch { return '—'; }
}

/** Date → nome do mês: "janeiro" */
export function formatMonthNameSafe(d: Date): string {
  try { return d.toLocaleDateString('pt-BR', { month:'long' }); }
  catch { return '—'; }
}

/** Date → dia como string: "15" */
export function formatDaySafe(d: Date): string { return String(d.getDate()); }

/** Date → "2024-01-15" (para inputs type=date e params de API) */
export function toInputDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Constrói "yyyy-MM-dd" para um dia num mês do currentDate */
export function buildDateKey(currentDate: Date, month: number, day: number): string {
  return `${currentDate.getFullYear()}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function isSameDaySafe(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function isTodaySafe(d: Date): boolean { return isSameDaySafe(d, new Date()); }
export function isSameMonthSafe(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
export function startOfMonthSafe(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function endOfMonthSafe(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
export function startOfWeekSafe(d: Date): Date {
  const r = new Date(d); r.setDate(d.getDate() - d.getDay()); r.setHours(0,0,0,0); return r;
}
export function endOfWeekSafe(d: Date): Date {
  const r = new Date(d); r.setDate(d.getDate() + (6 - d.getDay())); r.setHours(23,59,59,999); return r;
}
export function eachDayOfIntervalSafe(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start); cur.setHours(0,0,0,0);
  const last = new Date(end);  last.setHours(0,0,0,0);
  while (cur <= last) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}
