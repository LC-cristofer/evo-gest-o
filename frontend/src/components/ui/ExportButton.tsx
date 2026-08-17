'use client';

/**
 * Botão de exportação reutilizável
 * Faz download direto do XLSX/CSV da API
 */

import { useState } from 'react';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface ExportButtonProps {
  endpoint:  string;           // ex: '/export/employees'
  params?:   Record<string, any>;
  label?:    string;
  format?:   'xlsx' | 'csv';
  className?: string;
  size?:     'sm' | 'md';
}

export function ExportButton({
  endpoint,
  params   = {},
  label    = 'Exportar',
  format   = 'xlsx',
  className,
  size     = 'sm',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint, {
        params:       { ...params, format },
        responseType: 'blob',
      });

      // Extrai nome do arquivo do header ou gera um
      const disposition = res.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch?.[1] || `export_${Date.now()}.${format}`;

      // Cria link de download
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${filename} baixado!`);
    } catch {
      toast.error('Erro ao exportar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={clsx(
        'flex items-center gap-1.5 border border-slate-200 rounded-lg',
        'text-slate-600 hover:text-slate-800 hover:bg-slate-50',
        'transition disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-3.5 h-3.5" />
      )}
      {loading ? 'Exportando...' : label}
    </button>
  );
}
