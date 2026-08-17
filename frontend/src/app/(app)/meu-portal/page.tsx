'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  ClipboardList, FileText, Bell, AlertTriangle, CheckCircle2,
  Flame, BookOpen, ExternalLink, Download, Clock, UserCheck,
  ChevronRight, Newspaper,
} from 'lucide-react';

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function StatCard({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function MeuPortalPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'FUNCIONARIO' && !['TI','RH','DIRETORIA'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['portal-dashboard'],
    queryFn: () => api.get('/portal/dashboard').then(r => r.data),
    refetchInterval: 120_000,
  });

  const now = new Date();
  const month = MONTHS_PT[now.getMonth()];
  const year  = now.getFullYear();

  const diarioOk   = dash?.diary_today === 'ENVIADO';
  const relatorioOk = dash?.relatorio_month === 'ENVIADO';
  const streak = dash?.streak || 0;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Saudação */}
      <div className="pt-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Olá, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
            </p>
          </div>
          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <Flame className="w-4 h-4" style={{ color: '#ea580c' }} />
              <span className="text-sm font-bold" style={{ color: '#ea580c' }}>{streak} dias</span>
            </div>
          )}
        </div>
      </div>

      {/* Status do dia — pendências em destaque */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
          TAREFAS DE HOJE
        </h2>
        <div className="space-y-3">
          {/* Diário */}
          <Link href="/diario">
            <div className="flex items-center justify-between p-3 rounded-xl transition cursor-pointer"
              style={{
                background: diarioOk ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${diarioOk ? '#bbf7d0' : '#fecaca'}`,
              }}>
              <div className="flex items-center gap-3">
                {diarioOk
                  ? <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
                  : <AlertTriangle className="w-5 h-5" style={{ color: '#dc2626' }} />
                }
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Diário de Bordo
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {diarioOk ? 'Preenchido hoje ✓' : 'Pendente — clique para preencher'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </div>
          </Link>

          {/* Relatório mensal */}
          <Link href="/relatorio">
            <div className="flex items-center justify-between p-3 rounded-xl transition cursor-pointer"
              style={{
                background: relatorioOk ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${relatorioOk ? '#bbf7d0' : '#fde68a'}`,
              }}>
              <div className="flex items-center gap-3">
                {relatorioOk
                  ? <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
                  : <AlertTriangle className="w-5 h-5" style={{ color: '#d97706' }} />
                }
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Relatório — {month}/{year}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {relatorioOk ? 'Enviado ✓' : 'Não enviado ainda'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </div>
          </Link>
        </div>
      </div>

      {/* Stats de horas */}
      {dash?.hours && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Horas — {month}/{year}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Horas trabalhadas"
              value={`${dash.hours.hours_worked}h`}
              sub={`de ${dash.hours.hours_expected}h previstas`}
              color="#2563eb"
              icon={Clock}
            />
            <StatCard
              label="Faltas justificadas"
              value={dash.hours.absences_justified}
              sub={`+ ${dash.hours.absences_unjustified} não justificada(s)`}
              color={dash.hours.absences_unjustified > 0 ? '#dc2626' : '#059669'}
              icon={UserCheck}
            />
          </div>
        </div>
      )}

      {/* Sequência de dias */}
      {streak > 0 && (
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            🔥
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {streak} {streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}!
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Continue assim — consistência é tudo.{streak >= 5 ? ' Incrível! 🏆' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Treinamentos — link fixo */}
      <a href="https://treinamentos.casca.ong.br/login" target="_blank" rel="noopener noreferrer">
        <div className="card p-4 flex items-center justify-between hover:shadow-md transition cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <BookOpen className="w-5 h-5" style={{ color: '#2563eb' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Portal de Treinamentos
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                treinamentos.casca.ong.br
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </div>
      </a>

      {/* Notícias e avisos */}
      {dash?.posts?.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Avisos e Notícias
          </h2>
          <div className="space-y-2">
            {dash.posts.map((p: any) => (
              <div key={p.id} className="card p-4 flex items-start gap-3">
                <Newspaper className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#2563eb' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                  {p.summary && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.summary}</p>}
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {p.published_at ? new Date(p.published_at).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentos úteis */}
      {dash?.useful_docs?.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Documentos Úteis
          </h2>
          <div className="space-y-2">
            {dash.useful_docs.map((d: any) => (
              <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer">
                <div className="card p-3 flex items-center justify-between hover:shadow transition">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5" style={{ color: '#2563eb' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                      {d.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.description}</p>}
                    </div>
                  </div>
                  <Download className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
