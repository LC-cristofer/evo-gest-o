'use client';
// Admissões page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Mail, CheckCircle2, XCircle, Clock, Loader2, FileText } from 'lucide-react';
import { admissionAPI, unitAPI, api } from '@/lib/api';
import { formatDateSafe } from '@/utils/date';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_CFG: Record<string,{label:string,color:string}> = {
  PENDENTE:   { label:'Aguardando', color:'bg-amber-100 text-amber-700' },
  EM_ANALISE: { label:'Em análise', color:'bg-blue-100 text-blue-700' },
  APROVADO:   { label:'Aprovado',   color:'bg-emerald-100 text-emerald-700' },
  REJEITADO:  { label:'Rejeitado',  color:'bg-red-100 text-red-600' },
  EXPIRADO:   { label:'Expirado',   color:'bg-slate-100 text-slate-500' },
};

export default function AdmisoesPage() {
  const qc = useQueryClient();
  const [tab, setTab]         = useState('PENDENTE');
  const [newModal, setNewModal] = useState(false);
  const [reviewing, setReviewing] = useState<any>(null);
  const [action, setAction]   = useState<'APROVADO'|'REJEITADO'|null>(null);
  const [reason, setReason]   = useState('');

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admissions', tab],
    queryFn: () => admissionAPI.list(tab !== 'TODAS' ? { status: tab } : {}).then(r => r.data),
    refetchInterval: 30_000,
  });
  const { data: units     } = useQuery({ queryKey: ['units-list'],     queryFn: () => unitAPI.list().then(r => r.data) });
  const { data: positions } = useQuery({ queryKey: ['positions-list'], queryFn: () => api.get('/positions').then(r => r.data) });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const createMutation = useMutation({
    mutationFn: (d: any) => admissionAPI.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); setNewModal(false); reset(); toast.success('Processo criado!'); },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => admissionAPI.resend(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); toast.success('Link reenviado!'); },
  });

  const reviewMutation = useMutation({
    mutationFn: () => admissionAPI.review(reviewing.id, { action, rejection_reason: reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admissions'] }); setReviewing(null); setAction(null); setReason(''); toast.success(action === 'APROVADO' ? 'Admissão aprovada!' : 'Processo rejeitado.'); },
  });

  const TABS = ['PENDENTE','EM_ANALISE','APROVADO','REJEITADO','EXPIRADO','TODAS'];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-800">Admissões Digitais</h1><p className="text-slate-400 text-sm mt-0.5">{(list as any[]).length} processos</p></div>
        <button onClick={() => setNewModal(true)} className="btn-primary"><Plus className="w-4 h-4" />Novo processo</button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 pt-4 border-b border-slate-100 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition',
                tab===t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500')}>
              {STATUS_CFG[t]?.label || 'Todos'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {isLoading ? <div className="text-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" /></div>
          : (list as any[]).length === 0 ? <p className="text-sm text-slate-400 text-center py-12">Nenhum processo encontrado</p>
          : (
            <div className="space-y-3">
              {(list as any[]).map((proc: any) => (
                <div key={proc.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-200 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800">{proc.candidate_name}</p>
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_CFG[proc.status]?.color)}>{STATUS_CFG[proc.status]?.label || proc.status}</span>
                      </div>
                      <p className="text-sm text-slate-500">{proc.candidate_email}</p>
                      <p className="text-xs text-slate-400 mt-1">{proc.position_name && `${proc.position_name} · `}{proc.unit_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex gap-2">
                        {['PENDENTE','EXPIRADO','EM_ANALISE'].includes(proc.status) && (
                          <button onClick={() => resendMutation.mutate(proc.id)} className="text-xs border border-slate-200 px-2.5 py-1.5 rounded-lg hover:border-blue-200 text-slate-500 hover:text-blue-600 transition">Reenviar</button>
                        )}
                        {proc.status === 'EM_ANALISE' && (
                          <button onClick={() => setReviewing(proc)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition">Revisar</button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{formatDateSafe(proc.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal novo */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNewModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Novo processo de admissão</h2>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="label">Nome do candidato *</label><input {...register('candidate_name',{required:true})} className="input" placeholder="Nome completo" /></div>
                <div><label className="label">Email *</label><input {...register('candidate_email',{required:true})} type="email" className="input" /></div>
                <div><label className="label">Telefone</label><input {...register('candidate_phone')} className="input" /></div>
                <div><label className="label">Cargo</label><select {...register('position_id')} className="input bg-white"><option value="">Selecione</option>{((positions as any[])||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="label">Unidade</label><select {...register('unit_id')} className="input bg-white"><option value="">Selecione</option>{((units as any[])||[]).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <div><label className="label">Salário previsto</label><input {...register('salary')} type="number" step="0.01" className="input" /></div>
                <div><label className="label">Data admissão prevista</label><input {...register('hire_date_expected')} type="date" className="input" /></div>
                <div className="sm:col-span-2"><label className="label">Notas</label><textarea {...register('notes')} rows={2} className="input resize-none" /></div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">📧 Um link será enviado ao candidato (válido por 72h)</div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setNewModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending} className="btn-primary">
                  {(isSubmitting||createMutation.isPending) ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : <><Mail className="w-4 h-4" />Criar e enviar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal revisar */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setReviewing(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Revisar: {reviewing.candidate_name}</h2>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setAction('APROVADO')} className={clsx('flex-1 py-3 rounded-xl border-2 text-sm font-medium transition', action==='APROVADO' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500')}>✅ Aprovar</button>
              <button onClick={() => setAction('REJEITADO')} className={clsx('flex-1 py-3 rounded-xl border-2 text-sm font-medium transition', action==='REJEITADO' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500')}>❌ Rejeitar</button>
            </div>
            {action === 'REJEITADO' && <div className="mb-4"><label className="label">Motivo *</label><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="input resize-none" /></div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setReviewing(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => reviewMutation.mutate()} disabled={!action||(action==='REJEITADO'&&!reason)||reviewMutation.isPending}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50', action==='APROVADO'?'bg-emerald-600 hover:bg-emerald-500 text-white':'bg-red-600 hover:bg-red-500 text-white')}>
                {reviewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
