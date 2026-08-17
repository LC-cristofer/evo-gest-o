'use client';

/**
 * Botão de download de PDF
 * Reutilizável em qualquer página que precise gerar um PDF
 */

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface PDFButtonProps {
  endpoint:   string;          // ex: '/pdf/employee/uuid'
  params?:    Record<string, any>;
  label?:     string;
  className?: string;
  size?:      'sm' | 'md';
  variant?:   'outline' | 'ghost';
}

export function PDFButton({
  endpoint,
  params    = {},
  label     = 'Baixar PDF',
  className,
  size      = 'sm',
  variant   = 'outline',
}: PDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint, {
        params,
        responseType: 'blob',
      });

      const disposition = res.headers['content-disposition'] || '';
      const match       = disposition.match(/filename="?([^";\n]+)"?/);
      const filename    = match?.[1] || `relatorio_${Date.now()}.pdf`;

      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF baixado!');
    } catch {
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={clsx(
        'flex items-center gap-1.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs rounded-lg' : 'px-4 py-2 text-sm rounded-lg',
        variant === 'outline'
          ? 'border border-red-200 text-red-600 hover:bg-red-50'
          : 'text-red-500 hover:text-red-700',
        className
      )}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <FileText className="w-3.5 h-3.5" />
      }
      {loading ? 'Gerando...' : label}
    </button>
  );
}
