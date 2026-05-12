'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef, StatusBadge } from '@/components/DataTable';
import { radApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { FileText } from 'lucide-react';

const STATUS_MAP = {
  pending:   { label: 'รอดำเนินการ', variant: 'warning' as const },
  approved:  { label: 'อนุมัติ',     variant: 'success' as const },
  rejected:  { label: 'ปฏิเสธ',      variant: 'danger'  as const },
  dispensed: { label: 'จ่ายแล้ว',    variant: 'info'    as const },
  cancelled: { label: 'ยกเลิก',      variant: 'gray'    as const },
};

const COLS: ColDef[] = [
  { key: 'med_name', label: 'ยาปฏิชีวนะ',
    render: r => <><p className="font-medium">{r.med_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => `${r.med_name ?? '-'}${r.med_generic_name ? ` (${r.med_generic_name})` : ''}` },
  { key: 'patient_name', label: 'ผู้ป่วย', className: 'text-xs',
    exportValue: r => r.patient_name ?? '-' },
  { key: 'diagnosis', label: 'การวินิจฉัย', className: 'text-xs text-slate-600 max-w-[160px] truncate',
    exportValue: r => r.diagnosis ?? '-' },
  { key: 'quantity', label: 'จำนวน',
    render: r => <span className="font-semibold">{r.quantity} {r.unit || ''}</span>,
    exportValue: r => `${r.quantity} ${r.unit || ''}` },
  { key: 'requested_by_name', label: 'ผู้ขอ', className: 'text-xs',
    exportValue: r => r.requested_by_name ?? '-' },
  { key: 'approved_by_name', label: 'ผู้อนุมัติ', className: 'text-xs text-slate-500',
    exportValue: r => r.approved_by_name ?? '-' },
  { key: 'status', label: 'สถานะ',
    render: r => <StatusBadge status={r.status} map={STATUS_MAP} />,
    exportValue: r => STATUS_MAP[r.status as keyof typeof STATUS_MAP]?.label ?? r.status ?? '-' },
  { key: 'request_time', label: 'วันที่',
    render: r => fmtDate(r.request_time),
    exportValue: r => fmtDate(r.request_time) },
];

export default function RadRegistryReportPage() {
  return (
    <MainLayout title="รายงาน RAD Registry" subtitle="Medication Request Summary">
      <DataTable cols={COLS}
        fetcher={p => radApi.getAll(p).then(r => r.data)}
        filters={[
          { key: 'status', type: 'select', placeholder: 'ทุกสถานะ',
            options: Object.entries(STATUS_MAP).map(([v, { label }]) => ({ value: v, label })) },
        ]}
        searchPlaceholder="ค้นหาชื่อยา, ผู้ป่วย, การวินิจฉัย..."
        exportTitle="รายงาน RAD Registry"
        emptyIcon={<FileText size={36} />} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
