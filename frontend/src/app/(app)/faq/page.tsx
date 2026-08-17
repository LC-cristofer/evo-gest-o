'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ChevronDown, ChevronUp, Loader2, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const CATEGORIES = ['Todos','Uso do Sistema','Funcionários','Admissões','Exportação','Permissões','Acesso','Geral'];

export default function FAQPage() {
  const { can } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('Todos');
  const [open, setOpen]         = useState<string | null>(null);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState({ question:'', answer:'', category:'Geral', order_index:0 });

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['faq', category],
    queryFn: () => api.get('/faq', { params: category !== 'Todos' ? { category } : {} }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/faq', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq'] });
      setModal(false);
      setForm({ question:'', answer:'', category:'Geral', order_index:0 });
      toast.success('FAQ adicionado!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/faq/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq'] }); toast.success('Removido.'); },
  });

  const filtered = (faqs as any[]).filter((f: any) =>
    !search || f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Central de Ajuda — FAQ</h1>
          <p className="text-slate-400 text-sm mt-0.5">Perguntas e respostas frequentes</p>
        </div>
        {can('units:manage') && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pergunta..." className="input pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition',
                category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <span className="text-4xl mb-3 block">❓</span>
            Nenhuma pergunta encontrada
          </div>
        ) : filtered.map((item: any) => (
          <div key={item.id} className={clsx('card overflow-hidden transition', open === item.id && 'ring-1 ring-blue-200')}>
            <button
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition"
            >
              <div className="flex items-start gap-3 flex-1">
                <span className="text-blue-500 text-lg mt-0.5">❓</span>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{item.question}</p>
                  {item.category && (
                    <span className="text-xs text-slate-400 mt-0.5 block">{item.category}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {item.views > 0 && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Eye className="w-3 h-3" />{item.views}
                  </span>
                )}
                {open === item.id ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {open === item.id && (
              <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed pt-3">{item.answer}</p>
                {can('employees:delete') && (
                  <button onClick={() => deleteMutation.mutate(item.id)}
                    className="mt-3 text-xs text-red-400 hover:text-red-600 transition">
                    Remover
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Nova pergunta</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Pergunta *</label>
                <textarea value={form.question} onChange={e => setForm(f => ({...f, question:e.target.value}))} rows={2} className="input resize-none" />
              </div>
              <div>
                <label className="label">Resposta *</label>
                <textarea value={form.answer} onChange={e => setForm(f => ({...f, answer:e.target.value}))} rows={4} className="input resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Categoria</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))} className="input bg-white">
                    {CATEGORIES.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ordem</label>
                  <input type="number" value={form.order_index} onChange={e => setForm(f => ({...f, order_index:parseInt(e.target.value)||0}))} className="input" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.question || !form.answer || createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
