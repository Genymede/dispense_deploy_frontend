'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { fmtFreq } from '@/lib/drugUtils';
import { Badge } from '@/components/ui';
import { ClipboardList } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  pending:   'yellow',
  dispensed: 'green',
  returned:  'blue',
  cancelled: 'red',
};
const STATUS_TH: Record<string, string> = {
  pending:   'รอจ่าย',
  dispensed: 'จ่ายแล้ว',
  returned:  'คืนยา',
  cancelled: 'ยกเลิก',
};

const COLS: ColDef[] = [
  {
    key: 'patient_name', label: 'ผู้ป่วย',
    render: r => r.patient_name
      ? <><p className="font-medium">{r.patient_name}</p><p className="text-xs text-slate-400">{r.hn_number}</p></>
      : <span className="text-slate-400">-</span>,
    exportValue: r => r.patient_name ? `${r.patient_name} (HN: ${r.hn_number ?? '-'})` : '-',
  },
  {
    key: 'med_showname', label: 'รายการยา',
    render: r => (
      <div>
        <p className="font-medium text-sm">{r.med_showname || r.med_name}</p>
        {r.med_showname && <p className="text-xs text-slate-400">{r.med_name}</p>}
      </div>
    ),
    exportValue: r => r.med_showname || r.med_name,
  },
  { key: 'quantity',  label: 'จำนวน',    className: 'text-xs text-center',
    render: r => <span>{r.quantity}</span> },
  { key: 'frequency', label: 'วิธีใช้',  className: 'text-xs text-slate-600',
    render: r => <span>{fmtFreq(r.frequency)}</span>,
    exportValue: r => fmtFreq(r.frequency) },
  { key: 'route',     label: 'ทางที่ให้', className: 'text-xs text-slate-500' },
  { key: 'doctor_name',       label: 'แพทย์',    className: 'text-xs text-slate-600' },
  { key: 'dispensed_by_name', label: 'ผู้จ่ายยา', className: 'text-xs text-slate-600' },
  {
    key: 'status', label: 'สถานะ',
    render: r => <Badge variant={(STATUS_COLOR[r.status] ?? 'gray') as any} dot>{STATUS_TH[r.status] ?? r.status}</Badge>,
    exportValue: r => STATUS_TH[r.status] ?? r.status,
  },
  {
    key: 'dispensed_at', label: 'วันที่จ่าย',
    render: r => fmtDate(r.dispensed_at, true),
    exportValue: r => fmtDate(r.dispensed_at, true),
  },
];

export default function MedOrderHistoryPage() {
  return (
    <MainLayout title="ประวัติการจ่ายยา" subtitle="Medication Dispensing History">
      <DataTable
        cols={COLS}
        fetcher={p => extraReportApi.getMedOrderHistory(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        filters={[
          { key: 'search',    type: 'search', placeholder: 'ค้นหาผู้ป่วย / HN / ชื่อยา...' },
          { key: 'status',    type: 'select', placeholder: 'สถานะทั้งหมด',
            options: [
              { value: 'pending',   label: 'รอจ่าย' },
              { value: 'dispensed', label: 'จ่ายแล้ว' },
              { value: 'returned',  label: 'คืนยา' },
              { value: 'cancelled', label: 'ยกเลิก' },
            ]},
          { key: 'date_from', type: 'date', placeholder: 'จากวันที่' },
          { key: 'date_to',   type: 'date', placeholder: 'ถึงวันที่' },
        ]}
        exportTitle="ประวัติการจ่ายยา"
        emptyIcon={<ClipboardList size={36} />}
        emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
