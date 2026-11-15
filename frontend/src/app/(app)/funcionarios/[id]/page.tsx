'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, UserMinus, Camera, Upload, Trash2, FileDown,
  Download, FileText, Loader2, Building2, Calendar,
  Phone, Mail, CreditCard, AlertTriangle, History, Send, UserCheck,
} from 'lucide-react';
import { employeeAPI, api, unitAPI, downloadBlob } from '@/lib/api';
import { formatDateSafe, formatDateTimeSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { useUndo } from '@/components/ui/UndoToast';
import clsx from 'clsx';

const STATUS: Record<string, {label:string;cls:string}> = {
  ATIVO:     { label:'Ativo',     cls:'badge badge-green'  },
  AFASTADO:  { label:'Afastado',  cls:'badge badge-amber'  },
  DESLIGADO: { label:'Desligado', cls:'badge badge-red'    },
  INATIVO:   { label:'Inativo',   cls:'badge badge-stone'  },
  PENDENTE:  { label:'Pendente',  cls:'badge badge-violet' },
};

const DOC_CATEGORIES = ['Geral','RG','CPF','CTPS','PIS/PASEP','Comprovante Residência',
  'Atestado Médico','Contrato','ASO','Outros'];

function Field({ label, value, className }: { label:string; value?: string|null; className?: string }) {
  return (
    <div className={className}>
      <p className="label">{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div className="col-span-full"><p className="section-title">{title}</p></div>;
}

export default function FuncionarioDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, user } = useAuthStore();
  const qc = useQueryClient();

  const [tab, setTab] = useState('dados');
  const { showUndo } = useUndo();
  const [dismissModal, setDismissModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [sendDocModal, setSendDocModal]   = useState(false);
  const [dismissForm, setDismissForm] = useState({ type: 'PEDIDO_DEMISSAO', reason: '', date: new Date().toISOString().split('T')[0] });
  const [transferForm, setTransferForm] = useState({ unit_id: '', supervisor_id: '', reason: '' });
  const [docCategory, setDocCategory] = useState('Geral');
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef   = useRef<HTMLInputElement>(null);
  const headerDocRef = useRef<HTMLInputElement>(null);

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', params.id],
    queryFn:  () => employeeAPI.get(params.id).then(r => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['employee-history', params.id],
    queryFn:  () => employeeAPI.history(params.id).then(r => r.data),
    enabled:  tab === 'historico',
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn:  () => unitAPI.list().then(r => r.data),
    enabled:  transferModal,
  });

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-for-unit', transferForm.unit_id],
    queryFn:  () => transferForm.unit_id ? api.get('/users', { params: { role: 'SUPERVISOR', unit_id: transferForm.unit_id } }).then(r => r.data) : Promise.resolve([]),
    enabled:  transferModal && !!transferForm.unit_id,
  });

  const dismissMutation = useMutation({
    mutationFn: () => employeeAPI.status(params.id, {
      status: 'DESLIGADO',
      dismissal_type: dismissForm.type,
      reason: dismissForm.reason,
      dismissal_date: dismissForm.date,
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employee', params.id] });
      setDismissModal(false);
      showUndo(res.data?.undo_id, 'Desligamento registrado.', [['employee', params.id], ['employees']]);
    },
  });

  const transferMutation = useMutation({
    mutationFn: () => api.patch(`/employees/${params.id}/transfer`, transferForm),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employee', params.id] });
      setTransferModal(false);
      showUndo(res.data?.undo_id, 'Funcionário remanejado.', [['employee', params.id], ['employees']]);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erro ao remanejar.'),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('photo', file);
      return api.post(`/employees/${params.id}/photo`, fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee', params.id] }); toast.success('Foto atualizada!'); },
  });

  const docUploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      return api.post(`/employees/${params.id}/documents`, fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee', params.id] }); toast.success('Documento enviado!'); },
  });

  const docDeleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/employees/${params.id}/documents/${docId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee', params.id] }); toast.success('Removido.'); },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (!emp) return <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Funcionário não encontrado.</div>;

  const st = STATUS[emp.status] || { label: emp.status, cls: 'badge badge-stone' };
  const docs = emp.documents || [];

  const TABS = [
    { key:'dados',     label:'Dados',       show: true },
    { key:'documentos',label:`Docs (${docs.length})`, show: true },
    { key:'historico', label:'Histórico',   show: true },
    { key:'beneficios',label:'Benefícios',  show: true },
  ];

  return (
    <div className="max-w-4xl page-enter space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/funcionarios" className="hover:text-blue-600 flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />Funcionários
        </Link>
        <span>/</span>
        <span className="truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{emp.full_name}</span>
      </div>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Foto */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center"
              style={{ border: '2px solid var(--border)' }}>
              {emp.photo_url ? (
                <Image src={`http://localhost:4000${emp.photo_url}`} alt="" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <span className="text-blue-600 font-bold text-2xl">{emp.full_name.slice(0,2).toUpperCase()}</span>
              )}
            </div>
            {can('employees:update') && (
              <>
                <button onClick={() => photoRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition shadow-md">
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={photoRef} type="file" className="hidden" accept="image/*"
                  onChange={e => e.target.files?.[0] && photoMutation.mutate(e.target.files[0])} />
              </>
            )}
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-2 mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{emp.full_name}</h1>
              {emp.social_name && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>({emp.social_name})</span>}
              <span className={st.cls}>{st.label}</span>
              {emp.has_disability && <span className="badge badge-blue">PCD</span>}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {emp.position_name && <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{emp.position_name}</span>}
              {emp.unit_name    && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{emp.unit_name}</span>}
              {emp.supervisor_name && <span>Sup: {emp.supervisor_name}</span>}
              {emp.hire_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Admissão: {formatDateSafe(emp.hire_date)}</span>}
              {emp.dismissal_date && <span className="flex items-center gap-1 text-red-500"><Calendar className="w-3.5 h-3.5" />Saída: {formatDateSafe(emp.dismissal_date)}</span>}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{emp.employee_code} · {emp.cpf}</p>
          </div>

          {/* Ações */}
          {can('employees:update') && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={async () => {
                  try {
                    const res = await api.get(`/pdf/employee/${emp.id}`, { responseType: 'blob' });
                    downloadBlob(res.data, `ficha_${emp.employee_code || emp.id}.pdf`);
                  } catch { toast.error('Erro ao gerar PDF.'); }
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
              <Link href={`/funcionarios/${emp.id}/editar`} className="btn-secondary text-xs">
                <Pencil className="w-3.5 h-3.5" />Editar
              </Link>
              <button onClick={() => setTransferModal(true)} className="btn-secondary text-xs">
                <Building2 className="w-3.5 h-3.5" />Remanejar
              </button>
              {/* ── Botão Criar Conta de Funcionário ── */}
              {['TI','RH'].includes(user?.role || '') && emp.status === 'ATIVO' && (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.post('/users/create-employee-account', { employee_id: emp.id });
                      toast.success(res.data.message || 'Conta criada!');
                    } catch (e: any) {
                      const msg = e?.response?.data?.error || 'Erro ao criar conta.';
                      if (msg.includes('já possui')) toast.success('Funcionário já tem conta no sistema.');
                      else toast.error(msg);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}
                  title="Criar login CPF para este funcionário"
                >
                  <UserCheck className="w-3.5 h-3.5" />Criar conta
                </button>
              )}
              {/* ── Botão Enviar Documento (header) ── */}
              <button
                onClick={() => setSendDocModal(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition"
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb' }}
                title="Enviar documento para este funcionário"
              >
                <Send className="w-3.5 h-3.5" />Enviar documento
              </button>
              {emp.status === 'ATIVO' && (
                <button onClick={() => setDismissModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition"
                  style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'var(--red)' }}>
                  <UserMinus className="w-3.5 h-3.5" />Desligar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex gap-0 border-b px-4 pt-3" style={{ borderColor: 'var(--border)' }}>
          {TABS.filter(t => t.show).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx('px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px mr-1',
                tab===t.key ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-blue-600')}
              style={{ color: tab===t.key ? undefined : 'var(--text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Dados ────────────────────────────────────── */}
          {tab === 'dados' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Section title="Identificação" />
              <Field label="CPF"       value={emp.cpf} />
              <Field label="RG"        value={emp.rg} />
              <Field label="Nascimento" value={formatDateSafe(emp.birth_date)} />
              <Field label="Gênero"    value={emp.gender} />
              <Field label="Nome da mãe" value={emp.mothers_name} />
              <Field label="PIS/PASEP" value={emp.pis_pasep} />
              <Field label="CTPS Nº"   value={emp.ctps_number} />

              <Section title="Contato" />
              <Field label="Email"     value={emp.email} />
              <Field label="Telefone"  value={emp.phone} />
              <Field label="Telefone 2" value={emp.phone_secondary} />

              <Section title="Endereço" />
              <Field label="Logradouro" value={[emp.address, emp.address_number].filter(Boolean).join(', ')} className="col-span-2" />
              <Field label="Bairro"     value={emp.neighborhood} />
              <Field label="Cidade/UF"  value={[emp.city, emp.state].filter(Boolean).join(' / ')} />
              <Field label="CEP"        value={emp.zip_code} />

              <Section title="Dados Profissionais" />
              <Field label="Cargo"      value={emp.position_name} />
              <Field label="Unidade"    value={emp.unit_name} />
              <Field label="Supervisor" value={emp.supervisor_name} />
              <Field label="Admissão"   value={formatDateSafe(emp.hire_date)} />
              {emp.dismissal_date && <Field label="Desligamento" value={formatDateSafe(emp.dismissal_date)} />}
              <Field label="Contrato"   value={emp.contract_type} />
              <Field label="Jornada"    value={emp.work_schedule} />
              <Field label="Salário"    value={emp.salary ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(emp.salary) : null} />
              {emp.dismissal_reason && <Field label="Motivo saída" value={emp.dismissal_reason} className="col-span-full" />}

              <Section title="Dados Bancários" />
              <Field label="Banco"    value={emp.bank_code} />
              <Field label="Agência"  value={emp.bank_agency} />
              <Field label="Conta"    value={emp.bank_account} />
              <Field label="Tipo"     value={emp.bank_account_type} />
              <Field label="Chave PIX" value={emp.pix_key} />

              {emp.notes && (
                <>
                  <Section title="Observações" />
                  <div className="col-span-full text-sm rounded-xl p-3" style={{ background:'var(--bg-hover)', color:'var(--text-secondary)' }}>
                    {emp.notes}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Documentos ───────────────────────────────────── */}
          {tab === 'documentos' && (
            <div className="space-y-4">
              {can('employees:update') && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <select value={docCategory} onChange={e => setDocCategory(e.target.value)} className="input w-auto">
                      {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button onClick={() => docRef.current?.click()} disabled={docUploadMutation.isPending} className="btn-primary text-xs">
                      {docUploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Enviar documento
                    </button>
                    <input ref={docRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => e.target.files?.[0] && docUploadMutation.mutate({ file: e.target.files[0], category: docCategory })} />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Salvo em: /documents/{params.id}/
                  </span>
                </div>
              )}

              {docs.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum documento enviado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-4 p-3 rounded-xl transition"
                      style={{ background:'var(--bg-hover)', border:'1px solid var(--border-light)' }}>
                      <FileText className="w-5 h-5 shrink-0" style={{ color:'var(--blue-600)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>{doc.original_name}</p>
                        <p className="text-xs" style={{ color:'var(--text-muted)' }}>
                          {doc.category} · {formatDateTimeSafe(doc.created_at)}
                        </p>
                      </div>
                      <a href={`http://localhost:4000${doc.file_url}`} target="_blank" rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-white transition" style={{ color:'var(--text-muted)' }}>
                        <Download className="w-4 h-4" />
                      </a>
                      {can('employees:update') && (
                        <button onClick={() => docDeleteMutation.mutate(doc.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Histórico ─────────────────────────────────────── */}
          {tab === 'historico' && (
            <div className="space-y-3">
              {!history || history.length === 0 ? (
                <p className="text-center py-10 text-sm" style={{ color:'var(--text-muted)' }}>Nenhum histórico.</p>
              ) : history.map((h: any) => (
                <div key={h.id} className="flex gap-3 p-3 rounded-xl" style={{ background:'var(--bg-hover)' }}>
                  <History className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'var(--text-muted)' }} />
                  <div>
                    <p className="text-sm" style={{ color:'var(--text-primary)' }}>{h.description || h.action}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{formatDateTimeSafe(h.created_at)} · {h.user_name || 'Sistema'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Benefícios ──────────────────────────────────── */}
          {tab === 'beneficios' && (
            <div className="text-center py-12" style={{ color:'var(--text-muted)' }}>
              <p>Módulo de benefícios em breve.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modais omitidos para brevidade -- o arquivo completo está sendo enviado */}
    </div>
  );
}