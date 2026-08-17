'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Função standalone (usar fora de componentes React) ───────
export function showUndoToast({
  undoId,
  label = 'Ação realizada',
  invalidateKeys = [],
  onUndone,
}: {
  undoId: string;
  label?: string;
  invalidateKeys?: string[][];
  onUndone?: () => void;
}) {
  if (!undoId) return;
  toast(
    (t) => (
      <UndoButton
        toastId={t.id}
        undoId={undoId}
        label={label}
        invalidateKeys={invalidateKeys}
        onUndone={onUndone}
      />
    ),
    { duration: 8000, position: 'bottom-center' }
  );
}

// ─── Hook (usar dentro de componentes React) ──────────────────
export function useUndo() {
  const qc = useQueryClient();

  const showUndo = (
    undoId: string | undefined | null,
    label = 'Ação realizada',
    invalidateKeys: string[][] = []
  ) => {
    if (!undoId) return;
    toast(
      (t) => (
        <UndoButton
          toastId={t.id}
          undoId={undoId}
          label={label}
          invalidateKeys={invalidateKeys}
          onUndone={() => {
            invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          }}
        />
      ),
      { duration: 8000, position: 'bottom-center' }
    );
  };

  return { showUndo };
}

// ─── Componente interno ───────────────────────────────────────
function UndoButton({ toastId, undoId, label, invalidateKeys, onUndone }: {
  toastId: string;
  undoId: string;
  label: string;
  invalidateKeys?: string[][];
  onUndone?: () => void;
}) {
  const qc = useQueryClient();
  const undoMutation = useMutation({
    mutationFn: () => api.post(`/undo/${undoId}`),
    onSuccess: () => {
      toast.dismiss(toastId);
      toast.success('Ação desfeita!');
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onUndone?.();
    },
    onError: (err: any) => {
      toast.dismiss(toastId);
      toast.error(err?.response?.data?.error || 'Não foi possível desfazer.');
    },
  });

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        onClick={() => undoMutation.mutate()}
        disabled={undoMutation.isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition shrink-0"
      >
        {undoMutation.isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <RotateCcw className="w-3.5 h-3.5" />}
        Desfazer
      </button>
    </div>
  );
}

export default UndoButton;
