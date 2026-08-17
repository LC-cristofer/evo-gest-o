'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Loader2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { unitAPI } from '@/lib/api';

const I = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`input ${p.className || ''}`} />;
const FL = ({ label, children, req }: any) => (
  <div><label className="label">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>
);

export default function EditarUnidadePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ['unit', params.id],
    queryFn: () => unitAPI.get(params.id).then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    if (existing) reset({
      code: existing.code, name: existing.name,
      address: existing.address || '', city: existing.city || '',
      state: existing.state || '', zip_code: existing.zip_code || '',
      phone: existing.phone || '', email: existing.email || '',
      capacity: existing.capacity || '',
    });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (k !== 'code') clean[k] = (v === '' ? null : v);
      }
      return unitAPI.update(params.id, clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units-list'] });
      qc.invalidateQueries({ queryKey: ['units-full'] });
      qc.invalidateQueries({ queryKey: ['unit', params.id] });
      toast.success('Unidade atualizada!');
      router.push(`/unidades/${params.id}`);
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <Link href={`/unidades/${params.id}`} className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />{existing?.name || 'Unidade'}</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">Editar</span>
      </div>
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div>
          <h1 className="text-base font-semibold text-slate-800">Editar unidade</h1>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FL label="Código"><I {...register('code')} disabled className="bg-slate-50 text-slate-400" /></FL>
              <FL label="Nome" req className="sm:col-span-2"><I {...register('name', { required: true })} /></FL>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FL label="CEP"><I {...register('zip_code')} /></FL>
              <FL label="Endereço" className="sm:col-span-2"><I {...register('address')} /></FL>
              <FL label="Cidade"><I {...register('city')} /></FL>
              <FL label="UF"><I {...register('state')} maxLength={2} /></FL>
              <FL label="Telefone"><I {...register('phone')} /></FL>
              <FL label="Email"><I {...register('email')} type="email" /></FL>
              <FL label="Capacidade máxima"><I {...register('capacity')} type="number" min="1" /></FL>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
            <Link href={`/unidades/${params.id}`} className="btn-secondary">Cancelar</Link>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
              {(isSubmitting || mutation.isPending) ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><Save className="w-4 h-4" />Salvar alterações</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
