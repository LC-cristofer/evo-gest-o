'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Download, Loader2, Search, Plus, FolderOpen, File, FileImage } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDateSafe } from '@/utils/date';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const CATEGORIES = ['Geral','RH','Financeiro','Jurídico','Treinamento','Formulários','Outros'];

function fileIcon(mime: string) {
  if (mime?.includes('pdf'))   return <FileText className="w-8 h-8 text-red-500" />;
  if (mime?.includes('image')) return <FileImage className="w-8 h-8 text-blue-500" />;
  if (mime?.includes('sheet') || mime?.includes('excel')) return <File className="w-8 h-8 text-green-500" />;
  return <File className="w-8 h-8 text-slate-400" />;
}

function formatSize(bytes: number) {
  if (!bytes) return '?';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(0)}KB`;
  return `${(bytes/1024/1024).toFixed(1)}MB`;
}

export default function DocumentosPage() {
  const { can } = useAuthStore();
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('');
  const [modal,    setModal]    = useState(false);
  const [form, setForm] = useState({ title:'', description:'', category:'Geral', is_public:'false', tags:'' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,  setFile]  = useState<File|null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['useful-docs', category],
    queryFn:  () => api.get('/useful-docs', { params: category ? { category } : undefined }).then(r => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Selecione um arquivo.');
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([k,v]) => fd.append(k, v));
      return api.post('/useful-docs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['useful-docs'] });
      setModal(false); setFile(null);
      setForm({ title:'', description:'', category:'Geral', is_public:'false', tags:'' });
      toast.success('Documento enviado!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/useful-docs/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['useful-docs'] }); toast.success('Removido.'); },
  });

  const filtered = (docs as any[]).filter((d: any) =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: any, doc: any) => {
    const cat = doc.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Documentos Úteis</h1>
          <p className="text-slate-400 text-sm mt-0.5">Arquivos e formulários do sistema</p>
        </div>
        {can('documents:manage') && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Enviar documento
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar documentos..." />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="input w-auto bg-white">
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhum documento encontrado.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catDocs]) => (
          <div key={cat} className="card overflow-hidden">
            <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{cat}</span>
              <span className="text-xs text-slate-400 ml-1">({(catDocs as any[]).length})</span>
            </div>
            <div className="divide-y divide-slate-50">
              {(catDocs as any[]).map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition">
                  <div className="shrink-0">{fileIcon(doc.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{doc.title}</p>
                    {doc.description && <p className="text-xs text-slate-400 truncate">{doc.description}</p>}
                    <p className="text-xs text-slate-300 mt-0.5">
                      {formatSize(doc.file_size)} · {formatDateSafe(doc.created_at)}
                      {doc.is_public && <span className="ml-2 text-emerald-500">• Público</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`http://localhost:4000${doc.file_path}`}
                      target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition"
                      title="Abrir / Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {can('documents:manage') && (
                      <button
                        onClick={() => confirm('Remover este documento?') && deleteMutation.mutate(doc.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal upload */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Enviar documento</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Arquivo *</label>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); if (!form.title) setForm(f => ({...f, title: e.target.files![0].name.replace(/\.[^.]+$/, '')})); }}} />
                <button onClick={() => fileRef.current?.click()} className={clsx('input flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition', file ? 'text-blue-600' : 'text-slate-400')}>
                  <Upload className="w-4 h-4" />
                  {file ? file.name : 'Clique para selecionar...'}
                </button>
              </div>
              <div><label className="label">Título *</label><input value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} className="input" /></div>
              <div><label className="label">Descrição</label><input value={form.description} onChange={e => setForm(f=>({...f, description:e.target.value}))} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Categoria</label>
                  <select value={form.category} onChange={e => setForm(f=>({...f, category:e.target.value}))} className="input bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_public === 'true'} onChange={e => setForm(f=>({...f, is_public: e.target.checked ? 'true' : 'false'}))} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-700">Público</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => uploadMutation.mutate()} disabled={!file || !form.title || uploadMutation.isPending} className="btn-primary">
                {uploadMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : <><Upload className="w-4 h-4" />Enviar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
