'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, MapPin, Phone, Trash2, Users, AlertTriangle } from 'lucide-react';
import { unitAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function UnidadesPage() {
  const { can } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units-full'],
    queryFn: () => unitAPI.list().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units-full'] });
      qc.invalidateQueries({ queryKey: ['units-list'] });
      setConfirmDelete(null);
      toast.success('Unidade desativada!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Não foi possível desativar.');
      setConfirmDelete(null);
    },
  });

  // Separar VOLANTE das unidades normais
  const normalUnits  = ((units as any[]).filter(u => !u.name?.toUpperCase().includes('VOLANTE')));
  const volanteUnits = ((units as any[]).filter(u =>  u.name?.toUpperCase().includes('VOLANTE')));

  const filteredNormal  = normalUnits.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.code.toLowerCase().includes(search.toLowerCase()));
  const filteredVolante = volanteUnits.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-6xl space-y-5 page-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Unidades</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {filteredNormal.length} unidades · {filteredVolante.length} volantes
          </p>
        </div>
        {can('units:manage') && (
          <Link href="/unidades/nova" className="btn-primary">
            <Plus className="w-4 h-4" />Nova unidade
          </Link>
        )}
      </div>

      <div className="card p-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código..." className="input" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-12 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Unidades normais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNormal.map((u: any) => (
              <div key={u.id} className="card hover:shadow-md transition-all duration-200 group">
                {/* Foto da unidade */}
                {u.photo_url ? (
                  <div className="h-32 overflow-hidden rounded-t-2xl">
                    <Image
                      src={`http://localhost:4000${u.photo_url}`}
                      alt={u.name}
                      width={400} height={128}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-24 rounded-t-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #dbeafe, #eff6ff)' }}>
                    <Building2 className="w-10 h-10 text-blue-300" />
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <Link href={`/unidades/${u.id}`}
                        className="font-semibold text-sm hover:text-blue-600 transition leading-tight block"
                        style={{ color: 'var(--text-primary)' }}>
                        {u.name}
                      </Link>
                      <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {u.code}
                      </span>
                    </div>
                    {can('units:manage') && (
                      <button
                        onClick={() => setConfirmDelete(u)}
                        className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl py-2.5 text-center" style={{ background: '#d1fae5' }}>
                      <p className="text-xl font-bold" style={{ color: '#065f46' }}>{u.active_count || 0}</p>
                      <p className="text-[10px] font-medium" style={{ color: '#047857' }}>Ativos</p>
                    </div>
                    <div className="rounded-xl py-2.5 text-center" style={{ background: '#fef3c7' }}>
                      <p className="text-xl font-bold" style={{ color: '#92400e' }}>{u.away_count || 0}</p>
                      <p className="text-[10px] font-medium" style={{ color: '#b45309' }}>Afastados</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {u.city && (
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <MapPin className="w-3 h-3" />{u.city}{u.state && `, ${u.state}`}
                      </p>
                    )}
                    {u.phone && (
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Phone className="w-3 h-3" />{u.phone}
                      </p>
                    )}
                    {u.supervisor_name && (
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Users className="w-3 h-3" />Sup: {u.supervisor_name}
                      </p>
                    )}
                  </div>

                  <Link href={`/unidades/${u.id}`}
                    className="mt-3 w-full block text-center py-2 text-xs font-medium rounded-xl transition"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    Ver detalhes →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Unidades Volante */}
          {filteredVolante.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                <span className="badge badge-amber">VOLANTE</span>
                {filteredVolante.length} unidade(s) volante — clique para expandir
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredVolante.map((u: any) => (
                  <Link key={u.id} href={`/unidades/${u.id}`}
                    className="card p-4 hover:border-amber-300 transition">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {u.active_count || 0} ativos
                    </p>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Desativar unidade</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{confirmDelete.name}</p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Esta ação desativa a unidade. Ela não será excluída permanentemente.
              Se houver funcionários ativos vinculados, a operação será bloqueada.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="btn-danger"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
