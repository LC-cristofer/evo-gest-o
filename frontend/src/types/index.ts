// ============================================================
// ONG Sistema - Tipos TypeScript
// ============================================================

export type UserRole = 'DIRETORIA' | 'RH' | 'SUPERVISOR' | 'TI';
export type EmployeeStatus = 'ATIVO' | 'INATIVO' | 'AFASTADO' | 'DESLIGADO' | 'PENDENTE';
export type AdmissionStatus = 'PENDENTE' | 'EM_ANALISE' | 'APROVADO' | 'REJEITADO' | 'EXPIRADO';
export type EventType =
  | 'ADMISSAO' | 'MUDANCA_UNIDADE' | 'MUDANCA_CARGO' | 'MUDANCA_SUPERVISOR'
  | 'AFASTAMENTO' | 'RETORNO' | 'ADVERTENCIA' | 'ELOGIO'
  | 'SOLICITACAO' | 'DESLIGAMENTO' | 'FERIAS' | 'BENEFICIO_ALTERADO';
export type DismissalType =
  | 'PEDIDO_DEMISSAO' | 'DEMISSAO_SEM_JUSTA_CAUSA'
  | 'DEMISSAO_COM_JUSTA_CAUSA' | 'ACORDO_MUTUO'
  | 'TERMINO_CONTRATO' | 'APOSENTADORIA' | 'FALECIMENTO';
export type BenefitType = 'VR' | 'VT' | 'PLANO_SAUDE' | 'OUTROS';
export type BenefitStatus = 'ATIVO' | 'INATIVO' | 'PENDENTE' | 'CANCELADO';
export type DocumentStatus = 'PENDENTE' | 'ENVIADO' | 'APROVADO' | 'REJEITADO';

// ─── Entidades ───────────────────────────────────────────────

export interface Unit {
  id:         string;
  code:       string;
  name:       string;
  address?:   string;
  city?:      string;
  state?:     string;
  phone?:     string;
  email?:     string;
  is_active:  boolean;
  capacity?:  number;
  created_at: string;
  // Computed
  active_count?:    number;
  away_count?:      number;
  dismissed_count?: number;
}

export interface Position {
  id:          string;
  name:        string;
  description?: string;
  salary_floor?: number;
  salary_ceil?:  number;
  cbo_code?:     string;
  is_active:     boolean;
}

export interface Employee {
  id:             string;
  employee_code:  string;
  cpf:            string;
  rg?:            string;
  full_name:      string;
  social_name?:   string;
  birth_date:     string;
  gender?:        string;
  email?:         string;
  phone?:         string;
  phone_secondary?: string;
  address?:       string;
  address_number?: string;
  address_comp?:  string;
  neighborhood?:  string;
  city?:          string;
  state?:         string;
  zip_code?:      string;
  bank_code?:     string;
  bank_agency?:   string;
  bank_account?:  string;
  bank_account_type?: string;
  pix_key?:       string;
  hire_date:      string;
  position_id?:   string;
  unit_id?:       string;
  supervisor_id?: string;
  salary?:        number;
  contract_type:  string;
  work_schedule?: string;
  status:         EmployeeStatus;
  pis_pasep?:     string;
  ctps_number?:   string;
  has_disability: boolean;
  disability_type?: string;
  notes?:         string;
  created_at:     string;
  updated_at:     string;
  // Joins
  position_name?:    string;
  unit_name?:        string;
  unit_code?:        string;
  supervisor_name?:  string;
  supervisor_email?: string;
  benefits?:         EmployeeBenefit[];
  recent_history?:   HistoryEvent[];
}

export interface HistoryEvent {
  id:             string;
  employee_id:    string;
  event_type:     EventType;
  event_data?:    Record<string, any>;
  field_name?:    string;
  old_value?:     string;
  new_value?:     string;
  dismissal_type?: DismissalType;
  effective_date?: string;
  description:    string;
  created_by?:    string;
  created_by_name?: string;
  created_at:     string;
}

export interface AdmissionProcess {
  id:               string;
  token:            string;
  candidate_name:   string;
  candidate_email:  string;
  candidate_cpf?:   string;
  candidate_phone?: string;
  position_id?:     string;
  unit_id?:         string;
  supervisor_id?:   string;
  salary?:          number;
  hire_date_expected?: string;
  status:           AdmissionStatus;
  link_expires_at:  string;
  link_sent_at?:    string;
  submitted_at?:    string;
  reviewed_at?:     string;
  rejection_reason?: string;
  form_data?:       Record<string, any>;
  send_count:       number;
  employee_id?:     string;
  created_at:       string;
  // Joins
  position_name?:    string;
  unit_name?:        string;
  supervisor_name?:  string;
  created_by_name?:  string;
  // Counts
  doc_total?:    number;
  doc_sent?:     number;
  doc_approved?: number;
  documents?:    AdmissionDocument[];
}

export interface AdmissionDocument {
  id:            string;
  process_id:    string;
  document_type: string;
  is_required:   boolean;
  file_name?:    string;
  file_path?:    string;
  file_size?:    number;
  mime_type?:    string;
  status:        DocumentStatus;
  rejection_reason?: string;
  uploaded_at?:  string;
}

export interface EmployeeBenefit {
  id:           string;
  employee_id:  string;
  benefit_type: BenefitType;
  status:       BenefitStatus;
  value?:       number;
  operator?:    string;
  card_number?: string;
  start_date?:  string;
  end_date?:    string;
  notes?:       string;
}

export interface Notification {
  id:          string;
  type:        string;
  title:       string;
  message:     string;
  link?:       string;
  is_read:     boolean;
  read_at?:    string;
  employee_id?: string;
  created_at:  string;
}

// ─── API Responses ───────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface DashboardGeneral {
  period:             string;
  totals:             { total: number; active: number; away: number; dismissed: number; pending: number; };
  by_status:          Array<{ unit_name: string; code: string; status: EmployeeStatus; total: number; }>;
  recent_admissions:  Array<{ full_name: string; hire_date: string; position: string; unit: string; }>;
  recent_dismissals:  Array<{ full_name: string; effective_date: string; dismissal_type: DismissalType; unit: string; }>;
  unit_ranking:       Array<{ unit_name: string; code: string; absences: number; late_arrivals: number; employees_with_issues: number; }>;
  digital_admissions: { total: number; pending: number; in_review: number; expired: number; };
  attendance:         { total_absences: number; justified_absences: number; late_arrivals: number; total_minutes_late: number; };
}

// ─── Filtros comuns ──────────────────────────────────────────

export interface EmployeeFilters {
  search?:       string;
  status?:       EmployeeStatus;
  unit_id?:      string;
  supervisor_id?: string;
  page?:         number;
  limit?:        number;
  order?:        string;
  dir?:          'ASC' | 'DESC';
}
