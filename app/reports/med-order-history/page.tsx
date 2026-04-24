'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
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
  { key: 'frequency', label: 'วิธีใช้',  className: 'text-xs text-slate-600' },
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
  const [drawer, setDrawer] = useState<any | null>(null);
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
        deps={[]}
        onRowClick={row => setDrawer(row)}
      />
      <RegistryDrawer
        open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title="รายละเอียดการจ่ายยา"
        subtitle={r => `${r.patient_name ?? '—'} · ${r.med_showname || r.med_name}`}
        fields={[
          { label: 'ผู้ป่วย',      key: '_patient', type: 'patient' as const },
          { label: 'เลขใบสั่งยา', key: 'prescription_no' },
          { label: 'รายการยา',    key: 'med_showname' },
          { label: 'ชื่อสามัญ',   key: 'med_name' },
          { label: 'จำนวน',       key: 'quantity' },
          { label: 'วิธีใช้',     key: 'frequency' },
          { label: 'ทางที่ให้',   key: 'route' },
          { label: 'แพทย์',       key: 'doctor_name' },
          { label: 'ผู้จ่ายยา',   key: 'dispensed_by_name' },
          { label: 'วอร์ด',       key: 'ward' },
          { label: 'วินิจฉัย',    key: 'diagnosis', span: true },
          { label: 'สถานะ',       key: 'status' },
          { label: 'วันที่สั่ง',  key: 'created_at',   type: 'datetime' as const },
          { label: 'วันที่จ่าย',  key: 'dispensed_at', type: 'datetime' as const },
        ]}
      />
    </MainLayout>
  );
}
