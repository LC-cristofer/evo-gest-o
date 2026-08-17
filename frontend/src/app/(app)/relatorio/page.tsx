'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  CheckCircle2, Save, Send, ChevronLeft, ChevronRight,
  Plus, Trash2, Users, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const GENERAL_FIELDS = [
  { key: 'content',    label: 'Resumo das atividades do mês',  placeholder: 'Descreva as principais atividades realizadas no período...' },
  { key: 'highlights', label: 'Destaques e conquistas',        placeholder: 'O que de mais importante aconteceu?' },
  { key: 'challenges', label: 'Dificuldades e desafios',       placeholder: 'Quais foram os principais desafios enfrentados?' },
  { key: 'goals_next', label: 'Objetivos para o próximo mês',  placeholder: 'O que pretende focar no mês seguinte?' },
];

const BLANK_STUDENT  = () => ({ iniciais:'', serie:'', necessidade:'', supervisor:'', unidade:'' });
const BLANK_ACTIVITY = () => ({ iniciais:'', descricao:'' });

function isPAE(positionName?: string) {
  if (!positionName) return false;
  const l = positionName.toLowerCase();
  return l.includes('apoio') || l.includes('pae') || l.includes('apoio escolar');
}

function StudentRow({ student, idx, onChange, onRemove }: any) {
  const cols = [
    { key:'iniciais',    placeholder:'Ex: J.M.L', cls:'w-24' },
    { key:'serie',       placeholder:'3º ano',    cls:'w-24' },
    { key:'necessidade', placeholder:'TOD',        cls:'flex-1' },
    { key:'supervisor',  placeholder:'Nome',       cls:'flex-1' },
    { key:'unidade',     placeholder:'CMEI...',    cls:'flex-1' },
  ];
  return (
    <div className="flex items-center gap-2 py-2 border-b" style={{ borderColor:'var(--border)' }}>
      <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color:'var(--text-muted)' }}>{idx+1}</span>
      {cols.map(c => (
        <div key={c.key} className={`${c.cls} shrink-0`}>
          <input value={student[c.key]||''} onChange={e=>onChange(idx,c.key,e.target.value)}
            placeholder={c.placeholder} className="input text-xs py-1.5 px-2 w-full" />
        </div>
      ))}
      <button onClick={()=>onRemove(idx)} className="p-1 rounded hover:bg-red-50 transition shrink-0">
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

function ActivityRow({ activity, idx, onChange, onRemove }: any) {
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background:'#eff6ff', color:'#2563eb' }}>{idx+1}</span>
          <input value={activity.iniciais||''} onChange={e=>onChange(idx,'iniciais',e.target.value)}
            placeholder="Iniciais (Ex: J.M.L)" className="input text-sm py-1.5 px-2 w-44" />
        </div>
        <button onClick={()=>onRemove(idx)} className="p-1 rounded hover:bg-red-50 transition">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
      <textarea rows={4} value={activity.descricao||''} onChange={e=>onChange(idx,'descricao',e.target.value)}
        placeholder="Descreva as atividades desenvolvidas com este aluno no mês, progressos, estratégias utilizadas..."
        className="input resize-none text-sm w-full" />
    </div>
  );
}

