'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Loader2, Users, ArrowRightLeft, ChevronLeft, ChevronRight, Download, FileText, X, CheckSquare, Square } from 'lucide-react';
import { debounce } from 'lodash';
import { employeeAPI, unitAPI, exportAPI, downloadBlob, api } from '@/lib/api';
import { formatDateSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { useUndo } from '@/components/ui/UndoToast';
import clsx from 'clsx';

const STATUS_STYLE: Record<string, string> = {
  ATIVO:     'bg-emerald-100 text-emerald-700',
  INATIVO:   'bg-slate-100 text-slate-500',
  AFASTADO:  'bg-amber-100 text-amber-700',
  DESLIGADO: 'bg-red-100 text-red-600',
  PENDENTE:  'bg-violet-100 text-violet-700',
};

export default function FuncionariosPage() {
  const { can, user } = useAuthStore();
  const qc = useQueryClient();
  const { showUndo } = useUndo();

  // Filtros
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [dSearch, setDSearch] = useState('');
  const [status,  setStatus]  = useState('');
  const searchParamsUrl = useSearchParams();
  useEffect(() => {
    const s = searchParamsUrl.get('status');
    if (s) setStatus(s);
  }, [searchParamsUrl]);
  const [unitId,  setUnitId]  = useState('');

  // Seleção para ações em lote
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal remanejamento em lote
  const [bulkModal,      setBulkModal]      = useState(false);
  const [bulkUnitId,     setBulkUnitId]     = useState('');
  const [bulkSupervisor, setBulkSupervisor] = useState('');
  const [bulkReason,     setBulkReason]     = useState('');

  // Export loading
  const [exporting, setExporting] = useState(false);

  const debounced = useCallback(debounce((v: string) => { setDSearch(v); setPage(1); }, 400), []);
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    debounced(e.target.value);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, dSearch, status, unitId],
    queryFn:  () => employeeAPI.list({ page, limit: 25, search: dSearch || undefined, status: status || undefined, unit_id: unitId || undefined }).then(r => r.data),
    placeholderData: (p: any) => p,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-list'],
    queryFn:  () => unitAPI.list().then(r => r.data),
    enabled:  ['TI','RH','DIRETORIA'].includes(user?.role || ''),
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors-bulk', bulkUnitId],
    queryFn:  () => api.get('/users', { params: { role: 'SUPERVISOR', unit_id: bulkUnitId } }).then(r => r.data),
    enabled:  bulkModal && !!bulkUnitId,
  });

  const bulkTransferMutation = useMutation({
    mutationFn: () => api.post('/employees/bulk-transfer', {
      employee_ids: Array.from(selected),
      unit_id:      bulkUnitId,
      supervisor_id: bulkSupervisor || undefined,
      reason:       bulkReason || undefined,
    }),
    onSuccess: (res) => {
      showUndo(res.data?.undo_id, res.data.message || 'Remanejamento realizado', [['employees']]);
      qc.invalidateQueries({ queryKey: ['employees'] });
      setSelected(new Set());
      setBulkModal(false);
      setBulkUnitId(''); setBulkSupervisor(''); setBulkReason('');
    },
  });

  const handleExportXlsx = async () => {
    setExporting(true);
    try {
      const res = await exportAPI.employees({ status: status || undefined, unit_id: unitId || undefined });
      downloadBlob(res.data, `funcionarios_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch {}
    setExporting(false);
  };

  const employees = data?.data || [];
  const total     = data?.total || 0;
  const pages     = data?.pages || 1;

  const allOnPageSelected = employees.length > 0 && employees.every((e: any) => selected.has(e.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      employees.forEach((e: any) => next.delete(e.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      employees.forEach((e: any) => next.add(e.id));
      setSelected(next);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Funcionários</h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} cadastrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Exportar XLSX */}
          <button onClick={handleExportXlsx} disabled={exporting} className="btn-secondary text-sm">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar XLSX
          </button>

          {/* Remanejamento em lote */}
          {selected.size > 0 && can('employees:update') && (
            <button onClick={() => setBulkModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition font-medium">
              <ArrowRightLeft className="w-4 h-4" />
              Remanejar {selected.size} selecionado{selected.size > 1 ? 's' : ''}
              <button onClick={e => { e.stopPropagation(); setSelected(new Set()); }} className="ml-1 hover:bg-violet-800 rounded p-0.5">
                <X className="w-3 h-3" />
              </button>
            </button>
          )}

          {can('employees:create') && (
            <Link href="/funcionarios/novo" className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Novo funcionário
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={handleSearch} className="input pl-9" placeholder="Buscar por nome, CPF, código..." />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input w-auto bg-white">
          <option value="">Todos os status</option>
          {['ATIVO','INATIVO','AFASTADO','DESLIGADO','PENDENTE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {['TI','RH','DIRETORIA'].includes(user?.role || '') && (
          <select value={unitId} onChange={e => { setUnitId(e.target.value); setPage(1); }} className="input w-auto bg-white">
            <option value="">Todas as unidades</option>
            {(units as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-10 h-10 text-slate-200" />
            <p className="text-slate-400 text-sm">Nenhum funcionário encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  {can('employees:update') && (
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-600 transition">
                        {allOnPageSelected
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Funcionário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Unidade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">Admissão</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employees.map((emp: any) => (
                  <tr key={emp.id} className={clsx('hover:bg-slate-50/50 transition', selected.has(emp.id) && 'bg-blue-50/40')}>
                    {can('employees:update') && (
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(emp.id)} className="text-slate-300 hover:text-blue-600 transition">
                          {selected.has(emp.id)
                            ? <CheckSquare className="w-4 h-4 text-blue-600" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {emp.full_name.slice(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 truncate">{emp.full_name}</p>
                          <p className="text-xs text-slate-400">{emp.employee_code} · {emp.cpf}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{emp.position_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{emp.unit_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">{formatDateSafe(emp.hire_date)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLE[emp.status] || 'bg-slate-100 text-slate-500')}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/funcionarios/${emp.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">Página {page} de {pages} · {total} registros</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <button disabled={page >= pages} onClick={() => setPage(p => p+1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal remanejamento em lote */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBulkModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-1">Remanejamento em lote</h2>
            <p className="text-xs text-slate-400 mb-4">{selected.size} funcionário{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}</p>
            <div className="space-y-3">
              <div>
                <label className="label">Unidade de destino *</label>
                <select value={bulkUnitId} onChange={e => { setBulkUnitId(e.target.value); setBulkSupervisor(''); }} className="input bg-white">
                  <option value="">Selecione a unidade...</option>
                  {(units as any[]).filter((u: any) => !u.name?.toUpperCase().includes('VOLANTE')).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Novo supervisor (opcional)</label>
                <select value={bulkSupervisor} onChange={e => setBulkSupervisor(e.target.value)} className="input bg-white" disabled={!bulkUnitId}>
                  <option value="">Manter / definir depois</option>
                  {(supervisors as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Motivo do remanejamento</label>
                <input value={bulkReason} onChange={e => setBulkReason(e.target.value)} className="input" placeholder="Ex: reestruturação, cobertura..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setBulkModal(false)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => bulkTransferMutation.mutate()}
                disabled={!bulkUnitId || bulkTransferMutation.isPending}
                className="btn-primary"
              >
                {bulkTransferMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Remanejando...</>
                  : <><ArrowRightLeft className="w-4 h-4" /> Confirmar remanejamento</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
