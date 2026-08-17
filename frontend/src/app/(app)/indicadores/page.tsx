'use client';
// indicadores/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingDown, Loader2, Download, FileText } from 'lucide-react';
import { api, unitAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

import { useUndo } from '@/components/ui/UndoToast';

export default function IndicadoresPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { showUndo } = useUndo();
  const [unitId, setUnitId] = useState(user?.unit_id || '');
  const [month, setMonth]   = useState(() => new Date().toISOString().slice(0,7));
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ employee_id:'', record_date:new Date().toISOString().split('T')[0], type:'FALTA', minutes_late:0, justification:'', has_medical_cert:false });

  const { data: units } = useQuery({ queryKey:['units-list'], queryFn:()=>unitAPI.list().then(r=>r.data), enabled: user?.role!=='SUPERVISOR' });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['attendance-summary', unitId, month],
    queryFn: () => unitId ? api.get(`/attendance/unit/${unitId}/summary`, { params:{month} }).then(r=>r.data) : Promise.resolve([]),
    enabled: !!unitId,
  });
  const { data: emps = [] } = useQuery({
    queryKey: ['employees-simple', unitId],
    queryFn: () => api.get('/employees', { params:{ unit_id:unitId||undefined, status:'ATIVO', limit:50 } }).then(r=>r.data.data),
    enabled: modal && !!unitId,
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/attendance', form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['attendance-summary']}); setModal(false); },
  });

  const totals = (rows as any[]).reduce((a:any, r:any) => ({
    absences:    a.absences    + parseInt(r.absences||0),
    late_arrivals: a.late_arrivals + parseInt(r.late_arrivals||0),
  }), { absences:0, late_arrivals:0 });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-800">Indicadores de Presença</h1></div>
        <button onClick={() => setModal(true)} disabled={!unitId} className="btn-primary"><Plus className="w-4 h-4" />Lançar ocorrência</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        {user?.role !== 'SUPERVISOR' && (
          <select value={unitId} onChange={e=>setUnitId(e.target.value)} className="input w-auto flex-1">
            <option value="">Selecione a unidade</option>
            {(units as any[]).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="input w-auto" />
      </div>

      {unitId && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500"><TrendingDown className="w-4 h-4 text-white" /></div>
            <div><p className="text-xs text-slate-400">Faltas</p><p className="text-2xl font-bold text-slate-800">{totals.absences}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500"><TrendingDown className="w-4 h-4 text-white" /></div>
            <div><p className="text-xs text-slate-400">Atrasos</p><p className="text-2xl font-bold text-slate-800">{totals.late_arrivals}</p></div>
          </div>
        </div>
      )}

      {unitId && (
        <div className="card overflow-hidden">
          {isLoading ? <div className="p-12 text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" /></div>
          : (rows as any[]).length === 0 ? <p className="text-sm text-slate-400 text-center py-10">Sem ocorrências no período</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Funcionário</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-red-400 uppercase">Faltas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-400 uppercase">Justif.</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-pink-400 uppercase">Atestado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-amber-400 uppercase">Atrasos</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Min.</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(rows as any[]).map((r:any) => (
                    <tr key={r.id || r.employee_code} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3"><p className="font-medium text-slate-700">{r.full_name}</p><p className="text-xs text-slate-400">{r.employee_code}</p></td>
                      <td className="px-4 py-3 text-center"><span className={clsx('font-semibold', parseInt(r.absences||0)>0?'text-red-600':'text-slate-300')}>{r.absences||0}</span></td>
                      <td className="px-4 py-3 text-center"><span className={clsx('font-semibold', parseInt(r.justified||0)>0?'text-blue-600':'text-slate-300')}>{r.justified||0}</span></td>
                      <td className="px-4 py-3 text-center"><span className={clsx('font-semibold', parseInt(r.medical_certs||0)>0?'text-pink-600':'text-slate-300')}>{r.medical_certs||0}</span></td>
                      <td className="px-4 py-3 text-center"><span className={clsx('font-semibold', parseInt(r.late_arrivals||0)>0?'text-amber-600':'text-slate-300')}>{r.late_arrivals||0}</span></td>
                      <td className="px-4 py-3 text-center text-slate-500">{parseInt(r.total_minutes_late||0)>0?`${r.total_minutes_late}min`:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Lançar ocorrência</h2>
            <div className="space-y-4">
              <div><label className="label">Funcionário *</label>
                <select value={form.employee_id} onChange={e=>setForm(f=>({...f,employee_id:e.target.value}))} className="input bg-white">
                  <option value="">Selecione</option>
                  {(emps as any[]).map((e:any)=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div><label className="label">Data *</label><input type="date" value={form.record_date} onChange={e=>setForm(f=>({...f,record_date:e.target.value}))} className="input" /></div>
              <div><label className="label">Tipo *</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="input bg-white">
                  <option value="FALTA">Falta</option>
                  <option value="ATRASO">Atraso</option>
                  <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                  <option value="MEIO_PERIODO">Meio Período</option>
                </select>
              </div>
              {form.type === 'ATRASO' && <div><label className="label">Minutos de atraso</label><input type="number" min="0" value={form.minutes_late} onChange={e=>setForm(f=>({...f,minutes_late:parseInt(e.target.value)||0}))} className="input" /></div>}
              <div><label className="label">Justificativa</label><textarea value={form.justification} onChange={e=>setForm(f=>({...f,justification:e.target.value}))} rows={2} className="input resize-none" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cert" checked={form.has_medical_cert} onChange={e=>setForm(f=>({...f,has_medical_cert:e.target.checked}))} className="w-4 h-4 rounded" />
                <label htmlFor="cert" className="text-sm text-slate-700 cursor-pointer">Possui atestado médico</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={()=>setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={()=>addMutation.mutate()} disabled={!form.employee_id||addMutation.isPending} className="btn-primary">
                {addMutation.isPending?<Loader2 className="w-4 h-4 animate-spin" />:null}Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