export default function RelatorioPage() {
  const qc  = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [form, setForm]   = useState<Record<string,string>>({ content:'', highlights:'', challenges:'', goals_next:'' });
  const [students,   setStudents]   = useState([BLANK_STUDENT()]);
  const [activities, setActivities] = useState([BLANK_ACTIVITY()]);

  const { data: me } = useQuery({ queryKey:['portal-me'], queryFn:()=>api.get('/portal/me').then(r=>r.data), staleTime:Infinity });
  const userIsPAE = isPAE(me?.position_name);
  const formType  = userIsPAE ? 'PAE' : 'GERAL';

  const { data: report, isLoading } = useQuery({
    queryKey: ['relatorio', year, month],
    queryFn:  () => api.get(`/relatorio/${year}/${month}`).then(r=>r.data),
  });
  const { data: list = [] } = useQuery({
    queryKey: ['relatorio-list'],
    queryFn:  () => api.get('/relatorio/list/me').then(r=>r.data),
  });

  useEffect(() => {
    if (!report) {
      setForm({ content:'', highlights:'', challenges:'', goals_next:'' });
      setStudents([BLANK_STUDENT()]); setActivities([BLANK_ACTIVITY()]); return;
    }
    setForm({ content:report.content||'', highlights:report.highlights||'',
      challenges:report.challenges||'', goals_next:report.goals_next||'' });
    if (report.form_data) {
      if (report.form_data.students)   setStudents(report.form_data.students);
      if (report.form_data.activities) setActivities(report.form_data.activities);
    }
  }, [report]);

  const isSubmitted    = report?.status === 'ENVIADO';
  const curYear        = now.getFullYear();
  const curMonth       = now.getMonth()+1;
  const isCurrentMonth = year===curYear && month===curMonth;
  const isPrevMonth    = (year===curYear && month===curMonth-1) || (curMonth===1 && year===curYear-1 && month===12);
  const canEdit        = (isCurrentMonth||isPrevMonth) && !isSubmitted;

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) => {
      const payload: any = { year, month, form_type:formType, submit };
      if (formType==='PAE') {
        payload.form_data = { students, activities };
        payload.content   = activities.map((a:any)=>`${a.iniciais}: ${a.descricao}`).join('\n\n');
      } else { Object.assign(payload, form); }
      return api.post('/relatorio', payload).then(r=>r.data);
    },
    onSuccess: (_,submit) => {
      qc.invalidateQueries({ queryKey:['relatorio',year,month] });
      qc.invalidateQueries({ queryKey:['relatorio-list'] });
      qc.invalidateQueries({ queryKey:['portal-dashboard'] });
      toast.success(submit ? 'Relatório enviado! ✅' : 'Rascunho salvo.');
    },
    onError: (e:any) => toast.error(e?.response?.data?.error||'Erro ao salvar.'),
  });

  const goMonth = (dir:number) => {
    let m=month+dir, y=year;
    if(m>12){m=1;y++;} if(m<1){m=12;y--;}
    setYear(y); setMonth(m);
  };

  const updateStudent  = (i:number,k:string,v:string) => setStudents(s=>s.map((r,j)=>j===i?{...r,[k]:v}:r));
  const updateActivity = (i:number,k:string,v:string) => setActivities(a=>a.map((r,j)=>j===i?{...r,[k]:v}:r));

  const paeOk     = students.some((s:any)=>s.iniciais.trim()) && activities.some((a:any)=>a.iniciais.trim()&&a.descricao.trim());
  const generalOk = GENERAL_FIELDS.every(f=>form[f.key].trim().length>0);
  const canSubmit = formType==='PAE' ? paeOk : generalOk;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold" style={{ color:'var(--text-primary)' }}>
          📋 Relatório Mensal{userIsPAE ? ' — PAE' : ''}
        </h1>
        <p className="text-sm" style={{ color:'var(--text-muted)' }}>
          {userIsPAE ? 'Relatório de Profissional de Apoio Escolar' : 'Resumo das suas atividades do mês'}
        </p>
      </div>

      {/* Navegação mês */}
      <div className="card p-4 flex items-center justify-between">
        <button onClick={()=>goMonth(-1)} className="p-2 rounded-xl hover:bg-slate-100 transition">
          <ChevronLeft className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
        </button>
        <div className="text-center">
          <p className="font-bold" style={{ color:'var(--text-primary)' }}>{MONTHS_PT[month-1]} {year}</p>
          {isSubmitted && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1"
              style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>
              <CheckCircle2 className="w-3 h-3" />Enviado
            </span>
          )}
          {report?.status==='RASCUNHO' && (
            <span className="inline-flex text-xs px-2 py-0.5 rounded-full mt-1"
              style={{ background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a' }}>Rascunho</span>
          )}
        </div>
        <button onClick={()=>goMonth(1)} disabled={year>=curYear&&month>=curMonth}
          className="p-2 rounded-xl hover:bg-slate-100 transition disabled:opacity-40">
          <ChevronRight className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
        </button>
      </div>

      {/* Histórico */}
      {(list as any[]).length>0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(list as any[]).map((r:any)=>(
            <button key={r.id} onClick={()=>{setYear(r.year);setMonth(r.month);}}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition"
              style={{ background:r.year===year&&r.month===month?'#2563eb':'var(--bg-card)',
                color:r.year===year&&r.month===month?'white':'var(--text-secondary)', border:'1px solid var(--border)' }}>
              {MONTHS_PT[r.month-1].slice(0,3)}/{r.year}{r.status==='ENVIADO'?' ✓':''}
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      {isSubmitted ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color:'#22c55e' }} />
          <h2 className="text-lg font-bold mb-1" style={{ color:'var(--text-primary)' }}>Relatório enviado!</h2>
          <p className="text-sm" style={{ color:'var(--text-muted)' }}>
            Seu relatório de {MONTHS_PT[month-1]} foi enviado com sucesso.
          </p>
          {report?.submitted_at && (
            <p className="text-xs mt-2" style={{ color:'var(--text-muted)' }}>
              {new Date(report.submitted_at).toLocaleDateString('pt-BR',{dateStyle:'full'})}
            </p>
          )}
        </div>
      ) : !canEdit ? (
        <div className="card p-8 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-semibold" style={{ color:'var(--text-primary)' }}>Relatório indisponível</p>
          <p className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>Só é possível preencher o mês atual ou anterior.</p>
        </div>
      ) : isLoading ? (
        <div className="card p-6 space-y-4">
          {[1,2,3].map(i=><div key={i} className="h-20 rounded-xl animate-pulse" style={{ background:'var(--bg-hover)' }} />)}
        </div>
      ) : (
        <>
          {formType==='PAE' ? (
            <>
              {/* Tabela de estudantes */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color:'#2563eb' }} />
                    <h2 className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>Estudante(s) Acompanhado(s)</h2>
                  </div>
                  <button onClick={()=>setStudents(s=>[...s,BLANK_STUDENT()])}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl transition"
                    style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>
                    <Plus className="w-3.5 h-3.5" />Adicionar
                  </button>
                </div>
                <div className="flex items-center gap-2 pb-2 border-b text-xs font-semibold overflow-x-auto"
                  style={{ borderColor:'var(--border)', color:'var(--text-muted)' }}>
                  <span className="w-5 shrink-0" />
                  <span className="w-24 shrink-0">Iniciais</span>
                  <span className="w-24 shrink-0">Série</span>
                  <span className="flex-1 min-w-[100px]">Necessidade</span>
                  <span className="flex-1 min-w-[100px]">Supervisor(a)</span>
                  <span className="flex-1 min-w-[100px]">Unidade</span>
                  <span className="w-6 shrink-0" />
                </div>
                {students.map((s:any,i:number)=>(
                  <StudentRow key={i} idx={i} student={s} onChange={updateStudent}
                    onRemove={()=>setStudents(st=>st.filter((_,j)=>j!==i))} />
                ))}
              </div>

              {/* Atividades */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" style={{ color:'#2563eb' }} />
                    <h2 className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>Atividades Desenvolvidas</h2>
                  </div>
                  <button onClick={()=>setActivities(a=>[...a,BLANK_ACTIVITY()])}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl transition"
                    style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>
                    <Plus className="w-3.5 h-3.5" />Adicionar
                  </button>
                </div>
                <p className="text-xs mb-4" style={{ color:'var(--text-muted)' }}>
                  Descreva brevemente as atividades pedagógicas desenvolvidas com cada aluno atendido:
                </p>
                <div className="space-y-3">
                  {activities.map((a:any,i:number)=>(
                    <ActivityRow key={i} idx={i} activity={a} onChange={updateActivity}
                      onRemove={()=>setActivities(ac=>ac.filter((_,j)=>j!==i))} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card p-5 space-y-5">
              <h2 className="text-sm font-semibold" style={{ color:'var(--text-muted)' }}>
                {MONTHS_PT[month-1].toUpperCase()} {year}
              </h2>
              {GENERAL_FIELDS.map(f=>(
                <div key={f.key}>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color:'var(--text-primary)' }}>
                    {f.label} <span className="text-red-500">*</span>
                  </label>
                  <textarea rows={4} value={form[f.key]}
                    onChange={e=>setForm(fm=>({...fm,[f.key]:e.target.value}))}
                    placeholder={f.placeholder} className="input resize-none" />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={()=>saveMutation.mutate(false)} disabled={saveMutation.isPending}
              className="btn-secondary flex-1 justify-center">
              <Save className="w-4 h-4" />Rascunho
            </button>
            <button onClick={()=>{ if(!canSubmit){toast.error('Preencha os campos obrigatórios.');return;} saveMutation.mutate(true); }}
              disabled={saveMutation.isPending||!canSubmit} className="btn-primary flex-1 justify-center">
              <Send className="w-4 h-4" />Enviar relatório
            </button>
          </div>
        </>
      )}
    </div>
  );
}
