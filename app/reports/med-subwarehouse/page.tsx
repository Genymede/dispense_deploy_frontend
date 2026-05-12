'use client';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import { Database } from 'lucide-react';

const COLS: ColDef[] = [
  {
    key: 'drug_name', label: 'ชื่อยา',
    render: r => <><p className="font-medium">{r.drug_name}</p><p className="text-xs text-slate-400">{r.med_generic_name}</p></>,
    exportValue: r => r.drug_name ?? '-'
  },
  { key: 'category', label: 'หมวด', className: 'text-xs' },
  { key: 'packaging_type', label: 'รูปแบบ', className: 'text-xs' },
  {
    key: 'med_quantity', label: 'คงเหลือ',
    render: r => <span className={Number(r.med_quantity) < (r.min_quantity ?? 0) ? 'text-red-600 font-bold' : 'font-semibold'}>{r.med_quantity}</span>,
    exportValue: r => String(r.med_quantity ?? '-')
  },
  { key: 'min_quantity', label: 'ขั้นต่ำ', className: 'text-xs text-slate-500' },
  { key: 'location', label: 'ที่เก็บ', className: 'text-xs font-mono' },
  {
    key: 'lot_count', label: 'จำนวนล็อต',
    render: r => <span className="text-sm font-medium">{r.lot_count ?? 0}</span>,
    exportValue: r => String(r.lot_count ?? 0),
  },
  {
    key: 'nearest_valid_lot_exp', label: 'หมดอายุ',
    render: r => {
      const d = r.nearest_valid_lot_exp;
      if (!d) return <span className="text-slate-300 text-xs">—</span>;
      const isNear = new Date(d) <= new Date(Date.now() + 90 * 86400_000);
      const isExp = new Date(d) < new Date();
      return <span className={isExp ? 'text-red-600 font-semibold' : isNear ? 'text-amber-600 font-medium' : ''}>{fmtDate(d)}</span>;
    },
    exportValue: r => fmtDate(r.nearest_valid_lot_exp)
  },
];

export default function MedSubwarehousePage() {
  return (
    <MainLayout title="คลังยาย่อย" subtitle="Subwarehouse Inventory Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedSubwarehouse(p).then((r: any) => ({ data: r.data.data ?? r.data, total: r.data.total ?? 0 }))}
        filters={[
          { key: 'search', type: 'search', placeholder: 'ค้นหาชื่อยา...' },
          {
            key: 'status', type: 'select', placeholder: 'ทุกสถานะ',
            options: [{ value: 'low', label: 'สต็อกต่ำ' }, { value: 'expired', label: 'หมดอายุ' }, { value: 'out', label: 'หมดสต็อก' }]
          },
        ]}
        exportTitle="คลังยาย่อย"
        emptyIcon={<Database size={36} />} emptyText="ไม่พบรายการ"
        deps={[]} />
    </MainLayout>
  );
}
