'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Loader2,
  Send, X, User, Building2, CreditCard, MessageSquare,
  Cake, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  startOfMonthSafe, endOfMonthSafe, startOfWeekSafe, endOfWeekSafe,
  eachDayOfIntervalSafe, isSameMonthSafe, isTodaySafe, isSameDaySafe,
  toInputDateValue, buildDateKey, formatDaySafe, formatDayOfMonthSafe,
  formatMonthNameSafe, formatDateSafe,
} from '@/utils/date';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ─── Modal Aniversariante ─────────────────────────────────────
function BirthdayModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const [msg, setMsg]       = useState('');
  const [sending, setSending] = useState(false);
  const firstName = employee.full_name?.split(' ')[0] || '';

  const quickMessages = [
    `🎂 Parabéns, ${firstName}! Que este novo ano de vida seja cheio de conquistas. Com carinho, equipe C.A.S.C.A!`,
    `🎉 Feliz aniversário, ${firstName}! Desejamos saúde, paz e muito sucesso!`,
    `✨ ${firstName}, hoje é seu dia especial! A equipe inteira celebra com você. Parabéns!`,
    `⭐ Parabéns pelo seu aniversário, ${firstName}! Que cada ano traga mais realizações e alegrias!`,
  ];

  const sendMessage = async () => {
    if (!msg.trim()) { toast.error('Digite uma mensagem.'); return; }
    setSending(true);
    try {
      await api.post('/messages/send-birthday', { employee_id: employee.id, message: msg.trim() });
      toast.success('Mensagem enviada!');
      onClose();
    } catch { toast.error('Erro ao enviar mensagem.'); }
    setSending(false);
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '—';
    const d = cpf.replace(/\D/g, '');
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header — azul */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {employee.full_name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-blue-200 font-medium">🎂 Aniversariante</p>
                <h3 className="font-bold text-base leading-tight">{employee.full_name}</h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {employee.age_this_year ? `${employee.age_this_year} anos · ` : ''}dia {parseInt(employee.day)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {employee.unit_name && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Unidade</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{employee.unit_name}</p>
                </div>
              </div>
            )}
            {employee.supervisor_name && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Supervisor</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{employee.supervisor_name}</p>
                </div>
              </div>
            )}
            {employee.cpf && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 col-span-2">
                <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">CPF</p>
                  <p className="text-sm font-semibold text-slate-700">{formatCpf(employee.cpf)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Mensagens rápidas */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Mensagens rápidas:</p>
            <div className="space-y-1">
              {quickMessages.map((m, i) => (
                <button key={i} onClick={() => setMsg(m)}
                  className={clsx(
                    'w-full text-left text-xs p-2.5 rounded-xl border transition',
                    msg === m
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50/60'
                  )}>
                  {m.slice(0, 85)}{m.length > 85 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Personalizar:</p>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3}
              className="input resize-none text-sm" placeholder="Digite uma mensagem personalizada..." />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Fechar</button>
          <button onClick={sendMessage} disabled={!msg.trim() || sending} className="btn-primary flex-1">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────
export default function CalendarioPage() {
  const qc = useQueryClient();
  const [currentDate,    setCurrentDate]    = useState(new Date());
  const [selected,       setSelected]       = useState<Date | null>(null);
  const [modal,          setModal]          = useState(false);
  const [birthdayModal,  setBirthdayModal]  = useState<any>(null);
  const [sideTab,        setSideTab]        = useState<'eventos' | 'aniversarios'>('eventos');
  const [form, setForm] = useState({ title: '', description: '', type: 'EVENTO', color: '#2563eb' });

  const monthStart = startOfMonthSafe(currentDate);
  const monthEnd   = endOfMonthSafe(currentDate);
  const calStart   = startOfWeekSafe(monthStart);
  const calEnd     = endOfWeekSafe(monthEnd);
  const days       = eachDayOfIntervalSafe(calStart, calEnd);
  const monthKey   = toInputDateValue(monthStart).slice(0, 7);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events', monthKey],
    queryFn:  () => api.get('/calendar/events', {
      params: { start: toInputDateValue(calStart), end: toInputDateValue(calEnd) },
    }).then(r => r.data),
  });

  const { data: birthdays = [] } = useQuery({
    queryKey: ['birthdays', currentDate.getMonth() + 1],
    queryFn:  () => api.get('/calendar/birthdays', {
      params: { month: currentDate.getMonth() + 1 },
    }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/calendar/events', {
      ...form,
      start_date: selected ? toInputDateValue(selected) : toInputDateValue(new Date()),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); setModal(false); toast.success('Evento criado!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); toast.success('Evento removido.'); },
  });

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of events as any[]) {
      const key = ev.start_date?.slice(0, 10);
      if (key) { if (!map[key]) map[key] = []; map[key].push({ ...ev, _type: 'event' }); }
    }
    for (const b of birthdays as any[]) {
      if (!b.birth_date) continue;
      const bday = new Date(b.birth_date + 'T00:00:00');
      const key  = buildDateKey(currentDate, bday.getMonth(), bday.getDate());
      if (!map[key]) map[key] = [];
      // Amarelo para aniversários
      map[key].push({ ...b, title: `🎂 ${b.full_name.split(' ')[0]}`, color: '#eab308', _type: 'birthday' });
    }
    return map;
  }, [events, birthdays, currentDate]);

  const selectedKey   = selected ? toInputDateValue(selected) : null;
  const selectedItems = selectedKey ? (eventsByDay[selectedKey] || []) : [];

  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Calendário</h1>
          <p className="text-slate-400 text-sm mt-0.5">Eventos e aniversários</p>
        </div>
        <button onClick={() => { setSelected(new Date()); setModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo evento
        </button>
      </div>

      {/* Layout: calendário (2/3) + painel lateral (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Calendário ─────────────────────────────────────── */}
        <div className="lg:col-span-2 card overflow-hidden">
          {/* Nav do mês */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </button>
            <h2 className="font-semibold text-slate-800 capitalize">
              {formatMonthNameSafe(currentDate)} {currentDate.getFullYear()}
            </h2>
            <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const key      = toInputDateValue(day);
              const dayItems = eventsByDay[key] || [];
              const isThis   = isSameMonthSafe(day, currentDate);
              const isSel    = isSameDaySafe(day, selected);
              const isNow    = isTodaySafe(day);
              const hasBday  = dayItems.some(item => item._type === 'birthday');

              return (
                <button key={i} onClick={() => setSelected(day)}
                  className={clsx(
                    'min-h-[68px] p-1.5 border-b border-r border-slate-50 text-left transition-colors',
                    !isThis    && 'opacity-30',
                    isSel      && 'bg-blue-50',
                    isNow && !isSel && 'bg-slate-50/80',
                    'hover:bg-blue-50/40'
                  )}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className={clsx(
                      'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full',
                      isNow ? 'bg-blue-600 text-white' : 'text-slate-600',
                      isSel && !isNow && 'bg-blue-100 text-blue-700',
                    )}>
                      {formatDaySafe(day)}
                    </span>
                    {/* Indicador de aniversário — amarelo */}
                    {hasBday && !isNow && (
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 2).map((item: any, j: number) => (
                      <div key={j}
                        className="truncate text-[9px] font-semibold rounded px-1 py-0.5 text-white leading-tight"
                        style={{ background: item._type === 'birthday' ? '#eab308' : (item.color || '#2563eb') }}>
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] text-slate-400 pl-1">+{dayItems.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-blue-600" />
              <span className="text-xs text-slate-400">Evento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-yellow-400" />
              <span className="text-xs text-slate-400">Aniversário</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-xs text-slate-400">Hoje</span>
            </div>
          </div>
        </div>

        {/* ── Painel lateral ─────────────────────────────────── */}
        <div className="card flex flex-col overflow-hidden">
          {/* Tabs do painel */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setSideTab('eventos')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 -mb-px',
                sideTab === 'eventos'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}>
              <Calendar className="w-3.5 h-3.5" />
              {selected ? formatDayOfMonthSafe(selected) : 'Eventos'}
            </button>
            <button
              onClick={() => setSideTab('aniversarios')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition border-b-2 -mb-px',
                sideTab === 'aniversarios'
                  ? 'border-yellow-400 text-yellow-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}>
              <Cake className="w-3.5 h-3.5" />
              Aniversários
              {(birthdays as any[]).length > 0 && (
                <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded-full">
                  {(birthdays as any[]).length}
                </span>
              )}
            </button>
          </div>

          {/* Conteúdo do painel */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* Tab: Eventos do dia selecionado */}
            {sideTab === 'eventos' && (
              <>
                {selectedItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">{selected ? 'Nenhum evento' : 'Selecione um dia'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 group">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: item._type === 'birthday' ? '#eab308' : (item.color || '#2563eb') }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 leading-tight">{item.title}</p>
                          {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                          {item._type === 'birthday' && (
                            <button onClick={() => setBirthdayModal(item)}
                              className="mt-1.5 flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium transition">
                              <MessageSquare className="w-3 h-3" /> Enviar parabéns
                            </button>
                          )}
                          {item._type === 'event' && (
                            <button
                              onClick={() => { if (confirm('Remover este evento?')) deleteMutation.mutate(item.id); }}
                              className="mt-1 text-xs text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selected && (
                  <button onClick={() => setModal(true)}
                    className="mt-4 w-full py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition">
                    + Adicionar evento neste dia
                  </button>
                )}
              </>
            )}

            {/* Tab: Aniversariantes do mês */}
            {sideTab === 'aniversarios' && (
              <>
                {(birthdays as any[]).length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Cake className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">Nenhum aniversariante este mês</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(birthdays as any[]).map((b: any) => (
                      <div key={b.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-yellow-50/60 transition group cursor-pointer"
                        onClick={() => setBirthdayModal(b)}>
                        {/* Dia */}
                        <div className="w-9 h-9 rounded-xl bg-yellow-50 border border-yellow-100 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] text-yellow-500 font-semibold leading-none">dia</span>
                          <span className="text-sm font-bold text-yellow-700 leading-none">{parseInt(b.day)}</span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{b.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {b.unit_name && (
                              <span className="text-[10px] text-slate-400 truncate">{b.unit_name}</span>
                            )}
                            {b.supervisor_name && (
                              <span className="text-[10px] text-slate-300">· {b.supervisor_name}</span>
                            )}
                          </div>
                          {b.cpf && (
                            <p className="text-[10px] text-slate-300 mt-0.5">
                              {b.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                            </p>
                          )}
                        </div>
                        {/* Ação */}
                        <MessageSquare className="w-3.5 h-3.5 text-slate-200 group-hover:text-yellow-500 transition shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal novo evento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Novo evento{selected ? ` — ${formatDateSafe(selected)}` : ''}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="input" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} className="input resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="input bg-white">
                    <option value="EVENTO">Evento</option>
                    <option value="REUNIAO">Reunião</option>
                    <option value="PRAZO">Prazo</option>
                    <option value="FERIADO">Feriado</option>
                  </select>
                </div>
                <div>
                  <label className="label">Cor</label>
                  <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))}
                    className="input h-[42px] p-1 cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aniversariante */}
      {birthdayModal && (
        <BirthdayModal employee={birthdayModal} onClose={() => setBirthdayModal(null)} />
      )}
    </div>
  );
}
