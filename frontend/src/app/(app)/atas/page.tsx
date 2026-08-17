'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Download, Trash2, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function AtasPage() {
  const { can } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ title:'', meeting_date: new Date().toISOString().split('T')[0], location:'', content:'', participants:'' });

  const { data: atas = [], isLoading } = useQuery({
    queryKey: ['atas'],
    queryFn:  () => api.get('/minutes').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('meeting_date', form.meeting_date);
      if (form.location) fd.append('location', form.location);
      if (form.content)  fd.append('content',  form.content);
      if (form.participants) fd.append('participants', JSON.stringify(form.participants.split(',').map(s => s.trim())));
      return api.post('/minutes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['atas'] }); setModal(false); toast.success('Ata registrada!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/minutes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['atas'] }); setSelected(null); toast.success('Removida.'); },
  });

  const filtered = (atas as any[]).filter((a: any) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Atas de Reunião</h1>
          <p className="text-slate-400 text-sm mt-0.5">{(atas as any[]).length} atas registradas</p>
        </div>
        {can('employees:update') && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nova ata
          </button>
        )}
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ata..." className="input pl-9" />
        </div>
      </div>

      {selected ? (
        /* Detalhe */
        <div className="card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{selected.title}</h2>
              <p className="text-sm text-slate-400">{formatDateSafe(selected.meeting_date)} · {selected.location || 'Sem local'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="btn-secondary text-xs">← Voltar</button>
              {can('employees:delete') && (
                <button onClick={() => deleteMutation.mutate(selected.id)} className="btn-danger text-xs">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {selected.participants?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Participantes</p>
              <div className="flex flex-wrap gap-2">
                {selected.participants.map((p: string, i: number) => (
                  <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-100">{p}</span>
                ))}
              </div>
            </div>
          )}
          {selected.content && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Conteúdo</p>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selected.content}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Lista */
        isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma ata encontrada</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-50">
              {filtered.map((ata: any) => (
                <div key={ata.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition">
                  <button onClick={() => setSelected(ata)} className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 hover:text-blue-600 transition">{ata.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatDateSafe(ata.meeting_date)}
                        {ata.location && ` · ${ata.location}`}
                        {ata.created_by_name && ` · Por: ${ata.created_by_name}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {ata.participants?.length > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {ata.participants.length} pessoas
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Nova ata de reunião</h2>
            <div className="space-y-4">
              <div><label className="label">Título *</label><input value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Data *</label><input type="date" value={form.meeting_date} onChange={e => setForm(f => ({...f, meeting_date:e.target.value}))} className="input" /></div>
                <div><label className="label">Local</label><input value={form.location} onChange={e => setForm(f => ({...f, location:e.target.value}))} className="input" placeholder="Sala, online..." /></div>
              </div>
              <div><label className="label">Participantes (separados por vírgula)</label><input value={form.participants} onChange={e => setForm(f => ({...f, participants:e.target.value}))} className="input" placeholder="João, Maria, Ana..." /></div>
              <div><label className="label">Conteúdo / Pauta</label><textarea value={form.content} onChange={e => setForm(f => ({...f, content:e.target.value}))} rows={5} className="input resize-none" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
