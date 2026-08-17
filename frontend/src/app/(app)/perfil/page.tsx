'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { KeyRound, Loader2, Eye, EyeOff, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const ROLE_LABELS: Record<string, string> = {
  TI: 'TI', DIRETORIA: 'Diretoria', RH: 'RH', SUPERVISOR: 'Supervisor',
};

export default function PerfilPage() {
  const { user } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string;
  }>();

  const changePwMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.newPassword !== data.confirmPassword) throw new Error('As senhas não coincidem.');
      return api.post('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
    },
    onSuccess: () => { toast.success('Senha alterada com sucesso!'); reset(); },
    onError: (err: any) => toast.error(err.message || 'Erro ao alterar senha.'),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Meu perfil</h1>
        <p className="text-slate-400 text-sm mt-0.5">Informações da sua conta</p>
      </div>

      {/* Info card */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user?.name.slice(0,2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800">{user?.name}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {ROLE_LABELS[user?.role || ''] || user?.role}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Alterar senha</h2>
        </div>
        <form onSubmit={handleSubmit(d => changePwMutation.mutate(d))} className="p-6 space-y-4">
          {[
            { label: 'Senha atual', name: 'currentPassword', show: showCurrent, setShow: setShowCurrent },
            { label: 'Nova senha',  name: 'newPassword',     show: showNew,     setShow: setShowNew },
            { label: 'Confirmar nova senha', name: 'confirmPassword', show: showNew, setShow: setShowNew },
          ].map(({ label, name, show, setShow }) => (
            <div key={name}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  {...register(name as any, { required: true })}
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting || changePwMutation.isPending} className="btn-primary">
              {(isSubmitting || changePwMutation.isPending)
                ? <><Loader2 className="w-4 h-4 animate-spin" />Alterando...</>
                : <><Check className="w-4 h-4" />Alterar senha</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
