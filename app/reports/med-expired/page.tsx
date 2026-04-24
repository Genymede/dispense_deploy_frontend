'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { ColDef } from '@/components/DataTable';
import { extraReportApi } from '@/lib/api';
import { fmtDate } from '@/lib/dateUtils';
import RegistryDrawer from '@/components/RegistryDrawer';
import { TrendingDown } from 'lucide-react';

const COLS: ColDef[] = [
  { key:'drug_name', label:'ชื่อยา',
    render: r => <><p className="font-medium">{r.drug_name}</p><p className="text-xs text-slate-400">{r.packaging_type}</p></>,
    exportValue: r => r.drug_name??'-' },
  { key:'unit', label:'หน่วย', className:'text-xs' },
  { key:'med_quantity', label:'จำนวน', className:'font-semibold' },
  { key:'location', label:'ที่เก็บ', className:'text-xs font-mono' },
  { key:'exp_date', label:'หมดอายุ',
    render: r => r.exp_date ? <span className="text-red-600 font-medium">{fmtDate(r.exp_date)}</span> : '-',
    exportValue: r => fmtDate(r.exp_date) },
];

export default function MedExpiredPage() {
  const [drawer, setDrawer] = useState<any|null>(null);
  return (
    <MainLayout title="ยาหมดอายุ" subtitle="Expired Medication Report">
      <DataTable cols={COLS}
        fetcher={p => extraReportApi.getMedExpired(p).then((r:any) => ({ data:r.data.data??r.data, total:r.data.total??0 }))}
        filters={[{ key:'search', type:'search', placeholder:'ค้นหาชื่อยา...' }]}
        exportTitle="ยาหมดอายุ"
        emptyIcon={<TrendingDown size={36}/>} emptyText="ไม่พบรายการ"
        deps={[]} onRowClick={row => setDrawer(row)} />
      <RegistryDrawer open={!!drawer} onClose={() => setDrawer(null)} row={drawer}
        title={r => r.drug_name} subtitle="ยาหมดอายุ"
        fields={[
          { label:'ชื่อยา',     key:'drug_name' },
          { label:'รูปแบบ',     key:'packaging_type' },
          { label:'จำนวน',      key:'med_quantity', type:'number' as const },
          { label:'หน่วย',      key:'unit' },
          { label:'ที่เก็บ',    key:'location' },
          { label:'Lot',        key:'lot_number' },
          { label:'วันหมดอายุ', key:'exp_date', type:'date' as const },
        ]} />
    </MainLayout>
  );
}
