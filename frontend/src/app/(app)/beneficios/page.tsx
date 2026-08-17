'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const BENEFIT_LABELS: Record<string, { label: string; color: string }> = {
  VR:          { label: 'Vale Refeição',   color: 'bg-green-100 text-green-700' },
  VT:          { label: 'Vale Transporte', color: 'bg-blue-100 text-blue-700' },
  PLANO_SAUDE: { label: 'Plano de Saúde', color: 'bg-rose-100 text-rose-700' },
  OUTROS:      { label: 'Outros',          color: 'bg-slate-100 text-slate-600' },
};

export default function BeneficiosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ employee_id:'', benefit_type:'VR', value:'', operator:'', card_number:'', start_date:'' });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['benefit-requests'],
    queryFn:  () => api.get('/benefits/requests').then(r => r.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-search', search],
    queryFn:  () => api.get('/employees', { params:{ search:search||undefined, status:'ATIVO', limit:20 } }).then(r => r.data.data),
    enabled:  addModal || search.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/benefits', { ...form, value: form.value ? parseFloat(form.value) : undefined }),
    onSuccess: () => { setAddModal(false); setForm({ employee_id:'', benefit_type:'VR', value:'', operator:'', card_number:'', start_date:'' }); toast.success('Benefício adicionado!'); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/benefits/requests/${id}/review`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['benefit-requests'] }); toast.success('Solicitação atualizada!'); },
  });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-800">Benefícios</h1><p className="text-slate-400 text-sm mt-0.5">VR, VT e Plano de Saúde</p></div>
        <button onClick={() => setAddModal(true)} className="btn-primary"><Plus className="w-4 h-4" />Adicionar benefício</button>
      </div>

      {/* Cards de tipo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(BENEFIT_LABELS).map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className={clsx('inline-flex p-2 rounded-lg mb-2 text-sm', v.color)}><Gift className="w-4 h-4" /></div>
            <p className="text-sm font-semibold text-slate-700">{v.label}</p>
          </div>
        ))}
      </div>

      {/* Solicitações pendentes */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Solicitações pendentes ({(requests as any[]).length})</h2>
        </div>
        {isLoading ? <div className="p-12 text-center text-slate-400">Carregando...</div>
        : (requests as any[]).length === 0 ? <p className="text-sm text-slate-400 text-center py-10">Sem solicitações pendentes</p>
        : (
          <div className="divide-y divide-slate-50">
            {(requests as any[]).map((r: any) => (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">{r.full_name} <span className="text-xs text-slate-400">{r.employee_code}</span></p>
                  <p className="text-xs text-slate-400">{BENEFIT_LABELS[r.benefit_type]?.label} · {r.request_type?.replace(/_/g,' ')} · {r.unit_name}</p>
                  {r.justification && <p className="text-xs text-slate-500 italic">"{r.justification}"</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => reviewMutation.mutate({ id:r.id, status:'APROVADO' })} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition" title="Aprovar"><CheckCircle2 className="w-5 h-5" /></button>
                  <button onClick={() => reviewMutation.mutate({ id:r.id, status:'REJEITADO' })} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition" title="Rejeitar"><XCircle className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Busca por funcionário */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Consultar benefícios de funcionário</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite o nome ou CPF..." className="input pl-9" />
        </div>
        {search.length >= 2 && (employees as any[]).length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-50">
            {(employees as any[]).slice(0,5).map((emp: any) => (
              <a key={emp.id} href={`/funcionarios/${emp.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
                <div><p className="text-sm font-medium text-slate-700">{emp.full_name}</p><p className="text-xs text-slate-400">{emp.employee_code} · {emp.unit_name}</p></div>
                <span className="text-xs text-blue-500">Ver →</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Modal adicionar */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setAddModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Adicionar benefício</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Funcionário *</label>
                <input placeholder="Buscar..." onChange={e=>setSearch(e.target.value)} className="input mb-2" />
                <select value={form.employee_id} onChange={e=>setForm(f=>({...f,employee_id:e.target.value}))} className="input bg-white">
                  <option value="">Selecione</option>
                  {(employees as any[]).map((e:any)=><option key={e.id} value={e.id}>{e.full_name} — {e.employee_code}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Tipo *</label>
                  <select value={form.benefit_type} onChange={e=>setForm(f=>({...f,benefit_type:e.target.value}))} className="input bg-white">
                    {Object.entries(BENEFIT_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Valor (R$)</label><input type="number" step="0.01" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} className="input" placeholder="0,00" /></div>
                <div><label className="label">Operadora</label><input value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} className="input" /></div>
                <div><label className="label">Início</label><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} className="input" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={()=>setAddModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={()=>addMutation.mutate()} disabled={!form.employee_id||addMutation.isPending} className="btn-primary">
                {addMutation.isPending?<Loader2 className="w-4 h-4 animate-spin" />:<Gift className="w-4 h-4" />}Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
