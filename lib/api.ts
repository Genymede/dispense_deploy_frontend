import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const msg = (err.response?.data as any)?.error || err.message || 'เกิดข้อผิดพลาด';
    return Promise.reject(new Error(msg));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Types (match backend exactly)
// ─────────────────────────────────────────────────────────────────────────────

export interface Drug {
  med_sid: number;
  med_id: number;
  current_stock: number;
  packaging_type: string;
  is_divisible: boolean;
  location: string | null;
  med_showname: string | null;
  med_showname_eng: string | null;
  min_quantity: number | null;
  max_quantity: number | null;
  cost_price: number | null;
  unit_price: number | null;
  mfg_date: string | null;
  exp_date: string | null;
  is_expired: boolean;
  drug_code: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  med_name: string;
  med_generic_name: string | null;
  med_marketing_name: string;
  med_thai_name: string | null;
  category: string | null;
  med_dosage_form: string | null;
  med_severity: string;
  unit: string;
  med_out_of_stock: boolean;
  lot_count?: number;
  nearest_lot_exp?: string | null;
  expired_lot_count?: number;
  lots?: StockLot[];
}

export interface StockLot {
  lot_id: number;
  lot_number: string | null;
  quantity: number;
  exp_date: string | null;
  mfg_date: string | null;
  received_at: string;
  note: string | null;
}

export interface MedTableItem {
  med_id: number;
  med_name: string;
  med_generic_name: string | null;
  med_marketing_name: string;
  med_medical_category: string | null;
  med_counting_unit: string;
  med_dosage_form: string | null;
  med_cost_price: number;
  med_selling_price: number;
  med_out_of_stock: boolean;
}

export interface StockTransaction {
  tx_id: number;
  med_sid: number;
  med_id: number;
  tx_type: 'in' | 'out' | 'adjust' | 'return' | 'expired';
  quantity: number;
  balance_before: number;
  balance_after: number;
  lot_number: string | null;
  expiry_date: string | null;
  reference_no: string | null;
  prescription_no: string | null;
  ward_from: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  note: string | null;
  created_at: string;
  med_showname: string | null;
  med_name: string;
  med_generic_name: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
}

