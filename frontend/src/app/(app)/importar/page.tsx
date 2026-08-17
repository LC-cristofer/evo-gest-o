'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ImportarPage() {
  const { can } = useAuthStore();
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<any>(null);
  const [result, setResult]     = useState<any>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [isDrag, setIsDrag]     = useState(false);

  if (!can('import:execute')) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Sem permissão para importar.</div>;
  }

  const DB_FIELDS = [
    { value: '',               label: '(ignorar)' },
    { value: 'full_name',      label: 'Nome completo' },
    { value: 'cpf',            label: 'CPF' },
    { value: 'birth_date',     label: 'Data de nascimento' },
    { value: 'hire_date',      label: 'Data de admissão' },
    { value: 'email',          label: 'Email' },
    { value: 'phone',          label: 'Telefone' },
    { value: 'position_name',  label: 'Cargo (nome)' },
    { value: 'unit_name',      label: 'Unidade (nome)' },
    { value: 'salary',         label: 'Salário' },
  ];

  const previewMutation = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append('file', f);
      return api.post('/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      setPreview(res.data);
      // auto-map
      const heuristics: Record<string,string> = {
        'nome': 'full_name','nome completo':'full_name','cpf':'cpf',
        'data nascimento':'birth_date','admissão':'hire_date','admissao':'hire_date',
        'email':'email','telefone':'phone','cargo':'position_name','unidade':'unit_name','salário':'salary',
      };
      const map: Record<string,string> = {};
      res.data.headers.forEach((h: string) => { map[h] = heuristics[h.toLowerCase().trim()] || ''; });
      setColumnMap(map);
    },
  });

  const importMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('column_map', JSON.stringify(columnMap));
      return api.post('/import/execute', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => setResult(res.data),
  });

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    previewMutation.mutate(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <div><h1 className="text-xl font-bold text-slate-800">Importar Planilha</h1><p className="text-slate-400 text-sm mt-0.5">Importe funcionários a partir de .xlsx, .xls ou .csv</p></div>

      {result && (
        <div className={clsx('card p-6', result.errors === 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50')}>
          <div className="flex items-start gap-4">
            {result.errors === 0 ? <CheckCircle2 className="w-10 h-10 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />}
            <div>
              <h2 className="text-base font-semibold text-slate-800">{result.message}</h2>
              <div className="flex gap-5 mt-2 text-sm">
                <span className="text-emerald-600">✅ {result.success} importados</span>
                {result.errors > 0 && <span className="text-red-600">❌ {result.errors} com erro</span>}
              </div>
            </div>
          </div>
          <button onClick={() => { setFile(null); setPreview(null); setResult(null); setColumnMap({}); }} className="btn-secondary mt-4 text-xs">Nova importação</button>
        </div>
      )}

      {!result && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onDrop={onDrop}
            className={clsx('border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer', isDrag ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50')}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">{isDrag ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}</p>
            <p className="text-xs text-slate-400 mt-1">Suporta .xlsx, .xls e .csv — máx. 50MB</p>
            {file && <div className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"><FileSpreadsheet className="w-4 h-4" />{file.name}</div>}
          </div>

          {previewMutation.isPending && (
            <div className="card p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" /><p className="text-sm text-slate-500">Analisando planilha...</p></div>
          )}

          {preview && !previewMutation.isPending && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Mapeamento de colunas</h2>
                <p className="text-xs text-slate-400 mt-0.5">{preview.sheet_name} — {preview.total_rows} linhas detectadas</p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {(preview.headers as string[]).map((h: string) => (
                    <div key={h} className="flex items-center gap-3">
                      <div className="w-1/2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 truncate" title={h}>{h}</div>
                      <span className="text-slate-400 text-xs shrink-0">→</span>
                      <select value={columnMap[h] || ''} onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value }))} className="flex-1 input text-sm py-2">
                        {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => { setFile(null); setPreview(null); setColumnMap({}); }} className="btn-secondary">Cancelar</button>
                  <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="btn-primary">
                    {importMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Importando...</> : <><Upload className="w-4 h-4" />Importar {preview.total_rows} registros</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Como usar</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-500">
          <li>Prepare sua planilha com os dados dos funcionários</li>
          <li>Arraste o arquivo ou clique para selecionar</li>
          <li>Mapeie as colunas da planilha para os campos do sistema</li>
          <li>Clique em "Importar"</li>
        </ol>
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
          ⚠️ <strong>Campos obrigatórios:</strong> Nome completo e CPF. CPFs já existentes serão atualizados.
        </div>
      </div>
    </div>
  );
}
