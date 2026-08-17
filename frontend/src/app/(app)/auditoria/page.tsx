'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, Filter, Download, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner, EmptyState, Modal, Badge } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  CREATE:          'bg-emerald-100 text-emerald-700',
  UPDATE:          'bg-blue-100 text-blue-700',
  DELETE:          'bg-red-100 text-red-700',
  LOGIN_SUCCESS:   'bg-slate-100 text-slate-600',
  LOGIN_FAILED:    'bg-red-100 text-red-600',
  LOGOUT:          'bg-slate-100 text-slate-500',
  EXPORT:          'bg-violet-100 text-violet-700',
  ADMISSION_CREATED: 'bg-emerald-100 text-emerald-700',
  PASSWORD_CHANGED:  'bg-amber-100 text-amber-700',
};

export default function AuditoriaPage() {
  const { user } = useAuthStore();
  const [search, setSearch]   = useState('');
  const [entity, setEntity]   = useState('');
  const [action, setAction]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [page, setPage]       = useState(1);
  const [detail, setDetail]   = useState<any>(null);

  if (user?.role !== 'TI') {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Shield className="w-8 h-8 mr-3 opacity-30" />
        Acesso restrito ao TI.
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, entity, action, dateFrom, dateTo],
    queryFn: () => api.get('/audit', {
      params: {
        page, limit: 30,
        search:    search || undefined,
        entity:    entity || undefined,
        action:    action || undefined,
        date_from: dateFrom || undefined,
        date_to:   dateTo || undefined,
      }
    }).then(r => r.data),
  });

  const logs    = data?.data || [];
  const total   = data?.total || 0;
  const pages   = data?.pages || 1;

  const ENTITIES = [
    'employees', 'users', 'units', 'admissions',
    'attendance_records', 'employee_benefits', 'positions',
  ];

  const ACTIONS = [
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILED',
    'LOGOUT', 'EXPORT', 'ADMISSION_CREATED', 'PASSWORD_CHANGED',
  ];

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-600" />
            Log de Auditoria
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {total.toLocaleString('pt-BR')} eventos registrados
          </p>
        </div>
        <button
          onClick={() => window.open('/api/v1/export/audit?format=csv', '_blank')}
          className="btn-secondary text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por usuário ou entidade..."
              className="input pl-9"
            />
          </div>
          <select
            value={entity}
            onChange={e => { setEntity(e.target.value); setPage(1); }}
            className="input bg-white"
          >
            <option value="">Todas as entidades</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="input bg-white"
          >
            <option value="">Todas as ações</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" placeholder="De" />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="input" placeholder="Até" />
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !logs.length ? (
          <EmptyState icon={Shield} title="Nenhum evento encontrado" description="Ajuste os filtros para ver os registros." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Data/Hora</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Usuário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ação</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Entidade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">IP</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition group">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        <span title={formatDate(log.created_at, true)}>
                          {timeAgo(log.created_at)}
                        </span>
                        <br />
                        <span className="text-slate-400">{formatDate(log.created_at, true)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 text-xs">{log.user_name || 'Sistema'}</p>
                        <p className="text-xs text-slate-400">{log.user_email || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                        <span className="font-mono">{log.entity}</span>
                        {log.entity_id && (
                          <span className="text-slate-300 ml-1">#{log.entity_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono text-slate-400">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(log.old_data || log.new_data) && (
                          <button
                            onClick={() => setDetail(log)}
                            className="opacity-0 group-hover:opacity-100 transition p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <span className="text-xs text-slate-400">Página {page} de {pages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition">
                    Anterior
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition">
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de detalhe do log */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalhes do evento" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Ação',      detail.action],
                ['Entidade',  detail.entity],
                ['ID',        detail.entity_id],
                ['Usuário',   detail.user_name || 'Sistema'],
                ['IP',        detail.ip_address || '—'],
                ['Data/Hora', formatDate(detail.created_at, true)],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="font-medium text-slate-700 font-mono text-xs break-all">{value}</p>
                </div>
              ))}
            </div>

            {detail.old_data && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-1">Antes</p>
                <pre className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(detail.old_data, null, 2)}
                </pre>
              </div>
            )}

            {detail.new_data && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Depois</p>
                <pre className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-700 overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(detail.new_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
