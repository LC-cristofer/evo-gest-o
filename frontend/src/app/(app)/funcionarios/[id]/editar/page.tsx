'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Loader2, Scan, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeAPI, unitAPI, api } from '@/lib/api';

type FormData = Record<string, any>;

const I = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`input ${p.className || ''}`} />;
const S = ({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className="input bg-white">{children}</select>;
const FL = ({ label, children, req, cls }: any) => (
  <div className={cls}>
    <label className="label">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);
const Sec = ({ t }: { t: string }) => (
  <div className="col-span-full mt-2"><p className="section-title">{t}</p></div>
);

export default function EditarFuncionarioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', params.id],
    queryFn:  () => employeeAPI.get(params.id).then(r => r.data),
  });
  const { data: units     } = useQuery({ queryKey: ['units-list'],     queryFn: () => unitAPI.list().then(r => r.data) });
  const { data: positions } = useQuery({ queryKey: ['positions-list'], queryFn: () => api.get('/positions').then(r => r.data) });
  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: () => api.get('/users').then(r => (r.data as any[]).filter((u: any) => u.role === 'SUPERVISOR')),
  });

  // Filtra VOLANTE das unidades
  const filteredUnits = ((units as any[]) || []).filter(
    (u: any) => !u.name?.toUpperCase().includes('VOLANTE')
  );

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (emp) {
      const d: Record<string, any> = { ...emp };
      // Limpar campos que não devem ser editados
      delete d.id; delete d.employee_code; delete d.created_at; delete d.created_by;
      delete d.photo_url; delete d.documents; delete d.benefits; delete d.recent_history;
      // Normalizar nulos para string vazia nos campos de texto
      for (const k of Object.keys(d)) {
        if (d[k] === null) d[k] = '';
      }
      reset(d);
    }
  }, [emp, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        // Ignorar campos protegidos
        if (['id','employee_code','cpf','created_at','created_by','photo_url',
             'documents','benefits','recent_history','position_name','unit_name',
             'unit_code','supervisor_name','supervisor_email'].includes(k)) continue;
        clean[k] = v === '' ? null : v;
      }
      return employeeAPI.update(params.id, clean);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', params.id] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário atualizado!');
      router.push(`/funcionarios/${params.id}`);
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
    </div>
  );

  const hasDisability = watch('has_disability');

  return (
    <div className="max-w-4xl page-enter">
      <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        <Link href={`/funcionarios/${params.id}`} className="hover:text-blue-600 flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />{emp?.full_name || 'Funcionário'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }} className="font-medium">Editar</span>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Editar: {emp?.full_name}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            CPF: {emp?.cpf} · Código: {emp?.employee_code}
          </p>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">

              <Sec t="Identificação" />
              <FL label="Nome completo" req cls="sm:col-span-2">
                <I {...register('full_name', { required: true })} />
              </FL>
              <FL label="Nome social"><I {...register('social_name')} /></FL>
              <FL label="CPF">
                <I value={emp?.cpf || ''} disabled className="opacity-50 cursor-not-allowed" />
              </FL>
              <FL label="RG"><I {...register('rg')} /></FL>
              <FL label="Órgão emissor (RG)"><I {...register('rg_issuer')} placeholder="SSP/PR" /></FL>
              <FL label="Data de nascimento" req><I {...register('birth_date', { required: true })} type="date" /></FL>
              <FL label="Gênero">
                <S {...register('gender')}>
                  <option value="">Selecione</option>
                  <option>Masculino</option><option>Feminino</option>
                  <option>Não binário</option><option>Prefiro não informar</option>
                </S>
              </FL>
              <FL label="Nacionalidade"><I {...register('nationality')} /></FL>
              <FL label="Naturalidade"><I {...register('place_of_birth')} /></FL>
              <FL label="Nome da mãe" cls="sm:col-span-2"><I {...register('mothers_name')} /></FL>

              <Sec t="Contato" />
              <FL label="Email"><I {...register('email')} type="email" /></FL>
              <FL label="Telefone"><I {...register('phone')} /></FL>
              <FL label="Telefone alternativo"><I {...register('phone_secondary')} /></FL>

              <Sec t="Endereço" />
              <FL label="Logradouro" cls="sm:col-span-2"><I {...register('address')} /></FL>
              <FL label="Número"><I {...register('address_number')} /></FL>
              <FL label="Complemento"><I {...register('address_comp')} /></FL>
              <FL label="Bairro"><I {...register('neighborhood')} /></FL>
              <FL label="CEP"><I {...register('zip_code')} maxLength={9} /></FL>
              <FL label="Cidade"><I {...register('city')} /></FL>
              <FL label="UF"><I {...register('state')} maxLength={2} /></FL>

              <Sec t="Dados Profissionais" />
              <FL label="Data de admissão" req><I {...register('hire_date', { required: true })} type="date" /></FL>
              <FL label="Tipo de contrato">
                <S {...register('contract_type')}>
                  <option value="CLT">CLT</option><option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option><option value="Temporário">Temporário</option>
                </S>
              </FL>
              <FL label="Cargo">
                <S {...register('position_id')}>
                  <option value="">Selecione...</option>
                  {((positions as any[]) || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </S>
              </FL>
              <FL label="Unidade">
                <S {...register('unit_id')}>
                  <option value="">Selecione...</option>
                  {filteredUnits.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </S>
              </FL>
              <FL label="Supervisor">
                <S {...register('supervisor_id')}>
                  <option value="">Sem supervisor</option>
                  {((supervisors as any[]) || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </S>
              </FL>
              <FL label="Salário (R$)"><I {...register('salary')} type="number" step="0.01" min="0" /></FL>
              <FL label="Jornada" cls="sm:col-span-2"><I {...register('work_schedule')} /></FL>

              <Sec t="Dados Trabalhistas" />
              <FL label="PIS/PASEP"><I {...register('pis_pasep')} /></FL>
              <FL label="Nº CTPS"><I {...register('ctps_number')} /></FL>
              <FL label="Série CTPS"><I {...register('ctps_series')} /></FL>

              <Sec t="Dados Bancários" />
              <FL label="Banco (código)"><I {...register('bank_code')} /></FL>
              <FL label="Agência"><I {...register('bank_agency')} /></FL>
              <FL label="Conta"><I {...register('bank_account')} /></FL>
              <FL label="Tipo de conta">
                <S {...register('bank_account_type')}>
                  <option value="">Selecione</option>
                  <option value="corrente">Corrente</option><option value="poupança">Poupança</option>
                </S>
              </FL>
              <FL label="Chave PIX" cls="sm:col-span-2"><I {...register('pix_key')} /></FL>

              <Sec t="Diversidade e Inclusão" />
              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" {...register('has_disability')} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Funcionário possui deficiência (PCD)
                  </span>
                </label>
              </div>
              {hasDisability && (
                <FL label="Tipo de deficiência" cls="sm:col-span-2">
                  <I {...register('disability_type')} />
                </FL>
              )}

              <Sec t="Observações" />
              <FL label="Notas" cls="sm:col-span-2">
                <textarea {...register('notes')} rows={3} className="input resize-none" />
              </FL>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'var(--bg-hover)', borderTop: '1px solid var(--border)' }}>
            <Link href={`/funcionarios/${params.id}`} className="btn-secondary">Cancelar</Link>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
              {(isSubmitting || mutation.isPending)
                ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                : <><Save className="w-4 h-4" />Salvar alterações</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
