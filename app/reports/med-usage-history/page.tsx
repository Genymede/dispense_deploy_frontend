'use client';
import { useState, useRef, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import SearchSelect from '@/components/SearchSelect';
import { Badge, Card } from '@/components/ui';
import { extraReportApi } from '@/lib/api';
import { fmtDate as safeDate } from '@/lib/dateUtils';
import { Pill, UserSearch } from 'lucide-react';

const RX_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'gray' | 'danger' }> = {
  dispensed: { label: 'จ่ายแล้ว', variant: 'success' },
  pending:   { label: 'รอจ่าย',   variant: 'warning' },
  returned:  { label: 'คืนยา',    variant: 'gray'    },
  cancelled: { label: 'ยกเลิก',   variant: 'danger'  },
};

const COLS: ColDef[] = [
  { key: 'med_name', label: 'ยา',
    render: r => <><p className="font-medium">{r.med_name ?? '—'}</p><p className="text-xs text-slate-400">{r.med_generic_name ?? ''}</p></>,
    exportValue: r => r.med_name ?? '-' },
  { key: 'quantity', label: 'จำนวน',
    render: r => <span className="text-sm">{r.quantity} {r.unit}</span>,
    exportValue: r => `${r.quantity} ${r.unit ?? ''}` },
  { key: 'dose', label: 'วิธีใช้',
    render: r => (
      <div className="text-xs text-slate-500 space-y-0.5">
        {r.dose      && <p>ขนาด: {r.dose}</p>}
        {r.frequency && <p>ความถี่: {r.frequency}</p>}
        {r.route     && <p>เส้นทาง: {r.route}</p>}
      </div>
    ),
    exportValue: r => [r.dose, r.frequency, r.route].filter(Boolean).join(' / ') || '-' },
  { key: 'doctor_name', label: 'แพทย์', className: 'text-xs text-slate-600' },
  { key: 'status', label: 'สถานะ',
    render: r => { const s = RX_STATUS[r.status] ?? { label: r.status, variant: 'gray' as const }; return <Badge variant={s.variant}>{s.label}</Badge>; },
    exportValue: r => RX_STATUS[r.status]?.label ?? r.status ?? '-' },
  { key: 'created_at', label: 'วันที่',
    render: r => safeDate(r.created_at),
    exportValue: r => safeDate(r.created_at) },
];

export default function MedUsageHistoryPage() {
  const [selectedPatient, setSelectedPatient] = useState<{ patient_id: number; full_name: string; hn_number: string } | null>(null);
  const patientRef = useRef<{ patient_id: number } | null>(null);
  const [depsKey, setDepsKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const handleSelect = (patient: any) => {
    if (!patient) {
      setSelectedPatient(null);
      patientRef.current = null;
      return;
    }
    const p = { patient_id: patient.patient_id, full_name: patient.full_name ?? `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim(), hn_number: patient.hn_number ?? '' };
    setSelectedPatient(p);
    patientRef.current = { patient_id: patient.patient_id };
    setDepsKey(k => k + 1);
  };

  const fetcher = useCallback((params: any) => {
    const pid = patientRef.current?.patient_id;
    if (!pid) return Promise.resolve({ data: [], total: 0 });
    return extraReportApi.getMedUsageHistory({ ...params, patient_id: pid })
      .then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }));
  }, []);

  const exportTitle = selectedPatient
    ? `ประวัติการใช้ยา - ${selectedPatient.full_name} (HN: ${selectedPatient.hn_number})`
    : 'ประวัติการใช้ยาผู้ป่วย';

  return (
    <MainLayout title="ประวัติการใช้ยาผู้ป่วย" subtitle="Med Reconciliation — Medication Usage History">

      {/* Patient selector */}
      <Card className="mb-4">
        <p className="text-xs font-medium text-slate-500 mb-2">เลือกผู้ป่วย</p>
        <div className="max-w-sm">
          <SearchSelect
            type="patient"
            label=""
            resetKey={resetKey}
            onSelect={handleSelect}
          />
        </div>
        {selectedPatient && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{selectedPatient.full_name}</span>
            <span className="text-slate-400">HN: {selectedPatient.hn_number}</span>
            <button
              onClick={() => { setSelectedPatient(null); patientRef.current = null; setResetKey(k => k + 1); }}
              className="ml-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              ล้าง
            </button>
          </div>
        )}
      </Card>

      {!selectedPatient ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <UserSearch size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">กรุณาเลือกผู้ป่วย</p>
          <p className="text-xs text-slate-400 mt-1">เลือกผู้ป่วยด้านบนเพื่อดูประวัติการใช้ยาและออกรายงานเฉพาะบุคคล</p>
        </Card>
      ) : (
        <DataTable
          cols={COLS}
          fetcher={fetcher}
          filters={[
            { key: 'status', type: 'select', placeholder: 'ทุกสถานะ',
              options: Object.entries(RX_STATUS).map(([v, { label }]) => ({ value: v, label })) },
            { key: 'date_from', type: 'date', placeholder: 'จากวันที่' },
            { key: 'date_to',   type: 'date', placeholder: 'ถึงวันที่' },
          ]}
          exportTitle={exportTitle}
          emptyIcon={<Pill size={36} />}
          emptyText="ไม่พบรายการยา"
          deps={[depsKey]}
        />
      )}
    </MainLayout>
  );
}
