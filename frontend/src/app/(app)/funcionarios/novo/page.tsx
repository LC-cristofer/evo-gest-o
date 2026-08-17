'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Loader2, Upload, Scan } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeAPI, unitAPI, api } from '@/lib/api';
import clsx from 'clsx';

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

export default function NovoFuncionarioPage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: () => unitAPI.list().then(r => r.data),
  });
  const { data: positions } = useQuery({
    queryKey: ['positions-list'],
    queryFn: () => api.get('/positions').then(r => r.data),
  });
  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: () => api.get('/users').then(r =>
      (r.data as any[]).filter((u: any) => u.role === 'SUPERVISOR')
    ),
  });

  // Filtra VOLANTE das unidades do formulário
  const filteredUnits = ((units as any[]) || []).filter(
    (u: any) => !u.name?.toUpperCase().includes('VOLANTE')
  );

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { contract_type: 'CLT', has_disability: false, status: 'ATIVO' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) clean[k] = v === '' ? null : v;
      return employeeAPI.create(clean);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário cadastrado com sucesso!');
      router.push(`/funcionarios/${res.data.id}`);
    },
  });

  // OCR — upload de documento para auto-preenchimento
  const handleOCRUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await api.post('/ocr/upload', 
          (() => { const fd = new FormData(); fd.append('file', file); fd.append('doc_type', 'auto'); return fd; })(),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const extracted = res.data?.extracted || {};
        if (extracted.full_name)  { setValue('full_name',  extracted.full_name);  toast.success('Nome extraído!'); }
        if (extracted.cpf)        { setValue('cpf',         extracted.cpf);        toast.success('CPF extraído!'); }
        if (extracted.rg)         { setValue('rg',          extracted.rg); }
        if (extracted.birth_date) { setValue('birth_date',  extracted.birth_date); toast.success('Data de nascimento extraída!'); }
        if (Object.keys(extracted).length === 0) toast('Nenhum dado encontrado no documento.', { icon: '⚠️' });
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Serviço OCR não disponível no momento.');
    } finally {
      setOcrLoading(false);
    }
  }, [setValue]);

  const SECTIONS = ['Identificação','Contato','Endereço','Profissional','Dados Trabalhistas','Bancário'];
  const hasDisability = watch('has_disability');

  return (
    <div className="max-w-4xl page-enter">
      <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        <Link href="/funcionarios" className="hover:text-blue-600 flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />Funcionários
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }} className="font-medium">Novo funcionário</span>
      </div>

      {/* OCR Banner */}
      <div className="card-warm p-4 mb-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <Scan className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Preenchimento automático via OCR
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Envie uma foto do RG ou CNH para preencher os dados automaticamente
          </p>
        </div>
        <label className={clsx('btn-secondary cursor-pointer text-xs', ocrLoading && 'opacity-50 pointer-events-none')}>
          {ocrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {ocrLoading ? 'Processando...' : 'Enviar documento'}
          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleOCRUpload} />
        </label>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Novo funcionário</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Preencha todos os campos do colaborador</p>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">

              <Sec t="Identificação" />
              <FL label="Nome completo" req cls="sm:col-span-2">
                <I {...register('full_name', { required: true })} placeholder="Nome completo" />
              </FL>
              <FL label="Nome social"><I {...register('social_name')} placeholder="Se diferente do registrado" /></FL>
              <FL label="CPF" req><I {...register('cpf', { required: true })} placeholder="000.000.000-00" /></FL>
              <FL label="RG"><I {...register('rg')} /></FL>
              <FL label="Órgão emissor (RG)"><I {...register('rg_issuer')} placeholder="SSP/PR" /></FL>
              <FL label="Data de nascimento" req><I {...register('birth_date', { required: true })} type="date" max={new Date().toISOString().split('T')[0]} /></FL>
              <FL label="Gênero">
                <S {...register('gender')}>
                  <option value="">Selecione</option>
                  <option>Masculino</option><option>Feminino</option>
                  <option>Não binário</option><option>Prefiro não informar</option>
                </S>
              </FL>
              <FL label="Nacionalidade"><I {...register('nationality')} placeholder="Brasileira" /></FL>
              <FL label="Naturalidade (cidade/estado)"><I {...register('place_of_birth')} placeholder="Araucária/PR" /></FL>
              <FL label="Nome da mãe" cls="sm:col-span-2"><I {...register('mothers_name')} /></FL>

              <Sec t="Contato" />
              <FL label="Email"><I {...register('email')} type="email" placeholder="email@exemplo.com" /></FL>
              <FL label="Telefone"><I {...register('phone')} placeholder="(00) 00000-0000" /></FL>
              <FL label="Telefone alternativo"><I {...register('phone_secondary')} placeholder="(00) 00000-0000" /></FL>

              <Sec t="Endereço" />
              <FL label="Logradouro" cls="sm:col-span-2"><I {...register('address')} placeholder="Rua, Avenida..." /></FL>
              <FL label="Número"><I {...register('address_number')} /></FL>
              <FL label="Complemento"><I {...register('address_comp')} placeholder="Apto, Bloco..." /></FL>
              <FL label="Bairro"><I {...register('neighborhood')} /></FL>
              <FL label="CEP"><I {...register('zip_code')} placeholder="00000-000" maxLength={9} /></FL>
              <FL label="Cidade"><I {...register('city')} /></FL>
              <FL label="UF"><I {...register('state')} placeholder="PR" maxLength={2} /></FL>

              <Sec t="Dados Profissionais" />
              <FL label="Data de admissão" req><I {...register('hire_date', { required: true })} type="date" /></FL>
              <FL label="Tipo de contrato">
                <S {...register('contract_type')}>
                  <option value="CLT">CLT</option><option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option><option value="Temporário">Temporário</option>
                </S>
              </FL>
              <FL label="Cargo" req>
                <S {...register('position_id', { required: true })}>
                  <option value="">Selecione um cargo...</option>
                  {((positions as any[]) || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </S>
              </FL>
              <FL label="Unidade" req>
                <S {...register('unit_id', { required: true })}>
                  <option value="">Selecione a unidade...</option>
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
              <FL label="Salário (R$)"><I {...register('salary')} type="number" step="0.01" min="0" placeholder="0,00" /></FL>
              <FL label="Jornada semanal" cls="sm:col-span-2">
                <I {...register('work_schedule')} placeholder="Ex: 44h semanais — Seg a Sex, 07:30–11:30 / 13:00–17:00" />
              </FL>

              <Sec t="Dados Trabalhistas" />
              <FL label="PIS/PASEP"><I {...register('pis_pasep')} /></FL>
              <FL label="Nº CTPS"><I {...register('ctps_number')} /></FL>
              <FL label="Série CTPS"><I {...register('ctps_series')} /></FL>

              <Sec t="Dados Bancários" />
              <FL label="Banco (código)"><I {...register('bank_code')} placeholder="104" /></FL>
              <FL label="Agência"><I {...register('bank_agency')} placeholder="0000" /></FL>
              <FL label="Conta"><I {...register('bank_account')} placeholder="00000-0" /></FL>
              <FL label="Tipo de conta">
                <S {...register('bank_account_type')}>
                  <option value="">Selecione</option>
                  <option value="corrente">Corrente</option><option value="poupança">Poupança</option>
                </S>
              </FL>
              <FL label="Chave PIX" cls="sm:col-span-2">
                <I {...register('pix_key')} placeholder="CPF, email, telefone ou chave aleatória" />
              </FL>

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
                  <I {...register('disability_type')} placeholder="Ex: TEA, Deficiência auditiva, Visual..." />
                </FL>
              )}

              <Sec t="Observações Internas" />
              <FL label="Notas" cls="sm:col-span-2">
                <textarea {...register('notes')} rows={3} className="input resize-none"
                  placeholder="Informações adicionais de uso interno..." />
              </FL>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'var(--bg-hover)', borderTop: '1px solid var(--border)' }}>
            <Link href="/funcionarios" className="btn-secondary">Cancelar</Link>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
              {(isSubmitting || mutation.isPending)
                ? <><Loader2 className="w-4 h-4 animate-spin" />Cadastrando...</>
                : <><Save className="w-4 h-4" />Cadastrar funcionário</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
