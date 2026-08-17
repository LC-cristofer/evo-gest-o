'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na página:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-slate-800">Algo deu errado</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-xs">
        Ocorreu um erro inesperado. Tente novamente ou entre em contato com o TI se o problema persistir.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 mt-2 font-mono">
          Ref: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium
                   px-5 py-2 rounded-lg transition"
      >
        Tentar novamente
      </button>
    </div>
  );
}
