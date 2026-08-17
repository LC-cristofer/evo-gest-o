/**
 * Hook: useViaCEP
 * Preenche endereço automaticamente ao digitar CEP
 * Usa a API pública viacep.com.br
 */

'use client';

import { useState, useCallback } from 'react';
import { UseFormSetValue } from 'react-hook-form';

interface ViaCEPResponse {
  cep:         string;
  logradouro:  string;
  complemento: string;
  bairro:      string;
  localidade:  string;
  uf:          string;
  erro?:       boolean;
}

interface AddressFields {
  address?:      string;
  neighborhood?: string;
  city?:         string;
  state?:        string;
}

export function useViaCEP(setValue: UseFormSetValue<any>) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchAddress = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCEPResponse = await res.json();

      if (data.erro) {
        setError('CEP não encontrado.');
        return;
      }

      if (data.logradouro) setValue('address',      data.logradouro,  { shouldDirty: true });
      if (data.bairro)     setValue('neighborhood', data.bairro,      { shouldDirty: true });
      if (data.localidade) setValue('city',         data.localidade,  { shouldDirty: true });
      if (data.uf)         setValue('state',        data.uf,          { shouldDirty: true });

    } catch {
      setError('Não foi possível buscar o CEP.');
    } finally {
      setLoading(false);
    }
  }, [setValue]);

  /**
   * Handler para o campo CEP — aplica máscara e busca ao completar
   */
  const handleCEPChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, onChangeFn: (v: string) => void) => {
      const raw    = e.target.value.replace(/\D/g, '').slice(0, 8);
      const masked = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
      onChangeFn(masked);

      if (raw.length === 8) {
        fetchAddress(raw);
      }
    },
    [fetchAddress]
  );

  return { loading, error, fetchAddress, handleCEPChange };
}
