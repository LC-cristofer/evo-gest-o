'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { CheckCircle2, XCircle, Clock, Search, Users, BarChart3 } from 'lucide-react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'ENVIADO') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
      <CheckCircle2 className="w-3 h-3" />Enviado
    </span>
  );
  if (status === 'RASCUNHO') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
      <Clock className="w-3 h-3" />Rascunho
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
      <XCircle className="w-3 h-3" />Pendente
    </span>
  );
}

export default function MinhaEquipePage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'diario' | 'relatorio'>('diario');

  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: diarioTeam = [], isLoading: dl } = useQuery({
    queryKey: ['team-diario', today],
    queryFn: () => api.get(`/diario/team/${today}`).then(r => r.data),
    refetchInterval: 120_000,
  });

  const { data: relatorioTeam = [], isLoading: rl } = useQuery({
    queryKey: ['team-relatorio', year, month],
    queryFn: () => api.get(`/relatorio/team/${year}/${month}`).then(r => r.data),
    refetchInterval: 300_000,
  });

  const data: any[] = tab === 'diario' ? diarioTeam : relatorioTeam;
  const filtered = data.filter((u: any) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.unit_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const sent  = data.filter((u: any) => (tab === 'diario' ? u.diario_status : u.relatorio_status) === 'ENVIADO').length;
  const total = data.length;
  const pct   = total > 0 ? Math.round((sent / total) * 100) : 0;

  const isLoading = tab === 'diario' ? dl : rl;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          👥 Minha Equipe
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Status de preenchimento da equipe
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'diario',    label: `Diário — ${now.toLocaleDateString('pt-BR', { day:'numeric', month:'short' })}` },
          { key: 'relatorio', label: `Relatório — ${MONTHS_PT[month-1]}` },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as any)}
            className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition"
            style={{
              background: tab === t.key ? '#2563eb' : 'var(--bg-card)',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: '#2563eb' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Preenchimento
            </span>
          </div>
          <span className="text-sm font-bold" style={{ color: pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }}>
            {sent}/{total} ({pct}%)
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444',
            }} />
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar funcionário ou unidade..."
          className="input pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Nenhum funcionário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Pendentes primeiro */}
          {[...filtered].sort((a: any, b: any) => {
            const aS = tab === 'diario' ? a.diario_status : a.relatorio_status;
            const bS = tab === 'diario' ? b.diario_status : b.relatorio_status;
            if (aS === bS) return a.name.localeCompare(b.name);
            if (aS === null) return -1;
            if (bS === null) return 1;
            return 0;
          }).map((u: any) => {
            const status = tab === 'diario' ? u.diario_status : u.relatorio_status;
            return (
              <div key={u.user_id} className="card p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: status === 'ENVIADO' ? '#f0fdf4' : status === 'RASCUNHO' ? '#fffbeb' : '#fef2f2',
                      color: status === 'ENVIADO' ? '#16a34a' : status === 'RASCUNHO' ? '#d97706' : '#dc2626',
                    }}>
                    {u.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                    {u.unit_name && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.unit_name}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
