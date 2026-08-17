/**
 * Custom Hooks do sistema ONG
 * Centraliza lógica de busca e estado reutilizável
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { debounce } from 'lodash';
import { employeeAPI, unitAPI, api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Employee, EmployeeFilters, PaginatedResponse } from '@/types';

// ─── useEmployees ─────────────────────────────────────────────
// Busca paginada de funcionários com debounce no search
export function useEmployees(initialFilters: EmployeeFilters = {}) {
  const [filters, setFilters] = useState<EmployeeFilters>({
    page:  1,
    limit: 25,
    ...initialFilters,
  });
  const [search, setSearch] = useState('');

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setFilters(f => ({ ...f, search: value || undefined, page: 1 }));
    }, 400),
    []
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    debouncedSetSearch(value);
  };

  const query = useQuery({
    queryKey: ['employees', filters],
    queryFn:  () => employeeAPI.list(filters).then(r => r.data) as Promise<PaginatedResponse<Employee>>,
    placeholderData: (prev) => prev,
  });

  const setPage   = (page: number)   => setFilters(f => ({ ...f, page }));
  const setStatus = (status: string) => setFilters(f => ({ ...f, status: status as any || undefined, page: 1 }));
  const setUnit   = (unit_id: string) => setFilters(f => ({ ...f, unit_id: unit_id || undefined, page: 1 }));

  return { ...query, search, handleSearch, filters, setPage, setStatus, setUnit };
}

// ─── useEmployee ─────────────────────────────────────────────
// Busca e mutation de um funcionário individual
export function useEmployee(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['employee', id],
    queryFn:  () => employeeAPI.get(id).then(r => r.data) as Promise<Employee>,
    enabled:  !!id && id !== 'novo',
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Employee>) => employeeAPI.update(id, data),
    onSuccess:  (res) => {
      queryClient.setQueryData(['employee', id], res.data);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (data: { status: string; dismissal_type?: string; reason?: string }) =>
      employeeAPI.status(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  return { ...query, updateMutation, statusMutation };
}

// ─── useUnits ─────────────────────────────────────────────────
export function useUnits() {
  return useQuery({
    queryKey: ['units-list'],
    queryFn:  () => unitAPI.list().then(r => r.data),
    staleTime: 5 * 60 * 1000, // 5 min — dados raramente mudam
  });
}

// ─── usePositions ─────────────────────────────────────────────
export function usePositions() {
  return useQuery({
    queryKey: ['positions-list'],
    queryFn:  () => api.get('/positions').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── useSupervisors ───────────────────────────────────────────
export function useSupervisors() {
  return useQuery({
    queryKey: ['supervisors-list'],
    queryFn:  () => api.get('/users').then(r =>
      (r.data as any[]).filter((u: any) => u.role === 'SUPERVISOR')
    ),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useNotifications ────────────────────────────────────────
export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications').then(r => r.data),
    refetchInterval: 60_000,
  });

  const unreadCount = (query.data as any[] || []).filter((n: any) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { ...query, unreadCount, markRead, markAllRead };
}

// ─── useDashboard ────────────────────────────────────────────
export function useDashboard(type: 'general' | 'unit' | 'supervisor', params?: any) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['dashboard', type, params],
    queryFn:  () => {
      if (type === 'general') return api.get('/dashboard/general', { params }).then(r => r.data);
      if (type === 'unit' && params?.unitId)
        return api.get(`/dashboard/unit/${params.unitId}`, { params }).then(r => r.data);
      return api.get('/dashboard/supervisor', { params }).then(r => r.data);
    },
    enabled: !!user,
  });
}

// ─── useAttendanceRecord ─────────────────────────────────────
export function useAttendanceRecord(employeeId: string, options?: { month?: string; year?: string }) {
  return useQuery({
    queryKey: ['attendance', employeeId, options],
    queryFn:  () => api.get(`/attendance/employee/${employeeId}`, { params: options }).then(r => r.data),
    enabled:  !!employeeId,
  });
}

// ─── useCPFSearch ────────────────────────────────────────────
// Busca instantânea por CPF, ideal para o campo de admissão
export function useCPFSearch() {
  const [cpf, setCpf]       = useState('');
  const [querying, setQuerying] = useState(false);

  const query = useQuery({
    queryKey: ['employee-by-cpf', cpf],
    queryFn:  () => employeeAPI.byCpf(cpf).then(r => r.data),
    enabled:  cpf.replace(/\D/g, '').length === 11,
    retry:    false,
  });

  const handleCPFChange = useCallback(
    debounce((value: string) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 11) {
        // Formata
        const formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
        setCpf(formatted);
      }
    }, 300),
    []
  );

  return {
    cpf,
    setCpf,
    handleCPFChange,
    employee:  query.data,
    exists:    !!query.data && !query.isError,
    isSearching: query.isFetching,
  };
}