export interface PrescriptionItem {
  item_id: number;
  prescription_id: number;
  med_sid: number;
  med_id: number;
  quantity: number;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  med_showname: string | null;
  med_name: string;
  med_generic_name: string | null;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface Prescription {
  prescription_id: number;
  prescription_no: string;
  patient_id: number | null;
  doctor_id: string | null;
  ward: string | null;
  status: 'pending' | 'dispensed' | 'returned' | 'cancelled';
  dispensed_by: string | null;
  dispensed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  hn_number: string | null;
  patient_photo: string | null;
  doctor_name: string | null;
  dispensed_by_name: string | null;
  items?: PrescriptionItem[];
  item_count?: number;
  total_cost?: number;
}

export interface Patient {
  patient_id: number;
  hn_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  national_id: string;
  phone: string | null;
}

export interface Alert {
  id: string;
  alert_type: 'low_stock' | 'near_expiry' | 'expired' | 'overstock' | 'incomplete_record';
  med_sid: number;
  drug_name: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_drugs: number;
  low_stock_count: number;
  near_expiry_count: number;
  expired_count: number;
  today_dispense_count: number;
  today_stock_in_count: number;
  total_transactions_today: number;
  pending_prescriptions: number;
  queue_waiting: number;
  queue_called: number;
  queue_completed_today: number;
  near_expiry_top: Array<{
    med_sid: number;
    drug_name: string;
    exp_date: string;
    med_quantity: number;
    days_left: number;
  }>;
  recent_transactions: Array<{
    tx_id: number;
    tx_type: string;
    quantity: number;
    created_at: string;
    drug_name: string;
  }>;
}

export interface StockSummary {
  date: string;
  stock_in: number;
  stock_out: number;
  stock_return: number;
  dispensed_count: number;
}

export interface InventoryItem extends Drug {
  total_value: number;
  stock_status: 'normal' | 'low_stock' | 'out_of_stock' | 'expired';
}

// ─────────────────────────────────────────────────────────────────────────────
// Drug APIs
// ─────────────────────────────────────────────────────────────────────────────
export const drugApi = {
  getAll: (params?: {
    search?: string; category?: string; status?: string;
    low_stock?: string; near_expiry?: string; expired?: string;
    limit?: number; offset?: number;
  }) => api.get<{ data: Drug[]; total: number }>('/drugs', { params }),

  getById: (med_sid: number) => api.get<Drug>(`/drugs/${med_sid}`),
  getLots: (med_sid: number) => api.get<StockLot[]>(`/drugs/${med_sid}/lots`),

  create: (data: Partial<Drug> & { med_id: number; packaging_type: string }) =>
    api.post<Drug>('/drugs', data),

  update: (med_sid: number, data: Partial<Drug>) =>
    api.put<Drug>(`/drugs/${med_sid}`, data),

  delete: (med_sid: number) => api.delete(`/drugs/${med_sid}`),

  getCategories: () => api.get<string[]>('/drugs/categories'),

  getMedTable: (search?: string) =>
    api.get<MedTableItem[]>('/drugs/med-table', { params: { search } }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock APIs
// ─────────────────────────────────────────────────────────────────────────────
export const stockApi = {
  getTransactions: (params?: {
    med_sid?: number; tx_type?: string;
    date_from?: string; date_to?: string;
    page?: number; limit?: number;
  }) => api.get<{ data: StockTransaction[]; total: number }>('/stock/transactions', { params }),

  getSummary: (days?: number) =>
    api.get<StockSummary[]>('/stock/summary', { params: { days } }),

  stockIn: (data: {
    med_sid: number; quantity: number; lot_number?: string;
    expiry_date?: string; reference_no?: string;
    performed_by?: string; note?: string;
  }) => api.post<StockTransaction>('/stock/in', data),

  adjust: (data: {
    med_sid: number; new_quantity: number;
    performed_by?: string; note?: string;
  }) => api.post<StockTransaction>('/stock/adjust', data),

  returnDrug: (data: {
    med_sid: number; quantity: number; ward_from?: string;
    reference_no?: string; performed_by?: string; note?: string;
  }) => api.post<StockTransaction>('/stock/return', data),

  markExpired: (data: {
    med_sid: number; quantity: number; lot_number?: string;
    performed_by?: string; note?: string;
  }) => api.post<StockTransaction>('/stock/expired', data),

  getLotsReport: (params: { type: 'expired' | 'near_expiry' | 'low_stock' | 'all'; days?: number }) =>
    api.get<{ type: string; data: any[]; days?: number }>('/stock/lots-report', { params }),

  getPendingIn: () =>
    api.get<StockTransaction[]>('/stock/pending-in'),

  approve: (tx_id: number, approved_by?: string | number) =>
    api.patch<StockTransaction>(`/stock/${tx_id}/approve`, { approved_by }),

  reject: (tx_id: number) =>
    api.patch<StockTransaction>(`/stock/${tx_id}/reject`, {}),

  receiveFromMain: (data: {
    med_sid: number; quantity: number; lot_number?: string;
    expiry_date?: string; mfg_date?: string;
    reference_no?: string; note?: string;
  }) => api.post<StockTransaction>('/stock/from-main', data),

  getRequisitions: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/stock/requisitions', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispense APIs
// ─────────────────────────────────────────────────────────────────────────────
export const dispenseApi = {
  getAll: (params?: {
    status?: string; ward?: string; date_from?: string; date_to?: string;
    search?: string; page?: number; limit?: number;
  }) => api.get<{ data: Prescription[]; total: number }>('/dispense', { params }),

  getById: (id: number) => api.get<Prescription>(`/dispense/${id}`),

  create: (data: {
    patient_id?: number; doctor_id?: string; ward?: string; note?: string;
    items: { med_sid: number; quantity: number; dose?: string; frequency?: string; route?: string }[];
  }) => api.post<Prescription>('/dispense', data),

  dispense: (id: number, dispensed_by?: string, overdue_items?: Array<{ item_id: number; overdue_qty: number }>) =>
    api.post<Prescription & { queue_number?: string | number }>(`/dispense/${id}/dispense`, { dispensed_by, overdue_items }),

  returnPrescription: (id: number, data: {
    items: { med_sid: number; quantity: number }[];
    performed_by?: string; note?: string;
  }) => api.post<Prescription>(`/dispense/${id}/return`, data),

  cancel: (id: number, reason?: string) =>
    api.post<Prescription>(`/dispense/${id}/cancel`, { reason }),

  getWards: () => api.get<string[]>('/dispense/wards'),

  searchPatients: (q: string) =>
    api.get<Patient[]>('/dispense/patients', { params: { q } }),

  getFull: (id: number) => api.get<any>(`/dispense/${id}/full`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard & Alert APIs
// ─────────────────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getStockSummary: (days?: number) =>
    api.get<StockSummary[]>('/dashboard/stock-summary', { params: { days } }),
};

export const alertApi = {
  getAll: (params?: { is_read?: boolean; type?: string }) =>
    api.get<Alert[]>('/alerts', {
      params: {
        ...params,
        is_read: params?.is_read !== undefined ? String(params.is_read) : undefined,
      },
    }),
  markRead: (med_sid: number, alert_type: string) =>
    api.put(`/alerts/${med_sid}/read`, { alert_type }),
  markAllRead: () => api.put('/alerts/read-all'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports APIs
// ─────────────────────────────────────────────────────────────────────────────
export const reportApi = {
  getStockReport: (params: { date_from: string; date_to: string; tx_type?: string }) =>
    api.get<StockTransaction[]>('/reports/stock', { params }),

  getDispenseReport: (params: { date_from: string; date_to: string; ward?: string }) =>
    api.get<any[]>('/reports/dispense', { params }),

  getInventoryReport: () => api.get<InventoryItem[]>('/reports/inventory'),

  getTopDrugs: (params?: { date_from?: string; date_to?: string; limit?: number }) =>
    api.get<any[]>('/reports/top-drugs', { params }),

  getByCategory: (params?: { date_from?: string; date_to?: string }) =>
    api.get<any[]>('/reports/by-category', { params }),

  getByWard: (params?: { date_from?: string; date_to?: string }) =>
    api.get<any[]>('/reports/by-ward', { params }),
};

export default api;

// ─────────────────────────────────────────────────────────────────────────────
// Registry APIs
// ─────────────────────────────────────────────────────────────────────────────
export interface MedRegistryItem {
  med_id: number;
  med_name: string;
  med_generic_name: string | null;
  med_marketing_name: string;
  med_thai_name: string | null;
  med_medical_category: string | null;
  med_dosage_form: string | null;
  med_counting_unit: string;
  med_severity: string;
  med_cost_price: number;
  med_selling_price: number;
  med_medium_price: number;
  med_essential_med_list: string | null;
  med_pregnancy_category: string | null;
  med_TMT_code: string | null;
  med_TPU_code: string | null;
  med_out_of_stock: boolean;
  med_mfg: string;
  med_exp: string;
}

export interface AllergyRecord {
  allr_id: number;
  med_id: number;
  patient_id: number;
  symptoms: string;
  description: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  reported_at: string | null;
  created_at: string;
  patient_name: string;
  hn_number: string;
  med_name: string;
  med_generic_name: string | null;
}

export interface AdrRecord {
  adr_id: number;
  med_id: number;
  patient_id: number;
  description: string;
  reported_at: string;
  severity: string | null;
  outcome: string | null;
  symptoms: string | null;
  patient_name: string;
  hn_number: string;
  med_name: string;
  reporter_name: string | null;
}

export interface MedErrorRecord {
  err_med_id: number;
  time: string;
  patient_id: number;
  med_id: number;
  description: string;
  resolved: boolean;
  patient_name: string;
  hn_number: string;
  med_name: string;
  doctor_name: string;
}

export interface MedInteractionRecord {
  interaction_id: number;
  med_id_1: number;
  med_id_2: number;
  description: string;
  severity: string | null;
  interaction_type: string | null;
  evidence_level: string | null;
  drug1_name: string;
  drug2_name: string;
  interacts_with_name?: string; // alias ที่ backend คืนมาจาก getDrugById (JOIN med_table AS mt2)
}

export const registryApi = {
  getDrugs: (params?: { search?: string; category?: string; page?: number; limit?: number }) =>
    api.get<{ data: MedRegistryItem[]; total: number }>('/registry/drugs', { params }),

  getDrugById: (med_id: number) =>
    api.get<{ med: MedRegistryItem; subwarehouse: Drug[]; interactions: MedInteractionRecord[]; allergies: AllergyRecord[] }>(
      `/registry/drugs/${med_id}`
    ),

  getAllergy: (params?: { search?: string; severity?: string; patient_id?: number; page?: number; limit?: number }) =>
    api.get<{ data: AllergyRecord[]; total: number }>('/registry/allergy', { params }),

  getAdr: (params?: { search?: string; severity?: string; patient_id?: number; page?: number; limit?: number }) =>
    api.get<{ data: AdrRecord[]; total: number }>('/registry/adr', { params }),

  getMedError: (params?: { resolved?: string; page?: number; limit?: number }) =>
    api.get<{ data: MedErrorRecord[]; total: number }>('/registry/med-error', { params }),

  getInteractions: (params?: { search?: string; type?: string; page?: number; limit?: number }) =>
    api.get<{ data: MedInteractionRecord[]; total: number }>('/registry/med-interactions', { params }),

  getMedUsage: (params?: { search?: string; status?: string; patient_id?: number; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/med-usage', { params }),

  getDispenseHistory: (params?: { search?: string; status?: string; ward?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/dispense-history', { params }),

  getMedDelivery: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/delivery', { params }),

  getOverdueMed: (params?: { search?: string; dispensed?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/overdue', { params }),

  getRadRegistry: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/rad', { params }),

  getMedProblems: (params?: { search?: string; resolved?: string; type?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/med-problem', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// RAD Registry API (ยาปฏิชีวนะควบคุม)
// ─────────────────────────────────────────────────────────────────────────────
export const radApi = {
  getAll: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/registry/rad', { params }),

  create: (data: {
    med_id: number; med_sid?: number; quantity: number; unit: string;
    patient_id?: number; ward?: string;
    diagnosis: string; infection_site?: string;
    clinical_indication: string; culture_result?: string; duration_days?: number;
    prescriber_name?: string; requested_by: string;
    note?: string;
  }) => api.post('/registry/rad', data),

  update: (id: number, data: Partial<{
    quantity: number; unit: string; ward: string;
    diagnosis: string; infection_site: string;
    clinical_indication: string; culture_result: string; duration_days: number;
    prescriber_name: string; approved_by: string; status: string; note: string;
  }>) => api.put(`/registry/rad/${id}`, data),

  remove: (id: number) => api.delete(`/registry/rad/${id}`),

  approve: (id: number, approved_by: string) =>
    api.put(`/registry/rad/${id}`, { status: 'approved', approved_by }),

  reject: (id: number, approved_by: string) =>
    api.put(`/registry/rad/${id}`, { status: 'rejected', approved_by }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────────────────────────────────────
export const exportApi = {
  excel: (params: { report: string; date_from?: string; date_to?: string; ward?: string; tx_type?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return `${API_URL}/api/reports/export/excel?${qs}`;
  },
  pdf: (params: { report: string; date_from?: string; date_to?: string; ward?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return `${API_URL}/api/reports/export/pdf?${qs}`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Extra Report APIs
// ─────────────────────────────────────────────────────────────────────────────
export const extraReportApi = {
  getMedTable:         (p?: any) => api.get<any>('/reports/med-table', { params: p }),
  getMedSubwarehouse:  (p?: any) => api.get<any>('/reports/med-subwarehouse', { params: p }),
  getMedExpired:       (p?: any) => api.get<any>('/reports/med-expired', { params: p }),

  getMedOrderHistory:  (p?: any) => api.get<any>('/reports/med-order-history', { params: p }),
  getMedUsageHistory:  (p?: any) => api.get<any>('/reports/med-usage-history', { params: p }),
  getErrorMedication:  (p?: any) => api.get<any>('/reports/error-medication', { params: p }),
  getMedProblem:       (p?: any) => api.get<any>('/reports/med-problem', { params: p }),
  getMedDelivery:      (p?: any) => api.get<any>('/reports/med-delivery', { params: p }),
  getOverdueMed:       (p?: any) => api.get<any>('/reports/overdue-med', { params: p }),

  // Cut-off CRUD
  getCutOff:           (p?: any) => api.get<any>('/reports/cut-off', { params: p }),
  createCutOff:        (data: { sub_warehouse_id: number; period_month: number; period_day: number; period_time_h: number; period_time_m: number; is_active?: boolean }) =>
    api.post<any>('/reports/cut-off', data),
  executeCutOff:       (id: number) => api.post<any>(`/reports/cut-off/${id}/execute`),
  updateCutOff:        (id: number, data: Partial<{ period_month: number; period_day: number; period_time_h: number; period_time_m: number; is_active: boolean }>) =>
    api.put<any>(`/reports/cut-off/${id}`, data),
  deleteCutOff:        (id: number) => api.delete<any>(`/reports/cut-off/${id}`),

  // Sub-warehouse
  getSubWarehouses:    () => api.get<any>('/sub-warehouse'),

  getRadRegistry:      (p?: any) => api.get<any>('/reports/rad-registry', { params: p }),
  getAllergyRegistry:   (p?: any) => api.get<any>('/registry/allergy', { params: p }),
  getAdrRegistry:      (p?: any) => api.get<any>('/registry/adr', { params: p }),
  getMedInteraction:   (p?: any) => api.get<any>('/registry/med-interactions', { params: p }),
};

// ─────────────────────────────────────────────────────────────────────────────
// CRUD APIs for registry
// ─────────────────────────────────────────────────────────────────────────────
export const crudApi = {
  // med_table
  createMedTable:    (data: any) => api.post('/registry/drugs', data),
  updateMedTable:    (id: number, data: any) => api.put(`/registry/drugs/${id}`, data),
  deleteMedTable:    (id: number) => api.delete(`/registry/drugs/${id}`),

  // allergy
  createAllergy:     (data: any) => api.post('/registry/allergy', data),
  updateAllergy:     (id: number, data: any) => api.put(`/registry/allergy/${id}`, data),
  deleteAllergy:     (id: number) => api.delete(`/registry/allergy/${id}`),

  // ADR
  createAdr:         (data: any) => api.post('/registry/adr', data),
  updateAdr:         (id: number, data: any) => api.put(`/registry/adr/${id}`, data),
  deleteAdr:         (id: number) => api.delete(`/registry/adr/${id}`),

  // interactions
  createInteraction: (data: any) => api.post('/registry/med-interactions', data),
  updateInteraction: (id: number, data: any) => api.put(`/registry/med-interactions/${id}`, data),
  deleteInteraction: (id: number) => api.delete(`/registry/med-interactions/${id}`),

  // med error
  createMedError:    (data: any) => api.post('/registry/med-error', data),
  updateMedError:    (id: number, data: any) => api.put(`/registry/med-error/${id}`, data),
  deleteMedError:    (id: number) => api.delete(`/registry/med-error/${id}`),

  // RAD
  createMedRequest:  (data: any) => api.post('/registry/rad', data),
  updateMedRequest:  (id: number, data: any) => api.put(`/registry/rad/${id}`, data),
  deleteMedRequest:  (id: number) => api.delete(`/registry/rad/${id}`),

  // med_usage
  createMedUsage:    (data: any) => api.post('/registry/med-usage', data),
  updateMedUsage:    (id: number, data: any) => api.put(`/registry/med-usage/${id}`, data),

  // delivery
  createDelivery:    (data: any) => api.post('/registry/delivery', data),
  updateDelivery:    (id: number, data: any) => api.put(`/registry/delivery/${id}`, data),
  deleteDelivery:    (id: number) => api.delete(`/registry/delivery/${id}`),

  // overdue
  createOverdue:     (data: any) => api.post('/registry/overdue', data),
  updateOverdue:     (id: number, data: any) => api.put(`/registry/overdue/${id}`, data),
  deleteOverdue:     (id: number) => api.delete(`/registry/overdue/${id}`),

  // med problem
  createMedProblem:  (data: any) => api.post('/registry/med-problem', data),
  updateMedProblem:  (id: number, data: any) => api.put(`/registry/med-problem/${id}`, data),
  deleteMedProblem:  (id: number) => api.delete(`/registry/med-problem/${id}`),

  // Form helpers
  searchPatients:    (q: string) => api.get<any[]>('/form/patients', { params: { q } }),
  getUsers:          (role_id?: number) => api.get<any[]>('/auth/users', { params: role_id ? { role_id } : {} }),
  getMedList:        (search?: string) => api.get<any[]>('/drugs/med-table', { params: { search } }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Patient APIs
// ─────────────────────────────────────────────────────────────────────────────
export const patientApi = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<{ data: any[]; total: number }>('/patients', { params }),
  getById: (id: number) => api.get<any>(`/patients/${id}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Queue APIs
// ─────────────────────────────────────────────────────────────────────────────
export const queueApi = {
  getQueue:   (params?: { status?: string; date?: string }) =>
    api.get<{ data: any[]; total: number }>('/queue', { params }),
  getDisplay: () => api.get<{ current: any | null; waiting: any[] }>('/queue/display'),
  getStats:   () => api.get<{ waiting: number; called: number; completed: number; skipped: number; total: number; current_number: number }>('/queue/stats'),
  create:     (data: { patient_id?: number; note?: string; ward?: string }) => api.post<any>('/queue', data),
  call:       (id: number, called_by?: string) => api.put<any>(`/queue/${id}/call`, { called_by }),
  complete:   (id: number) => api.put<any>(`/queue/${id}/complete`),
  receive:    (id: number, received_by?: string) => api.put<any>(`/queue/${id}/receive`, { received_by }),
  skip:       (id: number) => api.put<any>(`/queue/${id}/skip`),
  remove:     (id: number) => api.delete(`/queue/${id}`),
  reset:      () => api.post<{ success: boolean; deleted: number; message: string }>('/queue/reset'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Printer APIs
// ─────────────────────────────────────────────────────────────────────────────

export interface Printer {
  Name: string;
  Status: string | null;
  InstanceId: string | null;
  DriverName: string | null;
  PortName: string | null;
  ShareName: string | null;
  PrinterStatus: number | null;
  Port: {
    Name: string;
    PortMonitor: string;
    HostAddress: string;
  } | null;
}

export const printerApi = {
  getPrinters: () => api.get<Printer[]>('/printers'),
  print: (text: string, printerName: string) =>
    api.post<{ ok: boolean; message: string }>('/print', { text, printerName }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Safety Check + Mock APIs
// ─────────────────────────────────────────────────────────────────────────────
export interface SafetyAlert {
  type: 'allergy' | 'adr' | 'interaction' | 'stock' | 'expired' | 'narcotic' | 'pregnancy';
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  note?: string;
  med_name?: string;
  severity?: string;
}
export interface SafetyCheckResult {
  prescription_id: number;
  prescription_no: string;
  patient_name: string;
  hn_number: string;
  blood_group: string | null;
  pmh: string | null;
  alert_level: 'safe' | 'warning' | 'critical';
  alert_count: number;
  alerts: SafetyAlert[];
  items: any[];
}
export const safetyApi = {
  check:       (id: number) => api.get<SafetyCheckResult>(`/dispense/${id}/safety-check`),
  checkInline: (patient_id: number | null, med_sids: number[]) =>
    api.post<SafetyCheckResult>('/dispense/safety-check-inline', { patient_id, med_sids }),
  mock:        (count = 1) => api.post<{ message: string; created: any[] }>('/dispense/mock', { count }),
  updateItems: (id: number, items: any[]) => api.put(`/dispense/${id}/items`, { items }),
  getById:     (id: number) => api.get<any>(`/dispense/${id}`),
};
