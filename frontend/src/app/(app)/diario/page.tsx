'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle2, Save, Send, Calendar, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function StatusDot({ status }: { status: string | null }) {
  if (status === 'ENVIADO') return <div className="w-3 h-3 rounded-full bg-green-500" title="Enviado" />;
  if (status === 'RASCUNHO') return <div className="w-3 h-3 rounded-full bg-yellow-400" title="Rascunho" />;
  return <div className="w-3 h-3 rounded-full" style={{ background: 'var(--border)' }} title="Pendente" />;
}

export default function DiarioPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Perguntas do diário
  const { data: questions = [] } = useQuery({
    queryKey: ['diario-questions'],
    queryFn: () => api.get('/diario/questions').then(r => r.data),
    staleTime: Infinity,
  });

  // Entrada de hoje
  const { data: todayEntry, isLoading } = useQuery({
    queryKey: ['diario-today'],
    queryFn: () => api.get('/diario/today').then(r => r.data),
  });

  // Streak
  const { data: streakData } = useQuery({
    queryKey: ['diario-streak'],
    queryFn: () => api.get('/diario/streak').then(r => r.data),
  });

  // Histórico do mês para o mini-calendário
  const nowDate = new Date();
  const { data: history = [] } = useQuery({
    queryKey: ['diario-history', `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}`],
    queryFn: () => api.get('/diario/history', {
      params: { month: `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}` }
    }).then(r => r.data),
  });

  // Carrega respostas salvas
  useEffect(() => {
    if (todayEntry?.answers) {
      setAnswers(todayEntry.answers);
    }
  }, [todayEntry]);

  const isSubmitted = todayEntry?.status === 'ENVIADO';

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) =>
      api.post('/diario', { date: todayStr, answers, submit }).then(r => r.data),
    onSuccess: (_, submit) => {
      qc.invalidateQueries({ queryKey: ['diario-today'] });
      qc.invalidateQueries({ queryKey: ['diario-streak'] });
      qc.invalidateQueries({ queryKey: ['diario-history'] });
      qc.invalidateQueries({ queryKey: ['portal-dashboard'] });
      if (submit) {
        toast.success('Diário enviado com sucesso! ✅');
      } else {
        setSaved(true);
        toast.success('Rascunho salvo.');
        setTimeout(() => setSaved(false), 2000);
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao salvar.'),
  });

  // Mapa de datas do histórico
  const historyMap: Record<string, string> = {};
  (history as any[]).forEach((h: any) => { historyMap[h.date] = h.status; });

  // Mini calendário
  const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getDay();

  const allFilled = questions.length > 0 && questions.every((q: any) =>
    !q.is_required || (answers[q.id] && answers[q.id].trim().length > 0)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            📓 Diário de Bordo
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {(streakData?.streak || 0) > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <Flame className="w-4 h-4" style={{ color: '#ea580c' }} />
            <span className="text-sm font-bold" style={{ color: '#ea580c' }}>
              {streakData?.streak} dias
            </span>
          </div>
        )}
      </div>

      {/* Mini calendário do mês */}
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
          {MONTHS_PT[nowDate.getMonth()]} {nowDate.getFullYear()}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['D','S','T','Q','Q','S','S'].map((d,i) => (
            <div key={i} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_,i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const st = historyMap[dateStr];
            const isToday = dateStr === todayStr;
            const isFuture = day > nowDate.getDate();
            return (
              <div key={day} className="flex items-center justify-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium relative"
                  style={{
                    background: isToday ? '#2563eb' : 'transparent',
                    color: isToday ? 'white' : 'var(--text-secondary)',
                    border: isToday ? 'none' : '1px solid transparent',
                  }}>
                  {day}
                  {!isFuture && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{
                        background: st === 'ENVIADO' ? '#22c55e'
                          : st === 'RASCUNHO' ? '#eab308'
                          : day < nowDate.getDate() ? '#ef4444' : 'transparent'
                      }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Enviado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Rascunho</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Pendente</span>
        </div>
      </div>

      {/* Formulário */}
      <div className="card p-5">
        {isSubmitted ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#22c55e' }} />
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Diário enviado!
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Você já preencheu o diário de hoje. Volte amanhã!
            </p>
            {(streakData?.streak || 0) >= 5 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <span>🏆</span>
                <span className="text-sm font-semibold" style={{ color: '#ea580c' }}>
                  {streakData?.streak} dias consecutivos — incrível!
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
              PREENCHIMENTO DE HOJE
            </h2>
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />)}
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q: any) => (
                  <div key={q.id}>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      {q.label}
                      {q.is_required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {q.type === 'number' ? (
                      <input
                        type="number"
                        min={0}
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        placeholder={q.placeholder || ''}
                        className="input"
                      />
                    ) : (
                      <textarea
                        rows={3}
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        placeholder={q.placeholder || ''}
                        className="input resize-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => saveMutation.mutate(false)}
                disabled={saveMutation.isPending}
                className="btn-secondary flex-1 justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saved ? 'Salvo ✓' : 'Rascunho'}
              </button>
              <button
                onClick={() => {
                  if (!allFilled) { toast.error('Preencha todos os campos obrigatórios.'); return; }
                  saveMutation.mutate(true);
                }}
                disabled={saveMutation.isPending || !allFilled}
                className="btn-primary flex-1 justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </div>
            {!allFilled && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Preencha todos os campos obrigatórios para enviar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
