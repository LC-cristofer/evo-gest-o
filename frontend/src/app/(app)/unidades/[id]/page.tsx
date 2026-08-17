'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, TrendingDown, Clock } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

export default function UnidadeDetailPage() {
  const params    = useParams<{ id: string }>();
  const { user }  = useAuthStore();
  const unitId    = user?.role === 'SUPERVISOR' ? (user.unit_id || params.id) : params.id;

  const { data, isLoading } = useQuery({
    queryKey: ['unit-dashboard', unitId],
    queryFn:  () => dashboardAPI.unit(unitId!).then(r => r.data),
    enabled:  !!unitId,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-center py-20 text-slate-400">Unidade não encontrada.</div>;

  const { unit, employees = [] } = data;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/unidades" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Unidades</Link>
        <span>/</span>
        <span className="text-slate-600">{unit?.name}</span>
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">{unit?.name}</h1>
            <p className="text-sm text-slate-500">{unit?.code}</p>
            {unit?.city && <p className="text-sm text-slate-400 mt-1">{unit.city}{unit.state && `, ${unit.state}`}</p>}
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="text-center bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-emerald-700">{unit?.active_count || 0}</p>
              <p className="text-xs text-emerald-600">Ativos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Equipe ({employees.length})</h2>
        </div>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Nenhum funcionário ativo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Funcionário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Cargo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-red-400 uppercase">Faltas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-amber-400 uppercase">Atrasos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3">
                      <Link href={`/funcionarios/${emp.id}`} className="hover:text-blue-600">
                        <p className="font-medium text-slate-700">{emp.full_name}</p>
                        <p className="text-xs text-slate-400">{emp.employee_code}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{emp.position || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('text-sm font-semibold', parseInt(emp.month_absences||0)>0?'text-red-600':'text-slate-300')}>
                        {emp.month_absences||0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('text-sm font-semibold', parseInt(emp.month_late||0)>0?'text-amber-600':'text-slate-300')}>
                        {emp.month_late||0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
