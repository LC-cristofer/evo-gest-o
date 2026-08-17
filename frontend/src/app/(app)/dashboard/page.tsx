'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, TrendingDown, ClipboardList, AlertTriangle, UserCheck, UserMinus } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { formatFullDateSafe, formatMonthYearSafe, formatMonthShortSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';

function KPI({ label, value, icon: Icon, color, sub, href }: any) {
  const content = (
    <div className={`card p-5 flex items-start gap-4 transition ${href ? 'hover:shadow-md hover:border-blue-200 cursor-pointer' : ''}`}>
      <div className={`p-2.5 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
      <div>
        <p className="text-slate-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {href && <p className="text-xs text-blue-500 mt-1">Clique para ver →</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);

  const { data: general, isLoading } = useQuery({
    queryKey: ['dashboard-general'],
    queryFn: () => dashboardAPI.general().then(r => r.data),
    enabled: ['RH','DIRETORIA','TI'].includes(user?.role || ''),
  });

  const { data: supData } = useQuery({
    queryKey: ['dashboard-supervisor'],
    queryFn: () => dashboardAPI.supervisor().then(r => r.data),
    enabled: user?.role === 'SUPERVISOR',
  });

  const { data: trends } = useQuery({
    queryKey: ['attendance-trends'],
    queryFn: () => dashboardAPI.trends().then(r => r.data),
    enabled: ['RH','DIRETORIA','TI'].includes(user?.role || ''),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  // Supervisor view
  if (user?.role === 'SUPERVISOR' && supData) {
    const team = supData.team || [];
    return (
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Olá, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">{formatFullDateSafe(new Date())}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPI label="Total na equipe" value={supData.summary?.total || 0} icon={Users} color="bg-blue-500" href="/funcionarios" />
          <KPI label="Ativos" value={supData.summary?.active || 0} icon={UserCheck} color="bg-emerald-500" />
          <KPI label="Total geral" value={supData.summary?.total || 0} icon={Users} color="bg-slate-500" />
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Minha equipe</h3></div>
          <div className="divide-y divide-slate-50">
            {team.slice(0, 20).map((emp: any) => (
              <div key={emp.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{emp.full_name}</p>
                  <p className="text-xs text-slate-400">{emp.position} · {emp.unit_name}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  emp.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' :
                  emp.status === 'AFASTADO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                }`}>{emp.status}</span>
              </div>
            ))}
            {!team.length && <p className="px-5 py-8 text-sm text-slate-400 text-center">Nenhum funcionário na equipe</p>}
          </div>
        </div>
      </div>
    );
  }

  // General view
  const totals   = general?.totals || {};
  const ranking  = general?.unit_ranking || [];
  const trendData = (trends || []).map((t: any) => ({
    name:    formatMonthShortSafe(t.month),
    Faltas:  parseInt(t.absences || 0),
    Atrasos: parseInt(t.late_arrivals || 0),
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">{formatMonthYearSafe(new Date())} · Visão consolidada</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total de funcionários" value={totals.total || 0} icon={Users} color="bg-blue-500" sub={`${totals.active || 0} ativos`} href="/funcionarios" />
        <KPI label="Admissões digitais" value={general?.digital_admissions?.pending || 0} icon={ClipboardList} color="bg-violet-500" sub="Aguardando revisão" />
        <KPI label="Afastados" value={totals.away || 0} icon={AlertTriangle} color="bg-amber-500" sub="Clique para ver" href="/funcionarios?status=AFASTADO" />
        <KPI label="Desligados" value={totals.dismissed || 0} icon={TrendingDown} color="bg-red-500" sub="Clique para ver" href="/funcionarios?status=DESLIGADO" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Tendência de faltas e atrasos</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Faltas"  stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Atrasos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Sem dados de presença ainda</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Ranking de faltas por unidade</h3>
          {ranking.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ranking.slice(0,6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="unit_name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="absences" name="Faltas" fill="#ef4444" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Nenhuma ocorrência registrada</div>
          )}
        </div>
      </div>

      {/* Admissões digitais resumo */}
      {general?.digital_admissions && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Admissões Digitais</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total',       value: general.digital_admissions.total,     color: 'text-slate-700' },
              { label: 'Pendentes',   value: general.digital_admissions.pending,   color: 'text-amber-600' },
              { label: 'Em análise',  value: general.digital_admissions.in_review, color: 'text-blue-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`text-3xl font-bold ${color}`}>{value || 0}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
