'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Power, KeyRound, Loader2, Check } from 'lucide-react';
import { api, unitAPI } from '@/lib/api';
import { formatDateTimeSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  TI:         { label: 'TI',         color: 'bg-violet-100 text-violet-700' },
  DIRETORIA:  { label: 'Diretoria',  color: 'bg-blue-100 text-blue-700' },
  RH:         { label: 'RH',         color: 'bg-emerald-100 text-emerald-700' },
  SUPERVISOR: { label: 'Supervisor', color: 'bg-amber-100 text-amber-700' },
};

export default function ConfiguracoesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null);
  const [target, setTarget]   = useState<any>(null);
  const [pwError, setPwError] = useState('');

  if (user?.role !== 'TI') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Acesso restrito ao TI.</div>;
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => api.get('/users').then(r => r.data),
  });
  const { data: units = [] } = useQuery({
    queryKey: ['units-list'],
    queryFn:  () => unitAPI.list().then(r => r.data),
  });

  const EMPTY = { name:'', email:'', role:'RH', unit_id:'', password:'', confirmPassword:'' };
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm({ defaultValues: EMPTY });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.password !== data.confirmPassword) { setPwError('As senhas não coincidem.'); throw new Error('pw'); }
      setPwError('');
      return api.post('/users', { name:data.name, email:data.email, role:data.role, unit_id:data.unit_id||null, password:data.password });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users-list'] }); setModal(null); reset(EMPTY); toast.success('Usuário criado!'); },
    onError: (e: any) => { if (e.message !== 'pw') toast.error('Erro ao criar usuário.'); },
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => api.put(`/users/${target.id}`, { name:data.name, email:data.email, role:data.role, unit_id:data.unit_id||null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users-list'] }); setModal(null); toast.success('Atualizado!'); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey:['users-list'] }),
  });

  const resetPwMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`),
    onSuccess: (res: any) => toast.success(`Senha temporária: ${res.data.tempPassword}`, { duration: 10000 }),
  });

  const openEdit = (u: any) => {
    setTarget(u);
    reset({ name:u.name, email:u.email, role:u.role, unit_id:u.unit_id||'', password:'', confirmPassword:'' });
    setModal('edit');
  };

  const openCreate = () => { setTarget(null); reset(EMPTY); setPwError(''); setModal('create'); };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-400 text-sm mt-0.5">Gestão de usuários do sistema</p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Usuários ({(users as any[]).length})</h2>
          <button onClick={openCreate} className="btn-primary text-xs py-1.5"><Plus className="w-3.5 h-3.5" />Novo usuário</button>
        </div>

        {isLoading ? <div className="p-12 text-center text-slate-400">Carregando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Perfil</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Último acesso</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(users as any[]).map((u: any) => {
                  const rc = ROLE_LABELS[u.role] || { label:u.role, color:'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={u.id} className={clsx('hover:bg-slate-50/50 transition group', !u.is_active && 'opacity-50')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3"><span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', rc.color)}>{rc.label}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
                        {u.last_login ? formatDateTimeSafe(u.last_login) : 'Nunca'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', u.is_active?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500')}>
                          {u.is_active?'Ativo':'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={()=>openEdit(u)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={()=>toggleMutation.mutate(u.id)} disabled={u.id===user?.id} className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition disabled:opacity-30" title="Ativar/Desativar"><Power className="w-3.5 h-3.5" /></button>
                          <button onClick={()=>resetPwMutation.mutate(u.id)} className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition" title="Resetar senha"><KeyRound className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">{modal==='create'?'Novo usuário':'Editar usuário'}</h2>
            <form onSubmit={handleSubmit(d => modal==='create' ? createMutation.mutate(d) : editMutation.mutate(d))} className="space-y-4">
              <div><label className="label">Nome *</label><input {...register('name',{required:true})} className="input" /></div>
              <div><label className="label">Email *</label><input {...register('email',{required:true})} type="email" className="input" /></div>
              <div><label className="label">Perfil *</label>
                <select {...register('role')} className="input bg-white">
                  {Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {watch('role')==='SUPERVISOR' && (
                <div><label className="label">Unidade</label>
                  <select {...register('unit_id')} className="input bg-white">
                    <option value="">Nenhuma</option>
                    {(units as any[]).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              {modal==='create' && (
                <>
                  <div><label className="label">Senha *</label><input {...register('password',{required:true})} type="password" className="input" placeholder="Mínimo 8 caracteres" /></div>
                  <div><label className="label">Confirmar senha *</label><input {...register('confirmPassword',{required:true})} type="password" className="input" /></div>
                  {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setModal(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={isSubmitting||createMutation.isPending||editMutation.isPending} className="btn-primary">
                  {(isSubmitting||createMutation.isPending||editMutation.isPending)?<Loader2 className="w-4 h-4 animate-spin" />:<Check className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
